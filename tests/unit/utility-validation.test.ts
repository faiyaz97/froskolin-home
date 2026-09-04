import { describe, expect, it } from "vitest";

import { utilityConfirmationSchema } from "@/lib/validation";

const validBill = {
  householdId: "11111111-1111-4111-8111-111111111111",
  title: "Electricity bill",
  utilityType: "electricity",
  serviceStart: "2026-08-01",
  serviceEnd: "2026-08-31",
  totalCents: 10_000,
  fixedCents: 4_000,
  variableCents: 6_000,
  currency: "EUR",
  payerMemberId: "22222222-2222-4222-8222-222222222222",
  participants: [{ memberId: "22222222-2222-4222-8222-222222222222", order: 0 }],
};

describe("utility bill entry mode", () => {
  it("accepts the internal landlord payer selection", () => {
    expect(
      utilityConfirmationSchema.safeParse({
        ...validBill,
        payerMemberId: "landlord",
        entryMode: "manual",
      }).success,
    ).toBe(true);
  });

  it.each(["ai", "manual"] as const)("accepts %s as a saved source", (entryMode) => {
    expect(utilityConfirmationSchema.parse({ ...validBill, entryMode }).entryMode).toBe(entryMode);
  });

  it("rejects an unknown source", () => {
    expect(
      utilityConfirmationSchema.safeParse({ ...validBill, entryMode: "automatic" }).success,
    ).toBe(false);
  });
});
