import { describe, expect, it } from "vitest";

import { calculateLandlordRemainingCents, totalLandlordOutstanding } from "@/lib/domain";

describe("landlord balances", () => {
  it("subtracts partial payments without modifying the original share", () => {
    expect(calculateLandlordRemainingCents(7_420, [2_500, 900])).toBe(4_020);
  });

  it("reaches zero after a full payment", () => {
    expect(calculateLandlordRemainingCents(7_420, [2_500, 4_920])).toBe(0);
  });

  it("does not produce a negative outstanding balance if a later edit lowers the share", () => {
    expect(calculateLandlordRemainingCents(2_000, [2_500])).toBe(0);
  });

  it("keeps totals separate by currency", () => {
    expect(
      totalLandlordOutstanding([
        { currency: "EUR", originalShareCents: 8_000, paymentCents: [2_000] },
        { currency: "EUR", originalShareCents: 1_500, paymentCents: [] },
        { currency: "GBP", originalShareCents: 4_000, paymentCents: [1_000] },
      ]),
    ).toEqual([
      { currency: "EUR", amountCents: 7_500 },
      { currency: "GBP", amountCents: 3_000 },
    ]);
  });
});
