import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

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

function joinPinEncryptionKey(): Buffer {
  return createHash("sha256").update(`froskolin-household-join-pin\u0000${pinPepper()}`).digest();
}

/** Encrypts the owner-visible copy. Joining still verifies the separate HMAC digest. */
export function encryptJoinPin(pin: string): string {
  if (!PERSONAL_PIN_PATTERN.test(pin)) throw new Error("Join PIN must be exactly six digits.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", joinPinEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptJoinPin(value: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext) {
    throw new Error("Stored Join PIN is invalid.");
  }
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      joinPinEncryptionKey(),
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    const pin = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    if (!PERSONAL_PIN_PATTERN.test(pin)) throw new Error("Stored Join PIN is invalid.");
    return pin;
  } catch {
    throw new Error("Stored Join PIN could not be decrypted.");
  }
}
