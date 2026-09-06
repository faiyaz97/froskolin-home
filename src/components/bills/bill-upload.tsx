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
}: {
  onPrepared: (draft: PreparedBillDraft) => void;
  onAutofill?: () => void;
  autofillPending?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);

  return (
    <section className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-[var(--shadow-sm)]">
      <label className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--control-line)] bg-[var(--canvas)] px-2.5 transition-colors focus-within:ring-2 focus-within:ring-[var(--control-ring)] hover:border-[var(--brand)] hover:bg-[var(--pastel-mint)]">
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
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--pastel-mint)] text-[var(--brand)]">
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
      {file && onAutofill && (
        <Button
          type="button"
          tone="pastelAccent"
          onClick={onAutofill}
          disabled={autofillPending}
          className="min-h-11 shrink-0 px-3 text-xs"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {autofillPending ? "Filling…" : "Autofill with AI"}
        </Button>
      )}
    </section>
  );
}
