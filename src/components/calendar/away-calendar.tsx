"use client";

import { CalendarPlus, Pencil, Trash2, Users, X } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  DayButton,
  DayPicker,
  type DateRange as PickerRange,
  type DayButtonProps,
} from "react-day-picker";

import {
  MemberAvatar,
  resolveAvatarColor,
  type AvatarColor,
} from "@/components/household/member-avatar";
import { replaceAbsencesAction } from "@/lib/actions";
import { inclusiveDays, normalizeAbsenceRanges } from "@/lib/domain/occupancy";
import { Button } from "../ui/button";
import { StatusNote } from "../ui/page";

type Range = { start: string; end: string };
type HouseholdRange = Range & { memberId: string };
type CalendarMember = {
  id: string;
  name: string;
  color: AvatarColor | null;
  removed: boolean;
};

const fmt = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateOnlyToDate(value));

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

export function AwayCalendar({
  householdId,
  memberId,
  memberName,
  members,
  initialHouseholdRanges,
}: {
  householdId: string;
  memberId: string;
  memberName: string;
  members: CalendarMember[];
  initialHouseholdRanges: HouseholdRange[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [ranges, setRanges] = useState(() =>
    normalizeRanges(
      initialHouseholdRanges
        .filter((range) => range.memberId === memberId)
        .map(({ start, end }) => ({ start, end })),
    ),
  );
  const [selection, setSelection] = useState<PickerRange>();
  const [editingRange, setEditingRange] = useState<Range>();
  const [month, setMonth] = useState(() => dateOnlyToDate(ranges.at(-1)?.start ?? today));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [pending, startTransition] = useTransition();

  const total = useMemo(() => ranges.reduce((sum, range) => sum + rangeDays(range), 0), [ranges]);
  const recordedDays = useMemo(() => ranges.map(toPickerRange), [ranges]);
  const visibleHouseholdRanges = useMemo(
    () => [
      ...initialHouseholdRanges.filter((range) => range.memberId !== memberId),
      ...ranges.map((range) => ({ ...range, memberId })),
    ],
    [initialHouseholdRanges, memberId, ranges],
  );
  const memberMarkers = useMemo(
    () =>
      members.map((member, index) => ({
        member,
        modifier: `awayMember${index}`,
        color: resolveAvatarColor(member.name, member.color),
        ranges: visibleHouseholdRanges
          .filter((range) => range.memberId === member.id)
          .map(toPickerRange),
      })),
    [members, visibleHouseholdRanges],
  );
  const calendarModifiers = useMemo(
    () => Object.fromEntries(memberMarkers.map((marker) => [marker.modifier, marker.ranges])),
    [memberMarkers],
  );
  const schedule = useMemo(
    () =>
      visibleHouseholdRanges
        .map((range) => ({
          ...range,
          member: members.find((member) => member.id === range.memberId),
        }))
        .filter((range): range is HouseholdRange & { member: CalendarMember } =>
          Boolean(range.member),
        )
        .sort(
          (a, b) =>
            a.start.localeCompare(b.start) ||
            a.end.localeCompare(b.end) ||
            a.member.name.localeCompare(b.member.name),
        ),
    [members, visibleHouseholdRanges],
  );
  const targetColor = resolveAvatarColor(
    memberName,
    members.find((member) => member.id === memberId)?.color,
  );
  const calendarBounds = useMemo(() => {
    const years = visibleHouseholdRanges.flatMap((range) => [
      Number(range.start.slice(0, 4)),
      Number(range.end.slice(0, 4)),
    ]);
    const currentYear = Number(today.slice(0, 4));
    return {
      start: new Date(Date.UTC(Math.min(currentYear - 10, ...years), 0, 1)),
      end: new Date(Date.UTC(Math.max(currentYear + 5, ...years), 11, 1)),
    };
  }, [visibleHouseholdRanges, today]);

  const CalendarDayButton = useCallback(
    (props: DayButtonProps) => {
      const { children, modifiers, ...buttonProps } = props;
      const awayMembers = memberMarkers.filter((marker) => modifiers[marker.modifier]);
      const names = awayMembers.map((marker) => marker.member.name).join(", ");
      const ariaLabel = [buttonProps["aria-label"], names ? `Away: ${names}` : null]
        .filter(Boolean)
        .join(". ");

      return (
        <DayButton {...props} {...buttonProps} aria-label={ariaLabel} title={names || undefined}>
          <span>{children}</span>
          {awayMembers.length > 0 && (
            <span
              className="absolute inset-x-1 bottom-0.5 flex items-center justify-center gap-0.5"
              aria-hidden="true"
            >
              {awayMembers.slice(0, 3).map((marker) => (
                <span
                  key={marker.member.id}
                  className="size-1.5 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: marker.color }}
                />
              ))}
              {awayMembers.length > 3 && (
                <span className="text-[7px] leading-none font-black">
                  +{awayMembers.length - 3}
                </span>
              )}
            </span>
          )}
        </DayButton>
      );
    },
    [memberMarkers],
  );

  const selectionSummary = selection?.from
    ? selection.to
      ? `${fmt(dateToDateOnly(selection.from))} – ${fmt(dateToDateOnly(selection.to))}`
      : `${fmt(dateToDateOnly(selection.from))} — choose the last day`
    : "Choose the first day away, then the last day.";

  function addOrUpdateRange() {
    if (!selection?.from || !selection.to) {
      setError("Choose both the first and last day away.");
      return;
    }

    const selectedRange = {
      start: dateToDateOnly(selection.from),
      end: dateToDateOnly(selection.to),
    };
    const unchangedRanges = editingRange
      ? ranges.filter((range) => range !== editingRange)
      : ranges;
    setRanges(normalizeRanges([...unchangedRanges, selectedRange]));
    setSelection(undefined);
    setEditingRange(undefined);
    setError("");
    setSaved(false);
    setHasChanges(true);
  }

  function beginEditing(range: Range) {
    setEditingRange(range);
    setSelection(toPickerRange(range));
    setMonth(dateOnlyToDate(range.start));
    setError("");
    setSaved(false);
  }

  function clearSelection() {
    setSelection(undefined);
    setEditingRange(undefined);
    setError("");
  }

  function removeRange(range: Range) {
    setRanges(ranges.filter((item) => item !== range));
    if (editingRange === range) clearSelection();
    setSaved(false);
    setHasChanges(true);
  }

  function confirm() {
    setError("");
    startTransition(async () => {
      const result = await replaceAbsencesAction({
        householdId,
        memberId,
        ranges: ranges.map((range) => ({ startDate: range.start, endDate: range.end })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setHasChanges(false);
    });
  }

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section
        aria-labelledby="calendar-heading"
        className="min-w-0 rounded-[20px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="calendar-heading" className="font-black">
              Add away period for
            </h2>
            <span
              className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-extrabold"
              style={{ backgroundColor: `${targetColor}18`, color: targetColor }}
            >
              <MemberAvatar
                name={memberName}
                color={members.find((member) => member.id === memberId)?.color}
                className="size-7 text-[10px]"
              />
              {memberName}
            </span>
          </div>
          <div
            className="rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold text-[var(--brand-strong)]"
            aria-live="polite"
          >
            <strong>{total} days recorded</strong>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-1">
          <DayPicker
            mode="range"
            selected={selection}
            onSelect={(nextSelection) => {
              setSelection(nextSelection);
              setError("");
              setSaved(false);
            }}
            resetOnSelect
            month={month}
            onMonthChange={setMonth}
            startMonth={calendarBounds.start}
            endMonth={calendarBounds.end}
            disabled={pending}
            showOutsideDays
            fixedWeeks
            navLayout="after"
            timeZone="UTC"
            aria-labelledby="calendar-heading"
            modifiers={{
              recorded: recordedDays,
              selectionStart: selection?.from ?? [],
              ...calendarModifiers,
            }}
            modifiersClassNames={{
              recorded:
                "rounded-xl bg-[var(--peach-soft)] [&>button]:font-bold [&>button]:text-[var(--peach)]",
              selectionStart:
                "[&>button]:!bg-[var(--brand)] [&>button]:!font-black [&>button]:!text-white [&>button]:ring-4 [&>button]:ring-[#99f6e4]",
            }}
            classNames={{
              root: "relative mx-auto w-full max-w-[28rem]",
              months: "w-full",
              month: "w-full",
              month_caption: "relative flex h-11 items-center justify-center px-12",
              caption_label: "text-sm font-black",
              nav: "absolute inset-x-0 top-0 flex h-11 items-center justify-between",
              button_previous:
                "grid size-10 place-items-center rounded-xl text-[var(--ink-soft)] hover:bg-[var(--soft-line)] disabled:opacity-40",
              button_next:
                "grid size-10 place-items-center rounded-xl text-[var(--ink-soft)] hover:bg-[var(--soft-line)] disabled:opacity-40",
              chevron: "size-4 fill-current",
              month_grid: "mt-3 w-full table-fixed border-collapse",
              footer:
                "mt-3 min-h-11 rounded-xl bg-[var(--brand-soft)] px-3 py-2.5 text-center text-sm font-extrabold text-[var(--brand-strong)]",
              weekdays: "border-b border-[var(--soft-line)]",
              weekday: "h-9 text-center text-[11px] font-black text-[var(--muted)]",
              week: "h-10 sm:h-11",
              day: "p-0 text-center text-sm",
              day_button:
                "relative z-10 mx-auto grid size-9 place-items-center rounded-xl font-semibold hover:bg-[var(--brand-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-[#2dd4bf] disabled:cursor-not-allowed disabled:opacity-45 sm:size-10",
              outside: "text-[var(--muted)] opacity-45",
              today: "[&>button]:ring-2 [&>button]:ring-[var(--peach)] [&>button]:ring-inset",
              selected: "[&>button]:font-black",
              range_start:
                "!rounded-l-xl !bg-[#ccfbf1] [&>button]:!bg-[var(--brand)] [&>button]:!text-white",
              range_middle: "!bg-[var(--brand-soft)]",
              range_end:
                "!rounded-r-xl !bg-[#ccfbf1] [&>button]:!bg-[var(--brand)] [&>button]:!text-white",
              disabled: "cursor-not-allowed opacity-45",
            }}
            components={{ DayButton: CalendarDayButton }}
            footer={selectionSummary}
          />
        </div>

        <div className="mt-4 border-t border-[var(--soft-line)] pt-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-sm bg-[var(--brand)]" aria-hidden="true" />
              Current selection
            </span>
            {memberMarkers.map((marker) => (
              <span
                key={marker.member.id}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold"
                style={{ backgroundColor: `${marker.color}18`, color: marker.color }}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: marker.color }}
                  aria-hidden="true"
                />
                {marker.member.name}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="sm:min-w-40"
              onClick={addOrUpdateRange}
              disabled={pending || !selection?.from || !selection.to}
            >
              <CalendarPlus className="size-4" aria-hidden="true" />
              {editingRange ? "Update range" : "Add range"}
            </Button>
            {selection && (
              <Button type="button" tone="quiet" onClick={clearSelection} disabled={pending}>
                <X className="size-4" aria-hidden="true" />
                {editingRange ? "Cancel edit" : "Clear selection"}
              </Button>
            )}
          </div>
        </div>
      </section>

      <aside aria-labelledby="periods-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-[var(--muted)] uppercase">
              {memberName}
            </p>
            <h2 id="periods-heading" className="mt-1 font-extrabold">
              Away periods
            </h2>
          </div>
          <strong className="text-sm">{total} days</strong>
        </div>

        {ranges.length === 0 ? (
          <div className="mt-3 border-y border-[var(--line)] py-6 text-sm leading-6 text-[var(--muted)]">
            No away periods yet. Choose a range on the calendar to add one.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--soft-line)] border-y border-[var(--line)]">
            {ranges.map((range) => (
              <li key={`${range.start}-${range.end}`} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm">
                    <strong className="block">
                      {fmt(range.start)} – {fmt(range.end)}
                    </strong>
                    <small className="block text-[var(--muted)]">{rangeDays(range)} days</small>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => beginEditing(range)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold text-[var(--brand-strong)] hover:bg-white"
                      aria-label={`Edit ${fmt(range.start)} to ${fmt(range.end)}`}
                      disabled={pending}
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRange(range)}
                      className="grid size-10 place-items-center rounded-lg text-[var(--negative)] hover:bg-white"
                      aria-label={`Remove ${fmt(range.start)} to ${fmt(range.end)}`}
                      disabled={pending}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          Overlapping or touching ranges are combined automatically.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-[var(--negative)]">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="mt-3 text-sm font-bold text-[var(--positive)]">
            Away periods saved.
          </p>
        )}
        <Button
          type="button"
          className="mt-4 w-full"
          onClick={confirm}
          disabled={pending || !hasChanges}
        >
          {pending ? "Saving and recalculating…" : "Confirm away periods"}
        </Button>
        {!hasChanges && !saved && (
          <p className="mt-2 text-center text-xs text-[var(--muted)]">All changes are saved.</p>
        )}
      </aside>

      <section aria-labelledby="household-schedule-heading" className="lg:col-span-2">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-[var(--brand)]" aria-hidden="true" />
          <h2 id="household-schedule-heading" className="font-black">
            Who’s away
          </h2>
        </div>
        {schedule.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-6 text-sm text-[var(--muted)]">
            Everyone is home.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {schedule.map((range) => {
              const color = resolveAvatarColor(range.member.name, range.member.color);
              return (
                <li
                  key={`${range.memberId}-${range.start}-${range.end}`}
                  className="rounded-2xl border border-[var(--line)] bg-white p-3 shadow-[var(--shadow-sm)]"
                  style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                >
                  <span
                    className="inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold"
                    style={{ backgroundColor: `${color}18`, color }}
                  >
                    {range.member.name}
                  </span>
                  <p className="mt-2 text-sm font-bold">
                    {fmt(range.start)} – {fmt(range.end)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{rangeDays(range)} days</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="lg:col-span-2">
        <StatusNote title="At home unless marked away">
          Utility bills use these date-only ranges. Changing them recalculates every overlapping
          confirmed utility in one atomic operation.
        </StatusNote>
      </div>
    </div>
  );
}
