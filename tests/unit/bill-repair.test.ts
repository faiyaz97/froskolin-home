import { describe, expect, it, vi } from "vitest";
import { analyzeBill } from "@/lib/bills/analyze-bill";
import { rawBill, vat, charge } from "../fixtures/bill-analysis";

const document = { mimeType: "image/png" as const, bytes: new Uint8Array([1]), filename: "test" };
function cases() {
  const correct = rawBill({
    totalDueCents: 11000,
    vatLines: [vat("vat", 1000, 10000, 1000, ["fixed", "usage"])],
  });
  const broken = structuredClone(correct);
  broken.vatLines[0].appliesToChargeIds = ["usage"];
  return { correct, broken };
}
describe("targeted extraction repair", () => {
  // User-provided source amounts; anonymized labels, not a captured Gemini response.
  function gas() {
    return rawBill({
      lineItems: [
        charge("usage", 4373, "usage"),
        charge("fixed", 4041, "fixed"),
        charge("recalc", 5, "usage", { kind: "recalculation", adjustsChargeIds: ["usage"] }),
        charge("excise", 233, "usage", { kind: "excise" }),
        charge("previous", 96, "unknown", { kind: "previous_rounding" }),
        charge("current", -98, "unknown", { kind: "rounding" }),
        charge("summary", 1583, "informational", {
          kind: "tax",
          includedInPayableTotal: false,
          evidence: "Summary of detailed excise and VAT rows",
        }),
        charge("detail", 852, "informational", {
          parentId: "usage",
          includedInPayableTotal: false,
          evidence: "Included in consumption charge",
        }),
      ],
      vatLines: [
        vat("vat10", 461, 4611, 1000, ["usage", "recalc", "excise"]),
        vat("vat22", 889, 4041, 2200, ["fixed"]),
      ],
    });
  }
  it.each(["summary", "detail"])(
    "allows a total-only inclusion repair of %s without changing source amounts",
    async (id) => {
      const correct = gas();
      const broken = structuredClone(correct);
      const row = broken.lineItems.find((row) => row.id === id)!;
      row.includedInPayableTotal = true;
      row.classification = "usage";
      row.parentId = null;
      const repair = vi.fn().mockResolvedValue(correct);
      const result = await analyzeBill(document, { extract: async () => broken, repair });
      expect(result.analysis?.status).toBe("ready");
      expect(result.charges).toMatchObject({ fixedCents: 4929, consumptionCents: 5071 });
      expect(result.structuredData?.lineItems.find((row) => row.id === id)?.amountCents).toBe(
        row.amountCents,
      );
      expect(repair).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["recalc", "excise"])(
    "reports exact VAT discrepancy for missing %s reference",
    async (id) => {
      const correct = gas();
      const broken = structuredClone(correct);
      broken.vatLines[0].appliesToChargeIds = broken.vatLines[0].appliesToChargeIds.filter(
        (ref) => ref !== id,
      );
      const repair = vi.fn().mockResolvedValue(correct);
      const result = await analyzeBill(document, { extract: async () => broken, repair });
      expect(result.analysis?.status).toBe("ready");
      expect(repair.mock.calls[0][2].join("\n")).toContain(
        `base minus referenced sum=${id === "recalc" ? 5 : 233}`,
      );
    },
  );
  it("does not repair a ready extraction", async () => {
    const repair = vi.fn();
    expect(
      (await analyzeBill(document, { extract: async () => rawBill(), repair })).analysis?.status,
    ).toBe("ready");
    expect(repair).not.toHaveBeenCalled();
  });
  it("sends existing facts, exact issues and original document for one VAT repair", async () => {
    const { correct, broken } = cases();
    const repair = vi.fn().mockResolvedValue(correct);
    const result = await analyzeBill(document, { extract: async () => broken, repair });
    expect(result.charges).toMatchObject({ fixedCents: 4400, consumptionCents: 6600 });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(repair).toHaveBeenCalledWith(
      document,
      broken,
      expect.arrayContaining([
        "The rate, taxable base, or references for vat do not reconcile.",
        expect.stringContaining("referenced amount sum=6000"),
      ]),
    );
  });
  it.each(["unsafe", "malformed", "outage", "total", "unrelated"])(
    "keeps review safe after %s repair",
    async (mode) => {
      const { correct, broken } = cases();
      if (mode === "total") correct.totalDueCents++;
      if (mode === "unrelated") correct.supplier = "Different supplier";
      const repair = vi.fn().mockImplementation(async () => {
        if (mode === "outage") throw new Error("secret upstream");
        return mode === "unsafe" ? broken : mode === "malformed" ? {} : correct;
      });
      const result = await analyzeBill(document, { extract: async () => broken, repair });
      expect(result.analysis?.status).toBe("needs_review");
      expect(result.charges.fixedCents).toBeNull();
      expect(repair).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves unrelated rows even if repair rewrites their facts", async () => {
    const { correct, broken } = cases();
    correct.lineItems[0].amountCents = 9999;
    correct.lineItems[0].evidence = "Rephrased evidence";
    const result = await analyzeBill(document, {
      extract: async () => broken,
      repair: async () => correct,
    });
    expect(result.analysis?.status).toBe("ready");
    expect(result.structuredData?.lineItems[0]).toEqual(broken.lineItems[0]);
  });
});
