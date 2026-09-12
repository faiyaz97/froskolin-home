import type { BillCharge, StructuredBillExtraction } from "@/lib/validation";

export function charge(
  id: string,
  amountCents: number,
  classification: BillCharge["classification"],
  overrides: Partial<BillCharge> = {},
): BillCharge {
  return {
    id,
    originalLabel: id,
    amountCents,
    classification,
    kind: "charge",
    includedInPayableTotal: true,
    parentId: null,
    sourcePage: null,
    evidence: null,
    confidence: 0.99,
    adjustsChargeIds: [],
    ...overrides,
  };
}

export function rawBill(
  overrides: Partial<StructuredBillExtraction> = {},
): StructuredBillExtraction {
  return {
    schemaVersion: 2,
    supplier: "Example Energy",
    utilityType: "gas",
    billNumber: null,
    issueDate: "2026-06-03",
    servicePeriod: { start: "2026-03-01", end: "2026-05-31" },
    totalDueCents: 10000,
    currency: "EUR",
    consumption: { amount: 53.283974, unit: "Smc" },
    coverageComplete: true,
    lineItems: [charge("fixed", 4000, "fixed"), charge("usage", 6000, "usage")],
    vatLines: [],
    extractionConfidence: { servicePeriod: 0.99, totalDue: 0.99 },
    evidence: {},
    ...overrides,
  };
}

export function vat(
  id: string,
  amountCents: number,
  taxableBaseCents: number,
  rateBasisPoints: number,
  appliesToChargeIds: string[],
): StructuredBillExtraction["vatLines"][number] {
  return {
    id,
    originalLabel: id,
    amountCents,
    taxableBaseCents,
    rateBasisPoints,
    appliesToChargeIds,
    classification: "unknown",
    includedInPayableTotal: true,
    parentId: null,
    sourcePage: null,
    evidence: null,
    confidence: 0.99,
  };
}

/** Observed facts from tmp/pdfs/gas-bill-review/page-{1,2}.png only.
 * No personal identifiers retained. These summary pages do not establish tax bases.
 */
export const gasSummaryReference = rawBill({
  coverageComplete: false,
  lineItems: [
    charge("fixed", 4041, "fixed", { originalLabel: "Quota fissa", sourcePage: 2 }),
    charge("usage", 4373, "usage", { originalLabel: "Quota per consumi", sourcePage: 2 }),
    charge("fixed-detail", 2850, "informational", {
      originalLabel: "di cui spesa per la vendita di gas naturale",
      parentId: "fixed",
      includedInPayableTotal: false,
      sourcePage: 2,
    }),
    charge("fixed-network", 1191, "informational", {
      originalLabel: "di cui spesa per la rete e gli oneri generali di sistema",
      parentId: "fixed",
      includedInPayableTotal: false,
      sourcePage: 2,
    }),
    charge("usage-detail", 3521, "informational", {
      parentId: "usage",
      includedInPayableTotal: false,
      sourcePage: 2,
    }),
    charge("usage-network", 852, "informational", {
      parentId: "usage",
      includedInPayableTotal: false,
      sourcePage: 2,
    }),
    charge("recalculation", 5, "unknown", {
      originalLabel: "Totale ricalcoli",
      kind: "recalculation",
      sourcePage: 2,
    }),
    charge("tax-summary", 1583, "unknown", {
      originalLabel: "Accise e IVA",
      kind: "tax",
      sourcePage: 2,
    }),
    charge("previous-rounding", 96, "unknown", { kind: "previous_rounding", sourcePage: 2 }),
    charge("current-rounding", -98, "unknown", { kind: "rounding", sourcePage: 2 }),
  ],
});
