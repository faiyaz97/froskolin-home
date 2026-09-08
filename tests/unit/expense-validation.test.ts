import { describe, expect, it } from "vitest";

import { expenseInputSchema } from "@/lib/validation";

const validExpense = {
  householdId: "11111111-1111-4111-8111-111111111111",
  title: "Groceries",
  totalCents: 1200,
  currency: "EUR",
  payerMemberId: "22222222-2222-4222-8222-222222222222",
  expenseDate: "2026-09-08",
  splitConfig: {
    method: "equal" as const,
    participants: [{ memberId: "22222222-2222-4222-8222-222222222222", order: 0 }],
  },
};

describe("expense notes", () => {
  it("accepts an optional note up to 500 characters", () => {
    expect(expenseInputSchema.safeParse({ ...validExpense, note: "Paid in cash" }).success).toBe(
      true,
    );
    expect(expenseInputSchema.safeParse({ ...validExpense, note: "n".repeat(501) }).success).toBe(
      false,
    );
  });
});
