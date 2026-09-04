import { z } from "zod";

import {
  centsSchema,
  currencySchema,
  dateOnlySchema,
  nonEmptyTextSchema,
  positiveCentsSchema,
  uuidSchema,
} from "./common";

export const splitMethodSchema = z.enum(["equal", "exact", "percentage", "utility"]);
export const payerSelectionSchema = z.union([uuidSchema, z.literal("landlord")]);
export const participantSchema = z.object({
  memberId: uuidSchema,
  order: z.coerce.number().int().nonnegative(),
});

const equalSplitSchema = z.object({
  method: z.literal("equal"),
  participants: z.array(participantSchema).min(1),
});
const exactSplitSchema = z.object({
  method: z.literal("exact"),
  participants: z.array(participantSchema.extend({ amountCents: centsSchema })).min(1),
});
const percentageSplitSchema = z.object({
  method: z.literal("percentage"),
  participants: z
    .array(participantSchema.extend({ basisPoints: z.coerce.number().int().min(0).max(10_000) }))
    .min(1),
});

export const normalSplitConfigSchema = z
  .discriminatedUnion("method", [equalSplitSchema, exactSplitSchema, percentageSplitSchema])
  .superRefine((value, context) => {
    const ids = value.participants.map((participant) => participant.memberId);
    const orders = value.participants.map((participant) => participant.order);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        message: "Each participant may appear only once.",
        path: ["participants"],
      });
    if (new Set(orders).size !== orders.length)
      context.addIssue({
        code: "custom",
        message: "Participant allocation order must be unique.",
        path: ["participants"],
      });
  });

export const expenseInputSchema = z
  .object({
    householdId: uuidSchema,
    title: nonEmptyTextSchema,
    totalCents: positiveCentsSchema,
    currency: currencySchema,
    payerMemberId: payerSelectionSchema,
    expenseDate: dateOnlySchema,
    splitConfig: normalSplitConfigSchema,
  })
  .superRefine((value, context) => {
    if (value.splitConfig.method === "exact") {
      const sum = value.splitConfig.participants.reduce(
        (total, participant) => total + participant.amountCents,
        0,
      );
      if (sum !== value.totalCents)
        context.addIssue({
          code: "custom",
          message: "Exact shares must equal the expense total.",
          path: ["splitConfig"],
        });
    }
    if (value.splitConfig.method === "percentage") {
      const sum = value.splitConfig.participants.reduce(
        (total, participant) => total + participant.basisPoints,
        0,
      );
      if (sum !== 10_000)
        context.addIssue({
          code: "custom",
          message: "Percentages must total 100%.",
          path: ["splitConfig"],
        });
    }
  });

export const voidExpenseSchema = z.object({
  householdId: uuidSchema,
  expenseId: uuidSchema,
  reason: z.string().trim().min(1).max(280),
});
export const updateExpenseSchema = expenseInputSchema.and(z.object({ expenseId: uuidSchema }));
export const voidSettlementSchema = z.object({
  householdId: uuidSchema,
  settlementId: uuidSchema,
  reason: z.string().trim().min(1).max(280),
});

export const settlementInputSchema = z
  .object({
    householdId: uuidSchema,
    payingMemberId: uuidSchema,
    receivingMemberId: uuidSchema,
    amountCents: positiveCentsSchema,
    currency: currencySchema,
    settlementDate: dateOnlySchema,
    note: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.payingMemberId !== value.receivingMemberId, {
    message: "A settlement needs two different members.",
    path: ["receivingMemberId"],
  });

export const updateSettlementSchema = settlementInputSchema.and(
  z.object({ settlementId: uuidSchema }),
);

export const landlordPaymentSchema = z.object({
  householdId: uuidSchema,
  expenseId: uuidSchema,
  amountCents: centsSchema.optional(),
  markAsPaid: z.boolean().default(false),
});

export const reopenLandlordBillSchema = z.object({
  householdId: uuidSchema,
  expenseId: uuidSchema,
});
