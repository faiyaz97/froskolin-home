"use client";

import { MessageSquareText } from "lucide-react";
import { useId, useState } from "react";

import { Dialog } from "../ui/dialog";
import { Textarea } from "../ui/field";
import { iconActionClass } from "../ui/icon-action";

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
        className={iconActionClass({ tone: "violet", active: hasNote, className: "size-14" })}
      >
        <MessageSquareText
          className="size-6"
          strokeWidth={2.2}
          fill={hasNote ? "currentColor" : "none"}
          aria-hidden="true"
        />
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
