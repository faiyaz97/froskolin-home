import { NextResponse } from "next/server";

import { requireHouseholdMutation } from "@/lib/auth";
import {
  BillExtractionError,
  GeminiBillExtractor,
  analyzeBill,
  createDevelopmentBillExtractionDebugger,
  prepareBillUpload,
  sanitizeBillError,
  toBillAutofill,
} from "@/lib/bills";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = performance.now();
  let stage: "request" | "authorization" | "preparation" | "analysis" = "request";
  try {
    const formData = await request.formData();
    const householdId = formData.get("householdId");
    const consent = formData.get("consent");
    const file = formData.get("file");
    if (typeof householdId !== "string" || consent !== "true" || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a valid bill and consent to AI extraction." },
        { status: 400 },
      );
    }

    stage = "authorization";
    const { supabase } = await requireHouseholdMutation(householdId);
    const { data: group, error: groupError } = await supabase
      .from("households")
      .select("default_currency")
      .eq("id", householdId)
      .single();
    if (groupError || !group)
      return NextResponse.json(
        { error: "Group currency is unavailable. Try again later." },
        { status: 400 },
      );
    stage = "preparation";
    const preparationStartedAt = performance.now();
    const prepared = await prepareBillUpload(file);
    const preparationMs = Math.round(performance.now() - preparationStartedAt);
    const debug = createDevelopmentBillExtractionDebugger("/api/bills/extract");
    debug?.preparation(prepared);
    stage = "analysis";
    const extraction = await analyzeBill(
      prepared,
      new GeminiBillExtractor(undefined, debug),
      debug,
    );
    if (extraction.currency !== group.default_currency) {
      console.info("[bill-analysis] currency-mismatch", JSON.stringify({ route: "upload" }));
      return NextResponse.json(
        {
          error: `This bill uses ${extraction.currency}, but the group uses ${group.default_currency}. Enter a bill in the group currency.`,
        },
        { status: 422 },
      );
    }
    const autofill = toBillAutofill(extraction);
    console.info(
      "[bill-analysis] completed",
      JSON.stringify({
        route: "upload",
        pageCount: prepared.pageCount ?? null,
        inputMode: prepared.extractedText
          ? "original_pdf_with_sanitized_text"
          : prepared.pageImages?.length
            ? "rendered_page_images"
            : prepared.mimeType === "application/pdf"
              ? "original_pdf"
              : "sanitized_image",
        utilityType: extraction.utilityType,
        status: extraction.analysis?.status ?? "unknown",
        issueCount: extraction.analysis?.issues.length ?? 0,
        hasFixed: extraction.charges.fixedCents !== null,
        hasConsumption: extraction.charges.consumptionCents !== null,
        preparationMs,
        totalMs: Math.round(performance.now() - startedAt),
        responseBytes: Buffer.byteLength(JSON.stringify(autofill)),
      }),
    );
    return NextResponse.json({ extraction: autofill, pageCount: prepared.pageCount });
  } catch (error) {
    if (!(error instanceof BillExtractionError)) {
      console.error(
        "[bill-route] failed",
        JSON.stringify({ route: "upload", stage, kind: "unexpected" }),
      );
    }
    const message = sanitizeBillError(error);
    const status = message.includes("access") || message.includes("sign in") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
