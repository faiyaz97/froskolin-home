"use client";

import { useState } from "react";

import type { ExtractedBill } from "@/lib/validation";
import { BillConfirmation } from "./bill-confirmation";
import { BillUpload, type PreparedBillDraft } from "./bill-upload";

type Member = { id: string; name: string };
type Absence = { memberId: string; startDate: string; endDate: string };

export function BillWorkspace({
  householdId,
  defaultCurrency,
  locale,
  members,
  absences,
  currentMemberId,
  landlordEnabled,
}: {
  householdId: string;
  defaultCurrency: string;
  locale: string;
  members: Member[];
  absences: Absence[];
  currentMemberId: string;
  landlordEnabled: boolean;
}) {
  const [documentId, setDocumentId] = useState<string>();
  const [pageCount, setPageCount] = useState<number>();
  const [extraction, setExtraction] = useState<ExtractedBill>();
  const [entryMode, setEntryMode] = useState<"ai" | "manual">("manual");
  const [extractionRevision, setExtractionRevision] = useState(0);

  function prepareDraft(draft: PreparedBillDraft) {
    setDocumentId(draft.documentId);
    setPageCount(draft.pageCount);
    setEntryMode(draft.entryMode);
    if (draft.extraction) {
      setExtraction(draft.extraction);
      setExtractionRevision((revision) => revision + 1);
    }
    requestAnimationFrame(() =>
      document.getElementById("bill-facts")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <div className="grid gap-7">
      <BillUpload householdId={householdId} onPrepared={prepareDraft} />
      <BillConfirmation
        key={extractionRevision}
        householdId={householdId}
        documentId={documentId}
        defaultCurrency={defaultCurrency}
        locale={locale}
        initial={extraction}
        initialEntryMode={entryMode}
        entryMode={entryMode}
        onEntryModeChange={setEntryMode}
        pageCount={pageCount}
        members={members}
        absences={absences}
        currentMemberId={currentMemberId}
        landlordEnabled={landlordEnabled}
      />
    </div>
  );
}
