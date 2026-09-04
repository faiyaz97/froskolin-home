import { z } from "zod";

import {
  centsSchema,
  currencySchema,
  dateOnlySchema,
  positiveCentsSchema,
  uuidSchema,
} from "./common";
import { payerSelectionSchema } from "./expenses";

export const utilityTypeSchema = z.enum(["electricity", "gas", "water", "internet", "other"]);
export const billEntryModeSchema = z.enum(["ai", "manual"]);
export const utilityParticipantSchema = z.object({
  memberId: uuidSchema,
  order: z.coerce.number().int().nonnegative(),
});

export const utilityConfirmationSchema = z
  .object({
    householdId: uuidSchema,
    documentId: uuidSchema.optional(),
    title: z.string().trim().min(1).max(160),
    utilityType: utilityTypeSchema,
    supplier: z.string().trim().max(160).nullable().optional(),
    issueDate: dateOnlySchema.nullable().optional(),
    serviceStart: dateOnlySchema,
    serviceEnd: dateOnlySchema,
    totalCents: positiveCentsSchema,
    fixedCents: centsSchema,
    variableCents: centsSchema,
    currency: currencySchema,
    payerMemberId: payerSelectionSchema,
    participants: z.array(utilityParticipantSchema).min(1),
    consumptionAmount: z.number().finite().nonnegative().nullable().optional(),
    consumptionUnit: z.string().trim().max(40).nullable().optional(),
    classificationNote: z.string().trim().max(500).nullable().optional(),
    entryMode: billEntryModeSchema,
  })
  .superRefine((value, context) => {
    if (value.serviceStart > value.serviceEnd)
      context.addIssue({
        code: "custom",
        message: "Service end must be on or after its start.",
        path: ["serviceEnd"],
      });
    if (value.fixedCents + value.variableCents !== value.totalCents)
      context.addIssue({
        code: "custom",
        message: "Fixed and variable portions must equal the total.",
        path: ["variableCents"],
      });
  });

export const utilityUpdateSchema = utilityConfirmationSchema.extend({ expenseId: uuidSchema });

export const billUploadSchema = z.object({
  householdId: uuidSchema,
  consentAt: z.string().datetime().optional(),
});
