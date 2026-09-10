"use client";

import { AlertTriangle } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { Button } from "./button";
import { Dialog } from "./dialog";

export function ConfirmationButton({
  title,
  description,
  confirmLabel,
  pendingLabel = "Working…",
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
            <div className="flex gap-3 rounded-2xl bg-[var(--negative-soft)] p-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[var(--negative)]">
                <AlertTriangle className="size-5" aria-hidden="true" />
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
                tone="danger"
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
