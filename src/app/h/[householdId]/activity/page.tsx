import { AuditList } from "@/components/activity/audit-list";
import type { AvatarColor } from "@/components/household/member-avatar";
import type { UtilityType } from "@/components/bills/bill-meta-controls";
import { PageHeader } from "@/components/ui/page";
import type { ActivityEvent } from "@/lib/activity/presentation";
import {
  getActivityFeed,
  getActivityUtilityTypes,
  getHousehold,
  getHouseholdMembers,
} from "@/lib/queries";

const PAGE_SIZE = 10;

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [home, members, events] = await Promise.all([
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getActivityFeed(householdId, PAGE_SIZE + 1),
  ]);
  const visibleEvents = events.slice(0, PAGE_SIZE) as ActivityEvent[];
  const utilityTypes = await getActivityUtilityTypes(
    householdId,
    visibleEvents
      .filter((event) => event.entity_type === "expense")
      .map((event) => event.entity_id),
  );
  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Activity" />
      <div className="overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)]">
        <AuditList
          householdId={householdId}
          initialEvents={visibleEvents}
          initialUtilityTypes={utilityTypes as Record<string, UtilityType>}
          members={members.map((member) => ({
            id: member.id,
            userId: member.user_id,
            name: member.display_name,
            avatarColor: member.avatar_color as AvatarColor | null,
          }))}
          locale={home?.locale ?? "en-GB"}
          timezone={home?.timezone ?? "UTC"}
          initialHasMore={events.length > PAGE_SIZE}
        />
      </div>
    </div>
  );
}
