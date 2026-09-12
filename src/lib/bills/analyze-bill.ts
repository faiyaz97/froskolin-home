import "server-only";
import { structuredBillExtractionSchema, type StructuredBillExtraction } from "@/lib/validation";
import { calculateBillTotals } from "@/lib/domain/bill-analysis";
import type { BillExtractor, PreparedBillDocument } from "./bill-extractor";

type RepairExtractor = BillExtractor & {
  repair?: (
    document: PreparedBillDocument,
    extraction: StructuredBillExtraction,
    issues: string[],
  ) => Promise<StructuredBillExtraction>;
};

/** Existing validator remains the authority; extra numbers are diagnostic context only. */
function repairIssues(raw: StructuredBillExtraction, issues: string[]) {
  const context = raw.vatLines
    .filter((vat) => vat.includedInPayableTotal === true)
    .map((vat) => {
      const referenced = raw.lineItems.filter((row) => vat.appliesToChargeIds.includes(row.id));
      const eligible = referenced.filter(
        (row) =>
          row.includedInPayableTotal === true &&
          ["fixed", "usage"].includes(row.classification) &&
          !["rounding", "previous_rounding"].includes(row.kind) &&
          row.amountCents !== null,
      );
      const sum = eligible.reduce((total, row) => total + BigInt(row.amountCents!), 0n);
      const difference =
        vat.taxableBaseCents === null ? null : String(BigInt(vat.taxableBaseCents) - sum);
      const invalid = vat.appliesToChargeIds.filter((id) => !eligible.some((row) => row.id === id));
      return `VAT ${vat.id}: taxableBaseCents=${vat.taxableBaseCents}; referenced amount sum=${sum}; base minus referenced sum=${difference}; rateBasisPoints=${vat.rateBasisPoints}; VAT amountCents=${vat.amountCents}; appliesToChargeIds=${JSON.stringify(vat.appliesToChargeIds)}; missing/ineligible references=${JSON.stringify(invalid)}. Re-check only this tax relationship against source, including excise and recalculations if the source establishes they belong to the base. Do not choose charges solely because their amounts fill the gap, or alter the base to equal this diagnostic sum.`;
    });
  const payable = [...raw.lineItems, ...raw.vatLines].filter(
    (row) => row.includedInPayableTotal === true,
  );
  const sum = payable.reduce((total, row) => total + BigInt(row.amountCents ?? 0), 0n);
  return [
    ...issues,
    ...context,
    `Payable inclusion audit (before validation/allocation): counted row IDs=${JSON.stringify(payable.map((row) => row.id))}; known signed amounts sum=${sum}; amountDueCents=${raw.totalDueCents}; amount due minus counted sum=${BigInt(raw.totalDueCents) - sum}; missing amounts=${JSON.stringify(payable.filter((row) => row.amountCents === null).map((row) => row.id))}. Inspect inclusion and parent relationships of summary/sub-breakdown rows and previous/current rounding. Detailed tax rows and their combined summary must not both be payable. Keep source amounts unchanged unless specifically flagged as uncertain.`,
  ];
}

/** One initial extraction and at most one targeted repair. No cache or retries. */
export async function analyzeBill(document: PreparedBillDocument, extractor: RepairExtractor) {
  const raw = structuredBillExtractionSchema.parse(await extractor.extract(document));
  const initial = calculateBillTotals(raw);
  const issues = initial.analysis?.issues ?? [];
  if (initial.analysis?.status === "ready" || !issues.length || !extractor.repair) return initial;
  try {
    const repaired = structuredBillExtractionSchema.parse(
      await extractor.repair(document, raw, repairIssues(raw, issues)),
    );
    // Never accept a repair that changes unrelated invoice identity/total to balance charges.
    for (const field of [
      "schemaVersion",
      "supplier",
      "utilityType",
      "billNumber",
      "issueDate",
      "servicePeriod",
      "totalDueCents",
      "currency",
      "consumption",
    ] as const) {
      if (JSON.stringify(raw[field]) !== JSON.stringify(repaired[field])) return initial;
    }
    const affected = new Set<string>();
    for (const row of [...raw.lineItems, ...raw.vatLines]) {
      if (
        issues.some((issue) => issue.includes(row.originalLabel)) ||
        row.includedInPayableTotal === null ||
        row.amountCents === null ||
        row.confidence < 0.8 ||
        ("kind" in row && row.classification === "unknown")
      ) {
        affected.add(row.id);
        if (row.parentId) affected.add(row.parentId);
      }
    }
    for (const vat of raw.vatLines) {
      if (affected.has(vat.id)) vat.appliesToChargeIds.forEach((id) => affected.add(id));
    }
    for (const collection of ["lineItems", "vatLines"] as const) {
      for (const row of raw[collection]) {
        if (!affected.has(row.id)) {
          // Full-JSON model output can incidentally rephrase unrelated evidence.
          // Preserve original rows in code rather than accepting those mutations.
          const index = repaired[collection].findIndex((candidate) => candidate.id === row.id);
          if (index < 0) return initial;
          const candidate = repaired[collection][index];
          const relationshipChanged =
            candidate.includedInPayableTotal !== row.includedInPayableTotal ||
            candidate.classification !== row.classification ||
            candidate.parentId !== row.parentId;
          const inclusionReview =
            issues.includes("The charge breakdown does not match the actual amount due.") ||
            raw.coverageComplete !== true;
          // A global mismatch implicates inclusion, even when no specific row was named.
          // Keep amounts/identity frozen while permitting source-backed relationship corrections.
          const relationships =
            inclusionReview && relationshipChanged && candidate.evidence?.trim()
              ? {
                  includedInPayableTotal: candidate.includedInPayableTotal,
                  classification: candidate.classification,
                  parentId: candidate.parentId,
                  evidence: candidate.evidence,
                  sourcePage: candidate.sourcePage,
                }
              : {};
          if (collection === "lineItems")
            repaired.lineItems[index] = {
              ...raw.lineItems.find((item) => item.id === row.id)!,
              ...relationships,
            };
          else
            repaired.vatLines[index] = {
              ...raw.vatLines.find((item) => item.id === row.id)!,
              ...relationships,
            } as StructuredBillExtraction["vatLines"][number];
        }
      }
    }
    return calculateBillTotals(repaired);
  } catch {
    // Failed/malformed repair preserves the original safe review draft, not guessed totals.
    return initial;
  }
}
