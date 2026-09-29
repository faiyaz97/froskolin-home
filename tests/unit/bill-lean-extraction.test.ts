import { describe, expect, it, vi } from "vitest";

import { analyzeBill } from "@/lib/bills/analyze-bill";
import { toBillAutofill } from "@/lib/bills/autofill-response";
import { expandLeanExtraction, leanBillExtractionSchema } from "@/lib/bills/lean-extraction";
import { calculateBillTotals } from "@/lib/domain/bill-analysis";
import { rawBill, vat } from "../fixtures/bill-analysis";

function leanBill() {
  return {
    schemaVersion: 3,
    utilityType: "electricity",
    servicePeriod: { start: "2026-05-01", end: "2026-05-31" },
    totalDueCents: 11000,
    currency: "EUR",
    consumption: { amount: null, unit: null },
    coverageComplete: true,
    charges: [
      {
        id: "fixed",
        label: "Subscription",
        amountCents: 4000,
        classification: "fixed",
        kind: "charge",
        adjustsChargeIds: [],
      },
      {
        id: "usage",
        label: "Energy",
        amountCents: 6000,
        classification: "usage",
        kind: "charge",
        adjustsChargeIds: [],
      },
    ],
    vat: [
      {
        id: "vat",
        amountCents: 1000,
        rateBasisPoints: 1000,
        taxableBaseCents: 10000,
        appliesToChargeIds: ["fixed", "usage"],
      },
    ],
  } as const;
}

const document = {
  mimeType: "application/pdf" as const,
  bytes: new Uint8Array([1]),
  filename: "test.pdf",
};

