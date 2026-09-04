"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { saveSettlementAction, updateSettlementAction } from "@/lib/actions";
import { Button } from "../ui/button";
import { DateInput } from "../ui/date-input";
import { Field, Input, Textarea } from "../ui/field";
import { StatusNote } from "../ui/page";
import { SelectInput } from "../ui/select-input";

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
        initial ? `/h/${householdId}/settlements/${initial.settlementId}` : `/h/${householdId}`,
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
          <SelectInput
            name="payingMemberId"
            defaultValue={initial?.payingMemberId ?? members[1]?.id ?? members[0]?.id}
            ariaLabel="Paid by"
            disabled={pending}
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        </Field>
        <ArrowRight
          className="mb-4 hidden size-5 text-[var(--muted)] sm:block"
          aria-hidden="true"
        />
        <Field label="Paid to">
          <SelectInput
            name="receivingMemberId"
            defaultValue={initial?.receivingMemberId ?? members[0]?.id}
            ariaLabel="Paid to"
            disabled={pending}
            options={members.map((member) => ({ value: member.id, label: member.name }))}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Amount">
          <Input
            name="amount"
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
          <SelectInput
            name="currency"
            defaultValue={initial?.currency ?? defaultCurrency}
            ariaLabel="Currency"
            disabled={pending}
            options={[
              { value: "EUR", label: "EUR" },
              { value: "GBP", label: "GBP" },
              { value: "USD", label: "USD" },
            ]}
          />
        </Field>
      </div>
      <Field label="Payment date">
        <DateInput
          name="settlementDate"
          ariaLabel="Payment date"
          defaultValue={initial?.settlementDate ?? new Date().toISOString().slice(0, 10)}
          disabled={pending}
        />
      </Field>
      <Field label="Note (optional)">
        <Textarea
          name="note"
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
