import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { requireHouseholdMembership } from "@/lib/auth";
import { prepareBillUpload, sanitizeBillError } from "@/lib/bills";
import { billUploadSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const parsed = billUploadSchema.safeParse({
      householdId: formData.get("householdId"),
      consentAt: formData.get("consentAt") || undefined,
    });
    const file = formData.get("file");
    if (!parsed.success || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a valid household and bill file." },
        { status: 400 },
      );
    }

    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const prepared = await prepareBillUpload(file);
    // The bucket policy authorizes by the first path segment; don't add user
    // identifiers or original filenames to this sensitive object key.
    const storagePath = `${parsed.data.householdId}/${randomUUID()}`;
    const { error: uploadError } = await supabase.storage
      .from("froskolin-bills")
      .upload(storagePath, prepared.bytes, { contentType: prepared.mimeType, upsert: false });
    if (uploadError) throw uploadError;

    const { data, error: recordError } = await supabase
      .from("bill_documents")
      .insert({
        household_id: parsed.data.householdId,
        uploader_user_id: user.id,
        storage_path: storagePath,
        detected_mime: prepared.mimeType,
        byte_count: prepared.bytes.byteLength,
        page_count: prepared.pageCount ?? null,
        status: "uploaded",
      })
      .select("id")
      .single();

    if (recordError || !data) {
      await supabase.storage.from("froskolin-bills").remove([storagePath]);
      throw recordError ?? new Error("Document record was not created.");
    }
    return NextResponse.json({ documentId: data.id }, { status: 201 });
  } catch (error) {
    const message = sanitizeBillError(error);
    const status = message.includes("access") || message.includes("sign in") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
