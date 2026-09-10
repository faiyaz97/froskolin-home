"use client";

import { AlertTriangle, Check, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { confirmUtilityBillAction, updateUtilityBillAction } from "@/lib/actions";
import { determineBillEntryMode, type BillFinancialBaseline } from "@/lib/bills/entry-mode";
import { calculateUtilityShares, type DateRange } from "@/lib/domain";
import { formatMoney, formatUtilityBillTitle } from "@/lib/format";
import type { ExtractedBill } from "@/lib/validation";
import { CurrencyAction } from "../expenses/expense-sharing-controls";
import { ExpenseTools } from "../expenses/expense-tools";
import { TransactionNoteAction } from "../expenses/transaction-note-action";
import { MemberAvatar, type AvatarColor } from "../household/member-avatar";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Field } from "../ui/field";
import { MoneyInput } from "../ui/money-input";
import { StatusNote } from "../ui/page";
import { BillMetaControls, UtilityTypeIcon } from "./bill-meta-controls";

type Member = { id: string; name: string; avatarColor?: AvatarColor | null };
type Absence = { memberId: string; startDate: string; endDate: string };
export type ExistingUtility = {
  expenseId: string;
  title: string;
  utilityType: ExtractedBill["utilityType"];
  supplier: string | null;
  issueDate: string | null;
  serviceStart: string;
  serviceEnd: string;
  totalCents: number;
  fixedCents: number;
  variableCents: number;
  currency: string;
  payerMemberId: string;
  participantIds: string[];
  consumptionAmount: number | null;
  consumptionUnit: string | null;
  classificationNote: string | null;
  entryMode?: "ai" | "manual";
};

