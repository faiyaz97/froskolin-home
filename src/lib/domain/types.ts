/** A calendar date, always encoded as YYYY-MM-DD. */
export type DateOnly = string;

export interface DateRange {
  startDate: DateOnly;
  endDate: DateOnly;
}

export interface Share {
  memberId: string;
  amountCents: number;
}

export interface UtilityShare extends Share {
  fixedCents: number;
  variableCents: number;
  presenceDays: number;
}

export type UtilityVariableMode = "occupancy" | "equal_zero_presence_fallback";
