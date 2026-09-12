"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { Button } from "./button";
import { cn } from "./cn";
import { Dialog } from "./dialog";

export function ConfirmationButton({
  title,
  description,
  confirmLabel,
  pendingLabel = "Working…",
  tone = "danger",
  triggerLabel,
  triggerTitle,
  triggerClassName,
  disabled,
  onBeforeOpen,
  onConfirmAction,
  children,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel?: string;
  tone?: "danger" | "primary";
  triggerLabel: string;
  triggerTitle?: string;
  triggerClassName?: string;
  disabled?: boolean;
  onBeforeOpen?: () => void;
  onConfirmAction: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await onConfirmAction();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={triggerLabel}
        title={triggerTitle ?? triggerLabel}
        aria-haspopup="dialog"
        className={triggerClassName}
        onClick={() => {
          onBeforeOpen?.();
          setOpen(true);
        }}
      >
        {children}
      </button>

      {open && (
        <Dialog title={title} onClose={() => setOpen(false)} dismissible={!pending}>
          <div className="px-2 pb-2">
            <div
              className={cn(
                "flex gap-3 rounded-2xl p-3.5",
                tone === "danger" ? "bg-[var(--negative-soft)]" : "bg-[var(--brand-icon-active)]",
              )}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full bg-white",
                  tone === "danger" ? "text-[var(--negative)]" : "text-[var(--brand)]",
                )}
              >
                {tone === "danger" ? (
                  <AlertTriangle className="size-5" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="size-5" aria-hidden="true" />
                )}
              </span>
              <p className="self-center text-sm leading-5 font-semibold text-[var(--ink-soft)]">
                {description}
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                tone="quiet"
                className="min-w-24 rounded-full"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                tone={tone}
                className="min-w-24 rounded-full"
                disabled={pending}
                onClick={confirm}
              >
                {pending ? pendingLabel : confirmLabel}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
