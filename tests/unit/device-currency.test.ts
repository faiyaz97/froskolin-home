import { describe, expect, it } from "vitest";

import { currencyFromLocale } from "@/lib/device-currency";

describe("currencyFromLocale", () => {
  it.each([
    ["en-GB", "GBP"],
    ["en-US", "USD"],
    ["it-IT", "EUR"],
    ["de-DE", "EUR"],
    ["en-CA", "EUR"],
    ["not a locale", "EUR"],
    [undefined, "EUR"],
  ])("maps %s to %s", (locale, expected) => {
    expect(currencyFromLocale(locale)).toBe(expected);
  });
});
