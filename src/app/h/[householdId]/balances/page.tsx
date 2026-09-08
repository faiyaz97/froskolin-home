import { CheckCircle2 } from "lucide-react";

import { GroupBalancesView } from "@/components/expenses/group-balances-view";
import type { AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { getBalances, getHousehold, getHouseholdMembers, getPairBalances } from "@/lib/queries";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [{ membership }, home, members, rows, pairRows] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getBalances(householdId),
    getPairBalances(householdId),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Group balances" />

      {!rows.length ? (
        <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-5 shadow-[var(--shadow-sm)]">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <p className="font-black">All settled</p>
        </div>
      ) : (
        <GroupBalancesView
          householdId={householdId}
          currentMemberId={membership.id}
          locale={home?.locale ?? "en-GB"}
          members={members.map((member) => ({
            id: member.id,
            name: member.display_name,
            avatarColor: member.avatar_color as AvatarColor | null,
          }))}
          balances={rows.map((row) => ({
            memberId: row.member_id,
            currency: row.currency,
            amountCents: Number(row.net_cents),
          }))}
          pairBalances={pairRows.map((row) => ({
            payingMemberId: row.paying_member_id,
            receivingMemberId: row.receiving_member_id,
            currency: row.currency,
            amountCents: Number(row.amount_cents),
          }))}
        />
      )}
    </div>
  );
}
