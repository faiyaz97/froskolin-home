import { describe, expect, it } from "vitest";
import {
  calculateBalances,
  calculateEqualShares,
  calculateExactShares,
  calculatePercentageShares,
  calculatePresenceDays,
  calculateUtilityShares,
  enumerateDueOccurrences,
  normalizeAbsenceRanges,
  simplifyDebts,
} from "@/lib/domain";
import { recurringExpenseRuleSchema } from "@/lib/validation";

describe("normal expense splits", () => {
  it("splits equal shares and allocates remainder in participant order", () => {
    expect(calculateEqualShares(10, ["a", "b", "c"])).toEqual([
      { memberId: "a", amountCents: 4 },
      { memberId: "b", amountCents: 3 },
      { memberId: "c", amountCents: 3 },
    ]);
  });

  it("requires exact splits to conserve every cent", () => {
    expect(
      calculateExactShares(100, [
        { memberId: "a", amountCents: 40 },
        { memberId: "b", amountCents: 60 },
      ]),
    ).toHaveLength(2);
    expect(() => calculateExactShares(100, [{ memberId: "a", amountCents: 99 }])).toThrow(/total/);
  });

  it("uses basis points and largest-remainder rounding for percentage splits", () => {
    expect(
      calculatePercentageShares(101, [
        { memberId: "a", basisPoints: 3333 },
        { memberId: "b", basisPoints: 3333 },
        { memberId: "c", basisPoints: 3334 },
      ]),
    ).toEqual([
      { memberId: "a", amountCents: 34 },
      { memberId: "b", amountCents: 33 },
      { memberId: "c", amountCents: 34 },
    ]);
    expect(() => calculatePercentageShares(100, [{ memberId: "a", basisPoints: 9_999 }])).toThrow(
      /10,000/,
    );
  });
});

describe("inclusive occupancy calendar", () => {
  it("merges overlapping and adjacent absence inputs", () => {
    expect(
      normalizeAbsenceRanges([
        { startDate: "2028-08-04", endDate: "2028-08-06" },
        { startDate: "2028-08-01", endDate: "2028-08-03" },
        { startDate: "2028-08-06", endDate: "2028-08-08" },
      ]),
    ).toEqual([{ startDate: "2028-08-01", endDate: "2028-08-08" }]);
  });

  it("counts no away days, one away range, and full-period absence inclusively", () => {
    const period = { startDate: "2028-05-01", endDate: "2028-05-31" };
    expect(calculatePresenceDays(period, [])).toBe(31);
    expect(
      calculatePresenceDays(period, [{ startDate: "2028-05-10", endDate: "2028-05-20" }]),
    ).toBe(20);
    expect(calculatePresenceDays(period, [period])).toBe(0);
  });

  it("handles multiple ranges, cross-month/year periods, and leap years", () => {
    expect(
      calculatePresenceDays({ startDate: "2028-02-27", endDate: "2028-03-02" }, [
        { startDate: "2028-02-28", endDate: "2028-02-29" },
        { startDate: "2028-03-01", endDate: "2028-03-01" },
      ]),
    ).toBe(2);
    expect(
      calculatePresenceDays({ startDate: "2028-12-30", endDate: "2029-01-02" }, [
        { startDate: "2028-12-31", endDate: "2029-01-01" },
      ]),
    ).toBe(2);
  });
});

