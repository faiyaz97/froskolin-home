import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SettlementForm } from "@/components/expenses/settlement-form";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusNote } from "@/components/ui/page";
import { voidSettlementAction } from "@/lib/actions";
import { requireHouseholdMembership } from "@/lib/auth";
import { formatMoney } from "@/lib/format";

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; settlementId: string }>;
}) {
  const { householdId, settlementId } = await params;
  const { supabase } = await requireHouseholdMembership(householdId);
  const [settlementResult, homeResult, membersResult] = await Promise.all([
    supabase
      .from("settlements")
      .select("*")
      .eq("household_id", householdId)
      .eq("id", settlementId)
      .maybeSingle(),
    supabase.from("households").select("default_currency, locale").eq("id", householdId).single(),
    supabase
      .from("household_members")
      .select("id, display_name, removed_at")
      .eq("household_id", householdId)
      .order("joined_at"),
  ]);
  if (settlementResult.error || homeResult.error || membersResult.error)
    throw settlementResult.error ?? homeResult.error ?? membersResult.error;
  const settlement = settlementResult.data;
  if (!settlement) notFound();
  const involvedIds = new Set([settlement.paying_member_id, settlement.receiving_member_id]);
  const members = (membersResult.data ?? [])
    .filter((member) => !member.removed_at || involvedIds.has(member.id))
    .map((member) => ({ id: member.id, name: member.display_name }));
  const names = new Map(members.map((member) => [member.id, member.name]));
  const voidSettlement = async () => {
    "use server";
    const result = await voidSettlementAction({
      householdId,
      settlementId,
      reason: "Voided from the settlement detail page.",
    });
    if (result.ok) redirect(`/h/${householdId}/balances`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/h/${householdId}/balances`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] no-underline"
      >
        <ArrowLeft className="size-4" /> Balances
      </Link>
      <PageHeader
        eyebrow="Settlement"
        title={`${names.get(settlement.paying_member_id) ?? "Former roommate"} paid ${names.get(settlement.receiving_member_id) ?? "Former roommate"}`}
        description={`${formatMoney(Number(settlement.amount_cents), settlement.currency, homeResult.data.locale)} · ${settlement.settlement_date}`}
      />
      {settlement.voided_at ? (
        <StatusNote tone="warning" title="This settlement was voided">
          It remains in Activity but no longer affects balances.
        </StatusNote>
      ) : (
        <>
          <SettlementForm
            householdId={householdId}
            defaultCurrency={homeResult.data.default_currency}
            members={members}
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
          <form action={voidSettlement} className="mt-6 border-t border-[var(--line)] pt-6">
            <Button type="submit" tone="danger">
              Void settlement
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
