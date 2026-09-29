import { describe, expect, it } from "vitest";

import { groupLandlordPayments, type RawLandlordPayment } from "@/lib/queries/feed";

function payment(overrides: Partial<RawLandlordPayment> = {}): RawLandlordPayment {
  return {
    id: "payment-one",
    all_payment_id: "transfer-one",
    linked_settlement_id: null,
    expense_id: "bill-one",
    paid_by_member_id: "member-one",
    amount_cents: 2_000,
    payment_date: "2026-09-24",
    created_at: "2026-09-24T12:00:00Z",
    expenses: { title: "Gas bill", currency: "EUR", utility_bills: { utility_type: "gas" } },
    payer: { display_name: "Andrea" },
    ...overrides,
  };
}

describe("Home landlord payment feed grouping", () => {
  it("shows one physical transfer for several bill allocation rows", () => {
    const [result] = groupLandlordPayments([
      payment(),
      payment({
        id: "payment-two",
        expense_id: "bill-two",
        amount_cents: 3_000,
        expenses: {
          title: "Electricity bill",
          currency: "EUR",
          utility_bills: { utility_type: "electricity" },
        },
      }),
    ]);

    expect(result).toMatchObject({
      id: "transfer-one",
      expenseId: "bill-one",
      title: "Gas bill",
      utilityType: "gas",
      amountCents: 5_000,
      paidByName: "Andrea",
      affectedBillCount: 2,
    });
  });

  it("keeps legacy ungrouped payments as separate feed rows", () => {
    const result = groupLandlordPayments([
      payment({ id: "payment-one", all_payment_id: null }),
      payment({ id: "payment-two", all_payment_id: null, amount_cents: 3_000 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((row) => row.amountCents)).toEqual(expect.arrayContaining([2_000, 3_000]));
  });
});
