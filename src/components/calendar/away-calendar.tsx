"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition, type CSSProperties } from "react";
import { DayPicker, type DateRange as PickerRange } from "react-day-picker";
import { useRouter } from "next/navigation";

import { ChoiceRow } from "@/components/expenses/expense-sharing-controls";
import {
  MemberAvatar,
  resolveAvatarColor,
  type AvatarColor,
} from "@/components/household/member-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { iconActionClass } from "@/components/ui/icon-action";
import { replaceAbsencesAction } from "@/lib/actions";
import { inclusiveDays, normalizeAbsenceRanges } from "@/lib/domain/occupancy";

type Range = { start: string; end: string };
type CalendarMember = {
  id: string;
  name: string;
  color: AvatarColor | null;
  removed: boolean;
};
type CalendarView = "calendar" | "months" | "years";

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, month, 1)),
  ),
);

function dateOnlyToDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function dateToDateOnly(value: Date) {
  return [
    value.getUTCFullYear(),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToDate(value));
}

function rangeDays(range: Range) {
  return inclusiveDays({ startDate: range.start, endDate: range.end });
}

function normalizeRanges(ranges: Range[]): Range[] {
  return normalizeAbsenceRanges(
    ranges.map((range) => ({ startDate: range.start, endDate: range.end })),
  ).map((range) => ({ start: range.startDate, end: range.endDate }));
}

function toPickerRange(range: Range): PickerRange {
  return { from: dateOnlyToDate(range.start), to: dateOnlyToDate(range.end) };
}

function rangeKey(range: Range) {
  return `${range.start}:${range.end}`;
}

