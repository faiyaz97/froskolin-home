"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "./cn";
import { controlActiveClass, controlClass, controlPopoverClass } from "./field";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  selectedLabel?: string;
};

export function SelectInput({
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  disabled,
  ariaLabel,
  className,
  variant = "control",
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  variant?: "control" | "inline";
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? options.at(0)?.value ?? "");
  const selectedValue = value ?? internalValue;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === selectedValue),
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 8;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 16;
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 16;
      const width = Math.min(
        variant === "inline" ? Math.max(anchor.width, 168) : anchor.width,
        rightEdge - leftEdge,
      );
      const below = Math.max(0, bottomEdge - anchor.bottom - 6);
      const above = Math.max(0, anchor.top - topEdge - 6);
      const wanted = Math.min((menuRef.current?.scrollHeight ?? 254) + 2, 256);
      const flip = below < wanted && above > below;
      const height = Math.min(wanted, flip ? above : below);
      setPosition({
        position: "fixed",
        margin: 0,
        width,
        left: Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)),
        top: flip ? anchor.top - height - 6 : anchor.bottom + 6,
        maxHeight: height,
        visibility: "visible",
      });
    }
    reposition();
    menuRef.current?.focus({ preventScroll: true });
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    };
  }, [open, variant]);

  useEffect(() => {
    if (open) menuRef.current?.children[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex]);

  function choose(index: number) {
    const option = options[index];
    if (!option) return;
    if (value === undefined) setInternalValue(option.value);
    onValueChange?.(option.value);
    setActiveIndex(index);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Tab") {
      buttonRef.current?.focus();
      setOpen(false);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex);
      } else {
        setActiveIndex((current) => (current + direction + options.length) % options.length);
      }
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      setActiveIndex(options.length - 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative", variant === "inline" && "inline-block", className)}
    >
      <input type="hidden" name={name} value={selectedValue} />
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          variant === "control"
            ? cn(
                controlClass,
                "flex items-center justify-between gap-2.5 text-left",
                open && controlActiveClass,
              )
            : cn(
                "inline-flex min-h-9 max-w-40 items-center justify-between gap-1.5 rounded-xl border border-[var(--control-line)] bg-white px-2.5 text-sm font-black text-[var(--brand-strong)] shadow-[var(--shadow-sm)] transition-[border-color,background-color,box-shadow] hover:border-[var(--brand)] hover:bg-[var(--pastel-mint)] focus-visible:ring-2 focus-visible:ring-[var(--control-ring)] focus-visible:outline-none disabled:opacity-50",
                open && "border-[var(--brand)] bg-[var(--pastel-mint)]",
              ),
        )}
      >
        <span className="min-w-0 truncate">
          {selectedOption?.selectedLabel ?? selectedOption?.label}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--muted)] transition-[color,transform]",
            open && "rotate-180 text-[var(--brand)]",
          )}
          aria-hidden="true"
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={position}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={`${listboxId}-${activeIndex}`}
            onKeyDown={handleKeyDown}
            className={cn(
              controlPopoverClass,
              "froskolin-popover max-h-64 overflow-y-auto overscroll-contain p-1 outline-none",
            )}
          >
            {options.map((option, index) => {
              const selected = option.value === selectedValue;
              const active = index === activeIndex;
              return (
                <button
                  key={option.value}
                  id={`${listboxId}-${index}`}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm text-[var(--ink-soft)] outline-none",
                    active && "bg-[var(--canvas)]",
                    selected && "bg-[var(--pastel-mint)] font-bold text-[var(--brand-strong)]",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                        {option.description}
                      </span>
                    )}
                  </span>
                  <Check
                    className={cn("size-4 shrink-0 text-[var(--brand)]", !selected && "invisible")}
                    strokeWidth={3}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
