"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { saveSettlementAction, updateSettlementAction } from "@/lib/actions";
import { Button } from "../ui/button";
import { Field, inputClass, textareaClass } from "../ui/field";
import { StatusNote } from "../ui/page";

export function SettlementForm({
  householdId,
  defaultCurrency,
  members,
  initial,
}: {
  householdId: string;
  defaultCurrency: string;
  members: Array<{ id: string; name: string }>;
  initial?: {
    settlementId: string;
    payingMemberId: string;
    receivingMemberId: string;
    amountCents: number;
    currency: string;
    settlementDate: string;
    note?: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const input = {
        householdId,
        payingMemberId: String(data.get("payingMemberId") ?? ""),
        receivingMemberId: String(data.get("receivingMemberId") ?? ""),
        amountCents: Math.round(Number(data.get("amount")) * 100),
        currency: String(data.get("currency") ?? defaultCurrency),
        settlementDate: String(data.get("settlementDate") ?? ""),
        note: String(data.get("note") ?? "") || undefined,
      };
      const result = initial
        ? await updateSettlementAction({ ...input, settlementId: initial.settlementId })
        : await saveSettlementAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(
        initial
          ? `/h/${householdId}/settlements/${initial.settlementId}`
          : `/h/${householdId}/balances`,
      );
      router.refresh();
    });
  }
  return (
    <form className="grid gap-6" onSubmit={submit} aria-busy={pending}>
      {error && (
        <StatusNote tone="error" title={error}>
          Choose two different roommates and check the amount.
        </StatusNote>
      )}
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Field label="Paid by">
          <select
            name="payingMemberId"
            className={inputClass}
            defaultValue={initial?.payingMemberId ?? members[1]?.id ?? members[0]?.id}
            disabled={pending}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>
        <ArrowRight
          className="mb-4 hidden size-5 text-[var(--muted)] sm:block"
          aria-hidden="true"
        />
        <Field label="Paid to">
          <select
            name="receivingMemberId"
            className={inputClass}
            defaultValue={initial?.receivingMemberId ?? members[0]?.id}
            disabled={pending}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Amount">
          <input
            name="amount"
            className={inputClass}
            inputMode="decimal"
            min="0.01"
            step="0.01"
            type="number"
            defaultValue={initial ? (initial.amountCents / 100).toFixed(2) : undefined}
            required
            disabled={pending}
          />
        </Field>
        <Field label="Currency">
          <select
            name="currency"
            className={inputClass}
            defaultValue={initial?.currency ?? defaultCurrency}
            disabled={pending}
          >
            <option>EUR</option>
            <option>GBP</option>
            <option>USD</option>
          </select>
        </Field>
      </div>
      <Field label="Payment date">
        <input
          name="settlementDate"
          type="date"
          className={inputClass}
          defaultValue={initial?.settlementDate ?? new Date().toISOString().slice(0, 10)}
          required
          disabled={pending}
        />
      </Field>
      <Field label="Note (optional)">
        <textarea
          name="note"
          className={textareaClass}
          placeholder="Bank transfer, cash, etc."
          defaultValue={initial?.note}
          disabled={pending}
        />
      </Field>
      <StatusNote title="Record payments after they happen">
        Froskolin doesn’t transfer money. This entry updates balances and appears in the household
        history.
      </StatusNote>
      <Button type="submit" className="justify-self-end" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save settlement" : "Record settlement"}
      </Button>
    </form>
  );
}
