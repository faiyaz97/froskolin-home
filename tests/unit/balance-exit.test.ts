import { describe, expect, it } from "vitest";

import { routeDepartedSuggestions } from "@/lib/domain/balance-exit";

describe("departed member settlement routing", () => {
  it("routes offsetting direct debts between remaining members", () => {
    expect(
      routeDepartedSuggestions(
        [
          { currency: "EUR", fromMemberId: "a", toMemberId: "departed", amountCents: 1000 },
          { currency: "EUR", fromMemberId: "departed", toMemberId: "b", amountCents: 1000 },
        ],
        new Set(["departed"]),
      ),
    ).toEqual([{ currency: "EUR", fromMemberId: "a", toMemberId: "b", amountCents: 1000 }]);
  });

  it("routes an offsetting group credit to a former member's landlord bill", () => {
    expect(
      routeDepartedSuggestions(
        [
          { currency: "GBP", fromMemberId: "remaining", toMemberId: "departed", amountCents: 1000 },
          { currency: "GBP", fromMemberId: "departed", toMemberId: "landlord", amountCents: 1000 },
        ],
        new Set(["departed"]),
      ),
    ).toEqual([
      { currency: "GBP", fromMemberId: "remaining", toMemberId: "landlord", amountCents: 1000 },
    ]);
  });

  it("refuses to hide a departed member with an unsettled currency", () => {
    expect(() =>
      routeDepartedSuggestions(
        [{ currency: "EUR", fromMemberId: "departed", toMemberId: "b", amountCents: 1000 }],
        new Set(["departed"]),
      ),
    ).toThrow(/unsettled balance/i);
  });
});
