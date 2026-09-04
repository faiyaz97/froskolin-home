export type LandlordOutstandingInput = {
  currency: string;
  originalShareCents: number;
  paymentCents: number[];
};

export function calculateLandlordRemainingCents(
  originalShareCents: number,
  paymentCents: number[],
) {
  if (!Number.isSafeInteger(originalShareCents) || originalShareCents < 0) {
    throw new RangeError("originalShareCents must be a nonnegative integer");
  }
  if (paymentCents.some((amount) => !Number.isSafeInteger(amount) || amount <= 0)) {
    throw new RangeError("landlord payments must be positive integer cents");
  }
  return Math.max(
    originalShareCents - paymentCents.reduce((total, amount) => total + amount, 0),
    0,
  );
}

export function totalLandlordOutstanding(rows: LandlordOutstandingInput[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const remaining = calculateLandlordRemainingCents(row.originalShareCents, row.paymentCents);
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + remaining);
  }
  return [...totals.entries()]
    .map(([currency, amountCents]) => ({ currency, amountCents }))
    .filter((row) => row.amountCents > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
