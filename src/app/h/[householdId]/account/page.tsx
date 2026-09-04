import { PersonalSettingsPanel } from "@/components/household/personal-settings-panel";
import type { AvatarColor } from "@/components/household/member-avatar";
import { requireHouseholdMembership } from "@/lib/auth";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const { supabase, membership } = await requireHouseholdMembership(householdId);
  const [memberResult, householdResult] = await Promise.all([
    supabase
      .from("household_members")
      .select("display_name, avatar_color")
      .eq("id", membership.id)
      .single(),
    supabase.from("households").select("house_code").eq("id", householdId).single(),
  ]);
  if (memberResult.error || householdResult.error) {
    throw memberResult.error ?? householdResult.error;
  }

  return (
    <PersonalSettingsPanel
      householdId={householdId}
      houseCode={householdResult.data.house_code}
      initialName={memberResult.data.display_name}
      initialAvatarColor={(memberResult.data.avatar_color as AvatarColor | null) ?? null}
    />
  );
}
