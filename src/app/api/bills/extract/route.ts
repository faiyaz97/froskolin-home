import { NextResponse } from "next/server";

import { requireHouseholdMutation } from "@/lib/auth";
import {
  BillExtractionError,
  GeminiBillExtractor,
  analyzeBill,
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
    stage = "analysis";
    const extraction = await analyzeBill(prepared, new GeminiBillExtractor());
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
