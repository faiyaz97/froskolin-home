import { NextResponse } from "next/server";

import { requireHouseholdMembership } from "@/lib/auth";
import { GeminiBillExtractor, prepareBillUpload, sanitizeBillError } from "@/lib/bills";

export const runtime = "nodejs";

type Context = { params: Promise<{ documentId: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const { documentId } = await params;
    const body = (await request.json().catch(() => null)) as {
      householdId?: unknown;
      consent?: unknown;
    } | null;
    if (!body || typeof body.householdId !== "string" || body.consent !== true) {
      return NextResponse.json(
        { error: "Explicit consent is required before extraction." },
        { status: 400 },
      );
    }
    const { supabase } = await requireHouseholdMembership(body.householdId);
    const { data: document, error } = await supabase
      .from("bill_documents")
      .select("id, household_id, storage_path, detected_mime, byte_count, status")
      .eq("id", documentId)
      .eq("household_id", body.householdId)
      .maybeSingle();
    if (error || !document) return NextResponse.json({ error: "Bill not found." }, { status: 404 });

    const consentAt = new Date().toISOString();
    const { error: statusError } = await supabase
      .from("bill_documents")
      .update({
        status: "extracting",
        gemini_consent_at: consentAt,
        provider: "gemini",
        model: "gemini-3.1-flash-lite",
        extraction_schema_version: "1",
        sanitized_error: null,
      })
      .eq("id", documentId)
      .eq("household_id", body.householdId);
    if (statusError) throw statusError;

    try {
      const { data: download, error: downloadError } = await supabase.storage
        .from("froskolin-bills")
        .download(document.storage_path);
      if (downloadError || !download) throw downloadError ?? new Error("Bill download failed.");

      const file = new File([await download.arrayBuffer()], "bill", {
        type: document.detected_mime,
      });
      const prepared = await prepareBillUpload(file);
      const extracted = await new GeminiBillExtractor().extract(prepared);
      const { error: updateError } = await supabase
        .from("bill_documents")
        .update({
          status: "ready",
          extraction: extracted,
          confidence: extracted.extractionConfidence,
          evidence: extracted.evidence,
          sanitized_error: null,
        })
        .eq("id", documentId)
        .eq("household_id", body.householdId);
      if (updateError) throw updateError;
      return NextResponse.json({ extraction: extracted });
    } catch (error) {
      const message = sanitizeBillError(error);
      await supabase
        .from("bill_documents")
        .update({ status: "failed", sanitized_error: message })
        .eq("id", documentId)
        .eq("household_id", body.householdId);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: sanitizeBillError(error) }, { status: 400 });
  }
}
