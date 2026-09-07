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
    mustChangePin: boolean;
    memberName: string;
    memberAvatarColor: string | null;
  };
  try {
    const { user, membership } = await requireHouseholdMembership(householdId);
    shell = {
      mustChangePin: user.app_metadata.must_change_pin === true,
      memberName: membership.display_name,
      memberAvatarColor: membership.avatar_color,
    };
  } catch {
    redirect(`/login?next=${encodeURIComponent(`/h/${householdId}`)}`);
  }
  return (
    <AppShell householdId={householdId} {...shell}>
      {children}
    </AppShell>
  );
}
