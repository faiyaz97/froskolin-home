"use client";

import { FileText, Sparkles, UploadCloud } from "lucide-react";
import { useState } from "react";

import { Button } from "../ui/button";

export type PreparedBillDraft = {
  file: File;
};

export function BillUpload({
  onPrepared,
  onAutofill,
  autofillPending,
  mode = "manual",
}: {
  onPrepared: (draft: PreparedBillDraft) => void;
  onAutofill?: () => void;
  autofillPending?: boolean;
  mode?: "manual" | "ai";
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <section className="mx-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:mx-4">
      <label className="flex min-h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl bg-white/85 px-2.5 shadow-[var(--shadow-sm)] transition-colors focus-within:ring-2 focus-within:ring-[var(--control-ring)] hover:bg-white">
        <input
          className="screen-reader-only"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0] ?? null;
            event.target.value = "";
            setFile(selectedFile);
            if (selectedFile) onPrepared({ file: selectedFile });
          }}
        />
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--pastel-lavender)] text-[var(--violet)]">
          {file ? (
            <FileText className="size-4" aria-hidden="true" />
          ) : (
            <UploadCloud className="size-4" aria-hidden="true" />
          )}
        </span>
        {file ? (
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-xs">{file.name}</strong>
            <small className="block truncate text-[10px] leading-3.5 text-[var(--muted)]">
              {(file.size / 1048576).toFixed(1)} MB · tap to change
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
      </label>
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
          {autofillPending ? "Filling…" : "Autofill with AI"}
        </Button>
      ) : (
        <span className="rounded-full bg-[var(--brand-soft)] px-3 py-2 text-xs font-extrabold whitespace-nowrap text-[var(--brand-strong)]">
          Manual entry
        </span>
      )}
    </section>
  );
}
