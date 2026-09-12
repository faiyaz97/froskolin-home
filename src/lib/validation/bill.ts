import { z } from "zod";

import { centsSchema, currencySchema, dateOnlySchema, signedCentsSchema } from "./common";
import { utilityTypeSchema } from "./utility";

const confidenceSchema = z.coerce.number().min(0).max(1);
const rawCents = z.number().int().safe();
const sourceFields = {
  id: z.string().trim().min(1).max(80),
  originalLabel: z.string().trim().min(1).max(120),
  amountCents: rawCents.nullable(),
  includedInPayableTotal: z.boolean().nullable(),
  parentId: z.string().max(80).nullable(),
  sourcePage: z.number().int().min(1).max(100).nullable(),
  evidence: z.string().max(500).nullable(),
  confidence: z.number().min(0).max(1),
};

export const billChargeSchema = z.strictObject({
  ...sourceFields,
  classification: z.enum(["fixed", "usage", "unknown", "informational"]),
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
  adjustsChargeIds: z.array(z.string().max(80)).max(100),
});

export const billVatSchema = z.strictObject({
  ...sourceFields,
  classification: z.enum(["unknown", "informational"]),
  rateBasisPoints: z.number().int().min(0).max(10000).nullable(),
  taxableBaseCents: rawCents.nullable(),
  appliesToChargeIds: z.array(z.string().max(80)).max(100),
});

/** Model-only contract: no final financial buckets or AI VAT allocations. */
export const structuredBillExtractionSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    supplier: z.string().trim().max(160).nullable(),
    utilityType: utilityTypeSchema,
    billNumber: z.string().trim().max(120).nullable(),
    issueDate: dateOnlySchema.nullable(),
    servicePeriod: z.object({ start: dateOnlySchema, end: dateOnlySchema }),
    totalDueCents: rawCents.nonnegative(),
    currency: currencySchema,
    consumption: z.object({
      amount: z.number().finite().nonnegative().nullable(),
      unit: z.string().max(40).nullable(),
    }),
    coverageComplete: z.boolean().nullable(),
    lineItems: z.array(billChargeSchema).max(200),
    vatLines: z.array(billVatSchema).max(100),
    extractionConfidence: z.object({
      servicePeriod: z.number().min(0).max(1),
      totalDue: z.number().min(0).max(1),
    }),
    evidence: z.object({
      servicePeriod: z.string().max(500).optional(),
      totalDue: z.string().max(500).optional(),
    }),
  })
  .superRefine((value, context) => {
    if (value.servicePeriod.start > value.servicePeriod.end)
      context.addIssue({
        code: "custom",
        path: ["servicePeriod", "end"],
        message: "Service period is invalid.",
      });
  });

export type StructuredBillExtraction = z.infer<typeof structuredBillExtractionSchema>;
export type BillCharge = z.infer<typeof billChargeSchema>;

export const billAnalysisSchema = z.object({
  version: z.literal(2),
  status: z.enum(["ready", "needs_review"]),
  issues: z.array(z.string().max(300)).max(400),
  reconciliationCents: signedCentsSchema,
  allocations: z
    .array(
      z.object({ id: z.string(), fixedCents: signedCentsSchema, usageCents: signedCentsSchema }),
    )
    .max(301),
});
const chargeComponentSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    amountCents: signedCentsSchema,
    bucket: z.enum(["fixed", "variable", "whole_bill"]),
    kind: z.enum(["base", "tax", "adjustment"]),
  })
  .superRefine((value, context) => {
    if (value.kind !== "adjustment" && value.amountCents < 0)
      context.addIssue({
        code: "custom",
        path: ["amountCents"],
        message: "Only adjustments can have a negative amount.",
      });
  });

export const extractedBillSchema = z
  .object({
    supplier: z.string().trim().max(160).nullable(),
    utilityType: utilityTypeSchema,
    billNumber: z.string().trim().max(120).nullable(),
    issueDate: dateOnlySchema.nullable(),
    servicePeriod: z.object({ start: dateOnlySchema, end: dateOnlySchema }),
    totalDueCents: centsSchema,
    currency: currencySchema,
    consumption: z.object({
      amount: z.number().finite().nonnegative().nullable(),
      unit: z.string().trim().max(40).nullable(),
    }),
    charges: z.object({
      consumptionCents: centsSchema.nullable(),
      fixedCents: centsSchema.nullable(),
      taxesCents: centsSchema.nullable(),
      adjustmentsCents: signedCentsSchema.nullable(),
    }),
    chargeComponents: z.array(chargeComponentSchema).max(100).nullable().optional(),
    structuredData: structuredBillExtractionSchema.optional(),
    analysis: billAnalysisSchema.optional(),
    extractionConfidence: z.object({
      servicePeriod: confidenceSchema,
      totalDue: confidenceSchema,
      fixedCharges: confidenceSchema,
      consumptionCharges: confidenceSchema,
    }),
    evidence: z.object({
      servicePeriod: z.string().trim().max(500).optional(),
      totalDue: z.string().trim().max(500).optional(),
      fixedCharges: z.string().trim().max(500).optional(),
      consumptionCharges: z.string().trim().max(500).optional(),
    }),
  })
  .superRefine((value, context) => {
    if (value.servicePeriod.start > value.servicePeriod.end)
      context.addIssue({
        code: "custom",
        path: ["servicePeriod", "end"],
        message: "Service period is invalid.",
      });
  });

export type ExtractedBill = z.infer<typeof extractedBillSchema>;
