"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ReceiptText } from "lucide-react";

import {
  saveExpenseAction,
  saveRecurringExpenseRuleAction,
  updateExpenseAction,
} from "@/lib/actions";
import { Button } from "../ui/button";
import { StatusNote } from "../ui/page";
import {
  ExpenseAttachmentAction,
  type ExistingExpenseAttachment,
} from "./expense-attachment-action";
import { ExpenseDateAction } from "./expense-date-action";
import {
  CurrencyAction,
  ExpenseSharingControls,
  splitIsValid,
  type SplitValues,
} from "./expense-sharing-controls";
import { ExpenseTools } from "./expense-tools";
import type { RecurrenceFrequency } from "@/lib/domain/recurrence";

type MemberOption = { id: string; name: string };
type EditableSplitConfig =
  | { method: "equal"; participants: Array<{ memberId: string; order: number }> }
  | {
      method: "exact";
      participants: Array<{ memberId: string; order: number; amountCents: number }>;
    }
  | {
      method: "percentage";
      participants: Array<{ memberId: string; order: number; basisPoints: number }>;
    };

type InitialExpense = {
  expenseId: string;
  title: string;
  totalCents: number;
  currency: string;
  payerMemberId: string;
  expenseDate: string;
  splitConfig: EditableSplitConfig;
};