export function BillConfirmation({
  householdId,
  documentId,
  defaultCurrency,
  locale,
  initial,
  existing,
  uploadDocumentOnConfirm,
  members,
  absences,
  currentMemberId,
  landlordEnabled,
  onEntryModeChange,
  cancelHref,
}: {
  householdId: string;
  documentId?: string;
  defaultCurrency: string;
  locale: string;
  initial?: ExtractedBill;
  existing?: ExistingUtility;
  uploadDocumentOnConfirm?: () => Promise<{ documentId: string; pageCount?: number }>;
  members: Member[];
  absences: Absence[];
  currentMemberId: string;
  landlordEnabled: boolean;
  onEntryModeChange?: (mode: "manual" | "ai") => void;
  cancelHref?: string;
}) {
  const router = useRouter();
  const initialUtilityType = initial?.utilityType ?? existing?.utilityType ?? "other";
  const [total, setTotal] = useState(
    initial
      ? (initial.totalDueCents / 100).toFixed(2)
      : existing
        ? (existing.totalCents / 100).toFixed(2)
        : "",
  );
  const [fixed, setFixed] = useState(
    initial?.charges.fixedCents != null
      ? (initial.charges.fixedCents / 100).toFixed(2)
      : existing
        ? (existing.fixedCents / 100).toFixed(2)
        : "",
  );
  const [variable, setVariable] = useState(
    initial?.charges.consumptionCents != null
      ? (initial.charges.consumptionCents / 100).toFixed(2)
      : existing
        ? (existing.variableCents / 100).toFixed(2)
        : "",
  );
  const [serviceStart, setServiceStart] = useState(
    initial?.servicePeriod.start ?? existing?.serviceStart ?? "",
  );
  const [serviceEnd, setServiceEnd] = useState(
    initial?.servicePeriod.end ?? existing?.serviceEnd ?? "",
  );
  const [utilityType, setUtilityType] = useState(initialUtilityType);
  const [title, setTitle] = useState(
    initial
      ? formatUtilityBillTitle(
          initialUtilityType,
          initial.servicePeriod.start,
          initial.servicePeriod.end,
          locale,
        )
      : (existing?.title ?? formatUtilityBillTitle(initialUtilityType, "", "", locale)),
  );
  const [titleWasEdited, setTitleWasEdited] = useState(Boolean(existing && !initial));
  const [currency, setCurrency] = useState(
    initial?.currency ?? existing?.currency ?? defaultCurrency,
  );
  const [payer, setPayer] = useState(
    existing?.payerMemberId ?? (landlordEnabled ? "landlord" : currentMemberId),
  );
  const [selected, setSelected] = useState(
    () => new Set(existing?.participantIds ?? members.map((member) => member.id)),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [note, setNote] = useState(existing?.classificationNote ?? "");
  function updateGeneratedTitle(type: string, start: string, end: string) {
    if (!titleWasEdited) setTitle(formatUtilityBillTitle(type, start, end, locale));
  }
  const aiBaseline: BillFinancialBaseline | undefined = initial
    ? {
        totalCents: initial.totalDueCents,
        fixedCents: initial.charges.fixedCents,
        variableCents: initial.charges.consumptionCents,
      }
    : existing?.entryMode === "ai"
      ? {
          totalCents: existing.totalCents,
          fixedCents: existing.fixedCents,
          variableCents: existing.variableCents,
        }
      : undefined;
  const entryMode = determineBillEntryMode({ total, fixed, variable }, aiBaseline);
  useEffect(() => {
    onEntryModeChange?.(entryMode);
  }, [entryMode, onEntryModeChange]);
  const totalCents = Math.round(Number(total) * 100);
  const fixedCents = Math.round(Number(fixed) * 100);
  const variableCents = Math.round(Number(variable) * 100);
  const titleMissing = !title.trim();
  const totalValid = total !== "" && Number.isSafeInteger(totalCents) && totalCents > 0;
  const fixedValid = fixed !== "" && Number.isSafeInteger(fixedCents) && fixedCents >= 0;
  const variableValid =
    variable !== "" && Number.isSafeInteger(variableCents) && variableCents >= 0;
  const breakdownMismatch =
    totalValid && fixedValid && variableValid && fixedCents + variableCents !== totalCents;
  const servicePeriodMissing = !serviceStart || !serviceEnd;
  const servicePeriodInvalid = Boolean(serviceStart && serviceEnd && serviceEnd < serviceStart);
  const participantsMissing = selected.size === 0;
  const valid =
    !titleMissing &&
    totalValid &&
    fixedValid &&
    variableValid &&
    !breakdownMismatch &&
    !servicePeriodMissing &&
    !servicePeriodInvalid &&
    !participantsMissing;
  const servicePeriodError = attemptedSubmit
    ? servicePeriodMissing
      ? "Choose the service start and end dates."
      : servicePeriodInvalid
        ? "The service end must be on or after the start."
        : undefined
    : undefined;
  const missingClassification =
    !existing &&
    initial != null &&
    (initial.charges.fixedCents == null || initial.charges.consumptionCents == null);
  const lowConfidence =
    !existing &&
    initial != null &&
    !missingClassification &&
    Object.values(initial.extractionConfidence).some((value) => value < 0.8);
  const preview = useMemo(() => {
    if (!valid) return null;
    try {
      return calculateUtilityShares({
        totalCents,
        fixedCents,
        variableCents,
        servicePeriod: { startDate: serviceStart, endDate: serviceEnd },
        participants: members
          .filter((member) => selected.has(member.id))
          .map((member) => ({
            memberId: member.id,
            absenceRanges: absences
              .filter((range) => range.memberId === member.id)
              .map((range): DateRange => ({ startDate: range.startDate, endDate: range.endDate })),
          })),
      });
    } catch {
      return null;
    }
  }, [
    absences,
    fixedCents,
    members,
    selected,
    serviceEnd,
    serviceStart,
    totalCents,
    valid,
    variableCents,
  ]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);
    setError("");
    if (!valid) return;
    startTransition(async () => {
      setError("");
      let confirmedDocumentId = documentId;
      if (!confirmedDocumentId && uploadDocumentOnConfirm) {
        try {
          confirmedDocumentId = (await uploadDocumentOnConfirm()).documentId;
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "The bill file could not be saved.");
          return;
        }
      }
      const input = {
        householdId,
        documentId: confirmedDocumentId,
        title:
          title.trim() || formatUtilityBillTitle(utilityType, serviceStart, serviceEnd, locale),
        utilityType,
        supplier: null,
        issueDate: null,
        serviceStart,
        serviceEnd,
        totalCents,
        fixedCents,
        variableCents,
        currency,
        payerMemberId: payer,
        participants: members
          .filter((member) => selected.has(member.id))
          .map((member, order) => ({ memberId: member.id, order })),
        consumptionAmount: initial?.consumption.amount ?? existing?.consumptionAmount ?? null,
        consumptionUnit: initial?.consumption.unit ?? existing?.consumptionUnit ?? null,
        classificationNote: note || null,
        entryMode,
      };
      let expenseId: string;
      if (existing) {
        const result = await updateUtilityBillAction({ ...input, expenseId: existing.expenseId });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        expenseId = existing.expenseId;
      } else {
        const result = await confirmUtilityBillAction(input);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        expenseId = result.data.expenseId;
      }
      router.replace(existing ? `/h/${householdId}/expenses/${expenseId}` : `/h/${householdId}`);
      router.refresh();
    });
  }

  return (
    <form
      id="bill-facts"
      data-mobile-submit
      className="grid scroll-mt-24 gap-3"
      onSubmit={submit}
      aria-busy={pending}
      noValidate
    >
      {missingClassification && (
        <StatusNote tone="warning" title="Complete the missing bill facts">
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="size-3.5" />
            AI could not confidently classify every cent. Check the bill and enter the missing
            values before confirming.
          </span>
        </StatusNote>
      )}
      {lowConfidence && (
        <StatusNote tone="warning" title="Double-check the AI-filled details">
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="size-3.5" />
            The form was filled, but at least one fact was below 80% confidence. Nothing is saved
            until you confirm.
          </span>
        </StatusNote>
      )}
      {error && (
        <StatusNote tone="error" title={error}>
          Correct the bill fields and try again.
        </StatusNote>
      )}
      <fieldset className="grid gap-4 px-1 py-2 sm:px-4 sm:py-4" disabled={pending}>
        <legend className="screen-reader-only">Bill facts</legend>
        <div
          className={cn(
            "flex w-full min-w-0 items-center gap-3 border-b-2 border-[var(--pastel-mint-line)] py-2 focus-within:border-[var(--brand)]",
            attemptedSubmit && titleMissing && "border-[var(--negative)]",
          )}
        >
          <UtilityTypeIcon value={utilityType} className="size-11" />
          <label className="screen-reader-only" htmlFor="bill-title">
            Title
          </label>
          <input
            id="bill-title"
            name="title"
            value={title}
            onChange={(event) => {
              setTitleWasEdited(true);
              setTitle(event.target.value);
            }}
            placeholder="What bill is this?"
            required
            aria-invalid={(attemptedSubmit && titleMissing) || undefined}
            className="expense-primary-input h-12 w-0 min-w-0 flex-1 bg-transparent text-xl font-black tracking-[-0.025em] text-[var(--ink)] outline-none placeholder:font-semibold placeholder:text-[#94a3b8]"
          />
        </div>
        {attemptedSubmit && titleMissing && (
          <p role="alert" className="-mt-3 text-xs font-bold text-[var(--negative)]">
            Add a bill title.
          </p>
        )}
        <div
          className={cn(
            "flex w-full min-w-0 items-end gap-3 border-b-2 border-[var(--pastel-mint-line)] py-2 focus-within:border-[var(--brand)]",
            attemptedSubmit && !totalValid && "border-[var(--negative)]",
          )}
        >
          <CurrencyAction value={currency} onChange={setCurrency} disabled={pending} />
          <label className="screen-reader-only" htmlFor="bill-total">
            Total due
          </label>
          <input
            id="bill-total"
            inputMode="decimal"
            min="0"
            step="0.01"
            type="number"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            placeholder="0.00"
            required
            aria-invalid={(attemptedSubmit && !totalValid) || undefined}
            className="expense-primary-input h-14 w-0 min-w-0 flex-1 bg-transparent text-[2.2rem] leading-none font-black tracking-[-0.045em] text-[var(--ink)] tabular-nums outline-none placeholder:text-[#94a3b8]"
          />
        </div>
        {attemptedSubmit && !totalValid && (
          <p role="alert" className="-mt-3 text-xs font-bold text-[var(--negative)]">
            Enter a total greater than zero.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Field
            label="Fixed fees"
            error={attemptedSubmit && !fixedValid ? "Enter fixed fees." : undefined}
          >
            <MoneyInput
              value={fixed}
              onChange={setFixed}
              currency={currency}
              ariaLabel="Fixed fees"
              disabled={pending}
              invalid={(attemptedSubmit && !fixedValid) || breakdownMismatch}
            />
          </Field>
          <Field
            label="Usage costs"
            error={attemptedSubmit && !variableValid ? "Enter usage costs." : undefined}
          >
            <MoneyInput
              value={variable}
              onChange={setVariable}
              currency={currency}
              ariaLabel="Usage costs"
              disabled={pending}
              invalid={(attemptedSubmit && !variableValid) || breakdownMismatch}
            />
          </Field>
        </div>
        {breakdownMismatch && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--negative-soft)] p-3 text-sm font-bold text-[var(--negative)]"
          >
            Fixed fees + usage costs must equal the total.
          </p>
        )}
        <BillMetaControls
          utilityType={utilityType}
          onUtilityTypeChange={(value) => {
            setUtilityType(value);
            updateGeneratedTitle(value, serviceStart, serviceEnd);
          }}
          payer={payer}
          onPayerChange={setPayer}
          serviceStart={serviceStart}
          serviceEnd={serviceEnd}
          onServicePeriodChange={(start, end) => {
            setServiceStart(start);
            setServiceEnd(end);
            updateGeneratedTitle(utilityType, start, end);
          }}
          selected={selected}
          onSelectedChange={setSelected}
          members={members}
          currentMemberId={currentMemberId}
          landlordEnabled={landlordEnabled}
          locale={locale}
          disabled={pending}
          servicePeriodError={servicePeriodError}
        />
      </fieldset>
      {preview && (
        <section className="px-1 sm:px-4">
          {preview.variableMode === "equal_zero_presence_fallback" && (
            <StatusNote tone="warning" title="Nobody was recorded present">
              The variable portion is split equally for this bill.
            </StatusNote>
          )}
          <div className="overflow-hidden rounded-2xl bg-[var(--paper)] shadow-[var(--shadow-sm)]">
            {preview.shares.map((share) => {
              const member = members.find((candidate) => candidate.id === share.memberId);
              return (
                <div
                  key={share.memberId}
                  className="flex items-center gap-2 border-b border-[var(--soft-line)] px-3 py-3 last:border-0 sm:gap-3 sm:px-4"
                >
                  <MemberAvatar
                    name={member?.name ?? "Member"}
                    color={member?.avatarColor}
                    className="size-9 border-0 shadow-none"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate">{member?.name}</strong>
                    <small className="block text-[var(--muted)]">
                      Fees {formatMoney(share.fixedCents, currency, locale)} · usage{" "}
                      {formatMoney(share.variableCents, currency, locale)}
                    </small>
                  </span>
                  <span className="shrink-0 text-sm text-[var(--muted)]">
                    {share.presenceDays} days
                  </span>
                  <span className="h-8 w-px shrink-0 bg-[var(--line)]" aria-hidden="true" />
                  <strong className="shrink-0 tabular-nums">
                    {formatMoney(share.amountCents, currency, locale)}
                  </strong>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="md:mt-2 md:flex md:items-center md:justify-between md:gap-4">
        <ExpenseTools ariaLabel="Bill tools">
          <TransactionNoteAction
            value={note}
            onChange={setNote}
            disabled={pending}
            title="Bill notes"
            placeholder="Add anything useful about this bill."
          />
        </ExpenseTools>
        <div className="hidden items-center justify-end gap-2.5 md:flex">
          <Button
            type="button"
            tone="quiet"
            className="min-w-28 rounded-full px-5"
            onClick={() => (cancelHref ? router.replace(cancelHref) : router.back())}
            disabled={pending}
          >
            <X className="size-4" aria-hidden="true" /> Cancel
          </Button>
          <Button
            type="submit"
            tone="pastel"
            disabled={pending}
            className="min-w-48 rounded-full border-0 px-5 shadow-[0_10px_24px_rgb(15_118_110/0.12)]"
          >
            {existing ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-[18px]" aria-hidden="true" />
            )}
            {pending ? "Saving bill…" : existing ? "Save bill changes" : "Add bill"}
          </Button>
        </div>
      </div>
    </form>
  );
}
