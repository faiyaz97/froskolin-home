"use client";

import { FileText, LockKeyhole, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button, ButtonLink } from "../ui/button";
import { StatusNote } from "../ui/page";

export function BillUpload({ householdId }: { householdId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setPending(true);
    setError("");
    try {
      const body = new FormData();
      body.set("householdId", householdId);
      body.set("file", file);
      const upload = await fetch("/api/bills/upload", { method: "POST", body });
      const uploaded = (await upload.json()) as { documentId?: string; error?: string };
      if (!upload.ok || !uploaded.documentId) throw new Error(uploaded.error ?? "Upload failed.");
      if (consent) {
        const extraction = await fetch(`/api/bills/${uploaded.documentId}/extract`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ householdId, consent: true }),
        });
        const result = (await extraction.json()) as { error?: string };
        if (!extraction.ok)
          throw new Error(result.error ?? "Extraction failed. Continue with manual entry.");
      }
      router.push(`/h/${householdId}/bills/${uploaded.documentId}/confirm`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The bill could not be uploaded.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="grid gap-6" onSubmit={submit} aria-busy={pending}>
      {error && (
        <StatusNote tone="error" title={error}>
          You can retry or enter the bill manually.
        </StatusNote>
      )}
      <label className="grid min-h-64 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-[var(--line)] bg-white px-5 text-center hover:border-[var(--brand)] hover:bg-[#f0fdfa]">
        <input
          className="screen-reader-only"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          disabled={pending}
        />
        {file ? (
          <span>
            <FileText className="mx-auto size-9 text-[var(--brand)]" />
            <strong className="mt-3 block">{file.name}</strong>
            <small className="mt-1 block text-[var(--muted)]">
              {(file.size / 1048576).toFixed(1)} MB · choose another file
            </small>
          </span>
        ) : (
          <span>
            <UploadCloud className="mx-auto size-9 text-[var(--brand)]" />
            <strong className="mt-3 block text-lg">Choose a bill</strong>
            <small className="mt-2 block leading-5 text-[var(--muted)]">
              PDF, JPEG, PNG, or WebP
              <br />
              Up to 4 MiB and 10 pages
            </small>
          </span>
        )}
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-white p-4 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          className="mt-1 size-4 accent-[var(--brand)]"
          disabled={pending}
        />
        <span>
          <strong className="flex items-center gap-2">
            <LockKeyhole className="size-4" />
            Use Gemini to read this bill
          </strong>
          <small className="mt-1 block leading-5 text-[var(--muted)]">
            I consent to sending prepared document content to Google Gemini for extraction. This
            choice applies only to this upload.
          </small>
        </span>
      </label>
      <StatusNote title="The app, not AI, splits the money">
        Gemini only extracts bill facts. It never receives away dates or calculates what anyone
        owes.
      </StatusNote>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <ButtonLink href={`/h/${householdId}/bills/manual/confirm`} tone="quiet">
          Enter details manually
        </ButtonLink>
        <Button disabled={!file || pending} type="submit">
          {pending
            ? consent
              ? "Uploading and reading…"
              : "Uploading…"
            : consent
              ? "Upload and extract"
              : "Upload for manual entry"}
        </Button>
      </div>
    </form>
  );
}
