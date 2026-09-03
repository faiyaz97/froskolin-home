import { CalendarDays, HandCoins, ReceiptText, Repeat2 } from "lucide-react";
import Link from "next/link";

import { formatDateTime, formatMoney } from "@/lib/format";

export type FeedEvent = {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  occurred_at: string;
  new_values: Record<string, unknown> | null;
};

const icons = {
  absence_period: CalendarDays,
  expense: ReceiptText,
  recurring_rule: Repeat2,
  settlement: HandCoins,
};

export function ActivityFeed({
  householdId,
  events,
  locale,
  timezone,
}: {
  householdId: string;
  events: FeedEvent[];
  locale: string;
  timezone: string;
}) {
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)] p-8 text-center">
        <ReceiptText className="mx-auto size-7 text-[var(--brand-strong)]" aria-hidden="true" />
        <h2 className="mt-3 font-extrabold">Nothing in the household ledger yet</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add an expense and Froskolin will keep the story here.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Household activity"
      className="overflow-hidden border-y border-[var(--line)] bg-[var(--paper)] sm:rounded-2xl sm:border"
    >
      {events.map((event) => {
        const Icon = icons[event.entity_type as keyof typeof icons] ?? ReceiptText;
        const expense = event.entity_type === "expense";
        const cents = Number(event.new_values?.total_cents ?? event.new_values?.amount_cents);
        const currency = String(event.new_values?.currency ?? "");
        const row = (
          <div className="flex gap-3.5 px-4 py-4 sm:px-5">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${expense ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "bg-[var(--peach-soft)] text-[var(--peach)]"}`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="leading-5 font-extrabold">{event.summary}</p>
                {Number.isSafeInteger(cents) && currency && (
                  <p className="font-extrabold whitespace-nowrap tabular-nums">
                    {formatMoney(cents, currency, locale)}
                  </p>
                )}
              </div>
              <time className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                {formatDateTime(event.occurred_at, locale, timezone)}
              </time>
            </div>
          </div>
        );
        const href = expense
          ? `/h/${householdId}/expenses/${event.entity_id}`
          : event.entity_type === "settlement"
            ? `/h/${householdId}/settlements/${event.entity_id}`
            : null;
        return href ? (
          <Link
            key={event.id}
            href={href}
            className="block border-b border-[var(--soft-line)] text-[var(--ink)] no-underline last:border-0 hover:bg-white"
          >
            {row}
          </Link>
        ) : (
          <div key={event.id} className="border-b border-[var(--soft-line)] last:border-0">
            {row}
          </div>
        );
      })}
    </section>
  );
}
