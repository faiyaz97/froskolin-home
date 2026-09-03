import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { generateDueRecurringExpenses } from "@/lib/services/recurring";

export const runtime = "nodejs";

function validCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const actualBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

export async function GET(request: Request) {
  if (!validCronSecret(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await generateDueRecurringExpenses();
    return NextResponse.json(
      { ok: result.failed === 0, ...result },
      { status: result.failed ? 207 : 200 },
    );
  } catch {
    return NextResponse.json({ error: "Recurring generation failed." }, { status: 500 });
  }
}
