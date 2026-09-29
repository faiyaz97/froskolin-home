import { SettlementForm } from "@/components/expenses/settlement-form";
import type { AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { simplifyDebts } from "@/lib/domain/balances";
import { LANDLORD_BALANCE_ID } from "@/lib/domain/all-balances";
import { calculateConstrainedAllBalances } from "@/lib/domain/constrained-all-balances";
import {
  getAllLandlordShareBalances,
  getBalances,
  getHousehold,
  getHouseholdMembers,
  getPairBalances,
} from "@/lib/queries";

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
    source?: string;
  }>;
}) {
  const [{ householdId }, query] = await Promise.all([params, searchParams]);
  const [{ membership }, home, members, balances, pairBalances, landlordShares] = await Promise.all(
    [
      requireHouseholdMembership(householdId),
      getHousehold(householdId),
      getHouseholdMembers(householdId),
      getBalances(householdId),
      getPairBalances(householdId),
      getAllLandlordShareBalances(householdId),
    ],
  );
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
  const ownLandlordOutstanding = landlordShares
    .filter((row) => row.memberId === membership.id && row.currency === homeCurrency)
    .reduce((sum, row) => sum + row.remainingCents, 0);
  const allSuggestions =
    home?.balance_strategy === "super_simplified" && home.landlord_enabled
      ? calculateConstrainedAllBalances(
          balances.map((row) => ({
            memberId: row.member_id,
            currency: row.currency,
            amountCents: Number(row.net_cents),
          })),
          landlordShares,
        ).suggestions.filter((row) => row.fromMemberId === membership.id)
      : [];
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
  const requestedAllSuggestion =
    query.source === "all"
      ? allSuggestions.find(
          (row) =>
            row.toMemberId === query.receivingMemberId &&
            row.currency === query.currency &&
            row.amountCents === requestedAmountCents &&
            Number.isSafeInteger(requestedAmountCents),
        )
      : undefined;
  const requestedLandlordPayment =
    query.source === "landlord" &&
    query.receivingMemberId === LANDLORD_BALANCE_ID &&
    query.payingMemberId === membership.id &&
    query.currency === homeCurrency &&
    Number.isSafeInteger(requestedAmountCents) &&
    requestedAmountCents > 0 &&
    requestedAmountCents <= ownLandlordOutstanding
      ? {
          fromMemberId: membership.id,
          toMemberId: LANDLORD_BALANCE_ID,
          currency: homeCurrency,
          amountCents: requestedAmountCents,
        }
      : undefined;
  const requestedGroupSuggestion = [...suggestions, ...actualSuggestions].find(
    (suggestion) =>
      query.payingMemberId === membership.id &&
      suggestion.fromMemberId === query.payingMemberId &&
      suggestion.toMemberId === query.receivingMemberId &&
      suggestion.currency === query.currency &&
      Number.isSafeInteger(requestedAmountCents) &&
      suggestion.amountCents === requestedAmountCents,
  );
  const requestedSuggestion =
    requestedAllSuggestion ?? requestedLandlordPayment ?? requestedGroupSuggestion;
  const defaultSuggestion =
    requestedSuggestion ??
    [
      ...(home?.balance_strategy === "simplified"
        ? preferredSuggestions.length
          ? preferredSuggestions
          : suggestions
        : actualSuggestions),
    ]
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
        landlordEnabled={Boolean(home?.landlord_enabled) || ownLandlordOutstanding > 0}
        source={requestedAllSuggestion ? "all" : requestedLandlordPayment ? "landlord" : undefined}
        cancelHref={
          requestedAllSuggestion || requestedLandlordPayment
            ? `/h/${householdId}/balances`
            : undefined
        }
        members={activeMembers.map((member) => ({
          id: member.id,
          name: member.display_name,
          avatarColor: member.avatar_color as AvatarColor | null,
        }))}
      />
    </div>
  );
}