describe("smart utility splitting", () => {
  it("splits fixed equally and variable by occupancy", () => {
    const result = calculateUtilityShares({
      totalCents: 10_000,
      fixedCents: 4_000,
      variableCents: 6_000,
      servicePeriod: { startDate: "2028-05-01", endDate: "2028-05-31" },
      participants: [
        { memberId: "andrea" },
        { memberId: "luca" },
        { memberId: "marco", absenceRanges: [{ startDate: "2028-05-21", endDate: "2028-05-31" }] },
        { memberId: "sarah", absenceRanges: [{ startDate: "2028-05-11", endDate: "2028-05-31" }] },
      ],
    });
    expect(result.totalPresenceDays).toBe(92);
    expect(result.variableMode).toBe("occupancy");
    expect(result.shares.map((share) => share.amountCents).reduce((a, b) => a + b, 0)).toBe(10_000);
    expect(result.shares[0]).toMatchObject({
      fixedCents: 1_000,
      presenceDays: 31,
      variableCents: 2_022,
    });
  });

  it("keeps a positive fixed portion and uses equal variable fallback when nobody is present", () => {
    const result = calculateUtilityShares({
      totalCents: 11,
      fixedCents: 5,
      variableCents: 6,
      servicePeriod: { startDate: "2028-01-01", endDate: "2028-01-01" },
      participants: [
        { memberId: "a", absenceRanges: [{ startDate: "2028-01-01", endDate: "2028-01-01" }] },
        { memberId: "b", absenceRanges: [{ startDate: "2028-01-01", endDate: "2028-01-01" }] },
      ],
    });
    expect(result.variableMode).toBe("equal_zero_presence_fallback");
    expect(result.shares).toEqual([
      { memberId: "a", fixedCents: 3, variableCents: 3, presenceDays: 0, amountCents: 6 },
      { memberId: "b", fixedCents: 2, variableCents: 3, presenceDays: 0, amountCents: 5 },
    ]);
  });

  it("breaks non-divisible all-away fallback cents by participant order", () => {
    const result = calculateUtilityShares({
      totalCents: 10,
      fixedCents: 4,
      variableCents: 6,
      servicePeriod: { startDate: "2029-01-01", endDate: "2029-01-02" },
      participants: ["a", "b", "c", "d"].map((memberId) => ({
        memberId,
        absenceRanges: [{ startDate: "2029-01-01", endDate: "2029-01-02" }],
      })),
    });

    expect(result.variableMode).toBe("equal_zero_presence_fallback");
    expect(result.shares.map((share) => share.variableCents)).toEqual([2, 2, 1, 1]);
    expect(result.shares.map((share) => share.amountCents)).toEqual([3, 3, 2, 2]);
  });

  it("always preserves fixed, variable, and final total cents during rounding", () => {
    const result = calculateUtilityShares({
      totalCents: 101,
      fixedCents: 1,
      variableCents: 100,
      servicePeriod: { startDate: "2028-06-01", endDate: "2028-06-03" },
      participants: [{ memberId: "a" }, { memberId: "b" }, { memberId: "c" }],
    });
    expect(result.shares.reduce((sum, share) => sum + share.fixedCents, 0)).toBe(1);
    expect(result.shares.reduce((sum, share) => sum + share.variableCents, 0)).toBe(100);
    expect(result.shares.reduce((sum, share) => sum + share.amountCents, 0)).toBe(101);
  });

  it("conserves every cent across a range of totals and occupancy weights", () => {
    for (let totalCents = 0; totalCents <= 257; totalCents += 1) {
      const fixedCents = Math.floor(totalCents / 3);
      const result = calculateUtilityShares({
        totalCents,
        fixedCents,
        variableCents: totalCents - fixedCents,
        servicePeriod: { startDate: "2028-02-01", endDate: "2028-02-29" },
        participants: [
          { memberId: "a" },
          { memberId: "b", absenceRanges: [{ startDate: "2028-02-01", endDate: "2028-02-07" }] },
          { memberId: "c", absenceRanges: [{ startDate: "2028-02-01", endDate: "2028-02-19" }] },
        ],
      });

      expect(result.shares.reduce((sum, share) => sum + share.amountCents, 0)).toBe(totalCents);
    }
  });
});

describe("derived balances and settlements", () => {
  it("supports a payer who is not a participant and keeps currencies separate", () => {
    const balances = calculateBalances(
      [
        {
          payerMemberId: "owner",
          currency: "EUR",
          totalCents: 1000,
          shares: [
            { memberId: "a", amountCents: 500 },
            { memberId: "b", amountCents: 500 },
          ],
        },
        {
          payerMemberId: "a",
          currency: "USD",
          totalCents: 200,
          shares: [{ memberId: "a", amountCents: 200 }],
        },
      ],
      [{ payingMemberId: "a", receivingMemberId: "owner", currency: "EUR", amountCents: 200 }],
    );
    expect(balances).toEqual([
      { memberId: "a", currency: "EUR", amountCents: -300 },
      { memberId: "b", currency: "EUR", amountCents: -500 },
      { memberId: "owner", currency: "EUR", amountCents: 800 },
      { memberId: "a", currency: "USD", amountCents: 0 },
    ]);
  });

  it("simplifies balanced debts deterministically", () => {
    expect(
      simplifyDebts([
        { memberId: "andrea", currency: "EUR", amountCents: 130 },
        { memberId: "luca", currency: "EUR", amountCents: -60 },
        { memberId: "marco", currency: "EUR", amountCents: -45 },
        { memberId: "sarah", currency: "EUR", amountCents: -25 },
      ]),
    ).toEqual([
      { currency: "EUR", fromMemberId: "luca", toMemberId: "andrea", amountCents: 60 },
      { currency: "EUR", fromMemberId: "marco", toMemberId: "andrea", amountCents: 45 },
      { currency: "EUR", fromMemberId: "sarah", toMemberId: "andrea", amountCents: 25 },
    ]);
  });
});

describe("monthly recurrence", () => {
  it("clamps a month-end anchor without drifting and excludes known generated occurrences", () => {
    expect(enumerateDueOccurrences({ startDate: "2028-01-31", throughDate: "2028-05-31" })).toEqual(
      ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30", "2028-05-31"],
    );
    expect(
      enumerateDueOccurrences({
        startDate: "2028-01-31",
        throughDate: "2028-03-31",
        generatedOccurrenceDates: ["2028-01-31", "2028-02-29"],
      }),
    ).toEqual(["2028-03-31"]);
  });

  it("rejects recurring exact and percentage configurations that do not conserve the rule", () => {
    const base = {
      householdId: "00000000-0000-4000-8000-000000000001",
      title: "Internet",
      amountCents: 2400,
      currency: "EUR",
      payerMemberId: "00000000-0000-4000-8000-000000000002",
      startDate: "2028-01-31",
      active: true,
    };
    expect(
      recurringExpenseRuleSchema.safeParse({
        ...base,
        splitConfig: {
          method: "exact",
          participants: [
            {
              memberId: "00000000-0000-4000-8000-000000000002",
              order: 0,
              amountCents: 2399,
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      recurringExpenseRuleSchema.safeParse({
        ...base,
        splitConfig: {
          method: "percentage",
          participants: [
            {
              memberId: "00000000-0000-4000-8000-000000000002",
              order: 0,
              basisPoints: 9999,
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});
