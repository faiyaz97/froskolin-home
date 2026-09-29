import { describe, expect, it } from "vitest";
import { calculateAllBalances, LANDLORD_BALANCE_ID } from "@/lib/domain/all-balances";

describe("All balance projection", () => {
  it("combines a member debt with another member's landlord balance without changing either", () => {
    const group = [
      { memberId: "alex", currency: "EUR", amountCents: -10000 },
      { memberId: "bea", currency: "EUR", amountCents: 10000 },
    ];
    const landlord = [{ memberId: "bea", currency: "EUR", amountCents: 10000 }];
    const result = calculateAllBalances(group, landlord);
    expect(result.members).toEqual([
      {
        memberId: "alex",
        currency: "EUR",
        groupCents: -10000,
        landlordCents: 0,
        combinedCents: -10000,
      },
      {
        memberId: "bea",
        currency: "EUR",
        groupCents: 10000,
        landlordCents: 10000,
        combinedCents: 0,
      },
    ]);
    expect(result.suggestions).toEqual([
      {
        fromMemberId: "alex",
        toMemberId: LANDLORD_BALANCE_ID,
        currency: "EUR",
        amountCents: 10000,
      },
    ]);
    expect(group[0].amountCents).toBe(-10000);
    expect(landlord[0].amountCents).toBe(10000);
  });

  it("keeps currencies separate and still suggests member payments", () => {
    const result = calculateAllBalances(
      [
        { memberId: "a", currency: "EUR", amountCents: -7000 },
        { memberId: "b", currency: "EUR", amountCents: 7000 },
        { memberId: "a", currency: "GBP", amountCents: -1000 },
        { memberId: "b", currency: "GBP", amountCents: 1000 },
      ],
      [{ memberId: "a", currency: "EUR", amountCents: 2000 }],
    );
    expect(result.suggestions).toEqual([
      { fromMemberId: "a", toMemberId: "b", currency: "EUR", amountCents: 7000 },
      { fromMemberId: "a", toMemberId: LANDLORD_BALANCE_ID, currency: "EUR", amountCents: 2000 },
      { fromMemberId: "a", toMemberId: "b", currency: "GBP", amountCents: 1000 },
    ]);
  });
});
