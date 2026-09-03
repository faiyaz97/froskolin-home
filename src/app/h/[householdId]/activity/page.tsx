import { AuditList } from "@/components/activity/audit-list";
import type { FeedEvent } from "@/components/activity/feed";
import { PageHeader } from "@/components/ui/page";
import { getActivityFeed, getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [home, members, events] = await Promise.all([
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getActivityFeed(householdId, 100),
  ]);
  return (
    <>
      <PageHeader title="Activity" />
      <div className="rounded-2xl border border-[var(--line)] bg-white px-4 shadow-[var(--shadow-sm)] sm:px-5">
        <AuditList
          householdId={householdId}
          events={events as Array<FeedEvent & { actor_user_id: string | null }>}
          actorNames={Object.fromEntries(
            members.map((member) => [member.user_id, member.display_name]),
          )}
          locale={home?.locale ?? "en-GB"}
          timezone={home?.timezone ?? "UTC"}
        />
      </div>
    </>
  );
}
