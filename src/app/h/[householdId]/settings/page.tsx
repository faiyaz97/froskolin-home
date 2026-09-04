import { SettingsPanel } from "@/components/household/settings-panel";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { getHouseholdJoinPinAction } from "@/lib/actions";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const { supabase, user, membership } = await requireHouseholdMembership(householdId);
  const [homeResult, membersResult, rulesResult] = await Promise.all([
    supabase
      .from("households")
      .select(
        "name, default_currency, locale, timezone, house_code, joining_enabled, landlord_enabled",
      )
      .eq("id", householdId)
      .single(),
    supabase
      .from("household_members")
      .select("id, user_id, display_name, role, removed_at, avatar_color")
      .eq("household_id", householdId)
      .order("joined_at"),
    supabase
      .from("recurring_expense_rules")
      .select("id, title, amount_cents, currency, next_due_date, active, archived_at")
      .eq("household_id", householdId)
      .is("archived_at", null)
      .order("created_at"),
  ]);
  if (homeResult.error || membersResult.error || rulesResult.error)
    throw homeResult.error ?? membersResult.error ?? rulesResult.error;
  const joinPinResult =
    membership.role === "owner" ? await getHouseholdJoinPinAction(householdId) : null;
  return (
    <>
      <PageHeader title="Household settings" />
      <SettingsPanel
        householdId={householdId}
        home={{
          name: homeResult.data.name,
          defaultCurrency: homeResult.data.default_currency,
          locale: homeResult.data.locale,
          timezone: homeResult.data.timezone,
          houseCode: homeResult.data.house_code,
          joinPin: joinPinResult?.ok ? joinPinResult.data.joinPin : null,
          joiningEnabled: homeResult.data.joining_enabled,
          landlordEnabled: homeResult.data.landlord_enabled,
        }}
        currentUserId={user.id}
        isOwner={membership.role === "owner"}
        members={(membersResult.data ?? []).map((member) => ({
          id: member.id,
          userId: member.user_id,
          name: member.display_name,
          role: member.role,
          removed: Boolean(member.removed_at),
          avatarColor: member.avatar_color,
        }))}
        rules={(rulesResult.data ?? []).map((rule) => ({
          id: rule.id,
          title: rule.title,
          amountCents: Number(rule.amount_cents),
          currency: rule.currency,
          nextDueDate: rule.next_due_date,
          active: rule.active,
        }))}
      />
    </>
  );
}
