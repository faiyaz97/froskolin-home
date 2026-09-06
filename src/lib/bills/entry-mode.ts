export type BillFinancialValues = {
  total: string;
  fixed: string;
  variable: string;
};

export type BillFinancialBaseline = {
  totalCents: number | null;
  fixedCents: number | null;
  variableCents: number | null;
};

function inputCents(value: string): number | null | undefined {
  if (value.trim() === "") return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

export function determineBillEntryMode(
  values: BillFinancialValues,
  aiBaseline?: BillFinancialBaseline,
): "ai" | "manual" {
  if (!aiBaseline) return "manual";
  return inputCents(values.total) === aiBaseline.totalCents &&
    inputCents(values.fixed) === aiBaseline.fixedCents &&
    inputCents(values.variable) === aiBaseline.variableCents
    ? "ai"
    : "manual";
}
