import type { PlannedBillShare } from "./bill-payment-plan";

export type RecordedBillAllocation = {
  memberId: string;
  paidByMemberId: string | null;
  amountCents: number;
};

export type BillMemberContribution = {
  memberId: string;
  currency: string;
  originalShareCents: number;
  remainingShareCents: number;
  paidToLandlordCents: number;
  plannedToLandlordCents: number;
  toLandlordCents: number;
  paid: boolean;
  coveredBy: Array<{ memberId: string; amountCents: number; recorded: boolean }>;
  includes: Array<{ memberId: string; amountCents: number }>;
};

/** Reconciles immutable physical payments with the current unpaid-bill plan. */
export function calculateBillMemberContributions(
  shares: readonly PlannedBillShare[],
  payments: readonly RecordedBillAllocation[],
): BillMemberContribution[] {
  if (!shares.length) return [];
  const currency = shares[0]!.currency;
  const rows = new Map<string, BillMemberContribution>();
  const get = (memberId: string) => {
    let row = rows.get(memberId);
    if (!row) {
      row = {
        memberId,
        currency,
        originalShareCents: 0,
        remainingShareCents: 0,
        paidToLandlordCents: 0,
        plannedToLandlordCents: 0,
        toLandlordCents: 0,
        paid: false,
        coveredBy: [],
        includes: [],
      };
      rows.set(memberId, row);
    }
    return row;
  };
  for (const share of shares) {
    if (share.currency !== currency) throw new RangeError("bill currencies differ");
    const row = get(share.memberId);
    row.originalShareCents += share.originalShareCents;
    row.remainingShareCents += share.remainingCents;
    for (const payer of share.plannedPayers) {
      if (!Number.isSafeInteger(payer.amountCents) || payer.amountCents <= 0)
        throw new RangeError("planned bill amount is invalid");
      const payerRow = get(payer.memberId);
      payerRow.plannedToLandlordCents += payer.amountCents;
      if (payer.memberId !== share.memberId) {
        row.coveredBy.push({
          memberId: payer.memberId,
          amountCents: payer.amountCents,
          recorded: false,
        });
        payerRow.includes.push({ memberId: share.memberId, amountCents: payer.amountCents });
      }
    }
  }
  const recordedByBeneficiary = new Map<string, number>();
  for (const payment of payments) {
    if (!Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0)
      throw new RangeError("recorded bill amount is invalid");
    const payerId = payment.paidByMemberId ?? payment.memberId;
    const ownerRow = get(payment.memberId);
    const payerRow = get(payerId);
    recordedByBeneficiary.set(
      payment.memberId,
      (recordedByBeneficiary.get(payment.memberId) ?? 0) + payment.amountCents,
    );
    payerRow.paidToLandlordCents += payment.amountCents;
    if (payerId !== payment.memberId) {
      ownerRow.coveredBy.push({
        memberId: payerId,
        amountCents: payment.amountCents,
        recorded: true,
      });
      payerRow.includes.push({ memberId: payment.memberId, amountCents: payment.amountCents });
    }
  }
  for (const share of shares) {
    if ((recordedByBeneficiary.get(share.memberId) ?? 0) !== share.paidCents)
      throw new RangeError("recorded bill payments do not match paid shares");
  }
  const participantOrder = new Map(shares.map((share, index) => [share.memberId, index]));
  const result = [...rows.values()]
    .sort(
      (a, b) =>
        (participantOrder.get(a.memberId) ?? Number.MAX_SAFE_INTEGER) -
        (participantOrder.get(b.memberId) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((row) => ({
      ...row,
      toLandlordCents: row.paidToLandlordCents + row.plannedToLandlordCents,
      paid: row.remainingShareCents === 0 && row.plannedToLandlordCents === 0,
    }));
  const originalTotal = shares.reduce((sum, row) => sum + row.originalShareCents, 0);
  const landlordTotal = result.reduce((sum, row) => sum + row.toLandlordCents, 0);
  if (originalTotal !== landlordTotal)
    throw new RangeError("bill contributions do not add up to the bill total");
  return result;
}
