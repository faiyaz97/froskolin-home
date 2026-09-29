import { describe, expect, it } from "vitest";

import { calculateBillMemberContributions } from "@/lib/domain/bill-member-contributions";
import { projectBillPaymentPlan, type OpenBillShare } from "@/lib/domain/bill-payment-plan";

const share = (memberId: string, originalShareCents: number, paidCents: number): OpenBillShare => ({
  expenseId: "bill",
  memberId,
  currency: "GBP",
  expenseDate: "2026-09-25",
  originalShareCents,
  paidCents,
  remainingCents: originalShareCents - paidCents,
});

describe("bill member contributions", () => {
  it("keeps actual cash paid by Schiavo and reconciles the full bill", () => {
    const plan = projectBillPaymentPlan(
      [share("admin", 7034, 2000), share("schiavo", 7034, 7034), share("testardo", 7032, 0)],
      [
        { fromMemberId: "admin", toMemberId: "landlord", currency: "GBP", amountCents: 3034 },
        { fromMemberId: "testardo", toMemberId: "landlord", currency: "GBP", amountCents: 9032 },
      ],
    );
    const rows = calculateBillMemberContributions(plan, [
      { memberId: "schiavo", paidByMemberId: "schiavo", amountCents: 7034 },
      { memberId: "admin", paidByMemberId: "schiavo", amountCents: 2000 },
    ]);
    expect(rows.map((row) => [row.memberId, row.toLandlordCents, row.paid])).toEqual([
      ["admin", 3034, false],
      ["schiavo", 9034, true],
      ["testardo", 9032, false],
    ]);
    expect(rows.reduce((sum, row) => sum + row.toLandlordCents, 0)).toBe(21100);
    expect(rows[0]?.coveredBy).toEqual([
      { memberId: "testardo", amountCents: 2000, recorded: false },
      { memberId: "schiavo", amountCents: 2000, recorded: true },
    ]);
    expect(rows[1]?.includes).toEqual([{ memberId: "admin", amountCents: 2000 }]);
  });

  it("shows a fully covered member as Paid without inventing a cash payment", () => {
    const plan = projectBillPaymentPlan(
      [share("admin", 5000, 5000), share("schiavo", 5000, 0)],
      [{ fromMemberId: "schiavo", toMemberId: "landlord", currency: "GBP", amountCents: 5000 }],
    );
    const rows = calculateBillMemberContributions(plan, [
      { memberId: "admin", paidByMemberId: "schiavo", amountCents: 5000 },
    ]);
    expect(rows[0]).toMatchObject({ toLandlordCents: 0, paid: true });
    expect(rows[1]).toMatchObject({ toLandlordCents: 10000, paid: false });
  });
});
