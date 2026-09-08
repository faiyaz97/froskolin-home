"use client";

import { MessageSquareText } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "../ui/cn";
import { Dialog } from "../ui/dialog";
import { Textarea } from "../ui/field";

export function TransactionNoteAction({
  value,
  onChange,
  disabled,
  title = "Notes",
  placeholder = "Add a note.",
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  title?: string;
  placeholder?: string;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const hasNote = Boolean(value.trim());

  return (
    <>
      <button
        type="button"
        aria-label={hasNote ? "Edit notes" : "Add notes"}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="group grid size-14 shrink-0 place-items-center rounded-xl transition-colors hover:bg-[var(--soft-line)] disabled:opacity-50"
      >
        <span
          className={cn(
            "grid size-12 place-items-center rounded-xl border transition-colors",
            hasNote
              ? "border-[var(--pastel-lavender-line)] bg-[var(--pastel-lavender)] text-[var(--violet-strong)]"
              : "border-[var(--control-line)] bg-white text-[var(--muted)]",
          )}
        >
          <MessageSquareText
            className="size-6"
            strokeWidth={2.2}
            fill={hasNote ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <Dialog
          title={title}
          onClose={() => setOpen(false)}
          onDone={() => {
            onChange(draft.trim());
            setOpen(false);
          }}
        >
          <label className="screen-reader-only" htmlFor={inputId}>
            Notes
          </label>
          <Textarea
            id={inputId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            maxLength={500}
            autoFocus
          />
        </Dialog>
      )}
    </>
  );
}
