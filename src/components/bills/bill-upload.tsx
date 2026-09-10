"use client";

import { Eye, FileText, RefreshCw, Sparkles, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { ConfirmationButton } from "../ui/confirmation-button";
import { controlPopoverClass } from "../ui/field";

const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type PreparedBillDraft = {
  file: File;
};

export function BillUpload({
  onPrepared,
  onAutofill,
  autofillPending,
  mode = "manual",
  initialFileName,
  initialViewUrl,
  onRemove,
  onError,
}: {
  onPrepared: (draft: PreparedBillDraft) => void;
  onAutofill?: () => void;
  autofillPending?: boolean;
  mode?: "manual" | "ai";
  initialFileName?: string;
  initialViewUrl?: string;
  onRemove: () => void;
  onError: (message: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasDocument = Boolean(file || initialFileName);

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
    setFile(nextFile);
    onPrepared({ file: nextFile });
    setOpen(false);
  }

  function viewDocument() {
    const url = file ? URL.createObjectURL(file) : initialViewUrl;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    if (file) window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <section className="mx-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mx-4">
      <div ref={rootRef} className="relative min-w-0">
        <input
          ref={inputRef}
          className="screen-reader-only"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => (hasDocument ? setOpen((current) => !current) : inputRef.current?.click())}
          aria-expanded={hasDocument ? open : undefined}
          aria-label={
            hasDocument ? `Bill document: ${file?.name ?? initialFileName}` : "Choose a bill"
          }
          className="group flex min-h-12 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl bg-white/85 px-2.5 text-left shadow-[var(--shadow-sm)] transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--control-ring)] focus-visible:outline-none"
        >
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-[var(--violet)] transition-colors group-hover:bg-[var(--violet-soft)]",
              hasDocument && "bg-[var(--pastel-lavender)]",
            )}
          >
            {file || initialFileName ? (
              <FileText className="size-4" aria-hidden="true" />
            ) : (
              <UploadCloud className="size-4" aria-hidden="true" />
            )}
          </span>
          {file ? (
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">{file.name}</strong>
              <small className="block truncate text-[10px] leading-3.5 text-[var(--muted)]">
                {(file.size / 1048576).toFixed(1)} MB · tap for options
              </small>
            </span>
          ) : initialFileName ? (
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-xs">{initialFileName}</strong>
              <small className="block truncate text-[10px] leading-3.5 text-[var(--muted)]">
                Attached · tap for options
              </small>
            </span>
          ) : (
            <span className="min-w-0 flex-1">
              <strong className="block text-xs">Choose a bill</strong>
              <small className="block text-[10px] leading-3.5 text-[var(--muted)]">
                PDF or image · 4 MiB max
              </small>
            </span>
          )}
        </button>

        {open && hasDocument && (
          <div
            className={cn(
              controlPopoverClass,
              "absolute top-[calc(100%+.5rem)] left-0 z-[70] w-44 p-1.5",
            )}
          >
            {(file || initialViewUrl) && (
              <button
                type="button"
                onClick={viewDocument}
                className="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-bold hover:bg-[var(--canvas)]"
              >
                <Eye className="size-4 text-[var(--brand)]" aria-hidden="true" /> View
              </button>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-bold hover:bg-[var(--canvas)]"
            >
              <RefreshCw className="size-4 text-[var(--violet)]" aria-hidden="true" /> Replace
            </button>
            <ConfirmationButton
              triggerLabel="Remove bill document"
              title="Remove this bill document?"
              description={`${file?.name ?? initialFileName ?? "This document"} will be removed from this bill.`}
              confirmLabel="Remove"
              pendingLabel="Removing…"
              onConfirmAction={() => {
                setFile(null);
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
      {mode === "ai" ? (
        <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--violet-soft)] px-3 text-xs font-extrabold text-[var(--violet)]">
          <Sparkles className="size-4" aria-hidden="true" /> AI-filled
        </span>
      ) : file && onAutofill ? (
        <Button
          type="button"
          tone="pastelAccent"
          onClick={onAutofill}
          disabled={autofillPending}
          className="min-h-12 shrink-0 rounded-xl border-0 px-3 text-xs shadow-none"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {autofillPending ? "Filling…" : "Autofill"}
        </Button>
      ) : (
        <span className="rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold whitespace-nowrap text-[var(--brand-strong)]">
          Manual entry
        </span>
      )}
    </section>
  );
}