export function AwayCalendar({
  householdId,
  memberId,
  memberName,
  isOwner,
  members,
  initialRanges,
}: {
  householdId: string;
  memberId: string;
  memberName: string;
  isOwner: boolean;
  members: CalendarMember[];
  initialRanges: Range[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [ranges, setRanges] = useState(() => normalizeRanges(initialRanges));
  const [selection, setSelection] = useState<PickerRange>();
  const [editingKey, setEditingKey] = useState<string>();
  const [month, setMonth] = useState(() => dateOnlyToDate(ranges.at(-1)?.start ?? today));
  const [calendarView, setCalendarView] = useState<CalendarView>("calendar");
  const [yearPageStart, setYearPageStart] = useState(() => month.getUTCFullYear() - 5);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [draftMemberId, setDraftMemberId] = useState(memberId);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const targetMember = members.find((member) => member.id === memberId);
  const targetColor = resolveAvatarColor(memberName, targetMember?.color);
  const recordedDays = useMemo(() => ranges.map(toPickerRange), [ranges]);
  const recordedStarts = useMemo(
    () =>
      ranges
        .filter((range) => range.start !== range.end)
        .map((range) => dateOnlyToDate(range.start)),
    [ranges],
  );
  const recordedEnds = useMemo(
    () =>
      ranges.filter((range) => range.start !== range.end).map((range) => dateOnlyToDate(range.end)),
    [ranges],
  );
  const recordedMiddle = useMemo(
    () => (date: Date) => {
      const value = dateToDateOnly(date);
      return ranges.some((range) => range.start < value && value < range.end);
    },
    [ranges],
  );
  const calendarBounds = useMemo(() => {
    const years = ranges.flatMap((range) => [
      Number(range.start.slice(0, 4)),
      Number(range.end.slice(0, 4)),
    ]);
    const currentYear = Number(today.slice(0, 4));
    return {
      start: new Date(Date.UTC(Math.min(currentYear - 10, ...years), 0, 1)),
      end: new Date(Date.UTC(Math.max(currentYear + 5, ...years), 11, 1)),
    };
  }, [ranges, today]);
  const monthStart = dateToDateOnly(
    new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)),
  );
  const monthEnd = dateToDateOnly(
    new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)),
  );
  const visibleRanges = useMemo(
    () =>
      ranges
        .filter((range) => range.start <= monthEnd && range.end >= monthStart)
        .map((range) => ({
          original: range,
          visible: {
            start: range.start < monthStart ? monthStart : range.start,
            end: range.end > monthEnd ? monthEnd : range.end,
          },
        })),
    [monthEnd, monthStart, ranges],
  );
  const selectableMembers = members.filter((member) => !member.removed || member.id === memberId);
  const selectionRange = selection?.from
    ? {
        start: dateToDateOnly(selection.from),
        end: dateToDateOnly(selection.to ?? selection.from),
      }
    : undefined;
  const completeSelection = Boolean(selection?.from && selection.to);

  function moveCalendar(direction: -1 | 1) {
    if (calendarView === "calendar") {
      setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + direction, 1)));
    } else if (calendarView === "months") {
      setMonth(new Date(Date.UTC(month.getUTCFullYear() + direction, month.getUTCMonth(), 1)));
    } else {
      setYearPageStart((current) => current + direction * 12);
    }
  }

  function persist(nextRanges: Range[], onSuccess?: () => void) {
    setError("");
    startTransition(async () => {
      const result = await replaceAbsencesAction({
        householdId,
        memberId,
        ranges: nextRanges.map((range) => ({ startDate: range.start, endDate: range.end })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRanges(nextRanges);
      onSuccess?.();
    });
  }

  function saveSelection() {
    if (!selection?.from || !selection.to) return;
    const selectedRange = {
      start: dateToDateOnly(selection.from),
      end: dateToDateOnly(selection.to),
    };
    const unchanged = editingKey
      ? ranges.filter((range) => rangeKey(range) !== editingKey)
      : ranges;
    persist(normalizeRanges([...unchanged, selectedRange]), () => {
      setSelection(undefined);
      setEditingKey(undefined);
    });
  }

  function beginEditing(range: Range) {
    setEditingKey(rangeKey(range));
    setSelection(toPickerRange(range));
    setMonth(dateOnlyToDate(range.start));
    setCalendarView("calendar");
    setError("");
  }

  function removeRange(range: Range) {
    persist(
      ranges.filter((item) => rangeKey(item) !== rangeKey(range)),
      () => {
        if (editingKey === rangeKey(range)) {
          setSelection(undefined);
          setEditingKey(undefined);
        }
      },
    );
  }

  return (
    <div
      className="mx-auto max-w-3xl space-y-5"
      style={
        {
          "--calendar-member": targetColor,
          "--calendar-member-soft": `color-mix(in srgb, ${targetColor} 42%, white)`,
        } as CSSProperties
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-[var(--ink-soft)] sm:justify-start">
        <span>Add away period for</span>
        <button
          type="button"
          disabled={!isOwner}
          onClick={() => {
            setDraftMemberId(memberId);
            setMemberDialogOpen(true);
          }}
          aria-label={isOwner ? `Choose member, currently ${memberName}` : undefined}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-2.5 pr-3 text-sm font-extrabold transition-[filter]",
            isOwner &&
              "hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--control-ring)] focus-visible:outline-none",
          )}
          style={{ backgroundColor: `${targetColor}24`, color: "var(--ink)" }}
        >
          <MemberAvatar
            name={memberName}
            color={targetMember?.color}
            className="size-8 border-0 shadow-none"
          />
          {memberName}
          {isOwner && <ChevronDown className="size-3.5 text-[var(--muted)]" aria-hidden="true" />}
        </button>
      </div>

      <section
        aria-label="Away period calendar"
        className="rounded-[22px] bg-white p-3 shadow-[var(--shadow-sm)] sm:p-5"
      >
        <div className="mx-auto max-w-[42rem]">
          <div className="mb-2 flex h-11 items-center justify-between">
            <button
              type="button"
              aria-label={
                calendarView === "calendar"
                  ? "Previous month"
                  : calendarView === "months"
                    ? "Previous year"
                    : "Previous years"
              }
              onClick={() => moveCalendar(-1)}
              disabled={pending}
              className={iconActionClass({ className: "size-10" })}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>

            {calendarView === "calendar" ? (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Choose month"
                  onClick={() => setCalendarView("months")}
                  className="flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-sm font-black hover:bg-[var(--canvas)]"
                >
                  {monthNames[month.getUTCMonth()]}
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Choose year"
                  onClick={() => {
                    setYearPageStart(month.getUTCFullYear() - 5);
                    setCalendarView("years");
                  }}
                  className="flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-sm font-black hover:bg-[var(--canvas)]"
                >
                  {month.getUTCFullYear()}
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <strong className="rounded-lg bg-[var(--canvas)] px-4 py-2 text-sm">
                {calendarView === "months"
                  ? `${month.getUTCFullYear()} · Months`
                  : `${yearPageStart}–${yearPageStart + 11}`}
              </strong>
            )}

            <button
              type="button"
              aria-label={
                calendarView === "calendar"
                  ? "Next month"
                  : calendarView === "months"
                    ? "Next year"
                    : "Next years"
              }
              onClick={() => moveCalendar(1)}
              disabled={pending}
              className={iconActionClass({ className: "size-10" })}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          {calendarView === "calendar" ? (
            <DayPicker
              mode="range"
              selected={selection}
              onSelect={(nextSelection) => {
                setSelection(nextSelection);
                setError("");
              }}
              resetOnSelect
              month={month}
              onMonthChange={setMonth}
              startMonth={calendarBounds.start}
              endMonth={calendarBounds.end}
              disabled={pending}
              showOutsideDays
              fixedWeeks
              hideNavigation
              timeZone="UTC"
              weekStartsOn={1}
              modifiers={{
                recorded: recordedDays,
                recordedStart: recordedStarts,
                recordedMiddle,
                recordedEnd: recordedEnds,
                selectionAnchor: selection?.from && !selection.to ? selection.from : [],
              }}
              modifiersClassNames={{
                recorded:
                  "[&>button]:bg-[var(--calendar-member-soft)] [&>button]:font-bold [&>button]:text-[var(--ink)]",
                recordedStart: "[&>button]:!rounded-r-none",
                recordedMiddle: "[&>button]:!rounded-none",
                recordedEnd: "[&>button]:!rounded-l-none",
                selectionAnchor:
                  "[&>button]:!bg-[var(--pastel-mint)] [&>button]:!text-[var(--brand-strong)] [&>button]:ring-2 [&>button]:ring-[var(--pastel-mint-line)]",
              }}
              classNames={{
                root: "relative w-full",
                months: "w-full",
                month: "w-full",
                month_caption: "hidden",
                month_grid: "w-full table-fixed border-collapse",
                weekdays: "border-0",
                weekday: "h-8 text-center text-[10px] font-bold text-[var(--muted)]",
                week: "h-10 sm:h-11",
                day: "p-0 text-center text-sm",
                day_button:
                  "mx-auto grid h-9 w-[calc(100%-0.3rem)] place-items-center rounded-[10px] bg-[var(--canvas)] font-semibold outline-none transition-colors hover:bg-[var(--brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--control-ring)] sm:h-10",
                outside: "text-[#94a3b8] opacity-50",
                today:
                  "[&>button]:font-black [&>button]:text-[var(--brand)] [&>button]:ring-1 [&>button]:ring-[var(--pastel-mint-line)] [&>button]:ring-inset",
                selected: "[&>button]:font-black",
                range_start:
                  "[&>button]:!rounded-l-xl [&>button]:!rounded-r-none [&>button]:!bg-[var(--pastel-mint)] [&>button]:!text-[var(--brand-strong)]",
                range_middle:
                  "[&>button]:!rounded-none [&>button]:!bg-[var(--pastel-mint)] [&>button]:!text-[var(--brand-strong)]",
                range_end:
                  "[&>button]:!rounded-l-none [&>button]:!rounded-r-xl [&>button]:!bg-[var(--pastel-mint)] [&>button]:!text-[var(--brand-strong)]",
                disabled: "cursor-not-allowed opacity-45",
              }}
            />
          ) : calendarView === "months" ? (
            <div
              role="listbox"
              aria-label="Choose month"
              className="grid min-h-[17rem] grid-cols-3 content-center gap-2 py-3"
            >
              {monthNames.map((label, monthIndex) => (
                <button
                  key={label}
                  type="button"
                  role="option"
                  aria-selected={month.getUTCMonth() === monthIndex}
                  onClick={() => {
                    setMonth(new Date(Date.UTC(month.getUTCFullYear(), monthIndex, 1)));
                    setCalendarView("calendar");
                  }}
                  className={cn(
                    "min-h-12 rounded-xl text-sm font-bold hover:bg-[var(--brand-soft)]",
                    month.getUTCMonth() === monthIndex &&
                      "bg-[var(--pastel-mint)] text-[var(--brand-strong)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
            <div
              role="listbox"
              aria-label="Choose year"
              className="grid min-h-[17rem] grid-cols-4 content-center gap-2 py-3"
            >
              {Array.from({ length: 12 }, (_, index) => yearPageStart + index).map((year) => (
                <button
                  key={year}
                  type="button"
                  role="option"
                  aria-selected={month.getUTCFullYear() === year}
                  onClick={() => {
                    setMonth(new Date(Date.UTC(year, month.getUTCMonth(), 1)));
                    setCalendarView("calendar");
                  }}
                  className={cn(
                    "min-h-12 rounded-xl text-sm font-bold hover:bg-[var(--brand-soft)]",
                    month.getUTCFullYear() === year &&
                      "bg-[var(--pastel-mint)] text-[var(--brand-strong)]",
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          {calendarView === "calendar" && selectionRange && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[var(--canvas)] p-2 pl-3">
              <CalendarDays className="size-5 shrink-0 text-[var(--ink-soft)]" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-[11px] sm:gap-2 sm:text-sm">
                <strong className="truncate whitespace-nowrap">
                  {formatDate(selectionRange.start)}
                  {completeSelection ? ` – ${formatDate(selectionRange.end)}` : " – choose end"}
                </strong>
                {completeSelection && (
                  <span className="shrink-0 whitespace-nowrap text-[var(--muted)]">
                    · {rangeDays(selectionRange)} days
                  </span>
                )}
              </div>
              <Button
                type="button"
                tone="pastel"
                onClick={saveSelection}
                disabled={pending || !completeSelection}
                className="shrink-0 rounded-full px-3 sm:px-4"
              >
                {pending ? "Saving…" : editingKey ? "Update" : "Add period"}
              </Button>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-2 text-right text-xs font-semibold text-[var(--negative)]"
            >
              {error}
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="periods-heading"
        className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]"
      >
        <h2 id="periods-heading" className="px-4 pt-4 pb-3 text-base font-black sm:px-5">
          {new Intl.DateTimeFormat("en-GB", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(month)}
        </h2>
        {visibleRanges.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-[var(--muted)] sm:px-5">No days away.</p>
        ) : (
          <ul>
            {visibleRanges.map(({ original, visible }, index) => (
              <li key={rangeKey(original)}>
                {index > 0 && <div className="mx-4 h-px bg-[var(--soft-line)] sm:mx-5" />}
                <div className="flex min-h-16 items-center gap-2 px-4 py-2 sm:gap-3 sm:px-5">
                  <span
                    className="size-2.5 shrink-0 rounded-full bg-[var(--calendar-member)]"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-xs sm:text-sm">
                    <strong className="truncate whitespace-nowrap">
                      {formatDate(visible.start)} – {formatDate(visible.end)}
                    </strong>
                    <span className="shrink-0 whitespace-nowrap text-[var(--muted)]">
                      · {rangeDays(visible)} days
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => beginEditing(original)}
                    disabled={pending}
                    aria-label={`Edit ${formatDate(original.start)} to ${formatDate(original.end)}`}
                    className={iconActionClass({ tone: "brand", className: "size-10" })}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRange(original)}
                    disabled={pending}
                    aria-label={`Remove ${formatDate(original.start)} to ${formatDate(original.end)}`}
                    className={iconActionClass({ tone: "negative", className: "size-10" })}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {memberDialogOpen && (
        <Dialog
          title="Add away period for"
          onClose={() => setMemberDialogOpen(false)}
          doneDisabled={draftMemberId === memberId}
          onDone={() => {
            setMemberDialogOpen(false);
            router.replace(
              `/h/${householdId}/calendar?member=${encodeURIComponent(draftMemberId)}`,
            );
          }}
        >
          <div role="radiogroup" aria-label="Group members" className="grid gap-1">
            {selectableMembers.map((member) => (
              <ChoiceRow
                key={member.id}
                selected={draftMemberId === member.id}
                onClick={() => setDraftMemberId(member.id)}
              >
                <span className="flex items-center gap-3">
                  <MemberAvatar
                    name={member.name}
                    color={member.color}
                    className="size-9 border-0 shadow-none"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{member.name}</span>
                    {member.removed && (
                      <span className="block text-[10px] text-[var(--muted)]">Removed</span>
                    )}
                  </span>
                </span>
              </ChoiceRow>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}
