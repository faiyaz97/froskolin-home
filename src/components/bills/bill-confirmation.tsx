"use client";

import { AlertTriangle, FileText } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { confirmUtilityBillAction, updateUtilityBillAction } from "@/lib/actions";
import { calculateUtilityShares, type DateRange } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import type { ExtractedBill } from "@/lib/validation";
import { Button } from "../ui/button";
import { DateInput } from "../ui/date-input";
import { Field, Input, Textarea } from "../ui/field";
import { StatusNote } from "../ui/page";
import { SelectInput } from "../ui/select-input";

type Member = { id: string; name: string };
type Absence = { memberId: string; startDate: string; endDate: string };
type ExistingUtility = {
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
};

export function BillConfirmation({
  householdId,
  documentId,
  defaultCurrency,
  locale,
  initial,
  existing,
  pageCount,
  members,
  absences,
}: {
  householdId: string;
  documentId?: string;
  defaultCurrency: string;
  locale: string;
  initial?: ExtractedBill;
  existing?: ExistingUtility;
  pageCount?: number;
  members: Member[];
  absences: Absence[];
}) {
  const router = useRouter();
  const [total, setTotal] = useState(
    existing
      ? (existing.totalCents / 100).toFixed(2)
      : initial
        ? (initial.totalDueCents / 100).toFixed(2)
        : "",
  );
  const [fixed, setFixed] = useState(
    existing
      ? (existing.fixedCents / 100).toFixed(2)
      : initial?.charges.fixedCents != null
        ? (initial.charges.fixedCents / 100).toFixed(2)
        : "",
  );
  const [variable, setVariable] = useState(
    existing
      ? (existing.variableCents / 100).toFixed(2)
      : initial?.charges.consumptionCents != null
        ? (initial.charges.consumptionCents / 100).toFixed(2)
        : "",
  );
  const [serviceStart, setServiceStart] = useState(
    existing?.serviceStart ?? initial?.servicePeriod.start ?? "",
  );
  const [serviceEnd, setServiceEnd] = useState(
    existing?.serviceEnd ?? initial?.servicePeriod.end ?? "",
  );
  const [currency, setCurrency] = useState(
    existing?.currency ?? initial?.currency ?? defaultCurrency,
  );
  const [selected, setSelected] = useState(
    () => new Set(existing?.participantIds ?? members.map((member) => member.id)),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const totalCents = Math.round(Number(total) * 100);
  const fixedCents = Math.round(Number(fixed) * 100);
  const variableCents = Math.round(Number(variable) * 100);
  const valid =
    Number.isSafeInteger(totalCents) &&
    totalCents > 0 &&
    fixedCents >= 0 &&
    variableCents >= 0 &&
    fixedCents + variableCents === totalCents &&
    serviceStart !== "" &&
    serviceEnd >= serviceStart &&
    selected.size > 0;
  const lowConfidence =
    !existing &&
    (!initial ||
      Object.values(initial.extractionConfidence).some((value) => value < 0.8) ||
      initial.charges.fixedCents == null ||
      initial.charges.consumptionCents == null);
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
    if (!valid) return;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const utilityType = String(data.get("utilityType") ?? "other");
      const supplier = String(data.get("supplier") ?? "").trim();
      const input = {
        householdId,
        documentId,
        title: String(data.get("title") ?? "").trim() || `${supplier || utilityType} bill`,
        utilityType,
        supplier: supplier || null,
        issueDate: String(data.get("issueDate") ?? "") || null,
        serviceStart,
        serviceEnd,
        totalCents,
        fixedCents,
        variableCents,
        currency,
        payerMemberId: String(data.get("payerMemberId") ?? ""),
        participants: members
          .filter((member) => selected.has(member.id))
          .map((member, order) => ({ memberId: member.id, order })),
        consumptionAmount: existing?.consumptionAmount ?? initial?.consumption.amount ?? null,
        consumptionUnit: existing?.consumptionUnit ?? initial?.consumption.unit ?? null,
        classificationNote: String(data.get("classificationNote") ?? "") || null,
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
      router.replace(`/h/${householdId}/expenses/${expenseId}`);
      router.refresh();
    });
  }

  return (
    <form className="grid gap-7" onSubmit={submit} aria-busy={pending}>
      {lowConfidence && (
        <StatusNote tone="warning" title="Review the highlighted bill facts">
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="size-3.5" />
            Some fields were missing or below 80% extraction confidence. Nothing is saved until you
            confirm.
          </span>
        </StatusNote>
      )}
      {error && (
        <StatusNote tone="error" title={error}>
          Correct the bill fields and try again.
        </StatusNote>
      )}
      {documentId && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-4">
          <FileText className="size-6 text-[var(--brand)]" />
          <p className="min-w-0 flex-1 text-sm">
            <strong className="block truncate">Private uploaded bill</strong>
            <span className="text-[var(--muted)]">
              {pageCount ? `${pageCount} page${pageCount === 1 ? "" : "s"} · ` : ""}private document
            </span>
          </p>
          <a
            href={`/api/bills/${documentId}/view?householdId=${householdId}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold text-[var(--brand-strong)]"
          >
            View
          </a>
        </div>
      )}
      <fieldset className="grid gap-5" disabled={pending}>
        <legend className="mb-3 text-lg font-extrabold">Bill facts</legend>
        <Field label="Title">
          <Input
            name="title"
            defaultValue={
              existing?.title ?? (initial?.supplier ? `${initial.supplier} bill` : "Utility bill")
            }
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Utility type">
            <SelectInput
              name="utilityType"
              defaultValue={existing?.utilityType ?? initial?.utilityType ?? "other"}
              ariaLabel="Utility type"
              options={[
                { value: "electricity", label: "Electricity" },
                { value: "gas", label: "Gas" },
                { value: "water", label: "Water" },
                { value: "internet", label: "Internet" },
                { value: "other", label: "Other" },
              ]}
            />
          </Field>
          <Field label="Supplier">
            <Input name="supplier" defaultValue={existing?.supplier ?? initial?.supplier ?? ""} />
          </Field>
          <Field label="Paid by">
            <SelectInput
              name="payerMemberId"
              defaultValue={existing?.payerMemberId ?? members[0]?.id}
              ariaLabel="Paid by"
              options={members.map((member) => ({ value: member.id, label: member.name }))}
            />
          </Field>
          <Field label="Issue date">
            <DateInput
              name="issueDate"
              ariaLabel="Issue date"
              defaultValue={existing?.issueDate ?? initial?.issueDate ?? ""}
              allowClear
            />
          </Field>
          <Field label="Service starts">
            <DateInput
              ariaLabel="Service start date"
              value={serviceStart}
              onValueChange={setServiceStart}
            />
          </Field>
          <Field label="Service ends">
            <DateInput
              ariaLabel="Service end date"
              value={serviceEnd}
              onValueChange={setServiceEnd}
            />
          </Field>
        </div>
      </fieldset>
      <fieldset className="grid gap-5" disabled={pending}>
        <legend className="mb-3 text-lg font-extrabold">Classify every cent</legend>
        <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
          <Field label="Total due">
            <MoneyInput value={total} onChange={setTotal} />
          </Field>
          <Field label="Currency">
            <SelectInput
              name="currency"
              value={currency}
              onValueChange={setCurrency}
              ariaLabel="Currency"
              options={[
                { value: "EUR", label: "EUR" },
                { value: "GBP", label: "GBP" },
                { value: "USD", label: "USD" },
              ]}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fixed portion" hint="Shared equally, even when someone was away.">
            <MoneyInput value={fixed} onChange={setFixed} />
          </Field>
          <Field label="Variable portion" hint="Shared by each person’s days at home.">
            <MoneyInput value={variable} onChange={setVariable} />
          </Field>
        </div>
        {!valid && total && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--negative-soft)] p-3 text-sm font-bold text-[var(--negative)]"
          >
            Fixed + variable must equal the total, dates must be valid, and at least one roommate
            must participate.
          </p>
        )}
        <Field label="Classification note (optional)">
          <Textarea
            name="classificationNote"
            placeholder="Explain where taxes, credits, or adjustments were classified."
            defaultValue={existing?.classificationNote ?? ""}
          />
        </Field>
      </fieldset>
      <fieldset disabled={pending}>
        <legend className="text-lg font-extrabold">Participating roommates</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {members.map((member) => (
            <label
              key={member.id}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-3 text-sm font-bold"
            >
              <input
                type="checkbox"
                checked={selected.has(member.id)}
                onChange={(event) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(member.id);
                    else next.delete(member.id);
                    return next;
                  })
                }
                className="size-4 accent-[var(--brand)]"
              />
              {member.name}
            </label>
          ))}
        </div>
      </fieldset>
      {preview && (
        <section>
          <h2 className="text-lg font-extrabold">Deterministic preview</h2>
          {preview.variableMode === "equal_zero_presence_fallback" && (
            <StatusNote tone="warning" title="Nobody was recorded present">
              The variable portion is split equally for this bill.
            </StatusNote>
          )}
          <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
            {preview.shares.map((share) => (
              <div
                key={share.memberId}
                className="flex items-center gap-3 border-b border-[var(--soft-line)] px-4 py-3 last:border-0"
              >
                <span className="flex-1">
                  <strong>{members.find((member) => member.id === share.memberId)?.name}</strong>
                  <small className="block text-[var(--muted)]">
                    Fixed {formatMoney(share.fixedCents, currency, locale)} · usage{" "}
                    {formatMoney(share.variableCents, currency, locale)}
                  </small>
                </span>
                <span className="text-sm text-[var(--muted)]">{share.presenceDays} days</span>
                <strong>{formatMoney(share.amountCents, currency, locale)}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
      <Button type="submit" disabled={!valid || pending} className="justify-self-end">
        {pending ? "Saving bill…" : existing ? "Save bill changes" : "Confirm and create bill"}
      </Button>
    </form>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Input
      inputMode="decimal"
      min="0"
      step="0.01"
      type="number"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
    />
  );
}
