import { describe, expect, it } from "vitest";

import { calculateConstrainedAllBalances } from "@/lib/domain/constrained-all-balances";
import { projectBillPaymentPlan, type OpenBillShare } from "@/lib/domain/bill-payment-plan";

const share = (memberId: string, paidCents: number): OpenBillShare => ({
  expenseId: "bill",
  memberId,
  currency: "GBP",
  expenseDate: "2026-09-25",
  originalShareCents: 5000,
  paidCents,
  remainingCents: 5000 - paidCents,
});

describe("paid bill locks", () => {
  it("routes a later debt through the unpaid member instead of reopening a paid bill contribution", () => {
    const shares = [share("admin", 5000), share("testardo", 0)];
    const plan = calculateConstrainedAllBalances(
      [
        { memberId: "admin", currency: "GBP", amountCents: -5000 },
        { memberId: "testardo", currency: "GBP", amountCents: 5000 },
      ],
      shares,
    );
    expect(plan.suggestions).toEqual([
      { fromMemberId: "admin", toMemberId: "testardo", currency: "GBP", amountCents: 5000 },
      { fromMemberId: "testardo", toMemberId: "landlord", currency: "GBP", amountCents: 5000 },
    ]);
    const allocations = projectBillPaymentPlan(shares, plan.suggestions);
    expect(allocations[0]?.plannedPayers).toEqual([]);
    expect(allocations[1]?.plannedPayers).toEqual([{ memberId: "testardo", amountCents: 5000 }]);
  });
});
