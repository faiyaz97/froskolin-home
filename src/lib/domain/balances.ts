import { assertCents, assertUniqueMemberIds } from "./money";
import type { Share } from "./types";

export interface BalanceExpense {
  payerMemberId: string;
  currency: string;
  totalCents: number;
  shares: readonly Share[];
  voided?: boolean;
}

export interface BalanceSettlement {
  payingMemberId: string;
  receivingMemberId: string;
  currency: string;
  amountCents: number;
  voided?: boolean;
}

export interface MemberCurrencyBalance {
  memberId: string;
  currency: string;
  /** Positive means this member should receive money; negative means they owe. */
  amountCents: number;
}

function validateCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/.test(currency))
    throw new RangeError("currency must be a three-letter uppercase code");
}

/** Derives balances from the immutable ledger; it does not mutate any aggregate balance. */
export function calculateBalances(
  expenses: readonly BalanceExpense[],
  settlements: readonly BalanceSettlement[],
): MemberCurrencyBalance[] {
  const balances = new Map<string, number>();
  const add = (memberId: string, currency: string, delta: number) => {
    const key = `${currency}\u0000${memberId}`;
    balances.set(key, (balances.get(key) ?? 0) + delta);
  };

  for (const expense of expenses) {
    if (expense.voided) continue;
    validateCurrency(expense.currency);
    assertCents(expense.totalCents, "expense totalCents");
    if (!expense.payerMemberId) throw new RangeError("expense payerMemberId is required");
    assertUniqueMemberIds(expense.shares.map((share) => share.memberId));
    const shareTotal = expense.shares.reduce((sum, share) => {
      assertCents(share.amountCents, `share for ${share.memberId}`);
      return sum + share.amountCents;
    }, 0);
    if (shareTotal !== expense.totalCents)
      throw new RangeError("expense shares must equal expense total");
    add(expense.payerMemberId, expense.currency, expense.totalCents);
    for (const share of expense.shares) add(share.memberId, expense.currency, -share.amountCents);
  }

  for (const settlement of settlements) {
    if (settlement.voided) continue;
    validateCurrency(settlement.currency);
    assertCents(settlement.amountCents, "settlement amountCents", false);
    if (
      !settlement.payingMemberId ||
      !settlement.receivingMemberId ||
      settlement.payingMemberId === settlement.receivingMemberId
    ) {
      throw new RangeError("settlement parties must be distinct and non-empty");
    }
    add(settlement.payingMemberId, settlement.currency, settlement.amountCents);
    add(settlement.receivingMemberId, settlement.currency, -settlement.amountCents);
  }

  return [...balances.entries()]
    .map(([key, amountCents]) => {
      const [currency, memberId] = key.split("\u0000");
      return { memberId: memberId!, currency: currency!, amountCents };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency) || a.memberId.localeCompare(b.memberId));
}

export interface DebtSuggestion {
  currency: string;
  fromMemberId: string;
  toMemberId: string;
  amountCents: number;
}

/** Produces deterministic minimum-style payments from balanced, per-currency net balances. */
export function simplifyDebts(balances: readonly MemberCurrencyBalance[]): DebtSuggestion[] {
  const byCurrency = new Map<string, MemberCurrencyBalance[]>();
  for (const balance of balances) {
    validateCurrency(balance.currency);
    if (!Number.isSafeInteger(balance.amountCents))
      throw new RangeError("balance amount must be a safe integer");
    const list = byCurrency.get(balance.currency) ?? [];
    list.push(balance);
    byCurrency.set(balance.currency, list);
  }
  const suggestions: DebtSuggestion[] = [];
  for (const [currency, entries] of [...byCurrency.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const total = entries.reduce((sum, entry) => sum + entry.amountCents, 0);
    if (total !== 0) throw new RangeError(`balances for ${currency} must sum to zero`);
    const debtors = entries
      .filter((entry) => entry.amountCents < 0)
      .map((entry) => ({ ...entry, remaining: -entry.amountCents }))
      .sort((a, b) => a.memberId.localeCompare(b.memberId));
    const creditors = entries
      .filter((entry) => entry.amountCents > 0)
      .map((entry) => ({ ...entry, remaining: entry.amountCents }))
      .sort((a, b) => a.memberId.localeCompare(b.memberId));
    let debtorIndex = 0;
    let creditorIndex = 0;
    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex]!;
      const creditor = creditors[creditorIndex]!;
      const amountCents = Math.min(debtor.remaining, creditor.remaining);
      suggestions.push({
        currency,
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amountCents,
      });
      debtor.remaining -= amountCents;
      creditor.remaining -= amountCents;
      if (debtor.remaining === 0) debtorIndex += 1;
      if (creditor.remaining === 0) creditorIndex += 1;
    }
  }
  return suggestions;
}
