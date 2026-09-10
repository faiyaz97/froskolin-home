"use client";

import { Eye, Paperclip, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../ui/cn";
import { ConfirmationButton } from "../ui/confirmation-button";
import { controlPopoverClass } from "../ui/field";
import { iconActionClass } from "../ui/icon-action";

const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type ExistingExpenseAttachment = {
  fileName: string;
  viewUrl: string;
};

export function ExpenseAttachmentAction({
  file,
  existing,
  removed,
  onFileChange,
  onRemove,
  onError,
  disabled,
}: {
  file?: File;
  existing?: ExistingExpenseAttachment;
  removed: boolean;
  onFileChange: (file: File) => void;
  onRemove: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const hasAttachment = Boolean(file || (existing && !removed));
  const fileName = file?.name ?? existing?.fileName ?? "Attachment";

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function chooseFile(nextFile?: File) {
    if (!nextFile) return;
    if (!acceptedTypes.has(nextFile.type) || nextFile.size > 4 * 1024 * 1024) {
      onError("Choose a PDF, JPEG, PNG, or WebP file up to 4 MiB.");
      return;
    }
    onError("");
    onFileChange(nextFile);
    setOpen(false);
  }

  function viewAttachment() {
    const url = file ? URL.createObjectURL(file) : existing?.viewUrl;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    if (file) window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="screen-reader-only"
        aria-label="Choose attachment"
        disabled={disabled}
        onChange={(event) => {
          chooseFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => (hasAttachment ? setOpen((current) => !current) : inputRef.current?.click())}
        aria-expanded={hasAttachment ? open : undefined}
        aria-label={hasAttachment ? `Attachment: ${fileName}` : "Add attachment"}
        title={hasAttachment ? fileName : "Add attachment"}
        className={iconActionClass({ tone: "brand", active: hasAttachment, className: "size-14" })}
      >
        <Paperclip className="size-6" aria-hidden="true" />
      </button>

      {open && hasAttachment && (
        <div
          className={cn(
            controlPopoverClass,
            "absolute right-0 bottom-[calc(100%+.5rem)] z-[70] w-44 p-1.5",
          )}
        >
          <button
            type="button"
            onClick={viewAttachment}
            className="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-bold hover:bg-[var(--canvas)]"
          >
            <Eye className="size-4 text-[var(--brand)]" aria-hidden="true" /> View
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-bold hover:bg-[var(--canvas)]"
          >
            <RefreshCw className="size-4 text-[var(--violet)]" aria-hidden="true" /> Replace
          </button>
          <ConfirmationButton
            triggerLabel="Remove attachment"
            title="Remove this attachment?"
            description={`${fileName} will be removed from this expense.`}
            confirmLabel="Remove"
            pendingLabel="Removing…"
            onConfirmAction={() => {
              onRemove();
              setOpen(false);
            }}
            triggerClassName="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-bold text-[var(--negative)] hover:bg-[var(--negative-soft)]"
          >
            <Trash2 className="size-4" aria-hidden="true" /> Remove
          </ConfirmationButton>
        </div>
      )}
    </div>
  );
}
