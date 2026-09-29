import {
  calculateAllBalances,
  LANDLORD_BALANCE_ID,
  type LandlordOutstandingBalance,
} from "./all-balances";
import type { DebtSuggestion, MemberCurrencyBalance } from "./balances";
import { projectBillPaymentPlan, type OpenBillShare } from "./bill-payment-plan";

/**
 * Keeps a fully paid member's contribution to that bill fixed. A later debt
 * goes to the unpaid share owner, with an offsetting member payment.
 */
export function calculateConstrainedAllBalances(
  groupBalances: readonly MemberCurrencyBalance[],
  shares: readonly OpenBillShare[],
) {
  const outstanding: LandlordOutstandingBalance[] = shares
    .filter((share) => share.remainingCents > 0)
    .map((share) => ({
      memberId: share.memberId,
      currency: share.currency,
      amountCents: share.remainingCents,
    }));
  const base = calculateAllBalances(groupBalances, outstanding);
  let suggestions = [...base.suggestions];
  const paidBillMembers = new Set(
    shares
      .filter((share) => share.originalShareCents > 0 && share.remainingCents === 0)
      .map((share) => `${share.expenseId}\u0000${share.memberId}`),
  );
  if (!paidBillMembers.size) return base;

  const merge = (rows: readonly DebtSuggestion[]): DebtSuggestion[] => {
    const combined = new Map<string, DebtSuggestion>();
    for (const row of rows) {
      if (row.amountCents === 0) continue;
      const key = `${row.currency}\u0000${row.fromMemberId}\u0000${row.toMemberId}`;
      const previous = combined.get(key);
      combined.set(key, {
        ...row,
        amountCents: (previous?.amountCents ?? 0) + row.amountCents,
      });
    }
    return [...combined.values()].filter((row) => row.amountCents > 0);
  };

  for (let pass = 0; pass <= shares.length * 2; pass++) {
    const plan = projectBillPaymentPlan(shares, suggestions);
    const reroutes: DebtSuggestion[] = [];
    for (const share of plan) {
      for (const payer of share.plannedPayers) {
        if (!paidBillMembers.has(`${share.expenseId}\u0000${payer.memberId}`)) continue;
        reroutes.push(
          {
            fromMemberId: payer.memberId,
            toMemberId: LANDLORD_BALANCE_ID,
            currency: share.currency,
            amountCents: -payer.amountCents,
          },
          {
            fromMemberId: share.memberId,
            toMemberId: LANDLORD_BALANCE_ID,
            currency: share.currency,
            amountCents: payer.amountCents,
          },
          {
            fromMemberId: payer.memberId,
            toMemberId: share.memberId,
            currency: share.currency,
            amountCents: payer.amountCents,
          },
        );
      }
    }
    if (!reroutes.length)
      return {
        ...base,
        suggestions: suggestions.sort(
          (a, b) =>
            Number(a.toMemberId === LANDLORD_BALANCE_ID) -
            Number(b.toMemberId === LANDLORD_BALANCE_ID),
        ),
      };
    suggestions = merge([...suggestions, ...reroutes]);
  }
  throw new RangeError("could not preserve paid bill contributions");
}
