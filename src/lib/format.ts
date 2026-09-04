export function formatMoney(cents: number, currency: string, locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDateTime(value: string, locale = "en-GB", timezone = "UTC"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

export function timestampToDateOnly(value: string, timezone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}

const utilityLabels: Record<string, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  internet: "Internet",
  other: "Utility",
};

export function formatUtilityBillTitle(
  utilityType: string,
  serviceStart: string,
  serviceEnd: string,
  locale = "en-GB",
): string {
  const label = utilityLabels[utilityType] ?? utilityLabels.other;
  if (!serviceStart || !serviceEnd) return `${label} bill`;
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
  const start = formatter.format(new Date(`${serviceStart}T00:00:00Z`)).replaceAll(".", "");
  const end = formatter.format(new Date(`${serviceEnd}T00:00:00Z`)).replaceAll(".", "");
  return `${label} ${start} - ${end}`;
}
