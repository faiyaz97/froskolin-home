"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Repeat2, X } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "../ui/cn";
import { Dialog } from "../ui/dialog";
import { iconActionClass } from "../ui/icon-action";
import type { RecurrenceFrequency } from "@/lib/domain/recurrence";

function fromDateOnly(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function toDateOnly(value: Date) {
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
  }).format(fromDateOnly(value));
}

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, month, 1)),
  ),
);

type CalendarView = "calendar" | "months" | "years";

export function ExpenseDateAction({
  value,
  onValueChange,
  recurring,
  frequency,
  onFrequencyChange,
  onRecurringChange,
  recurringEnd,
  onRecurringEndChange,
  allowRecurrence,
  recurrenceRequired = false,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  recurring: boolean;
  frequency: RecurrenceFrequency;
  onFrequencyChange: (value: RecurrenceFrequency) => void;
  onRecurringChange: (value: boolean) => void;
  recurringEnd: string;
  onRecurringEndChange: (value: string) => void;
  allowRecurrence: boolean;
  recurrenceRequired?: boolean;
  disabled?: boolean;
}) {
  const today = new Date();
  const fallbackDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const initialDate = value ? fromDateOnly(value) : fallbackDate;
  const [open, setOpen] = useState(false);
  const [editingEnd, setEditingEnd] = useState(false);
  const [month, setMonth] = useState(initialDate);
  const [calendarView, setCalendarView] = useState<CalendarView>("calendar");
  const [yearPageStart, setYearPageStart] = useState(() => initialDate.getUTCFullYear() - 5);
  const [draftValue, setDraftValue] = useState(value);
  const [draftRecurring, setDraftRecurring] = useState(recurring);
  const [draftFrequency, setDraftFrequency] = useState(frequency);
  const [draftRecurringEnd, setDraftRecurringEnd] = useState(recurringEnd);
  const selectedDate = value ? fromDateOnly(value) : fallbackDate;
  const draftSelectedDate = draftValue ? fromDateOnly(draftValue) : fallbackDate;
  const hasDate = Boolean(value);
  const frequencyLabel = frequency[0].toUpperCase() + frequency.slice(1);
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(selectedDate);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setEditingEnd(false);
          setMonth(selectedDate);
          setCalendarView("calendar");
          setYearPageStart(selectedDate.getUTCFullYear() - 5);
          setDraftValue(value);
          setDraftRecurring(recurring);
          setDraftFrequency(frequency);
          setDraftRecurringEnd(recurringEnd);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          hasDate ? `${recurring ? `${frequencyLabel} from` : "Date"} ${value}` : "Choose date"
        }
        title={
          hasDate
            ? recurring
              ? `${formatDate(value)} · ${frequencyLabel}`
              : formatDate(value)
            : "Choose date"
        }
        className={iconActionClass({ tone: "brand", active: hasDate, className: "group size-14" })}
      >
        <span className="relative grid size-12 shrink-0 place-items-center">
          <span className="grid h-9 w-8 overflow-hidden rounded-[9px] border border-[var(--soft-line)] bg-white text-center shadow-[var(--shadow-sm)]">
            <span
              className={cn(
                "h-3 text-[7px] leading-3 font-black tracking-wide uppercase",
                hasDate
                  ? "bg-[var(--brand)] text-white"
                  : "bg-[var(--soft-line)] text-[var(--muted)]",
              )}
            >
              {hasDate ? monthLabel : "Date"}
            </span>
            <span className="text-sm leading-6 font-black text-[var(--ink)] tabular-nums">
              {hasDate ? selectedDate.getUTCDate() : "—"}
            </span>
          </span>
          {recurring && (
            <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full bg-[var(--violet)] text-white ring-2 ring-white">
              <Repeat2 className="size-2.5" strokeWidth={3} aria-hidden="true" />
            </span>
          )}
        </span>
      </button>

      {open && (
        <Dialog
          title="Date"
          onClose={() => setOpen(false)}
          onDone={() => {
            if (draftValue !== value) onValueChange(draftValue);
            if (draftFrequency !== frequency) onFrequencyChange(draftFrequency);
            if (draftRecurringEnd !== recurringEnd) onRecurringEndChange(draftRecurringEnd);
            if (draftRecurring !== recurring) onRecurringChange(draftRecurring);
            setOpen(false);
          }}
        >
          <div className="mb-1 flex h-10 items-center justify-between">
            <button
              type="button"
              aria-label={
                calendarView === "calendar"
                  ? "Previous month"
                  : calendarView === "months"
                    ? "Previous year"
                    : "Previous years"
              }
              onClick={() => {
                if (calendarView === "calendar") {
                  setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)));
                } else if (calendarView === "months") {
                  setMonth(new Date(Date.UTC(month.getUTCFullYear() - 1, month.getUTCMonth(), 1)));
                } else {
                  setYearPageStart((current) => current - 12);
                }
              }}
              className={iconActionClass({ className: "size-9" })}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>

            {calendarView === "calendar" ? (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Choose month"
                  aria-expanded="false"
                  onClick={() => setCalendarView("months")}
                  className="flex min-h-9 items-center gap-0.5 rounded-lg px-1.5 text-sm font-black hover:bg-[var(--canvas)]"
                >
                  {monthNames[month.getUTCMonth()]}
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Choose year"
                  aria-expanded="false"
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
              onClick={() => {
                if (calendarView === "calendar") {
                  setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)));
                } else if (calendarView === "months") {
                  setMonth(new Date(Date.UTC(month.getUTCFullYear() + 1, month.getUTCMonth(), 1)));
                } else {
                  setYearPageStart((current) => current + 12);
                }
              }}
              className={iconActionClass({ className: "size-9" })}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          {calendarView === "calendar" ? (
            <DayPicker
              mode="single"
              selected={
                editingEnd
                  ? draftRecurringEnd
                    ? fromDateOnly(draftRecurringEnd)
                    : undefined
                  : draftSelectedDate
              }
              disabled={editingEnd ? { before: draftSelectedDate } : undefined}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                if (!date) return;
                if (editingEnd) setDraftRecurringEnd(toDateOnly(date));
                else {
                  setDraftValue(toDateOnly(date));
                  if (draftRecurringEnd && draftRecurringEnd < toDateOnly(date)) {
                    setDraftRecurringEnd("");
                  }
                }
                setMonth(date);
              }}
              showOutsideDays
              fixedWeeks
              hideNavigation
              timeZone="UTC"
              classNames={{
                root: "relative w-full",
                months: "w-full",
                month: "w-full",
                month_caption: "hidden",
                month_grid: "w-full table-fixed border-collapse",
                weekdays: "border-b border-[var(--soft-line)]",
                weekday: "h-8 text-center text-[10px] font-black text-[var(--muted)]",
                week: "h-10",
                day: "p-0 text-center text-sm",
                day_button:
                  "mx-auto grid size-9 place-items-center rounded-full font-semibold outline-none transition-colors hover:bg-[var(--brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--control-ring)]",
                outside: "text-[#94a3b8] opacity-55",
                today:
                  "[&>button]:font-black [&>button]:text-[var(--brand)] [&>button]:ring-1 [&>button]:ring-[var(--pastel-mint-line)] [&>button]:ring-inset",
                selected:
                  "[&>button]:bg-[var(--brand)] [&>button]:font-black [&>button]:text-white [&>button]:shadow-sm [&>button]:ring-0 [&>button]:hover:bg-[var(--brand-strong)]",
              }}
            />
          ) : calendarView === "months" ? (
            <div
              role="listbox"
              aria-label="Choose month"
              className="grid min-h-[16.5rem] grid-cols-3 content-center gap-2 py-3"
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
                    "min-h-12 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--brand-soft)]",
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
              className="grid min-h-[16.5rem] grid-cols-4 content-center gap-2 py-3"
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
                    "min-h-12 rounded-xl text-sm font-bold transition-colors hover:bg-[var(--brand-soft)]",
                    month.getUTCFullYear() === year &&
                      "bg-[var(--pastel-mint)] text-[var(--brand-strong)]",
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          {allowRecurrence && (
            <div className="mt-3 border-t border-[var(--soft-line)] pt-3">
              <p className="mb-2 px-1 text-xs font-semibold text-[var(--muted)]">Repeat</p>
              <div
                className={cn(
                  "grid gap-1 rounded-xl bg-[var(--canvas)] p-1",
                  recurrenceRequired ? "grid-cols-3" : "grid-cols-4",
                )}
              >
                {(recurrenceRequired
                  ? (["weekly", "monthly", "yearly"] as const)
                  : (["none", "weekly", "monthly", "yearly"] as const)
                ).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={
                      option === "none"
                        ? !draftRecurring
                        : draftRecurring && draftFrequency === option
                    }
                    onClick={() => {
                      setDraftRecurring(option !== "none");
                      if (option !== "none") setDraftFrequency(option);
                      else setEditingEnd(false);
                    }}
                    className={cn(
                      "min-h-11 rounded-[10px] text-xs font-semibold",
                      (
                        option === "none"
                          ? !draftRecurring
                          : draftRecurring && draftFrequency === option
                      )
                        ? "bg-[var(--pastel-mint)] text-[var(--brand-strong)]"
                        : "text-[var(--muted)] hover:bg-white",
                    )}
                  >
                    {option === "none" ? "Never" : option[0].toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
              {draftRecurring && (
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    aria-pressed={!editingEnd}
                    onClick={() => {
                      setEditingEnd(false);
                      setMonth(draftSelectedDate);
                      setCalendarView("calendar");
                    }}
                    className={cn(
                      "min-w-0 rounded-[10px] border px-2.5 py-2 text-left",
                      !editingEnd
                        ? "border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)]"
                        : "border-[var(--soft-line)] bg-white hover:border-[var(--line)]",
                    )}
                  >
                    <span className="block text-[10px] font-semibold text-[var(--muted)]">
                      Starts
                    </span>
                    <span className="block truncate text-xs font-bold text-[var(--ink)]">
                      {formatDate(draftValue)}
                    </span>
                  </button>
                  <div className="relative min-w-0">
                    <button
                      type="button"
                      aria-pressed={editingEnd}
                      onClick={() => {
                        setEditingEnd(true);
                        setMonth(fromDateOnly(draftRecurringEnd || draftValue));
                        setCalendarView("calendar");
                      }}
                      className={cn(
                        "w-full min-w-0 rounded-[10px] border py-2 pr-9 pl-2.5 text-left",
                        editingEnd
                          ? "border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)]"
                          : "border-[var(--soft-line)] bg-white hover:border-[var(--line)]",
                      )}
                    >
                      <span className="block text-[10px] font-semibold text-[var(--muted)]">
                        Ends
                      </span>
                      <span className="block truncate text-xs font-bold text-[var(--ink)]">
                        {draftRecurringEnd ? formatDate(draftRecurringEnd) : "Never"}
                      </span>
                    </button>
                    {draftRecurringEnd && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftRecurringEnd("");
                          setEditingEnd(false);
                          setMonth(draftSelectedDate);
                        }}
                        aria-label="Remove end date"
                        className={iconActionClass({
                          tone: "negative",
                          className: "absolute top-1/2 right-1 size-8 -translate-y-1/2",
                        })}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
