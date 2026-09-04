import { z } from "zod";

import {
  currencySchema,
  dateOnlySchema,
  nonEmptyTextSchema,
  positiveCentsSchema,
  uuidSchema,
} from "./common";
import { normalSplitConfigSchema, payerSelectionSchema } from "./expenses";

export const recurringExpenseRuleSchema = z
  .object({
    householdId: uuidSchema,
    title: nonEmptyTextSchema,
    amountCents: positiveCentsSchema,
    currency: currencySchema,
    payerMemberId: payerSelectionSchema,
    splitConfig: normalSplitConfigSchema,
    startDate: dateOnlySchema,
    endDate: dateOnlySchema.nullable().optional(),
    active: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.endDate && value.startDate > value.endDate)
      context.addIssue({
        code: "custom",
        message: "End date must be on or after start date.",
        path: ["endDate"],
      });
    if (
      value.splitConfig.method === "exact" &&
      value.splitConfig.participants.reduce(
        (total, participant) => total + participant.amountCents,
        0,
      ) !== value.amountCents
    )
      context.addIssue({
        code: "custom",
        message: "Exact shares must equal the recurring amount.",
        path: ["splitConfig"],
      });
    if (
      value.splitConfig.method === "percentage" &&
      value.splitConfig.participants.reduce(
        (total, participant) => total + participant.basisPoints,
        0,
      ) !== 10_000
    )
      context.addIssue({
        code: "custom",
        message: "Percentages must total 100%.",
        path: ["splitConfig"],
      });
  });

export const updateRecurringExpenseRuleSchema = recurringExpenseRuleSchema.and(
  z.object({ ruleId: uuidSchema }),
);
export const archiveRecurringExpenseRuleSchema = z.object({
  householdId: uuidSchema,
  ruleId: uuidSchema,
});
export const setRecurringExpenseRuleActiveSchema = archiveRecurringExpenseRuleSchema.extend({
  active: z.boolean(),
});
