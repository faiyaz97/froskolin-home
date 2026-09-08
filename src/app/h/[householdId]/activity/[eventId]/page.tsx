import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MemberAvatar, type AvatarColor } from "@/components/household/member-avatar";
import type { UtilityType } from "@/components/bills/bill-meta-controls";
import { ActivityTypeIcon } from "@/components/activity/activity-type-icon";
import { PageHeader } from "@/components/ui/page";
import {
  activityActor,
  activityChanges,
  activityEntityLabel,
  activityHeadline,
  type ActivityEvent,
  type ActivityMember,
} from "@/lib/activity/presentation";
import { requireHouseholdMembership } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

export default async function AuditDetail({
  params,
}: {
  params: Promise<{ householdId: string; eventId: string }>;
}) {
  const { householdId, eventId } = await params;
  const { supabase } = await requireHouseholdMembership(householdId);
  const [eventResult, groupResult, membersResult] = await Promise.all([
    supabase
      .from("audit_events")
      .select("*")
      .eq("id", eventId)
      .eq("household_id", householdId)
      .maybeSingle(),
    supabase.from("households").select("locale, timezone").eq("id", householdId).single(),
    supabase
      .from("household_members")
      .select("id, user_id, display_name, avatar_color")
      .eq("household_id", householdId),
  ]);
  if (eventResult.error || groupResult.error || membersResult.error)
    throw eventResult.error ?? groupResult.error ?? membersResult.error;
  if (!eventResult.data) notFound();

  const event = eventResult.data as ActivityEvent;
  let utilityType: UtilityType | undefined;
  if (event.entity_type === "expense") {
    const billResult = await supabase
      .from("utility_bills")
      .select("utility_type")
      .eq("household_id", householdId)
      .eq("expense_id", event.entity_id)
      .maybeSingle();
    if (billResult.error) throw billResult.error;
    utilityType = billResult.data?.utility_type as UtilityType | undefined;
  }
  const locale = groupResult.data.locale;
  const timezone = groupResult.data.timezone;
  const members = (membersResult.data ?? []).map((member) => ({
    id: member.id,
    userId: member.user_id,
    name: member.display_name,
    avatarColor: member.avatar_color as AvatarColor | null,
  }));
  const actor = activityActor(event, members);
  const actorProfile = event.actor_user_id
    ? members.find((member) => member.userId === event.actor_user_id)
    : undefined;
  const changes = activityChanges(event, members as ActivityMember[], locale);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/h/${householdId}/activity`}
        className="mb-5 hidden min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[var(--muted)] no-underline transition-colors hover:bg-white hover:text-[var(--ink)] md:inline-flex"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Activity
      </Link>
      <PageHeader title="Activity detail" compact />

      <article className="overflow-hidden rounded-[24px] bg-white shadow-[var(--shadow-sm)]">
        <div className="p-4 sm:p-6">
          <header className="flex items-start gap-3 sm:gap-4">
            <ActivityTypeIcon
              entityType={event.entity_type}
              utilityType={utilityType}
              className="size-12"
              iconClassName="size-5"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black tracking-[0.12em] text-[var(--muted)] uppercase">
                {activityEntityLabel(event.entity_type)}
              </p>
              <h2 className="mt-1 text-xl leading-tight font-black tracking-[-0.03em] sm:text-2xl">
                {activityHeadline(event, members)}
              </h2>
              <time className="mt-1 block text-xs text-[var(--muted)]">
                {formatDateTime(event.occurred_at, locale, timezone)}
              </time>
            </div>
          </header>

          <div className="mt-5 flex items-center gap-3 border-t border-[var(--soft-line)] pt-4">
            <MemberAvatar
              name={actor}
              color={actorProfile?.avatarColor}
              className="size-10 border-0 shadow-none"
            />
            <p className="text-sm">
              <strong className="block">{actor}</strong>
              <span className="text-xs text-[var(--muted)]">Made this change</span>
            </p>
          </div>

          <section
            className="mt-4 border-t border-[var(--soft-line)] pt-4"
            aria-labelledby="changes"
          >
            <h3 id="changes" className="text-sm font-black">
              {event.action_type === "updated" ? "What changed" : "Recorded details"}
            </h3>

            {changes.length ? (
              <dl className="mt-2 overflow-hidden rounded-2xl bg-[var(--canvas)]">
                {changes.map((change) => (
                  <div
                    key={change.label}
                    className="border-b border-white px-3.5 py-3 last:border-0 sm:px-4"
                  >
                    <dt className="text-[10px] font-black tracking-[0.1em] text-[var(--muted)] uppercase">
                      {change.label}
                    </dt>
                    <dd className="mt-1 text-sm leading-5 font-bold break-words">
                      {change.before !== undefined && change.after !== undefined ? (
                        <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                          <span className="min-w-0 text-[var(--muted)]">{change.before}</span>
                          <ArrowRight className="size-3.5 text-[var(--muted)]" aria-hidden="true" />
                          <span className="min-w-0 text-right text-[var(--ink)]">
                            {change.after}
                          </span>
                        </span>
                      ) : (
                        <span>{change.after ?? change.before}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">No extra details were recorded.</p>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}
