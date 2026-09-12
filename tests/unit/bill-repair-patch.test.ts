import { expect, it } from "vitest";
import { applyBillRepairPatch, repairSchema } from "@/lib/bills/repair-patch";
import { rawBill, vat } from "../fixtures/bill-analysis";
const empty = { lineUpdates: [], vatUpdates: [], addedLines: [], addedVat: [], coverage: null };
it("retains nested evidence requirements for nullable coverage in the API schema", () => {
  const coverage = (
    repairSchema.properties as Record<
      string,
      { anyOf: Array<{ properties?: unknown; required?: string[] }> }
    >
  ).coverage;
  expect(coverage.anyOf[0].properties).toHaveProperty("evidence");
  expect(coverage.anyOf[0].required).toContain("evidence");
});
it("changes only VAT references and preserves unrelated facts exactly", () => {
  const raw = rawBill({ vatLines: [vat("vat", 1000, 10000, 1000, ["usage"])] });
  const result = applyBillRepairPatch(raw, {
    ...empty,
    vatUpdates: [
      {
        id: "vat",
        evidence: "Printed VAT group contains subscription and consumption",
        changes: { appliesToChargeIds: ["fixed", "usage"] },
      },
    ],
  });
  expect(result.lineItems).toEqual(raw.lineItems);
  expect(result.vatLines[0].appliesToChargeIds).toEqual(["fixed", "usage"]);
  expect(result.totalDueCents).toBe(raw.totalDueCents);
  expect(raw.vatLines[0].appliesToChargeIds).toEqual(["usage"]);
});
it.each([
  { ...empty, totalDueCents: 9999 },
  { ...empty, lineUpdates: [{ id: "fixed", evidence: "adjust", changes: { amountCents: 9999 } }] },
  {
    ...empty,
    lineUpdates: [{ id: "absent", evidence: "source", changes: { includedInPayableTotal: false } }],
  },
  {
    ...empty,
    lineUpdates: [{ id: "fixed", evidence: "", changes: { includedInPayableTotal: false } }],
  },
  { ...empty, addedLines: [rawBill().lineItems[0]] },
])("rejects unsafe or unsupported patches", (patch) => {
  expect(() => applyBillRepairPatch(rawBill(), patch)).toThrow();
});
