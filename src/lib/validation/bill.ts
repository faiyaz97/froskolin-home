import { z } from "zod";

import { centsSchema, currencySchema, dateOnlySchema, signedCentsSchema } from "./common";
import { utilityTypeSchema } from "./utility";

const confidenceSchema = z.coerce.number().min(0).max(1);
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
