import { SettlementForm } from "@/components/expenses/settlement-form";
import type { AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { simplifyDebts } from "@/lib/domain/balances";
import { getBalances, getHousehold, getHouseholdMembers, getPairBalances } from "@/lib/queries";

export default async function SettlementPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{
    payingMemberId?: string;
    receivingMemberId?: string;
    amountCents?: string;
    currency?: string;
  }>;
}) {
  const [{ householdId }, query] = await Promise.all([params, searchParams]);
  const [{ membership }, home, members, balances, pairBalances] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getBalances(householdId),
    getPairBalances(householdId),
  ]);
  const activeMembers = members.filter((member) => !member.removed_at);
  const activeMemberIds = new Set(activeMembers.map((member) => member.id));
  const homeCurrency = home?.default_currency ?? "EUR";
  const suggestions = simplifyDebts(
    balances.map((balance) => ({
      memberId: balance.member_id,
      currency: balance.currency,
      amountCents: Number(balance.net_cents),
    })),
  ).filter(
    (suggestion) =>
      suggestion.fromMemberId === membership.id && activeMemberIds.has(suggestion.toMemberId),
  );
  const preferredSuggestions = suggestions.filter(
    (suggestion) => suggestion.currency === homeCurrency,
  );
  const requestedAmountCents = Number(query.amountCents);
  const actualSuggestions = pairBalances
    .map((row) => ({
      fromMemberId: row.paying_member_id,
      toMemberId: row.receiving_member_id,
      currency: row.currency,
      amountCents: Number(row.amount_cents),
    }))
    .filter(
      (suggestion) =>
        suggestion.fromMemberId === membership.id && activeMemberIds.has(suggestion.toMemberId),
    );
  const requestedSuggestion = [...suggestions, ...actualSuggestions].find(
    (suggestion) =>
      query.payingMemberId === membership.id &&
      suggestion.fromMemberId === query.payingMemberId &&
      suggestion.toMemberId === query.receivingMemberId &&
      suggestion.currency === query.currency &&
      Number.isSafeInteger(requestedAmountCents) &&
      suggestion.amountCents === requestedAmountCents,
  );
  const defaultSuggestion =
    requestedSuggestion ??
    [...(preferredSuggestions.length ? preferredSuggestions : suggestions)]
      .sort((a, b) => b.amountCents - a.amountCents)
      .at(0);
  const defaultReceiverId =
    defaultSuggestion?.toMemberId ??
    activeMembers.find((member) => member.id !== membership.id)?.id;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Record a payment" />
      <SettlementForm
        householdId={householdId}
        currentMemberId={membership.id}
        defaultReceivingMemberId={defaultReceiverId}
        defaultAmountCents={requestedSuggestion?.amountCents}
        defaultCurrency={defaultSuggestion?.currency ?? homeCurrency}
        members={activeMembers.map((member) => ({
          id: member.id,
          name: member.display_name,
          avatarColor: member.avatar_color as AvatarColor | null,
        }))}
      />
    </div>
  );
}
