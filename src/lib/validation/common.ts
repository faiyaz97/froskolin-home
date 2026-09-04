import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, "Use a three-letter currency code.");
export const centsSchema = z.coerce.number().int().safe().nonnegative();
export const signedCentsSchema = z.coerce.number().int().safe();
export const positiveCentsSchema = z.coerce.number().int().safe().positive();
export const nonEmptyTextSchema = z.string().trim().min(1).max(120);
export const displayNameSchema = z.string().trim().min(1).max(40);

export function dateRangeIsValid(start: string, end: string): boolean {
  return start <= end;
}
