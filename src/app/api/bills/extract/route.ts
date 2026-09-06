import { NextResponse } from "next/server";

import { requireHouseholdMembership } from "@/lib/auth";
import { GeminiBillExtractor, prepareBillUpload, sanitizeBillError } from "@/lib/bills";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

    await requireHouseholdMembership(householdId);
    const prepared = await prepareBillUpload(file);
    const extraction = await new GeminiBillExtractor().extract(prepared);
    return NextResponse.json({ extraction, pageCount: prepared.pageCount });
  } catch (error) {
    const message = sanitizeBillError(error);
    const status = message.includes("access") || message.includes("sign in") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
