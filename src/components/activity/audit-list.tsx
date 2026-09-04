import { CalendarDays, HandCoins, House, ReceiptText, Repeat2 } from "lucide-react";
import Link from "next/link";

import type { FeedEvent } from "./feed";
import { MemberAvatar } from "../household/member-avatar";
import { formatDateTime } from "@/lib/format";

const icons = {
  absence_period: { icon: CalendarDays, color: "bg-[var(--sky-soft)] text-[var(--sky)]" },
  expense: { icon: ReceiptText, color: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  recurring_rule: { icon: Repeat2, color: "bg-[var(--violet-soft)] text-[var(--violet)]" },
  settlement: { icon: HandCoins, color: "bg-[var(--positive-soft)] text-[var(--positive)]" },
  landlord_payment: { icon: House, color: "bg-[var(--peach-soft)] text-[var(--peach)]" },
};

export function AuditList({
  householdId,
  events,
  actorNames,
  locale,
  timezone,
}: {
  householdId: string;
  events: Array<FeedEvent & { actor_user_id: string | null }>;
  actorNames: Record<string, string>;
  locale: string;
  timezone: string;
}) {
  if (!events.length) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        No important changes have been recorded yet.
      </p>
    );
  }
  return (
    <ol className="relative ml-4 border-l border-[var(--line)] pl-6 sm:ml-5 sm:pl-8">
      {events.map((event) => {
        const iconData = icons[event.entity_type as keyof typeof icons] ?? {
          icon: ReceiptText,
          color: "bg-[var(--peach-soft)] text-[var(--peach)]",
        };
        const Icon = iconData.icon;
        const actor = event.actor_user_id
          ? (actorNames[event.actor_user_id] ?? "A roommate")
          : "Froskolin";
        return (
          <li
            key={event.id}
            className="relative border-b border-[var(--soft-line)] py-5 first:pt-1"
          >
            <span
              className={`absolute top-5 -left-[2.37rem] grid size-8 place-items-center rounded-full ring-4 ring-white sm:-left-[3.04rem] ${iconData.color}`}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <Link
              href={`/h/${householdId}/activity/${event.id}`}
              className="block text-[var(--ink)] no-underline"
            >
              <div className="flex items-start gap-3">
                <MemberAvatar name={actor} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <strong>{actor}</strong> · {event.summary}
                  </p>
                  <time className="mt-2 block text-xs text-[var(--muted)]">
                    {formatDateTime(event.occurred_at, locale, timezone)}
                  </time>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
