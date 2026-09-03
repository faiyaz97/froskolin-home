"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Check, ReceiptText, Users } from "lucide-react";

import { saveExpenseAction, updateExpenseAction } from "@/lib/actions";
import { MemberAvatar } from "../household/member-avatar";
import { Button } from "../ui/button";
import { DateInput } from "../ui/date-input";
import { Field, inputClass } from "../ui/field";
import { StatusNote } from "../ui/page";
import { SelectInput } from "../ui/select-input";

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
  members,
  initial,
}: {
  householdId: string;
  defaultCurrency: string;
  members: MemberOption[];
  initial?: InitialExpense;
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const participants = members.filter((member) => selected.has(member.id));
    const totalCents = Math.round(Number(data.get("amount")) * 100);
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
                amountCents: Math.round(Number(data.get(`share-${member.id}`)) * 100),
              })),
            }
          : {
              method: "percentage" as const,
              participants: participants.map((member, order) => ({
                memberId: member.id,
                order,
                basisPoints: Math.round(Number(data.get(`share-${member.id}`)) * 100),
              })),
            };
    startTransition(async () => {
      const input = {
        householdId,
        title: String(data.get("title") ?? ""),
        totalCents,
        currency: String(data.get("currency") ?? defaultCurrency),
        payerMemberId: String(data.get("payer") ?? ""),
        expenseDate: String(data.get("date") ?? ""),
        splitConfig,
      };
      let expenseId: string;
      if (initial) {
        const updated = await updateExpenseAction({ ...input, expenseId: initial.expenseId });
        if (!updated.ok) {
          setError(updated.error);
          return;
        }
        expenseId = initial.expenseId;
      } else {
        const created = await saveExpenseAction(input);
        if (!created.ok) {
          setError(created.error);
          return;
        }
        expenseId = created.data.expenseId;
      }
      router.replace(`/h/${householdId}/expenses/${expenseId}`);
      router.refresh();
    });
  }

  return (
    <form className="grid gap-5" onSubmit={submit} aria-busy={pending}>
      {error && (
        <StatusNote tone="error" title={error}>
          Check the amounts and selected roommates.
        </StatusNote>
      )}

      <fieldset
        className="rounded-[20px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5"
        disabled={pending}
      >
        <legend className="screen-reader-only">Expense details</legend>
        <div className="grid gap-5">
          <Field label="Description">
            <div className="flex items-center gap-3">
              <span className="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-[var(--brand-soft)] text-[var(--brand)]">
                <ReceiptText className="size-6" aria-hidden="true" />
              </span>
              <input
                className={inputClass}
                name="title"
                placeholder="What was it for?"
                defaultValue={initial?.title}
                required
              />
            </div>
          </Field>

          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <Field label="Amount">
              <input
                className={`${inputClass} text-2xl font-black tracking-[-0.03em] tabular-nums`}
                name="amount"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                type="number"
                placeholder="0.00"
                defaultValue={initial ? (initial.totalCents / 100).toFixed(2) : undefined}
                required
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

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Paid by">
              <SelectInput
                name="payer"
                defaultValue={initial?.payerMemberId ?? members[0]?.id}
                ariaLabel="Paid by"
                disabled={pending}
                options={members.map((member) => ({
                  value: member.id,
                  label: member.name,
                }))}
              />
            </Field>
            <Field label="Date">
              <DateInput
                name="date"
                ariaLabel="Expense date"
                defaultValue={initial?.expenseDate ?? new Date().toISOString().slice(0, 10)}
                disabled={pending}
              />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset
        className="rounded-[20px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5"
        disabled={pending}
      >
        <legend className="mb-4 flex items-center gap-2 text-base font-black">
          <Users className="size-5 text-[var(--violet)]" aria-hidden="true" /> Split with
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {members.map((member) => {
            const checked = selected.has(member.id);
            return (
              <label
                key={member.id}
                className={`flex min-h-[54px] cursor-pointer items-center gap-3 rounded-[14px] border px-3 transition-colors ${checked ? "border-[#a7f3d0] bg-[#f0fdfa]" : "border-[var(--line)] bg-white"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  className="screen-reader-only"
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(member.id);
                      else next.delete(member.id);
                      return next;
                    })
                  }
                />
                <MemberAvatar name={member.name} />
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">
                  {member.name}
                </span>
                <span
                  className={`grid size-6 place-items-center rounded-lg border ${checked ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[#cbd5e1] text-transparent"}`}
                >
                  <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset
        className="rounded-[20px] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)] sm:p-5"
        disabled={pending}
      >
        <legend className="text-base font-black">Split method</legend>
        <div className="mt-3 grid grid-cols-3 rounded-[14px] bg-[var(--soft-line)] p-1">
          {(
            [
              ["equal", "Equally"],
              ["exact", "Amounts"],
              ["percentage", "Percentages"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-[11px] px-2 text-center text-xs font-extrabold transition-colors sm:text-sm ${split === value ? "bg-white text-[var(--brand-strong)] shadow-sm" : "text-[var(--muted)]"}`}
            >
              <input
                type="radio"
                name="split"
                value={value}
                checked={split === value}
                onChange={() => setSplit(value)}
                className="screen-reader-only"
              />
              {label}
            </label>
          ))}
        </div>

        {split !== "equal" && (
          <div className="mt-4 grid gap-3">
            {members
              .filter((member) => selected.has(member.id))
              .map((member) => (
                <Field key={member.id} label={member.name}>
                  <div className="relative">
                    <input
                      name={`share-${member.id}`}
                      className={inputClass}
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      type="number"
                      defaultValue={
                        initial?.splitConfig.method === "exact"
                          ? (
                              (initial.splitConfig.participants.find(
                                (participant) => participant.memberId === member.id,
                              )?.amountCents ?? 0) / 100
                            ).toFixed(2)
                          : initial?.splitConfig.method === "percentage"
                            ? (
                                (initial.splitConfig.participants.find(
                                  (participant) => participant.memberId === member.id,
                                )?.basisPoints ?? 0) / 100
                              ).toFixed(2)
                            : undefined
                      }
                      required
                    />
                    <span className="absolute top-4 right-4 text-sm font-bold text-[var(--muted)]">
                      {split === "percentage" ? "%" : defaultCurrency}
                    </span>
                  </div>
                </Field>
              ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" tone="secondary" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" className="min-w-36" disabled={pending || selected.size === 0}>
          {pending ? "Saving…" : initial ? "Save changes" : "Save expense"}
        </Button>
      </div>
    </form>
  );
}
