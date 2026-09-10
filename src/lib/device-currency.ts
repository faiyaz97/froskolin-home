export type SupportedCurrency = "EUR" | "GBP" | "USD";

const GBP_REGIONS = new Set(["GB", "GG", "IM", "JE"]);
const USD_REGIONS = new Set([
  "AS",
  "BQ",
  "EC",
  "FM",
  "GU",
  "MH",
  "MP",
  "PA",
  "PR",
  "PW",
  "SV",
  "TC",
  "TL",
  "UM",
  "US",
  "VG",
  "VI",
]);

export function currencyFromLocale(locale: string | undefined): SupportedCurrency {
  if (!locale) return "EUR";

  try {
    const region = new Intl.Locale(locale).maximize().region;
    if (region && GBP_REGIONS.has(region)) return "GBP";
    if (region && USD_REGIONS.has(region)) return "USD";
  } catch {
    return "EUR";
  }

  return "EUR";
}
