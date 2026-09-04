import { notFound } from "next/navigation";

import { RecurringForm } from "@/components/expenses/recurring-form";
import { PageHeader, StatusNote } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { normalSplitConfigSchema } from "@/lib/validation";

export default async function EditRecurringRulePage({
  params,
}: {
  params: Promise<{ householdId: string; ruleId: string }>;
}) {
  const { householdId, ruleId } = await params;
  const { supabase, membership } = await requireHouseholdMembership(householdId);
  const [homeResult, membersResult, ruleResult] = await Promise.all([
    supabase
      .from("households")
      .select("default_currency, landlord_enabled")
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select("id, display_name, removed_at")
      .eq("household_id", householdId)
      .order("joined_at"),
    supabase
      .from("recurring_expense_rules")
      .select(
        "id, title, amount_cents, currency, payer_member_id, paid_by_landlord, split_config, anchor_date, end_date, active, archived_at",
      )
      .eq("household_id", householdId)
      .eq("id", ruleId)
      .maybeSingle(),
  ]);
  if (homeResult.error || membersResult.error || ruleResult.error)
    throw homeResult.error ?? membersResult.error ?? ruleResult.error;
  if (!ruleResult.data || ruleResult.data.archived_at) notFound();
  const splitConfig = normalSplitConfigSchema.safeParse(ruleResult.data.split_config);
  if (!splitConfig.success) notFound();
  const participantIds = new Set(
    splitConfig.data.participants.map((participant) => participant.memberId),
  );
  const members = (membersResult.data ?? [])
    .filter((member) => !member.removed_at || participantIds.has(member.id))
    .map((member) => ({ id: member.id, name: member.display_name }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Monthly rule"
        title={`Edit ${ruleResult.data.title}`}
        description="Changes apply to future, ungenerated expenses only. Existing occurrences keep their own history."
      />
      <StatusNote title="No retroactive rewrite">
        Already generated expenses remain ordinary editable records. The new schedule starts with
        the next due occurrence.
      </StatusNote>
      <RecurringForm
        householdId={householdId}
        defaultCurrency={homeResult.data.default_currency}
        currentMemberId={membership.id}
        landlordEnabled={homeResult.data.landlord_enabled}
        members={members}
        initial={{
          ruleId,
          title: ruleResult.data.title,
          amountCents: Number(ruleResult.data.amount_cents),
          currency: ruleResult.data.currency,
          payerMemberId: ruleResult.data.paid_by_landlord
            ? "landlord"
            : ruleResult.data.payer_member_id,
          startDate: ruleResult.data.anchor_date,
          endDate: ruleResult.data.end_date ?? undefined,
          active: ruleResult.data.active,
          splitConfig: splitConfig.data,
        }}
      />
    </div>
  );
}
