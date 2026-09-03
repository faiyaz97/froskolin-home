"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { saveRecurringExpenseRuleAction, updateRecurringExpenseRuleAction } from "@/lib/actions";
import { Button } from "../ui/button";
import { Field, inputClass } from "../ui/field";
import { StatusNote } from "../ui/page";

export function RecurringForm({
  householdId,
  defaultCurrency,
  members,
  initial,
}: {
  householdId: string;
  defaultCurrency: string;
  members: Array<{ id: string; name: string }>;
  initial?: {
    ruleId: string;
    title: string;
    amountCents: number;
    currency: string;
    payerMemberId: string;
    startDate: string;
    endDate?: string;
    active: boolean;
    splitConfig:
      | { method: "equal"; participants: Array<{ memberId: string; order: number }> }
      | {
          method: "exact";
          participants: Array<{ memberId: string; order: number; amountCents: number }>;
        }
      | {
          method: "percentage";
          participants: Array<{ memberId: string; order: number; basisPoints: number }>;
        };
  };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    () =>
      new Set(
        initial?.splitConfig.participants.map((participant) => participant.memberId) ??
          members.map((member) => member.id),
      ),
  );
  const [split, setSplit] = useState<"equal" | "exact" | "percentage">(
    initial?.splitConfig.method ?? "equal",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const participants = members.filter((member) => selected.has(member.id));
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
      const input = {
        householdId,
        title: String(data.get("title") ?? ""),
        amountCents: Math.round(Number(data.get("amount")) * 100),
        currency: String(data.get("currency") ?? defaultCurrency),
        payerMemberId: String(data.get("payerMemberId") ?? ""),
        splitConfig,
        startDate: String(data.get("startDate") ?? ""),
        endDate: String(data.get("endDate") ?? "") || undefined,
        active: initial?.active ?? true,
      };
      const result = initial
        ? await updateRecurringExpenseRuleAction({ ...input, ruleId: initial.ruleId })
        : await saveRecurringExpenseRuleAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(`/h/${householdId}/settings`);
      router.refresh();
    });
  }
  return (
    <form className="grid gap-6" onSubmit={submit} aria-busy={pending}>
      {error && (
        <StatusNote tone="error" title={error}>
          Check the amount, dates, and selected roommates.
        </StatusNote>
      )}
      <Field label="Name">
        <input
          name="title"
          className={inputClass}
          placeholder="Internet"
          defaultValue={initial?.title}
          required
          disabled={pending}
        />
      </Field>
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid by">
          <select
            name="payerMemberId"
            className={inputClass}
            defaultValue={initial?.payerMemberId ?? members[0]?.id}
            disabled={pending}
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Frequency">
          <select className={inputClass} disabled>
            <option>Monthly</option>
          </select>
        </Field>
      </div>
      <fieldset disabled={pending}>
        <legend className="text-sm font-bold">Participants</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
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
      <fieldset disabled={pending}>
        <legend className="text-sm font-bold">Split method</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(
            [
              ["equal", "Equally"],
              ["exact", "Exact amounts"],
              ["percentage", "Percentages"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex min-h-12 items-center gap-2 rounded-xl border px-3 text-sm font-bold ${split === value ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white"}`}
            >
              <input
                type="radio"
                checked={split === value}
                onChange={() => setSplit(value)}
                className="accent-[var(--brand)]"
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
                    <span className="absolute top-3.5 right-3.5 text-[var(--muted)]">
                      {split === "percentage" ? "%" : (initial?.currency ?? defaultCurrency)}
                    </span>
                  </div>
                </Field>
              ))}
          </div>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts">
          <input
            name="startDate"
            type="date"
            className={inputClass}
            defaultValue={initial?.startDate ?? new Date().toISOString().slice(0, 10)}
            required
            disabled={pending}
          />
        </Field>
        <Field label="Ends (optional)">
          <input
            name="endDate"
            type="date"
            className={inputClass}
            defaultValue={initial?.endDate}
            disabled={pending}
          />
        </Field>
      </div>
      <StatusNote title="Monthly dates stay anchored">
        A rule starting on the 31st uses month-end in shorter months, then returns to the 31st when
        possible.
      </StatusNote>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || selected.size === 0}>
          {pending ? "Saving…" : initial ? "Save future occurrences" : "Create monthly rule"}
        </Button>
      </div>
    </form>
  );
}
