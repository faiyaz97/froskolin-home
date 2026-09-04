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
    unreadCount: number;
    mustChangePin: boolean;
    memberName: string;
    memberAvatarColor: string | null;
  };
  try {
    const { supabase, user, membership } = await requireHouseholdMembership(householdId);
    const unreadResult = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .eq("household_id", householdId)
      .is("read_at", null);
    if (unreadResult.error) throw unreadResult.error;

    shell = {
      unreadCount: unreadResult.count ?? 0,
      mustChangePin: user.app_metadata.must_change_pin === true,
      memberName: membership.display_name,
      memberAvatarColor: membership.avatar_color,
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
