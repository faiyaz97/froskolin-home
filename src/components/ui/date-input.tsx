"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./cn";
import { controlClass } from "./field";

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
  const rootRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
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
          "flex items-center gap-3 text-left font-extrabold",
          open
            ? "border-[var(--brand)] ring-3 ring-[#99f6e4]/45"
            : "border-[var(--line)] hover:border-[#cbd5e1]",
        )}
      >
        <CalendarDays className="size-5 shrink-0 text-[var(--sky)]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{formatDate(value)}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--muted)] transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${ariaLabel.toLowerCase()}`}
          className="absolute right-0 z-[60] mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-[18px] border border-[var(--line)] bg-white p-3 shadow-[0_18px_50px_rgb(15_23_42/0.18)]"
        >
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
              month_caption: "relative flex h-10 items-center justify-center px-11",
              caption_label: "text-sm font-black",
              nav: "absolute inset-x-0 top-0 flex h-10 items-center justify-between",
              button_previous:
                "grid size-9 place-items-center rounded-xl text-[var(--ink-soft)] hover:bg-[var(--soft-line)] disabled:opacity-40",
              button_next:
                "grid size-9 place-items-center rounded-xl text-[var(--ink-soft)] hover:bg-[var(--soft-line)] disabled:opacity-40",
              chevron: "size-4 fill-current",
              month_grid: "mt-2 w-full table-fixed border-collapse",
              weekdays: "border-b border-[var(--soft-line)]",
              weekday: "h-9 text-center text-[11px] font-black text-[var(--muted)]",
              week: "h-10",
              day: "p-0 text-center text-sm",
              day_button:
                "mx-auto grid size-9 place-items-center rounded-xl font-semibold hover:bg-[var(--brand-soft)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-[#2dd4bf]",
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
        </div>
      )}
    </div>
  );
}
