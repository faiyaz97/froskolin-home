import { z } from "zod";
import {
  billChargeSchema,
  billVatSchema,
  structuredBillExtractionSchema,
  type StructuredBillExtraction,
} from "@/lib/validation";
import { generationSchema } from "./extraction-schema";

const evidence = z.string().trim().min(1).max(500);
export const billRepairPatchSchema = z.strictObject({
  lineUpdates: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(80),
        evidence,
        changes: billChargeSchema.omit({ id: true, originalLabel: true, evidence: true }).partial(),
      }),
    )
    .max(200),
  vatUpdates: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(80),
        evidence,
        changes: billVatSchema.omit({ id: true, originalLabel: true, evidence: true }).partial(),
      }),
    )
    .max(100),
  addedLines: z.array(billChargeSchema.extend({ evidence })).max(200),
  addedVat: z.array(billVatSchema.extend({ evidence })).max(100),
  coverage: z.strictObject({ complete: z.boolean(), evidence }).nullable(),
});
export const repairSchema = generationSchema(
  z.toJSONSchema(billRepairPatchSchema, { target: "draft-7" }),
);

/** Applies only explicitly named fields; no invoice totals, arbitrary paths or deletion. */
export function applyBillRepairPatch(original: StructuredBillExtraction, input: unknown) {
  const patch = billRepairPatchSchema.parse(input);
  const result = structuredClone(original);
  const seen = new Set<string>();
  function update<
    T extends {
      id: string;
      amountCents: number | null;
      confidence: number;
      evidence: string | null;
    },
  >(rows: T[], updates: { id: string; changes: Partial<T>; evidence: string }[]) {
    for (const change of updates) {
      const row = rows.find((row) => row.id === change.id);
      if (!row || seen.has(change.id)) throw new Error("Invalid repair target");
      seen.add(change.id);
      if (
        change.changes.amountCents !== undefined &&
        change.changes.amountCents !== row.amountCents &&
        row.amountCents !== null &&
        row.confidence >= 0.8
      )
        throw new Error("Repair cannot change a confident source amount");
      Object.assign(row, change.changes, { evidence: change.evidence });
    }
  }
  update(result.lineItems, patch.lineUpdates);
  update(result.vatLines, patch.vatUpdates);
  const ids = new Set([...result.lineItems, ...result.vatLines].map((row) => row.id));
  for (const row of [...patch.addedLines, ...patch.addedVat]) {
    if (ids.has(row.id)) throw new Error("Duplicate added repair row");
    ids.add(row.id);
  }
  result.lineItems.push(...patch.addedLines);
  result.vatLines.push(...patch.addedVat);
  if (patch.coverage) result.coverageComplete = patch.coverage.complete;
  return structuredBillExtractionSchema.parse(result);
}
