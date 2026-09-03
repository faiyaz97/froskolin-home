import "server-only";

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const PERSONAL_PIN_PATTERN = /^\d{6}$/;
const LEGACY_OR_CURRENT_PIN_PATTERN = /^(?:\d{4}|\d{6})$/;
const HOUSE_CODE_PATTERN = /^FROSKO-\d{4}$/;

export const GENERIC_AUTH_ERROR = "We couldn't sign you in with those details.";

export function isSixDigitPin(value: string): boolean {
  return PERSONAL_PIN_PATTERN.test(value);
}

export function assertPersonalPin(value: string): void {
  if (!LEGACY_OR_CURRENT_PIN_PATTERN.test(value)) {
    throw new Error("PIN must be exactly six digits.");
  }
}

function pinPepper(): string {
  const pepper = process.env.PIN_PEPPER;
  if (!pepper) throw new Error("PIN authentication is unavailable: PIN_PEPPER is not configured.");
  return pepper;
}

/** This value is only sent server-to-server to Supabase Auth. */
export function deriveSupabasePassword(alias: string, pin: string): string {
  assertPersonalPin(pin);
  return createHmac("sha256", pinPepper()).update(`${alias}\u0000${pin}`).digest("base64url");
}

export function createInternalAuthAlias(): string {
  return `fh-${randomBytes(18).toString("hex")}@auth.froskolin.invalid`;
}

export function normalizeHouseCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isHouseCode(value: string): boolean {
  return HOUSE_CODE_PATTERN.test(normalizeHouseCode(value));
}

export function createHouseCode(): string {
  return `FROSKO-${randomInt(1000, 10_000)}`;
}

/** Deprecated compatibility digest for the original household-code column. */
export function digestAccessCode(code: string): string {
  return createHmac("sha256", pinPepper())
    .update(`household-code\u0000${normalizeHouseCode(code)}`)
    .digest("hex");
}

export function digestJoinPin(pin: string): string {
  if (!PERSONAL_PIN_PATTERN.test(pin)) throw new Error("Join PIN must be exactly six digits.");
  return createHmac("sha256", pinPepper()).update(`household-join-pin\u0000${pin}`).digest("hex");
}

export function matchesJoinPin(value: string, digest: string | null): boolean {
  if (!digest || !PERSONAL_PIN_PATTERN.test(value)) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = Buffer.from(digestJoinPin(value), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
