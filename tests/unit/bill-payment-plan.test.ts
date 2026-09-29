import { describe, expect, it } from "vitest";

import { projectBillPaymentPlan, type OpenBillShare } from "@/lib/domain/bill-payment-plan";

const billDate = "2026-09-25";
const share = (
  expenseId: string,
  memberId: string,
  originalShareCents: number,
  paidCents = 0,
): OpenBillShare => ({
  expenseId,
  memberId,
  currency: "GBP",
  expenseDate: billDate,
  originalShareCents,
  paidCents,
  remainingCents: originalShareCents - paidCents,
});

describe("projectBillPaymentPlan", () => {
  it("shows the owner's current due separately from a planned payment on their behalf", () => {
    const rows = projectBillPaymentPlan(
      [share("bill", "admin", 7034, 2000), share("bill", "testardo", 7032, 0)],
      [
        { currency: "GBP", fromMemberId: "admin", toMemberId: "landlord", amountCents: 3034 },
        {
          currency: "GBP",
          fromMemberId: "testardo",
          toMemberId: "landlord",
          amountCents: 9032,
        },
      ],
    );
    expect(rows[0]).toMatchObject({
      originalShareCents: 7034,
      paidCents: 2000,
      remainingCents: 5034,
      currentDueCents: 3034,
      coveredByOthersCents: 2000,
    });
    expect(rows[1]).toMatchObject({ currentDueCents: 9032, coveredByOthersCents: 0 });
  });

  it("never reopens a fully paid share when later expenses change the plan", () => {
    const rows = projectBillPaymentPlan(
      [share("bill", "admin", 5000, 5000), share("bill", "schiavo", 5000)],
      [{ currency: "GBP", fromMemberId: "admin", toMemberId: "landlord", amountCents: 5000 }],
    );
    expect(rows[0]).toMatchObject({ currentDueCents: 0, coveredByOthersCents: 0 });
    expect(rows[1]).toMatchObject({ currentDueCents: 0, coveredByOthersCents: 5000 });
  });

  it("uses the same own-share-first ordering as the payment recorder", () => {
    const rows = projectBillPaymentPlan(
      [share("old", "admin", 1000), share("new", "admin", 1000), share("old", "other", 1000)],
      [
        { currency: "GBP", fromMemberId: "admin", toMemberId: "landlord", amountCents: 2500 },
        { currency: "GBP", fromMemberId: "other", toMemberId: "landlord", amountCents: 500 },
      ],
    );
    expect(rows.map((row) => row.currentDueCents)).toEqual([1500, 1000, 500]);
  });

  it("keeps each debtor's offset on the earlier bill when another bill is added", () => {
    const first = "b680c9fa";
    const second = "02880b33"; // UUID order differs from creation order.
    const shares: OpenBillShare[] = [
      { ...share(first, "admin", 8412), createdAt: "2026-09-28T12:23:00Z" },
      { ...share(first, "testardo", 8412), createdAt: "2026-09-28T12:23:00Z" },
      { ...share(first, "schiavo", 4276), createdAt: "2026-09-28T12:23:00Z" },
      { ...share(second, "admin", 8413), createdAt: "2026-09-28T18:32:00Z" },
      { ...share(second, "testardo", 8412), createdAt: "2026-09-28T18:32:00Z" },
      { ...share(second, "schiavo", 4275), createdAt: "2026-09-28T18:32:00Z" },
    ];
    const plan = projectBillPaymentPlan(shares, [
      { currency: "GBP", fromMemberId: "admin", toMemberId: "landlord", amountCents: 12825 },
      { currency: "GBP", fromMemberId: "testardo", toMemberId: "landlord", amountCents: 18824 },
      { currency: "GBP", fromMemberId: "schiavo", toMemberId: "landlord", amountCents: 10551 },
    ]);
    expect(
      plan.find((row) => row.expenseId === first && row.memberId === "admin")?.plannedPayers,
    ).toEqual([
      { memberId: "admin", amountCents: 8412 - 4000 },
      { memberId: "testardo", amountCents: 2000 },
      { memberId: "schiavo", amountCents: 2000 },
    ]);
    expect(
      plan.find((row) => row.expenseId === first && row.memberId === "testardo")?.currentDueCents,
    ).toBe(10412);
    expect(
      plan.find((row) => row.expenseId === first && row.memberId === "schiavo")?.currentDueCents,
    ).toBe(6276);
  });

  it("applies an active payer's cash to a departed member's unpaid share first", () => {
    const rows = projectBillPaymentPlan(
      [share("bill", "active", 5000), share("bill", "departed", 5000)],
      [
        { currency: "GBP", fromMemberId: "active", toMemberId: "landlord", amountCents: 5000 },
        { currency: "GBP", fromMemberId: "other", toMemberId: "landlord", amountCents: 5000 },
      ],
      new Set(["departed"]),
    );
    expect(rows[0]?.plannedPayers).toEqual([{ memberId: "other", amountCents: 5000 }]);
    expect(rows[1]?.plannedPayers).toEqual([{ memberId: "active", amountCents: 5000 }]);
    expect(rows[1]?.coveredByOthersCents).toBe(5000);
  });
});
