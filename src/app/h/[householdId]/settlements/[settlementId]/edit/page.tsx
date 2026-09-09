import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SettlementForm } from "@/components/expenses/settlement-form";
import type { AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";

export default async function EditSettlementPage({
  params,
}: {
  params: Promise<{ householdId: string; settlementId: string }>;
}) {
  const { householdId, settlementId } = await params;
  const { supabase, membership } = await requireHouseholdMembership(householdId);
  const [settlementResult, homeResult, membersResult] = await Promise.all([
    supabase
      .from("settlements")
      .select("*")
      .eq("household_id", householdId)
      .eq("id", settlementId)
      .maybeSingle(),
    supabase.from("households").select("default_currency").eq("id", householdId).single(),
    supabase
      .from("household_members")
      .select("id, display_name, avatar_color, removed_at")
      .eq("household_id", householdId)
      .order("joined_at"),
  ]);
  if (settlementResult.error || homeResult.error || membersResult.error) {
    throw settlementResult.error ?? homeResult.error ?? membersResult.error;
  }
  const settlement = settlementResult.data;
  if (!settlement || settlement.voided_at) notFound();

  const involvedIds = new Set([settlement.paying_member_id, settlement.receiving_member_id]);
  const members = (membersResult.data ?? [])
    .filter((member) => !member.removed_at || involvedIds.has(member.id))
    .map((member) => ({
      id: member.id,
      name: member.display_name,
      avatarColor: member.avatar_color as AvatarColor | null,
    }));
  const viewHref = `/h/${householdId}/settlements/${settlementId}`;

  return (
    <div className="transaction-form-frame mx-auto flex max-w-2xl flex-col">
      <Link
        href={viewHref}
        className="mb-5 hidden min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[var(--muted)] no-underline hover:bg-white hover:text-[var(--ink)] md:inline-flex"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Payment
      </Link>
      <PageHeader title="Edit payment" compact />
      <SettlementForm
        householdId={householdId}
        defaultCurrency={homeResult.data.default_currency}
        currentMemberId={membership.id}
        members={members}
        cancelHref={viewHref}
        initial={{
          settlementId,
          payingMemberId: settlement.paying_member_id,
          receivingMemberId: settlement.receiving_member_id,
          amountCents: Number(settlement.amount_cents),
          currency: settlement.currency,
          settlementDate: settlement.settlement_date,
          note: settlement.note ?? undefined,
        }}
      />
    </div>
  );
}