describe("compact bill extraction", () => {
  it("fills the July electricity bill when the only unknown is printed late-payment interest", () => {
    const facts = leanBillExtractionSchema.parse({
      ...leanBill(),
      servicePeriod: { start: "2026-07-01", end: "2026-08-31" },
      totalDueCents: 25500,
      charges: [
        {
          id: "usage",
          label: "Quota per consumi",
          amountCents: 16781,
          classification: "usage",
          kind: "charge",
          adjustsChargeIds: [],
        },
        {
          id: "fixed",
          label: "Quota fissa",
          amountCents: 3888,
          classification: "fixed",
          kind: "charge",
          adjustsChargeIds: [],
        },
        {
          id: "power",
          label: "Quota potenza",
          amountCents: 1186,
          classification: "fixed",
          kind: "charge",
          adjustsChargeIds: [],
        },
        {
          id: "interest",
          label: "Altre partite - Interessi di mora",
          amountCents: 3,
          classification: "unknown",
          kind: "charge",
          adjustsChargeIds: [],
        },
        {
          id: "excise",
          label: "Accisa uso domestico seconda casa",
          amountCents: 1314,
          classification: "usage",
          kind: "excise",
          adjustsChargeIds: [],
        },
        {
          id: "rounding",
          label: "Arrotondamento precedente",
          amountCents: 11,
          classification: "unknown",
          kind: "previous_rounding",
          adjustsChargeIds: [],
        },
      ],
      vat: [
        {
          id: "vat",
          amountCents: 2317,
          rateBasisPoints: 1000,
          taxableBaseCents: 23169,
          appliesToChargeIds: ["usage", "fixed", "power", "excise"],
        },
      ],
    });
    const result = calculateBillTotals(expandLeanExtraction(facts));
    expect(result.analysis?.status).toBe("ready");
    expect(
      result.structuredData?.lineItems.find((row) => row.id === "interest")?.classification,
    ).toBe("fixed");
    expect(result.charges.fixedCents! + result.charges.consumptionCents!).toBe(25500);
  });

  it("does not classify other unknown fees or unreadable interest amounts", () => {
    for (const row of [
      { label: "Other charges", amountCents: 3 },
      { label: "Interessi di mora", amountCents: null },
    ]) {
      const facts = leanBillExtractionSchema.parse({
        ...leanBill(),
        totalDueCents: 11003,
        charges: [
          ...leanBill().charges,
          { id: "extra", classification: "unknown", kind: "charge", adjustsChargeIds: [], ...row },
        ],
      });
      expect(calculateBillTotals(expandLeanExtraction(facts)).analysis?.status).toBe(
        "needs_review",
      );
    }
  });

  it("keeps per-kWh network costs within the consumption parent on the scanned electricity bill", () => {
    const facts = leanBillExtractionSchema.parse({
      ...leanBill(),
      totalDueCents: 21100,
      charges: [
        {
          id: "energy",
          label: "Consumption, including network and system costs",
          amountCents: 12946,
          classification: "usage",
          kind: "charge",
          adjustsChargeIds: [],
        },
        {
          id: "fixed",
          label: "Fixed quota",
          amountCents: 3786,
          classification: "fixed",
          kind: "charge",
          adjustsChargeIds: [],
        },
        {
          id: "power",
          label: "Power quota",
          amountCents: 1186,
          classification: "fixed",
          kind: "charge",
          adjustsChargeIds: [],
        },
        {
          id: "excise",
          label: "Consumption excise",
          amountCents: 1255,
          classification: "usage",
          kind: "excise",
          adjustsChargeIds: [],
        },
        {
          id: "current-rounding",
          label: "Current rounding",
          amountCents: -11,
          classification: "unknown",
          kind: "rounding",
          adjustsChargeIds: [],
        },
        {
          id: "previous-rounding",
          label: "Previous rounding",
          amountCents: 21,
          classification: "unknown",
          kind: "previous_rounding",
          adjustsChargeIds: [],
        },
      ],
      vat: [
        {
          id: "vat",
          amountCents: 1917,
          rateBasisPoints: 1000,
          taxableBaseCents: 19173,
          appliesToChargeIds: ["energy", "fixed", "power", "excise"],
        },
      ],
    });
    const result = calculateBillTotals(expandLeanExtraction(facts));
    expect(result.analysis?.status).toBe("ready");
    expect(result.charges).toMatchObject({ fixedCents: 5471, consumptionCents: 15629 });
  });

  it("preserves exact mixed-VAT allocation without exposing source rows to the browser", () => {
    const facts = leanBillExtractionSchema.parse(leanBill());
    const result = calculateBillTotals(expandLeanExtraction(facts));
    expect(result.analysis?.status).toBe("ready");
    expect(result.charges).toMatchObject({ fixedCents: 4400, consumptionCents: 6600 });
    const client = toBillAutofill(result);
    expect(client).not.toHaveProperty("structuredData");
    expect(client).not.toHaveProperty("analysis");
    expect(JSON.stringify(client)).not.toContain("Subscription");
    expect(client.review?.status).toBe("ready");
    expect(JSON.stringify(client).length).toBeLessThan(JSON.stringify(result).length / 2);
  });

  it("leaves buckets blank when tax attribution is unresolved", () => {
    const facts = leanBillExtractionSchema.parse({
      ...leanBill(),
      vat: [{ ...leanBill().vat[0], appliesToChargeIds: [] }],
    });
    const client = toBillAutofill(calculateBillTotals(expandLeanExtraction(facts)));
    expect(client.totalDueCents).toBe(11000);
    expect(client.charges).toEqual({ fixedCents: null, consumptionCents: null });
    expect(client.review?.status).toBe("needs_review");
  });

  it("keeps signed credits and explicit rounding in the exact-cent calculation", () => {
    const facts = leanBillExtractionSchema.parse({
      ...leanBill(),
      totalDueCents: 10899,
      charges: [
        ...leanBill().charges,
        {
          id: "credit",
          label: "Usage credit",
          amountCents: -100,
          classification: "usage",
          kind: "credit",
          adjustsChargeIds: ["usage"],
        },
        {
          id: "rounding",
          label: "Current rounding",
          amountCents: -1,
          classification: "unknown",
          kind: "rounding",
          adjustsChargeIds: [],
        },
      ],
    });
    const result = calculateBillTotals(expandLeanExtraction(facts));
    expect(result.analysis?.status).toBe("ready");
    expect(result.charges.fixedCents).toBe(4400);
    expect(result.charges.consumptionCents).toBe(6499);
  });

  it("uses only one detailed pass, accepting it only when validated totals agree", async () => {
    const initial = expandLeanExtraction(
      leanBillExtractionSchema.parse({
        ...leanBill(),
        vat: [{ ...leanBill().vat[0], appliesToChargeIds: [] }],
      }),
    );
    const detailed = rawBill({
      totalDueCents: 11000,
      vatLines: [vat("vat", 1000, 10000, 1000, ["fixed", "usage"])],
    });
    detailed.utilityType = "electricity";
    detailed.servicePeriod = initial.servicePeriod;
    detailed.consumption = initial.consumption;
    const extractDetailed = vi.fn().mockResolvedValue(detailed);
    const result = await analyzeBill(document, {
      optimized: true,
      extract: async () => initial,
      extractDetailed,
    });
    expect(result.analysis?.status).toBe("ready");
    expect(extractDetailed).toHaveBeenCalledTimes(1);

    extractDetailed.mockResolvedValue({ ...detailed, totalDueCents: 11001 });
    const rejected = await analyzeBill(document, {
      optimized: true,
      extract: async () => initial,
      extractDetailed,
    });
    expect(rejected.analysis?.status).toBe("needs_review");
  });
});
