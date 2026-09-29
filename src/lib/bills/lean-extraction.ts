import { z } from "zod";

import { structuredBillExtractionSchema, type StructuredBillExtraction } from "@/lib/validation";
import { currencySchema, dateOnlySchema } from "@/lib/validation/common";
import { utilityTypeSchema } from "@/lib/validation/utility";
import { isLatePaymentInterestCharge } from "@/lib/domain/bill-charge-classification";
import { generationSchema } from "./extraction-schema";
import { redactSensitiveText } from "./preprocessing";

const cents = z.number().int().safe();
const id = z.string().trim().min(1).max(80);

/** Only non-overlapping payable facts needed by the existing calculator. */
export const leanBillExtractionSchema = z
  .strictObject({
    schemaVersion: z.literal(3),
    utilityType: utilityTypeSchema,
    servicePeriod: z.object({ start: dateOnlySchema, end: dateOnlySchema }),
    totalDueCents: cents.nonnegative(),
    currency: currencySchema,
    consumption: z.object({
      amount: z.number().finite().nonnegative().nullable(),
      unit: z.string().max(40).nullable(),
    }),
    coverageComplete: z.boolean(),
    charges: z
      .array(
        z.strictObject({
          id,
          label: z.string().trim().min(1).max(120),
          amountCents: cents.nullable(),
          classification: z.enum(["fixed", "usage", "unknown"]),
          kind: z.enum([
            "charge",
            "tax",
            "excise",
            "recalculation",
            "discount",
            "credit",
            "rounding",
            "previous_rounding",
          ]),
          adjustsChargeIds: z.array(id).max(100),
        }),
      )
      .max(200),
    vat: z
      .array(
        z.strictObject({
          id,
          amountCents: cents.nullable(),
          rateBasisPoints: z.number().int().min(0).max(10000).nullable(),
          taxableBaseCents: cents.nullable(),
          appliesToChargeIds: z.array(id).max(100),
        }),
      )
      .max(100),
  })
  .superRefine((value, context) => {
    if (value.servicePeriod.start > value.servicePeriod.end)
      context.addIssue({
        code: "custom",
        path: ["servicePeriod", "end"],
        message: "Invalid service period.",
      });
  });

export type LeanBillExtraction = z.infer<typeof leanBillExtractionSchema>;

export const leanGenerationSchema = generationSchema(
  z.toJSONSchema(leanBillExtractionSchema, { target: "draft-7" }),
);

export function expandLeanExtraction(input: LeanBillExtraction): StructuredBillExtraction {
  return structuredBillExtractionSchema.parse({
    schemaVersion: 2,
    supplier: null,
    utilityType: input.utilityType,
    billNumber: null,
    issueDate: null,
    servicePeriod: input.servicePeriod,
    totalDueCents: input.totalDueCents,
    currency: input.currency,
    consumption: input.consumption,
    coverageComplete: input.coverageComplete,
    lineItems: input.charges.map((row) => ({
      id: row.id,
      originalLabel: redactSensitiveText(row.label),
      amountCents: row.amountCents,
      includedInPayableTotal: true,
      parentId: null,
      sourcePage: null,
      evidence: null,
      confidence:
        row.amountCents === null ||
        (row.classification === "unknown" &&
          !isLatePaymentInterestCharge({ ...row, originalLabel: row.label }) &&
          row.kind !== "rounding" &&
          row.kind !== "previous_rounding")
          ? 0
          : 1,
      classification: isLatePaymentInterestCharge({ ...row, originalLabel: row.label })
        ? "fixed"
        : row.classification,
      kind: row.kind,
      adjustsChargeIds: row.adjustsChargeIds,
    })),
    vatLines: input.vat.map((row) => ({
      id: row.id,
      originalLabel: "VAT",
      amountCents: row.amountCents,
      includedInPayableTotal: true,
      parentId: null,
      sourcePage: null,
      evidence: null,
      confidence: row.amountCents === null ? 0 : 1,
      classification: "unknown",
      rateBasisPoints: row.rateBasisPoints,
      taxableBaseCents: row.taxableBaseCents,
      appliesToChargeIds: row.appliesToChargeIds,
    })),
    extractionConfidence: { servicePeriod: 1, totalDue: 1 },
    evidence: {},
  });
}
