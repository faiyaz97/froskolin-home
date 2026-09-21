import { NextResponse } from "next/server";

import { requireHouseholdMutation } from "@/lib/auth";
import {
  BillExtractionError,
  GeminiBillExtractor,
  analyzeBill,
  createDevelopmentBillExtractionDebugger,
  prepareBillUpload,
  sanitizeBillError,
} from "@/lib/bills";

export const runtime = "nodejs";

export async function POST(request: Request) {
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
    await requireHouseholdMutation(householdId);
    stage = "preparation";
    const prepared = await prepareBillUpload(file);
    const debug = createDevelopmentBillExtractionDebugger("/api/bills/extract");
    debug?.preparation(prepared);
    stage = "analysis";
    const extraction = await analyzeBill(
      prepared,
      new GeminiBillExtractor(undefined, debug),
      debug,
    );
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
      }),
    );
    return NextResponse.json({ extraction, pageCount: prepared.pageCount });
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
