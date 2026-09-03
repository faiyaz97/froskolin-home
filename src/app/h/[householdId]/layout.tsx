import { redirect } from "next/navigation";

import { AppShell } from "@/components/household/app-shell";
import { requireHouseholdMembership } from "@/lib/auth";

export default async function HouseholdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  let shell: {
    householdName: string;
    memberName: string;
    memberRole: "owner" | "member";
    memberCount: number;
    unreadCount: number;
    mustChangePin: boolean;
  };
  try {
    const { supabase, user, membership } = await requireHouseholdMembership(householdId);
    const [homeResult, memberResult, countResult, unreadResult] = await Promise.all([
      supabase.from("households").select("name").eq("id", householdId).single(),
      supabase.from("household_members").select("display_name").eq("id", membership.id).single(),
      supabase
        .from("household_members")
        .select("id", { count: "exact", head: true })
        .eq("household_id", householdId)
        .is("removed_at", null),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_user_id", user.id)
        .eq("household_id", householdId)
        .is("read_at", null),
    ]);
    if (homeResult.error || memberResult.error) throw homeResult.error ?? memberResult.error;

    shell = {
      householdName: String(homeResult.data.name),
      memberName: String(memberResult.data.display_name),
      memberRole: membership.role,
      memberCount: countResult.count ?? 1,
      unreadCount: unreadResult.count ?? 0,
      mustChangePin: user.app_metadata.must_change_pin === true,
    };
  } catch {
    redirect(`/login?next=${encodeURIComponent(`/h/${householdId}`)}`);
  }
  if (shell.mustChangePin) redirect("/change-pin");
  return (
    <AppShell householdId={householdId} {...shell}>
      {children}
    </AppShell>
  );
}
