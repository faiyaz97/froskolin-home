"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
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

  function choose(nextValue: string) {
    if (controlledValue === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
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
        onClick={() => setOpen((current) => !current)}
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
            navLayout="after"
            timeZone="UTC"
            classNames={{
              root: "relative w-full",
              months: "w-full",
              month: "w-full",
              month_caption: "relative flex h-9 items-center justify-center px-10",
              caption_label: "text-sm font-black",
              nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
              button_previous: iconActionClass({ className: "size-9" }),
              button_next: iconActionClass({ className: "size-9" }),
              chevron: "size-4 fill-current",
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
            footer={
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
            }
          />
        </Dialog>
      )}
    </div>
  );
}
