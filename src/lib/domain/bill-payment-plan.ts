import type { DebtSuggestion } from "./balances";
import { LANDLORD_BALANCE_ID } from "./all-balances";

export type OpenBillShare = {
  expenseId: string;
  memberId: string;
  currency: string;
  expenseDate: string;
  createdAt?: string;
  originalShareCents: number;
  paidCents: number;
  remainingCents: number;
};

export type PlannedBillShare = OpenBillShare & {
  /** Cash this member is expected to send for this bill, including other members' shares. */
  currentDueCents: number;
  /** Cash another member is currently expected to send for this share. */
  coveredByOthersCents: number;
  plannedPayers: Array<{ memberId: string; amountCents: number }>;
};

/** Mirrors the landlord-payment RPC's own-share-first allocation with older covers first. */
export function projectBillPaymentPlan(
  shares: readonly OpenBillShare[],
  suggestions: readonly DebtSuggestion[],
  departedIds: ReadonlySet<string> = new Set(),
): PlannedBillShare[] {
  const rows = shares.map((share) => {
    if (
      !Number.isSafeInteger(share.originalShareCents) ||
      !Number.isSafeInteger(share.paidCents) ||
      !Number.isSafeInteger(share.remainingCents) ||
      share.originalShareCents < 0 ||
      share.paidCents < 0 ||
      share.remainingCents < 0 ||
      share.paidCents + share.remainingCents !== share.originalShareCents
    ) {
      throw new RangeError("bill share payment amounts are inconsistent");
    }
    return {
      ...share,
      currentDueCents: 0,
      coveredByOthersCents: 0,
      plannedPayers: [] as Array<{ memberId: string; amountCents: number }>,
      unplannedCents: share.remainingCents,
    };
  });
  const rowByBillAndMember = new Map(
    rows.map((share) => [`${share.expenseId}\u0000${share.memberId}`, share]),
  );

  const landlordSuggestions = suggestions.filter(
    (suggestion) => suggestion.toMemberId === LANDLORD_BALANCE_ID,
  );
  const remainingBySuggestion = new Map<DebtSuggestion, number>();
  for (const suggestion of landlordSuggestions) {
    if (!Number.isSafeInteger(suggestion.amountCents) || suggestion.amountCents <= 0) {
      throw new RangeError("landlord suggestion must be positive integer cents");
    }
    remainingBySuggestion.set(suggestion, suggestion.amountCents);
  }
  // Route departed members' unpaid shares first, then reserve each active
  // payer's own shares before assigning surplus to others. Filling a payer's
  // newer own shares leaves their group credit on the earliest bill.
  for (const phase of ["departed", "own", "other"] as const) {
    for (const suggestion of landlordSuggestions) {
      let amountLeft = remainingBySuggestion.get(suggestion)!;
      const candidates = rows
        .filter(
          (share) =>
            share.currency === suggestion.currency &&
            share.unplannedCents > 0 &&
            (phase === "departed"
              ? departedIds.has(share.memberId)
              : phase === "own"
                ? !departedIds.has(share.memberId) && share.memberId === suggestion.fromMemberId
                : !departedIds.has(share.memberId) && share.memberId !== suggestion.fromMemberId),
        )
        .sort(
          (a, b) =>
            (phase === "own"
              ? b.expenseDate.localeCompare(a.expenseDate)
              : a.expenseDate.localeCompare(b.expenseDate)) ||
            (phase === "own"
              ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
              : (a.createdAt ?? "").localeCompare(b.createdAt ?? "")) ||
            (phase === "own"
              ? b.expenseId.localeCompare(a.expenseId)
              : a.expenseId.localeCompare(b.expenseId)) ||
            a.memberId.localeCompare(b.memberId),
        );
      for (const share of candidates) {
        if (amountLeft === 0) break;
        const amountCents = Math.min(amountLeft, share.unplannedCents);
        share.unplannedCents -= amountCents;
        amountLeft -= amountCents;
        if (share.memberId !== suggestion.fromMemberId) {
          share.coveredByOthersCents += amountCents;
        }
        const payerRow = rowByBillAndMember.get(
          `${share.expenseId}\u0000${suggestion.fromMemberId}`,
        );
        // An already paid member's row stays paid/zero; later cover for someone
        // else is shown separately in the bill plan rather than reopening it.
        if (payerRow && payerRow.remainingCents > 0) payerRow.currentDueCents += amountCents;
        share.plannedPayers.push({ memberId: suggestion.fromMemberId, amountCents });
      }
      remainingBySuggestion.set(suggestion, amountLeft);
    }
  }
  if ([...remainingBySuggestion.values()].some((amountLeft) => amountLeft > 0))
    throw new RangeError("landlord plan exceeds unpaid bill shares");
  if (rows.some((share) => share.unplannedCents > 0)) {
    throw new RangeError("landlord plan does not cover every unpaid bill share");
  }
  return rows.map((share) => ({
    expenseId: share.expenseId,
    memberId: share.memberId,
    currency: share.currency,
    expenseDate: share.expenseDate,
    createdAt: share.createdAt,
    originalShareCents: share.originalShareCents,
    paidCents: share.paidCents,
    remainingCents: share.remainingCents,
    currentDueCents: share.currentDueCents,
    coveredByOthersCents: share.coveredByOthersCents,
    plannedPayers: share.plannedPayers,
  }));
}
