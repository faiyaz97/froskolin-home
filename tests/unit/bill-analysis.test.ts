import { describe, expect, it } from "vitest";
import { normalizeExtractedBillBuckets } from "@/lib/bills/normalize-extraction";
import { structuredBillExtractionSchema, extractedBillSchema } from "@/lib/validation";
import { charge, rawBill, vat, gasSummaryReference } from "../fixtures/bill-analysis";

describe("deterministic bill analysis", () => {
  it("does not disguise a material unknown adjustment as rounding", () => {
    const result = normalizeExtractedBillBuckets(
      rawBill({
        totalDueCents: 11000,
        lineItems: [...rawBill().lineItems, charge("large", 1000, "unknown", { kind: "rounding" })],
      }),
    );
    expect(result.analysis?.status).toBe("needs_review");
  });

  it("uses stable cent allocation for mixed VAT and never loses money", () => {
    for (let f = 1; f <= 10; f++)
      for (let u = 1; u <= 10; u++) {
        const tax = Math.round((f + u) * 0.22);
        const result = normalizeExtractedBillBuckets(
          rawBill({
            totalDueCents: f + u + tax,
            lineItems: [charge("fixed", f, "fixed"), charge("usage", u, "usage")],
            vatLines: [vat("vat", tax, f + u, 2200, ["fixed", "usage"])],
          }),
        );
        expect(result.analysis?.status).toBe("ready");
        expect(result.charges.fixedCents! + result.charges.consumptionCents!).toBe(f + u + tax);
        expect(
          result.analysis?.allocations.reduce(
            (sum, row) => sum + row.fixedCents + row.usageCents,
            0,
          ),
        ).toBe(f + u + tax);
      }
  });
  it("sums extracted costs without accepting AI final buckets", () => {
    const result = normalizeExtractedBillBuckets(rawBill());
    expect(result.charges).toMatchObject({ fixedCents: 4000, consumptionCents: 6000 });
    expect(result.analysis?.status).toBe("ready");
    expect(() =>
      structuredBillExtractionSchema.parse({
        ...rawBill(),
        charges: { fixedCents: 0, consumptionCents: 10000 },
      }),
    ).toThrow();
    expect(extractedBillSchema.safeParse(result).success).toBe(true);
  });

  it("allocates separate VAT rates to their actual taxable charges, including usage excise", () => {
    // Synthetic detailed-tax scenario, not a claim about missing reference pages.
    const result = normalizeExtractedBillBuckets(
      rawBill({
        lineItems: [
          charge("fixed", 4041, "fixed"),
          charge("usage", 4373, "usage"),
          charge("excise", 233, "usage", { kind: "excise" }),
          charge("recalculation", 5, "usage", {
            kind: "recalculation",
            adjustsChargeIds: ["usage"],
          }),
          charge("previous", 96, "unknown", { kind: "previous_rounding" }),
          charge("current", -98, "unknown", { kind: "rounding" }),
        ],
        vatLines: [
          vat("vat22", 889, 4041, 2200, ["fixed"]),
          vat("vat10", 461, 4611, 1000, ["usage", "excise", "recalculation"]),
        ],
      }),
    );
    expect(result.charges).toMatchObject({
      fixedCents: 4929,
      consumptionCents: 5071,
      taxesCents: 1583,
    });
    expect(result.analysis?.reconciliationCents).toBe(0);
  });

  it("allocates mixed-base VAT for provider-neutral electricity charges", () => {
    const input = rawBill({
      utilityType: "electricity",
      totalDueCents: 12200,
      lineItems: [
        charge("capacity", 2000, "fixed"),
        charge("energy", 7000, "usage"),
        charge("excise", 1000, "usage", { kind: "excise" }),
      ],
      vatLines: [vat("vat", 2200, 10000, 2200, ["capacity", "energy", "excise"])],
    });
    expect(normalizeExtractedBillBuckets(input).charges).toMatchObject({
      fixedCents: 2440,
      consumptionCents: 9760,
    });
  });

  it("accounts for credits and fixed recalculations in their own taxable base", () => {
    const input = rawBill({
      totalDueCents: 10350,
      lineItems: [
        charge("fixed", 4000, "fixed"),
        charge("usage", 6000, "usage"),
        charge("credit", -1000, "usage", { kind: "credit", adjustsChargeIds: ["usage"] }),
        charge("recalc", -500, "fixed", { kind: "recalculation", adjustsChargeIds: ["fixed"] }),
      ],
      vatLines: [vat("vat", 1850, 8500, 2200, ["fixed", "usage", "credit", "recalc"])],
    });
    // 8500 * 22% = 1870; inconsistent tax cannot be forced to reconcile.
    expect(normalizeExtractedBillBuckets(input).analysis?.status).toBe("needs_review");
    input.totalDueCents = 10370;
    input.vatLines[0].amountCents = 1870;
    expect(normalizeExtractedBillBuckets(input).charges).toMatchObject({
      fixedCents: 4270,
      consumptionCents: 6100,
    });
  });

  it("does not add informational di cui children to their payable parent", () => {
    const input = rawBill({
      lineItems: [
        ...rawBill().lineItems,
        charge("detail", 2000, "informational", {
          parentId: "fixed",
          includedInPayableTotal: false,
        }),
      ],
    });
    expect(normalizeExtractedBillBuckets(input).charges.fixedCents).toBe(4000);
    input.lineItems[2].includedInPayableTotal = true;
    input.lineItems[2].classification = "fixed";
    input.totalDueCents = 12000;
    expect(normalizeExtractedBillBuckets(input).analysis?.status).toBe("needs_review");
  });

  it("requires review for the actual gas summary reference rather than guessing its combined taxes", () => {
    const result = normalizeExtractedBillBuckets(gasSummaryReference);
    expect(result.analysis?.status).toBe("needs_review");
    expect(result.charges.fixedCents).toBeNull();
    expect(result.charges.consumptionCents).toBeNull();
  });

  it.each(["unknown", "informational"] as const)(
    "never hides a payable %s charge inside rounding tolerance",
    (classification) => {
      const result = normalizeExtractedBillBuckets(
        rawBill({
          totalDueCents: 10001,
          lineItems: [...rawBill().lineItems, charge("unresolved", 1, classification)],
        }),
      );
      expect(result.analysis?.status).toBe("needs_review");
      expect(result.charges.fixedCents).toBeNull();
    },
  );

  it("reconciles at most two unexplained cents and records the reconciliation", () => {
    for (const delta of [-2, -1, 0, 1, 2]) {
      const result = normalizeExtractedBillBuckets(rawBill({ totalDueCents: 10000 + delta }));
      expect(result.analysis?.status).toBe("ready");
      expect(result.charges.fixedCents! + result.charges.consumptionCents!).toBe(10000 + delta);
      expect(result.analysis?.reconciliationCents).toBe(delta);
    }
    expect(normalizeExtractedBillBuckets(rawBill({ totalDueCents: 10003 })).analysis?.status).toBe(
      "needs_review",
    );
  });

  it("does not trust missing VAT references, incorrect bases, rates or duplicate row ids", () => {
    const input = rawBill({
      totalDueCents: 11000,
      vatLines: [vat("vat", 1000, 10000, 1000, ["fixed", "usage"])],
    });
    for (const overrides of [
      { appliesToChargeIds: [] },
      { appliesToChargeIds: ["absent"] },
      { taxableBaseCents: 9000 },
      { rateBasisPoints: 2200 },
      { appliesToChargeIds: ["fixed", "fixed", "usage"] },
    ]) {
      expect(
        normalizeExtractedBillBuckets({
          ...input,
          vatLines: [{ ...input.vatLines[0], ...overrides }],
        }).analysis?.status,
      ).toBe("needs_review");
    }
    expect(
      normalizeExtractedBillBuckets(
        rawBill({ lineItems: [charge("same", 4000, "fixed"), charge("same", 6000, "usage")] }),
      ).analysis?.status,
    ).toBe("needs_review");
  });

  it("flags unknown inclusion, low confidence and broken/cyclic relationships", () => {
    for (const overrides of [
      { confidence: 0.7 },
      { includedInPayableTotal: null },
      { amountCents: null },
      { parentId: "missing" },
      { parentId: "fixed" },
    ]) {
      expect(
        normalizeExtractedBillBuckets(
          rawBill({
            lineItems: [{ ...rawBill().lineItems[0], ...overrides }, rawBill().lineItems[1]],
          }),
        ).analysis?.status,
      ).toBe("needs_review");
    }
  });

  it("returns the same results on repeated runs and reordered extraction rows", () => {
    const input = rawBill({
      totalDueCents: 11001,
      vatLines: [vat("vat", 1000, 10000, 1000, ["fixed", "usage"])],
    });
    const first = normalizeExtractedBillBuckets(input);
    for (let run = 0; run < 20; run++) expect(normalizeExtractedBillBuckets(input)).toEqual(first);
    const reordered = normalizeExtractedBillBuckets({
      ...input,
      lineItems: [...input.lineItems].reverse(),
      vatLines: [{ ...input.vatLines[0], appliesToChargeIds: ["usage", "fixed"] }],
    });
    expect(reordered.charges).toEqual(first.charges);
    expect(reordered.analysis).toEqual(first.analysis);
  });
});
