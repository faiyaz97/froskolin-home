"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  activityActor,
  activityAmount,
  activityHeadline,
  type ActivityEvent,
  type ActivityMember,
} from "@/lib/activity/presentation";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { UtilityType } from "../bills/bill-meta-controls";
import { MemberAvatar, type AvatarColor } from "../household/member-avatar";
import { LoadMoreAction } from "../ui/load-more-action";
import { ActivityTypeIcon } from "./activity-type-icon";

type Member = ActivityMember & { avatarColor: AvatarColor | null };

export function AuditList({
  householdId,
  initialEvents,
  initialUtilityTypes,
  members,
  locale,
  timezone,
  initialHasMore,
}: {
  householdId: string;
  initialEvents: ActivityEvent[];
  initialUtilityTypes: Record<string, UtilityType>;
  members: Member[];
  locale: string;
  timezone: string;
  initialHasMore: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [utilityTypes, setUtilityTypes] = useState(initialUtilityTypes);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadError, setLoadError] = useState("");
  const [pending, startTransition] = useTransition();

  function loadMore() {
    const lastEvent = events.at(-1);
    if (!lastEvent || pending) return;
    startTransition(async () => {
      setLoadError("");
      const { data, error } = await createClient()
        .from("audit_events")
        .select(
          "id, action_type, entity_type, entity_id, summary, occurred_at, actor_user_id, previous_values, new_values",
        )
        .eq("household_id", householdId)
        .lt("occurred_at", lastEvent.occurred_at)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(11);
      if (error) {
        setLoadError("More activity could not be loaded.");
        return;
      }
      const nextEvents = (data ?? []) as ActivityEvent[];
      const visibleNextEvents = nextEvents.slice(0, 10);
      const expenseIds = visibleNextEvents
        .filter((event) => event.entity_type === "expense")
        .map((event) => event.entity_id);

      if (expenseIds.length) {
        const { data: bills, error: billsError } = await createClient()
          .from("utility_bills")
          .select("expense_id, utility_type")
          .eq("household_id", householdId)
          .in("expense_id", [...new Set(expenseIds)]);
        if (billsError) {
          setLoadError("More activity could not be loaded.");
          return;
        }
        setUtilityTypes((current) => ({
          ...current,
          ...Object.fromEntries(
            (bills ?? []).map((bill: { expense_id: string; utility_type: string }) => [
              bill.expense_id,
              bill.utility_type as UtilityType,
            ]),
          ),
        }));
      }

      setEvents((current) => [...current, ...visibleNextEvents]);
      setHasMore(nextEvents.length > 10);
    });
  }

  if (!events.length) {
    return (
      <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
        No activity recorded yet.
      </p>
    );
  }

  return (
    <>
      <ol
        aria-label="Group activity"
        className="-mx-3 overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)] md:mx-0"
      >
        {events.map((event) => {
          const actor = activityActor(event, members);
          const actorProfile = event.actor_user_id
            ? members.find((member) => member.userId === event.actor_user_id)
            : undefined;
          const amount = activityAmount(event, locale);

          return (
            <li key={event.id} className="border-b border-[var(--soft-line)] last:border-0">
              <Link
                href={`/h/${householdId}/activity/${event.id}`}
                className="group flex min-h-20 items-center gap-3 px-3.5 py-3 text-[var(--ink)] no-underline transition-colors hover:bg-[var(--row-hover)] focus-visible:bg-[var(--row-hover)] focus-visible:outline-none sm:px-5"
              >
                <span className="relative shrink-0">
                  <MemberAvatar
                    name={actor}
                    color={actorProfile?.avatarColor}
                    className="size-11 border-0 shadow-none"
                  />
                  <ActivityTypeIcon
                    entityType={event.entity_type}
                    utilityType={utilityTypes[event.entity_id]}
                    className="absolute -right-1 -bottom-1 size-5 rounded-full ring-2 ring-white"
                    iconClassName="size-3"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm leading-5">
                    {activityHeadline(event, members)}
                  </strong>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                    {actor} · {formatDateTime(event.occurred_at, locale, timezone)}
                  </span>
                </span>

                {amount && (
                  <strong className="shrink-0 text-sm tabular-nums sm:text-base">{amount}</strong>
                )}
                <ChevronRight
                  className="size-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ol>

      {hasMore && <LoadMoreAction pending={pending} onLoad={loadMore} />}
      {loadError && (
        <p role="alert" className="px-4 py-3 text-center text-xs font-bold text-[var(--negative)]">
          {loadError}
        </p>
      )}
    </>
  );
}