export function ExpenseForm({
  householdId,
  defaultCurrency,
  currentMemberId,
  landlordEnabled,
  members,
  initial,
  initialAttachment,
  defaultRecurring = false,
}: {
  householdId: string;
  defaultCurrency: string;
  currentMemberId: string;
  landlordEnabled: boolean;
  members: MemberOption[];
  initial?: InitialExpense;
  initialAttachment?: ExistingExpenseAttachment;
  defaultRecurring?: boolean;
}) {
  const router = useRouter();
  const [split, setSplit] = useState<"equal" | "exact" | "percentage">(
    initial?.splitConfig.method ?? "equal",
  );
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initial?.splitConfig.participants.map((participant) => participant.memberId) ??
          members.map((member) => member.id),
      ),
  );
  const [payer, setPayer] = useState(initial?.payerMemberId ?? currentMemberId);
  const [amount, setAmount] = useState(initial ? (initial.totalCents / 100).toFixed(2) : "");
  const [amounts, setAmounts] = useState<SplitValues>(() =>
    initial?.splitConfig.method === "exact"
      ? Object.fromEntries(
          initial.splitConfig.participants.map((p) => [
            p.memberId,
            (p.amountCents / 100).toFixed(2),
          ]),
        )
      : {},
  );
  const [percentages, setPercentages] = useState<SplitValues>(() =>
    initial?.splitConfig.method === "percentage"
      ? Object.fromEntries(
          initial.splitConfig.participants.map((p) => [
            p.memberId,
            (p.basisPoints / 100).toFixed(2),
          ]),
        )
      : {},
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [recurring, setRecurring] = useState(!initial && defaultRecurring);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("monthly");
  const [expenseDate, setExpenseDate] = useState(
    initial?.expenseDate ?? new Date().toISOString().slice(0, 10),
  );
  const [recurringEndDate, setRecurringEndDate] = useState("");
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [attachmentFile, setAttachmentFile] = useState<File>();
  const [attachmentRemoved, setAttachmentRemoved] = useState(false);
  const [createdExpenseId, setCreatedExpenseId] = useState<string>();

  async function syncAttachment(expenseId: string) {
    if (attachmentFile) {
      const body = new FormData();
      body.set("householdId", householdId);
      body.set("file", attachmentFile);
      const response = await fetch(`/api/expenses/${expenseId}/attachment`, {
        method: "POST",
        body,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The attachment could not be saved.");
      return;
    }
    if (attachmentRemoved && initialAttachment) {
      const response = await fetch(`/api/expenses/${expenseId}/attachment`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ householdId }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "The attachment could not be removed.");
      }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const participants = members.filter((member) => selected.has(member.id));
    const totalCents = Math.round(Number(data.get("amount")) * 100);
    if (!splitIsValid(split, participants, split === "exact" ? amounts : percentages, totalCents)) {
      setError("Open the split settings and make sure the selected shares match the total.");
      return;
    }
    const splitConfig =
      split === "equal"
        ? {
            method: "equal" as const,
            participants: participants.map((member, order) => ({ memberId: member.id, order })),
          }
        : split === "exact"
          ? {
              method: "exact" as const,
              participants: participants.map((member, order) => ({
                memberId: member.id,
                order,
                amountCents: Math.round(Number(amounts[member.id]) * 100),
              })),
            }
          : {
              method: "percentage" as const,
              participants: participants.map((member, order) => ({
                memberId: member.id,
                order,
                basisPoints: Math.round(Number(percentages[member.id]) * 100),
              })),
            };
    startTransition(async () => {
      const input = {
        householdId,
        title: String(data.get("title") ?? ""),
        totalCents,
        currency,
        payerMemberId: payer,
        expenseDate,
        splitConfig,
      };
      if (!initial && recurring) {
        const createdRule = await saveRecurringExpenseRuleAction({
          householdId,
          title: input.title,
          amountCents: input.totalCents,
          currency: input.currency,
          payerMemberId: input.payerMemberId,
          splitConfig,
          startDate: input.expenseDate,
          frequency,
          endDate: recurringEndDate || undefined,
          active: true,
        });
        if (!createdRule.ok) {
          setError(createdRule.error);
          return;
        }
        router.replace(`/h/${householdId}`);
        router.refresh();
        return;
      }
      let expenseId = initial?.expenseId ?? createdExpenseId;
      if (expenseId) {
        const updated = await updateExpenseAction({ ...input, expenseId });
        if (!updated.ok) {
          setError(updated.error);
          return;
        }
      } else {
        const created = await saveExpenseAction(input);
        if (!created.ok) {
          setError(created.error);
          return;
        }
        expenseId = created.data.expenseId;
      }
      try {
        await syncAttachment(expenseId);
      } catch (cause) {
        setCreatedExpenseId(expenseId);
        setError(
          `${initial || createdExpenseId ? "Expense changes were saved" : "Expense was created"}, but ${cause instanceof Error ? cause.message.toLowerCase() : "the attachment could not be saved"}`,
        );
        return;
      }
      router.replace(initial ? `/h/${householdId}/expenses/${expenseId}` : `/h/${householdId}`);
      router.refresh();
    });
  }

  return (
    <form
      data-mobile-submit
      className="grid w-full min-w-0 gap-3"
      onSubmit={submit}
      aria-busy={pending}
    >
      {error && (
        <StatusNote tone="error" title={error}>
          Check the amounts and selected roommates.
        </StatusNote>
      )}

      <section className="w-full min-w-0 px-1 py-2 sm:px-4 sm:py-4">
        <div className="grid min-w-0 gap-1">
          <label className="screen-reader-only" htmlFor="expense-title">
            Description
          </label>
          <div className="flex w-full min-w-0 items-center gap-3 border-b-2 border-[var(--pastel-mint-line)] py-2 focus-within:border-[var(--brand)]">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)]">
              <ReceiptText className="size-5" aria-hidden="true" />
            </span>
            <input
              id="expense-title"
              name="title"
              placeholder="What was it for?"
              defaultValue={initial?.title}
              required
              autoFocus={!initial}
              className="expense-primary-input h-12 w-0 min-w-0 flex-1 bg-transparent text-xl font-black tracking-[-0.025em] text-[var(--ink)] outline-none placeholder:font-semibold placeholder:text-[#94a3b8]"
            />
          </div>

          <div className="flex w-full min-w-0 items-end gap-3 border-b-2 border-[var(--pastel-mint-line)] py-2 focus-within:border-[var(--brand)]">
            <label className="screen-reader-only" htmlFor="expense-amount">
              Amount
            </label>
            <CurrencyAction value={currency} onChange={setCurrency} disabled={pending} />
            <input
              id="expense-amount"
              name="amount"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              className="expense-primary-input h-14 w-0 min-w-0 flex-1 bg-transparent text-[2.2rem] leading-none font-black tracking-[-0.045em] text-[var(--ink)] tabular-nums outline-none placeholder:text-[#94a3b8]"
            />
          </div>
        </div>
        <ExpenseSharingControls
          members={members}
          currentMemberId={currentMemberId}
          landlordEnabled={landlordEnabled}
          payer={payer}
          onPayerChange={setPayer}
          selected={selected}
          onSelectedChange={setSelected}
          method={split}
          amounts={amounts}
          percentages={percentages}
          onSplitChange={(method, nextAmounts, nextPercentages) => {
            setSplit(method);
            setAmounts(nextAmounts);
            setPercentages(nextPercentages);
          }}
          totalCents={Math.max(0, Math.round(Number(amount || 0) * 100))}
          currency={currency}
          disabled={pending}
        />

        <div className="h-24 md:hidden" aria-hidden="true" />
        <ExpenseTools>
          <ExpenseDateAction
            value={expenseDate}
            onValueChange={setExpenseDate}
            recurring={recurring}
            frequency={frequency}
            onFrequencyChange={setFrequency}
            onRecurringChange={(value) => {
              setRecurring(value);
              if (value) {
                setAttachmentFile(undefined);
                setAttachmentRemoved(false);
              }
            }}
            recurringEnd={recurringEndDate}
            onRecurringEndChange={setRecurringEndDate}
            allowRecurrence={!initial}
            disabled={pending}
          />
          <ExpenseAttachmentAction
            file={attachmentFile}
            existing={initialAttachment}
            removed={attachmentRemoved}
            onFileChange={(file) => {
              setAttachmentFile(file);
              setAttachmentRemoved(false);
            }}
            onRemove={() => {
              setAttachmentFile(undefined);
              setAttachmentRemoved(true);
            }}
            onError={setError}
            disabled={pending || recurring}
          />
        </ExpenseTools>
      </section>

      <div className="hidden gap-3 md:flex md:justify-end">
        <Button type="button" tone="secondary" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" className="min-w-36" disabled={pending || selected.size === 0}>
          {pending
            ? "Saving…"
            : initial
              ? "Save changes"
              : recurring
                ? "Add recurring expense"
                : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
