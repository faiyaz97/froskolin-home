/** A separately printed late-payment interest fee is a flat bill cost, not metered usage. */
export function isLatePaymentInterestCharge(row: {
  originalLabel: string;
  amountCents: number | null;
  kind: string;
  adjustsChargeIds: string[];
}): boolean {
  return (
    row.kind === "charge" &&
    row.amountCents !== null &&
    row.amountCents >= 0 &&
    row.adjustsChargeIds.length === 0 &&
    /\b(?:interessi?\s+(?:di\s+)?mora|late[ -]payment\s+interest|interest\s+(?:on|for)\s+late[ -]payment)\b/i.test(
      row.originalLabel,
    )
  );
}
