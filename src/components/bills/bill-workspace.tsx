"use client";

import { useRef, useState } from "react";

import { extractedBillSchema, type ExtractedBill } from "@/lib/validation";
import type { AvatarColor } from "../household/member-avatar";
import { StatusNote } from "../ui/page";
import { BillConfirmation, type ExistingUtility } from "./bill-confirmation";
import { BillUpload, type PreparedBillDraft } from "./bill-upload";

type Member = { id: string; name: string; avatarColor?: AvatarColor | null };
type Absence = { memberId: string; startDate: string; endDate: string };

export function BillWorkspace({
  householdId,
  defaultCurrency,
  locale,
  members,
  absences,
  currentMemberId,
  landlordEnabled,
  documentId,
  existing,
  cancelHref,
}: {
  householdId: string;
  defaultCurrency: string;
  locale: string;
  members: Member[];
  absences: Absence[];
  currentMemberId: string;
  landlordEnabled: boolean;
  documentId?: string;
  existing?: ExistingUtility;
  cancelHref?: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File>();
  const [extraction, setExtraction] = useState<ExtractedBill>();
  const [extractionRevision, setExtractionRevision] = useState(0);
  const [autofillPending, setAutofillPending] = useState(false);
  const [autofillError, setAutofillError] = useState("");
  const [documentRemoved, setDocumentRemoved] = useState(false);
  const [entryMode, setEntryMode] = useState<"manual" | "ai">(existing?.entryMode ?? "manual");
  const uploadedDocument = useRef<{ documentId: string; pageCount?: number } | undefined>(
    undefined,
  );

  function prepareDraft(draft: PreparedBillDraft) {
    setSelectedFile(draft.file);
    setDocumentRemoved(false);
    setExtraction(undefined);
    setAutofillError("");
    setEntryMode("manual");
    uploadedDocument.current = undefined;
  }

  function removeDocument() {
    setSelectedFile(undefined);
    setDocumentRemoved(true);
    setAutofillError("");
    setEntryMode(existing?.entryMode ?? "manual");
    uploadedDocument.current = undefined;
    if (extraction) {
      setExtraction(undefined);
      setExtractionRevision((revision) => revision + 1);
    }
  }

  async function autofill() {
    if (!selectedFile || autofillPending) return;
    setAutofillPending(true);
    setAutofillError("");
    try {
      const body = new FormData();
      body.set("householdId", householdId);
      body.set("consent", "true");
      body.set("file", selectedFile);
      const response = await fetch("/api/bills/extract", { method: "POST", body });
      const result = (await response.json()) as {
        extraction?: unknown;
        pageCount?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "AI could not read this bill.");
      const parsed = extractedBillSchema.safeParse(result.extraction);
      if (!parsed.success) throw new Error("AI returned incomplete bill data.");
      setExtraction(parsed.data);
      setExtractionRevision((revision) => revision + 1);
    } catch (cause) {
      setAutofillError(
        cause instanceof Error ? cause.message : "AI could not read this bill. Fill it manually.",
      );
    } finally {
      setAutofillPending(false);
    }
  }

  async function uploadDocumentOnConfirm() {
    if (uploadedDocument.current) return uploadedDocument.current;
    if (!selectedFile) throw new Error("Choose a bill file before confirming.");

    const body = new FormData();
    body.set("householdId", householdId);
    body.set("file", selectedFile);
    const response = await fetch("/api/bills/upload", { method: "POST", body });
    const result = (await response.json()) as {
      documentId?: string;
      pageCount?: number;
      error?: string;
    };
    if (!response.ok || !result.documentId) {
      throw new Error(result.error ?? "The bill file could not be saved.");
    }
    uploadedDocument.current = {
      documentId: result.documentId,
      pageCount: result.pageCount,
    };
    return uploadedDocument.current;
  }

  return (
    <div className="grid gap-3">
      <BillUpload
        onPrepared={prepareDraft}
        onAutofill={selectedFile ? autofill : undefined}
        autofillPending={autofillPending}
        mode={entryMode}
        initialFileName={documentId && !documentRemoved ? "Current bill document" : undefined}
        initialViewUrl={
          documentId && !documentRemoved
            ? `/api/bills/${documentId}/view?householdId=${householdId}`
            : undefined
        }
        onRemove={removeDocument}
        onError={setAutofillError}
      />
      {autofillError && (
        <StatusNote tone="error" title={autofillError}>
          Complete the form manually or try again.
        </StatusNote>
      )}
      <BillConfirmation
        key={extractionRevision}
        householdId={householdId}
        documentId={selectedFile || documentRemoved ? undefined : documentId}
        defaultCurrency={defaultCurrency}
        locale={locale}
        initial={extraction}
        existing={existing}
        uploadDocumentOnConfirm={selectedFile ? uploadDocumentOnConfirm : undefined}
        members={members}
        absences={absences}
        currentMemberId={currentMemberId}
        landlordEnabled={landlordEnabled}
        onEntryModeChange={setEntryMode}
        cancelHref={cancelHref}
      />
    </div>
  );
}
