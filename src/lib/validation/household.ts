import { z } from "zod";

import { currencySchema, displayNameSchema, nonEmptyTextSchema, uuidSchema } from "./common";

const localeSchema = z
  .string()
  .trim()
  .min(2)
  .max(35)
  .refine((value) => {
    try {
      new Intl.NumberFormat(value);
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid locale, such as en-GB or it-IT.");

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA timezone, such as Europe/Rome.");

export const pinSchema = z.string().regex(/^\d{6}$/, "PIN must be exactly six digits.");
const currentOrLegacyPinSchema = z
  .string()
  .regex(/^(?:\d{4}|\d{6})$/, "PIN must be exactly six digits.");
export const houseCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z0-9](?:[A-Z0-9-]{4,22})[A-Z0-9]$/, "Use 6–24 letters, numbers, or hyphens."),
  );
export const joinPinSchema = z
  .string()
  .regex(/^\d{6}$/, "House Join PIN must be exactly six digits.");

export const createHouseholdSchema = z.object({
  householdName: nonEmptyTextSchema.max(80),
  displayName: displayNameSchema,
  pin: pinSchema,
  joinPin: joinPinSchema,
  defaultCurrency: currencySchema.default("EUR"),
  locale: localeSchema.default("en-GB"),
  timezone: timezoneSchema.default("UTC"),
});

export const joinHouseholdSchema = z.object({
  houseCode: houseCodeSchema,
  joinPin: joinPinSchema,
  displayName: displayNameSchema,
  pin: pinSchema,
});

export const loginSchema = z.object({
  houseCode: houseCodeSchema,
  displayName: displayNameSchema,
  pin: currentOrLegacyPinSchema,
});

export const changePinSchema = z.object({
  currentPin: currentOrLegacyPinSchema,
  newPin: pinSchema,
});

export const updateHouseholdAccessSchema = z.object({
  householdId: uuidSchema,
  houseCode: houseCodeSchema,
  joinPin: joinPinSchema,
});

export const updateHouseholdSchema = z.object({
  householdId: uuidSchema,
  name: nonEmptyTextSchema.max(80),
  defaultCurrency: currencySchema,
  locale: localeSchema,
  timezone: timezoneSchema,
  joiningEnabled: z.boolean(),
  landlordEnabled: z.boolean(),
});

export const removeMemberSchema = z.object({ householdId: uuidSchema, memberId: uuidSchema });

export const updatePersonalSettingsSchema = z.object({
  householdId: uuidSchema,
  displayName: displayNameSchema,
  avatarColor: z.enum(["teal", "violet", "orange", "blue", "rose", "indigo"]),
});
