import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireHouseholdMembership } from "@/lib/auth";
import { prepareBillUpload, sanitizeBillError } from "@/lib/bills";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ expenseId: string }> };

function cleanFileName(value: string) {
  return (
    value
      .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "")
      .trim()
      .slice(0, 160) || "Attachment"
  );
}

async function authorizeExpense(householdId: string, expenseId: string) {
  const auth = await requireHouseholdMembership(householdId);
  const { data: expense, error } = await auth.supabase
    .from("expenses")
    .select("id, title, voided_at")
    .eq("id", expenseId)
    .eq("household_id", householdId)
    .maybeSingle();
  if (error || !expense || expense.voided_at) throw new Error("Expense not found.");
  return { ...auth, expense };
}

async function writeAudit({
  householdId,
  userId,
  attachmentId,
  expenseId,
  expenseTitle,
  action,
  mimeType,
  byteCount,
}: {
  householdId: string;
  userId: string;
  attachmentId: string;
  expenseId: string;
  expenseTitle: string;
  action: "attached" | "removed";
  mimeType: string;
  byteCount: number;
}) {
  await createAdminClient()
    .from("audit_events")
    .insert({
      household_id: householdId,
      actor_user_id: userId,
      action_type: "updated",
      entity_type: "expense_attachment",
      entity_id: attachmentId,
      previous_values: action === "removed" ? { expenseId, mimeType, byteCount } : null,
      new_values: action === "attached" ? { expenseId, mimeType, byteCount } : null,
      summary:
        action === "attached"
          ? `A household member attached a file to ${expenseTitle}.`
          : `A household member removed the attachment from ${expenseTitle}.`,
    });
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { expenseId } = await params;
    const householdId = new URL(request.url).searchParams.get("householdId");
    if (!householdId) throw new Error("Household is required.");
    const { supabase } = await authorizeExpense(householdId, expenseId);
    const { data: attachment, error } = await supabase
      .from("expense_attachments")
      .select("storage_path")
      .eq("expense_id", expenseId)
      .eq("household_id", householdId)
      .is("removed_at", null)
      .maybeSingle();
    if (error || !attachment)
      return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    const { data, error: signedUrlError } = await supabase.storage
      .from("froskolin-bills")
      .createSignedUrl(attachment.storage_path, 60);
    if (signedUrlError || !data?.signedUrl)
      throw signedUrlError ?? new Error("Could not open attachment.");
    return NextResponse.redirect(data.signedUrl);
  } catch {
    return NextResponse.json(
      { error: "You do not have access to this attachment." },
      { status: 403 },
    );
  }
}

export async function POST(request: Request, { params }: Context) {
  let storagePath: string | undefined;
  try {
    const { expenseId } = await params;
    const formData = await request.formData();
    const householdId = String(formData.get("householdId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a valid attachment." }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Attachments must be 4 MiB or smaller." }, { status: 400 });
    }
    const { supabase, user, expense } = await authorizeExpense(householdId, expenseId);
    const prepared = await prepareBillUpload(file);
    storagePath = `${householdId}/${randomUUID()}`;
    const { error: uploadError } = await supabase.storage
      .from("froskolin-bills")
      .upload(storagePath, prepared.bytes, { contentType: prepared.mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const { data: previous } = await supabase
      .from("expense_attachments")
      .select("id, storage_path")
      .eq("expense_id", expenseId)
      .eq("household_id", householdId)
      .is("removed_at", null)
      .maybeSingle();
    if (previous) {
      const { error } = await supabase
        .from("expense_attachments")
        .update({ removed_at: new Date().toISOString() })
        .eq("id", previous.id);
      if (error) throw error;
    }

    const { data: attachment, error: recordError } = await supabase
      .from("expense_attachments")
      .insert({
        household_id: householdId,
        expense_id: expenseId,
        uploader_user_id: user.id,
        storage_path: storagePath,
        original_file_name: cleanFileName(file.name),
        detected_mime: prepared.mimeType,
        byte_count: prepared.bytes.byteLength,
      })
      .select("id, original_file_name")
      .single();
    if (recordError || !attachment) {
      if (previous) {
        await supabase
          .from("expense_attachments")
          .update({ removed_at: null })
          .eq("id", previous.id);
      }
      throw recordError ?? new Error("Attachment record was not created.");
    }
    if (previous) await supabase.storage.from("froskolin-bills").remove([previous.storage_path]);
    await writeAudit({
      householdId,
      userId: user.id,
      attachmentId: attachment.id,
      expenseId,
      expenseTitle: expense.title,
      action: "attached",
      mimeType: prepared.mimeType,
      byteCount: prepared.bytes.byteLength,
    });
    return NextResponse.json(
      { attachmentId: attachment.id, fileName: attachment.original_file_name },
      { status: 201 },
    );
  } catch (error) {
    const householdId = storagePath?.split("/")[0];
    if (storagePath && householdId) {
      try {
        const { supabase } = await requireHouseholdMembership(householdId);
        await supabase.storage.from("froskolin-bills").remove([storagePath]);
      } catch {
        // Best-effort cleanup after a failed record write.
      }
    }
    return NextResponse.json({ error: sanitizeBillError(error) }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    const { expenseId } = await params;
    const body = (await request.json()) as { householdId?: string };
    const householdId = String(body.householdId ?? "");
    const { supabase, user, expense } = await authorizeExpense(householdId, expenseId);
    const { data: attachment, error } = await supabase
      .from("expense_attachments")
      .select("id, storage_path, detected_mime, byte_count")
      .eq("expense_id", expenseId)
      .eq("household_id", householdId)
      .is("removed_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!attachment) return new NextResponse(null, { status: 204 });
    const { error: updateError } = await supabase
      .from("expense_attachments")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", attachment.id);
    if (updateError) throw updateError;
    await supabase.storage.from("froskolin-bills").remove([attachment.storage_path]);
    await writeAudit({
      householdId,
      userId: user.id,
      attachmentId: attachment.id,
      expenseId,
      expenseTitle: expense.title,
      action: "removed",
      mimeType: attachment.detected_mime,
      byteCount: attachment.byte_count,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json({ error: sanitizeBillError(error) }, { status: 400 });
  }
}
