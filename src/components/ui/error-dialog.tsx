"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "./button";
import { Dialog } from "./dialog";

/** Action and loading failures use one dismissible modal; field hints stay beside their inputs. */
export function ErrorDialog({
  error,
  onClose,
  title = "Something went wrong",
  hint,
}: {
  error: string | null | undefined;
  onClose: () => void;
  title?: string;
  hint?: string;
}) {
  if (!error) return null;

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="px-2 pb-2">
        <div className="flex gap-3 rounded-2xl bg-[var(--negative-soft)] p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[var(--negative)]">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>
          <div className="self-center text-sm leading-5 text-[var(--ink-soft)]" role="alert">
            <p className="font-semibold">{error}</p>
            {hint && <p className="mt-1 text-[var(--muted)]">{hint}</p>}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" tone="primary" className="min-w-24 rounded-full" onClick={onClose}>
            OK
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
