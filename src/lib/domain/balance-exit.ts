import type { DebtSuggestion } from "./balances";

/** Replaces a departed member's pass-through debts with payments between those still here. */
export function routeDepartedSuggestions(
  suggestions: readonly DebtSuggestion[],
  departedIds: ReadonlySet<string>,
): DebtSuggestion[] {
  let rows = suggestions.map((row) => ({ ...row }));
  for (const memberId of [...departedIds].sort()) {
    const incoming = rows.filter((row) => row.toMemberId === memberId);
    const outgoing = rows.filter((row) => row.fromMemberId === memberId);
    rows = rows.filter((row) => row.toMemberId !== memberId && row.fromMemberId !== memberId);
    for (const currency of new Set([...incoming, ...outgoing].map((row) => row.currency))) {
      const payers = incoming.filter((row) => row.currency === currency).map((row) => ({ ...row }));
      const recipients = outgoing
        .filter((row) => row.currency === currency)
        .map((row) => ({ ...row }));
      let payerIndex = 0;
      let recipientIndex = 0;
      while (payerIndex < payers.length && recipientIndex < recipients.length) {
        const payer = payers[payerIndex]!;
        const recipient = recipients[recipientIndex]!;
        const amountCents = Math.min(payer.amountCents, recipient.amountCents);
        if (payer.fromMemberId !== recipient.toMemberId)
          rows.push({
            currency,
            fromMemberId: payer.fromMemberId,
            toMemberId: recipient.toMemberId,
            amountCents,
          });
        payer.amountCents -= amountCents;
        recipient.amountCents -= amountCents;
        if (payer.amountCents === 0) payerIndex += 1;
        if (recipient.amountCents === 0) recipientIndex += 1;
      }
      if (payerIndex !== payers.length || recipientIndex !== recipients.length)
        throw new RangeError("departed member has an unsettled balance");
    }
  }
  const net = new Map<string, number>();
  for (const row of rows) {
    const [a, b] = [row.fromMemberId, row.toMemberId].sort();
    const key = `${row.currency}\u0000${a}\u0000${b}`;
    net.set(
      key,
      (net.get(key) ?? 0) + (row.fromMemberId === a ? row.amountCents : -row.amountCents),
    );
  }
  return [...net.entries()]
    .filter(([, cents]) => cents !== 0)
    .map(([key, cents]) => {
      const [currency, a, b] = key.split("\u0000");
      return {
        currency: currency!,
        fromMemberId: cents > 0 ? a! : b!,
        toMemberId: cents > 0 ? b! : a!,
        amountCents: Math.abs(cents),
      };
    })
    .sort(
      (a, b) =>
        a.currency.localeCompare(b.currency) ||
        a.fromMemberId.localeCompare(b.fromMemberId) ||
        a.toMemberId.localeCompare(b.toMemberId),
    );
}
