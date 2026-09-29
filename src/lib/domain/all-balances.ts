import { simplifyDebts, type DebtSuggestion, type MemberCurrencyBalance } from "./balances";
import { assertCents } from "./money";

export const LANDLORD_BALANCE_ID = "landlord";

export interface LandlordOutstandingBalance {
  memberId: string;
  currency: string;
  amountCents: number;
}

export interface CombinedBalance {
  memberId: string;
  currency: string;
  groupCents: number;
  landlordCents: number;
  combinedCents: number;
}

/** A projection only: the group and landlord ledgers remain independent. */
export function calculateAllBalances(
  groupBalances: readonly MemberCurrencyBalance[],
  landlordBalances: readonly LandlordOutstandingBalance[],
): { members: CombinedBalance[]; suggestions: DebtSuggestion[] } {
  const entries = new Map<string, CombinedBalance>();
  const key = (memberId: string, currency: string) => `${currency}\u0000${memberId}`;
  const get = (memberId: string, currency: string) => {
    const id = key(memberId, currency);
    let entry = entries.get(id);
    if (!entry) {
      entry = { memberId, currency, groupCents: 0, landlordCents: 0, combinedCents: 0 };
      entries.set(id, entry);
    }
    return entry;
  };
  for (const balance of groupBalances) {
    if (!Number.isSafeInteger(balance.amountCents))
      throw new RangeError("group balance must be a safe integer");
    get(balance.memberId, balance.currency).groupCents += balance.amountCents;
  }
  const landlordByCurrency = new Map<string, number>();
  for (const balance of landlordBalances) {
    assertCents(balance.amountCents, "landlord outstanding");
    const entry = get(balance.memberId, balance.currency);
    entry.landlordCents += balance.amountCents;
    landlordByCurrency.set(
      balance.currency,
      (landlordByCurrency.get(balance.currency) ?? 0) + balance.amountCents,
    );
  }
  const members = [...entries.values()]
    .map((entry) => ({
      ...entry,
      combinedCents: entry.groupCents - entry.landlordCents,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency) || a.memberId.localeCompare(b.memberId));
  const suggestions = simplifyDebts([
    ...members.map((entry) => ({
      memberId: entry.memberId,
      currency: entry.currency,
      amountCents: entry.combinedCents,
    })),
    ...[...landlordByCurrency.entries()].map(([currency, amountCents]) => ({
      memberId: LANDLORD_BALANCE_ID,
      currency,
      amountCents,
    })),
  ]);
  return { members, suggestions };
}
