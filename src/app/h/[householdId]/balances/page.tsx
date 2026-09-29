import { BalanceView } from "@/components/expenses/balance-view";
import type { AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { LANDLORD_BALANCE_ID } from "@/lib/domain/all-balances";
import { effectiveBalanceStrategy } from "@/lib/domain/balance-strategy";
import { calculateConstrainedAllBalances } from "@/lib/domain/constrained-all-balances";
import { routeDepartedSuggestions } from "@/lib/domain/balance-exit";
import { simplifyDebts, type DebtSuggestion } from "@/lib/domain/balances";
import {
  getAllLandlordShareBalances,
  getBalances,
  getHousehold,
  getHouseholdMembers,
  getPairBalances,
} from "@/lib/queries";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [{ membership }, home, members, groupRows, pairRows] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getBalances(householdId),
    getPairBalances(householdId),
  ]);

  const strategy = effectiveBalanceStrategy(
    home?.balance_strategy ?? "simplified",
    Boolean(home?.landlord_enabled),
  );
  const superSimplified = strategy === "super_simplified";
  const groupBalances = groupRows.map((row) => ({
    memberId: row.member_id,
    currency: row.currency,
    amountCents: Number(row.net_cents),
  }));
  const landlordShares = home?.landlord_enabled
    ? await getAllLandlordShareBalances(householdId)
    : [];
  const landlordOutstanding = landlordShares
    .filter((row) => row.remainingCents > 0)
    .map((row) => ({
      memberId: row.memberId,
      currency: row.currency,
      amountCents: row.remainingCents,
    }));
  let suggestions: DebtSuggestion[];
  let memberBalances = groupBalances;
  if (superSimplified) {
    const projection = calculateConstrainedAllBalances(groupBalances, landlordShares);
    suggestions = projection.suggestions;
    memberBalances = projection.members.map((row) => ({
      memberId: row.memberId,
      currency: row.currency,
      amountCents: row.combinedCents,
    }));
  } else if (strategy === "simplified") {
    suggestions = simplifyDebts(groupBalances);
  } else {
    suggestions = pairRows.map((row) => ({
      fromMemberId: row.paying_member_id,
      toMemberId: row.receiving_member_id,
      currency: row.currency,
      amountCents: Number(row.amount_cents),
    }));
  }
  if (!superSimplified) {
    const landlordByMember = new Map<string, number>();
    for (const row of landlordOutstanding) {
      const key = `${row.currency}\u0000${row.memberId}`;
      landlordByMember.set(key, (landlordByMember.get(key) ?? 0) + row.amountCents);
    }
    suggestions.push(
      ...[...landlordByMember].map(([key, amountCents]) => {
        const [currency, fromMemberId] = key.split("\u0000");
        return { fromMemberId, toMemberId: LANDLORD_BALANCE_ID, currency, amountCents };
      }),
    );
    memberBalances = groupBalances.map((row) => ({
      ...row,
      amountCents:
        row.amountCents - (landlordByMember.get(`${row.currency}\u0000${row.memberId}`) ?? 0),
    }));
    for (const [key, amountCents] of landlordByMember) {
      const [currency, memberId] = key.split("\u0000");
      if (!memberBalances.some((row) => row.memberId === memberId && row.currency === currency))
        memberBalances.push({ memberId, currency, amountCents: -amountCents });
    }
  }
  suggestions = routeDepartedSuggestions(
    suggestions,
    new Set(members.filter((member) => member.removed_at).map((member) => member.id)),
  );
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Balances" />
      <BalanceView
        householdId={householdId}
        currentMemberId={membership.id}
        locale={home?.locale ?? "en-GB"}
        members={members
          .filter(
            (member) =>
              !member.removed_at ||
              suggestions.some(
                (row) => row.fromMemberId === member.id || row.toMemberId === member.id,
              ),
          )
          .map((member) => ({
            id: member.id,
            name: member.display_name,
            avatarColor: member.avatar_color as AvatarColor | null,
          }))}
        suggestions={suggestions}
        balances={memberBalances}
        strategyLabel={
          strategy === "super_simplified"
            ? "Combined"
            : strategy === "simplified"
              ? "Simplified"
              : "Standard"
        }
      />
    </div>
  );
}
