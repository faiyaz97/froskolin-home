import { z } from "zod";

import { dateOnlySchema, uuidSchema } from "./common";

export const absenceRangeSchema = z
  .object({ startDate: dateOnlySchema, endDate: dateOnlySchema })
  .refine((range) => range.startDate <= range.endDate, {
    message: "An away period cannot end before it starts.",
    path: ["endDate"],
  });

export const replaceAbsencesSchema = z.object({
  householdId: uuidSchema,
  memberId: uuidSchema,
  ranges: z.array(absenceRangeSchema).max(100),
});
