"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./cn";
import { controlActiveClass, controlClass } from "./field";
import { Dialog } from "./dialog";
import { iconActionClass } from "./icon-action";

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
  if (!value) return "Choose date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(fromDateOnly(value));
}

type CalendarView = "calendar" | "months" | "years";

const monthNames = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(2024, month, 1)),
  ),
);

export function DateInput({
  name,
  defaultValue,
  value: controlledValue,
  onValueChange,
  allowClear = false,
  disabled,
  ariaLabel,
  className,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  allowClear?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const value = controlledValue ?? internalValue;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    value ? fromDateOnly(value) : fromDateOnly(new Date().toISOString().slice(0, 10)),
  );
  const [calendarView, setCalendarView] = useState<CalendarView>("calendar");
  const [yearPageStart, setYearPageStart] = useState(() => month.getUTCFullYear() - 5);

  function choose(nextValue: string) {
    if (controlledValue === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  function moveCalendar(direction: -1 | 1) {
    if (calendarView === "calendar") {
      setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + direction, 1)));
    } else if (calendarView === "months") {
      setMonth(new Date(Date.UTC(month.getUTCFullYear() + direction, month.getUTCMonth(), 1)));
    } else {
      setYearPageStart((current) => current + direction * 12);
    }
  }

  return (
    <div className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (!open) {
            if (value) setMonth(fromDateOnly(value));
            setCalendarView("calendar");
          }
          setOpen((current) => !current);
        }}
        className={cn(
          controlClass,
          "flex items-center gap-2.5 text-left",
          open && controlActiveClass,
        )}
      >
        <CalendarDays className="size-[18px] shrink-0 text-[var(--brand)]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{formatDate(value)}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--muted)] transition-[color,transform]",
            open && "rotate-180 text-[var(--brand)]",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <Dialog title={`Choose ${ariaLabel.toLowerCase()}`} onClose={() => setOpen(false)}>
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
              onClick={() => moveCalendar(-1)}
              className={iconActionClass({ className: "size-9" })}
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
              className={iconActionClass({ className: "size-9" })}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          {calendarView === "calendar" ? (
            <DayPicker
              mode="single"
              selected={value ? fromDateOnly(value) : undefined}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                if (!date) return;
                choose(toDateOnly(date));
                setMonth(date);
                setOpen(false);
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
                month_grid: "mt-2 w-full table-fixed border-collapse",
                weekdays: "border-b border-[var(--soft-line)]",
                weekday: "h-9 text-center text-[11px] font-black text-[var(--muted)]",
                week: "h-10",
                day: "p-0 text-center text-sm",
                day_button:
                  "mx-auto grid size-9 place-items-center rounded-[10px] font-semibold outline-none hover:bg-[var(--brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--control-ring)]",
                outside: "text-[#94a3b8] opacity-55",
                today: "[&>button]:ring-2 [&>button]:ring-[var(--peach)] [&>button]:ring-inset",
                selected:
                  "[&>button]:bg-[var(--brand)] [&>button]:font-black [&>button]:text-white [&>button]:hover:bg-[var(--brand-strong)]",
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
          <div className="mt-2 flex items-center gap-2 border-t border-[var(--soft-line)] pt-3">
            <span className="text-xs font-bold text-[var(--muted)]">{formatDate(value)}</span>
            {allowClear && value && (
              <button
                type="button"
                className="ml-auto rounded-lg px-2 py-1 text-xs font-extrabold text-[var(--muted)] hover:bg-[var(--soft-line)]"
                onClick={() => {
                  choose("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className={`${allowClear && value ? "" : "ml-auto"} rounded-lg px-2 py-1 text-xs font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)]`}
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                choose(today);
                setMonth(fromDateOnly(today));
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
