"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { MemberAvatar } from "../household/member-avatar";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/field";
import { cn } from "../ui/cn";

type Member = { id: string; name: string };
export type SplitMethod = "equal" | "exact" | "percentage";
export type SplitValues = Record<string, string>;
const methods = { equal: "Equally", exact: "By amounts", percentage: "By percentages" };
const currencies = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British pound" },
  { code: "USD", symbol: "$", name: "US dollar" },
];

export function participantSummary(members: Member[], selected: Set<string>) {
  const names = members.filter((member) => selected.has(member.id)).map((member) => member.name);
  if (names.length === members.length && names.length) return "Everyone";
  if (names.length < 2) return names[0] ?? "Nobody";
  if (names.length === 2) return names.join(" & ");
  return `${names.slice(0, -1).join(", ")}, & ${names.at(-1)}`;
}

function ChoiceRow({
  selected,
  children,
  onClick,
  multiple = false,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  multiple?: boolean;
}) {
  return (
    <button
      type="button"
      role={multiple ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
        selected
          ? "bg-[var(--pastel-mint)] text-[var(--brand-strong)]"
          : "text-[var(--ink)] hover:bg-[var(--canvas)]",
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center border",
          multiple ? "rounded-md" : "rounded-full",
          selected
            ? "border-[var(--brand)] bg-[var(--brand)] text-white"
            : "border-[var(--control-line)] text-transparent",
        )}
      >
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      </span>
    </button>
  );
}

export function CurrencyAction({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label="Currency"
        title={`Currency: ${value}`}
        aria-haspopup="dialog"
        aria-expanded={draft !== null}
        disabled={disabled}
        onClick={() => setDraft(value)}
        className="grid size-11 shrink-0 place-items-center self-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)] hover:bg-[var(--pastel-mint-line)] disabled:opacity-50"
      >
        <span className="block text-2xl leading-none font-semibold" aria-hidden="true">
          {currencies.find((item) => item.code === value)?.symbol ?? value}
        </span>
      </button>
      {draft !== null && (
        <Dialog
          title="Currency"
          onClose={() => setDraft(null)}
          onDone={() => {
            onChange(draft);
            setDraft(null);
          }}
        >
          <div role="radiogroup" aria-label="Currency" className="grid gap-1">
            {currencies.map((item) => (
              <ChoiceRow
                key={item.code}
                selected={draft === item.code}
                onClick={() => setDraft(item.code)}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--canvas)] text-xl"
                  >
                    {item.symbol}
                  </span>
                  <span className="min-w-0">
                    <strong className="block">{item.code}</strong>
                    <span className="block text-xs text-[var(--muted)]">{item.name}</span>
                  </span>
                </span>
              </ChoiceRow>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}

function InlineValue({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 max-w-full min-w-0 items-center gap-1 rounded-lg px-1.5 align-middle font-bold text-[var(--brand-strong)] underline decoration-[var(--pastel-mint-line)] decoration-2 underline-offset-4 hover:bg-[var(--pastel-mint)] disabled:opacity-50"
    >
      <span className="min-w-0 truncate">{children}</span>
      <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
    </button>
  );
}

export function ExpenseSharingControls({
  members,
  currentMemberId,
  landlordEnabled,
  payer,
  onPayerChange,
  selected,
  onSelectedChange,
  method,
  amounts,
  percentages,
  onSplitChange,
  totalCents,
  currency,
  disabled,
}: {
  members: Member[];
  currentMemberId: string;
  landlordEnabled: boolean;
  payer: string;
  onPayerChange: (value: string) => void;
  selected: Set<string>;
  onSelectedChange: (value: Set<string>) => void;
  method: SplitMethod;
  amounts: SplitValues;
  percentages: SplitValues;
  onSplitChange: (method: SplitMethod, amounts: SplitValues, percentages: SplitValues) => void;
  totalCents: number;
  currency: string;
  disabled?: boolean;
}) {
  const [dialog, setDialog] = useState<"payer" | "participants" | "split" | null>(null);
  const [draftPayer, setDraftPayer] = useState(payer);
  const [draftSelected, setDraftSelected] = useState(selected);
  const participants = members.filter((member) => selected.has(member.id));
  const payerName =
    payer === currentMemberId
      ? "You"
      : payer === "landlord"
        ? "Landlord"
        : members.find((member) => member.id === payer)?.name;
  return (
    <>
      <div className="py-4 text-center text-sm leading-8 text-[var(--ink-soft)]">
        <span className="inline-block max-w-full">
          Paid by{" "}
          <InlineValue
            label="Paid by"
            disabled={disabled}
            onClick={() => {
              setDraftPayer(payer);
              setDialog("payer");
            }}
          >
            {payerName}
          </InlineValue>
        </span>{" "}
        <span className="inline-block max-w-full">
          split{" "}
          <InlineValue label="Split method" disabled={disabled} onClick={() => setDialog("split")}>
            {methods[method]}
          </InlineValue>
        </span>{" "}
        <span className="inline-flex max-w-full items-center gap-1 align-middle">
          with{" "}
          <InlineValue
            label="Split with"
            disabled={disabled}
            onClick={() => {
              setDraftSelected(new Set(selected));
              setDialog("participants");
            }}
          >
            {participantSummary(members, selected)}
          </InlineValue>
        </span>
      </div>
      {dialog === "payer" && (
        <Dialog
          title="Paid by"
          onClose={() => setDialog(null)}
          onDone={() => {
            onPayerChange(draftPayer);
            setDialog(null);
          }}
        >
          <div role="radiogroup" aria-label="Paid by" className="grid gap-1">
            {[
              ...members,
              ...(landlordEnabled || payer === "landlord"
                ? [{ id: "landlord", name: "Landlord" }]
                : []),
            ].map((member) => (
              <ChoiceRow
                key={member.id}
                selected={draftPayer === member.id}
                onClick={() => setDraftPayer(member.id)}
              >
                <span className="flex items-center gap-3">
                  <MemberAvatar name={member.name} className="size-9 border-0 shadow-none" />
                  <span className="font-semibold break-words">{member.name}</span>
                </span>
              </ChoiceRow>
            ))}
          </div>
        </Dialog>
      )}
      {dialog === "participants" && (
        <Dialog
          title="Split with"
          onClose={() => setDialog(null)}
          doneDisabled={!draftSelected.size}
          onDone={() => {
            onSelectedChange(draftSelected);
            setDialog(null);
          }}
        >
          <div role="group" aria-label="People" className="grid gap-1">
            {members.map((member) => (
              <ChoiceRow
                key={member.id}
                multiple
                selected={draftSelected.has(member.id)}
                onClick={() =>
                  setDraftSelected((current) => {
                    const next = new Set(current);
                    if (next.has(member.id)) next.delete(member.id);
                    else next.add(member.id);
                    return next;
                  })
                }
              >
                <span className="flex items-center gap-3">
                  <MemberAvatar name={member.name} className="size-9 border-0 shadow-none" />
                  <span className="font-semibold break-words">{member.name}</span>
                </span>
              </ChoiceRow>
            ))}
          </div>
          {!draftSelected.size && (
            <p role="status" className="px-3 pt-2 text-xs text-[var(--negative)]">
              Choose at least one person.
            </p>
          )}
        </Dialog>
      )}
      {dialog === "split" && (
        <SplitDialog
          method={method}
          amounts={amounts}
          percentages={percentages}
          members={participants}
          totalCents={totalCents}
          currency={currency}
          onClose={() => setDialog(null)}
          onDone={(nextMethod, nextAmounts, nextPercentages) => {
            onSplitChange(nextMethod, nextAmounts, nextPercentages);
            setDialog(null);
          }}
        />
      )}
    </>
  );
}

export function splitIsValid(
  method: SplitMethod,
  members: Member[],
  values: SplitValues,
  totalCents: number,
) {
  if (!members.length) return false;
  if (method === "equal") return true;
  return (
    members.every((member) => /^\d+(\.\d{1,2})?$/.test(values[member.id] ?? "")) &&
    members.reduce((sum, member) => sum + Math.round(Number(values[member.id]) * 100), 0) ===
      (method === "exact" ? totalCents : 10000)
  );
}

function SplitDialog({
  method,
  amounts,
  percentages,
  members,
  totalCents,
  currency,
  onClose,
  onDone,
}: {
  method: SplitMethod;
  amounts: SplitValues;
  percentages: SplitValues;
  members: Member[];
  totalCents: number;
  currency: string;
  onClose: () => void;
  onDone: (method: SplitMethod, amounts: SplitValues, percentages: SplitValues) => void;
}) {
  const [draftMethod, setDraftMethod] = useState(method);
  const [draftAmounts, setDraftAmounts] = useState(amounts);
  const [draftPercentages, setDraftPercentages] = useState(percentages);
  const values = draftMethod === "exact" ? draftAmounts : draftPercentages;
  const valid = splitIsValid(draftMethod, members, values, totalCents);
  const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency });
  const total = formatter.format(totalCents / 100);
  const equalShare = members.length ? formatter.format(totalCents / members.length / 100) : total;
  function changeMethod(next: SplitMethod) {
    setDraftMethod(next);
    // Seed new custom splits evenly; existing edits are never overwritten.
    const old = next === "exact" ? draftAmounts : draftPercentages;
    if (next !== "equal" && members.every((member) => old[member.id] === undefined)) {
      const target = next === "exact" ? totalCents : 10000;
      const seeded = Object.fromEntries(
        members.map((member, index) => [
          member.id,
          (
            (Math.floor(target / members.length) + (index < target % members.length ? 1 : 0)) /
            100
          ).toFixed(2),
        ]),
      );
      if (next === "exact") setDraftAmounts(seeded);
      else setDraftPercentages(seeded);
    }
  }
  return (
    <Dialog
      title="Split expense"
      onClose={onClose}
      doneDisabled={!valid}
      onDone={() => onDone(draftMethod, draftAmounts, draftPercentages)}
    >
      <div
        role="group"
        aria-label="Split method"
        className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-[var(--canvas)] p-1"
      >
        {(Object.keys(methods) as SplitMethod[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={draftMethod === option}
            onClick={() => changeMethod(option)}
            className={cn(
              "min-h-11 rounded-lg px-1 text-xs font-semibold",
              draftMethod === option
                ? "bg-[var(--pastel-mint)] text-[var(--brand-strong)]"
                : "text-[var(--muted)]",
            )}
          >
            {option === "equal" ? "Equally" : option === "exact" ? "Amounts" : "Percentages"}
          </button>
        ))}
      </div>
      <p className="mb-2 flex min-h-12 items-center justify-between rounded-xl bg-[var(--canvas)] px-3 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-2">
          <Users className="size-4 text-[var(--violet)]" aria-hidden="true" />
          {members.length} {members.length === 1 ? "person" : "people"}
        </span>
        <strong className="text-sm text-[var(--ink)]">
          {draftMethod === "equal" ? `${equalShare} each` : total}
        </strong>
      </p>
      <div className="divide-y divide-[var(--soft-line)]">
        {members.map((member, index) => (
          <div key={member.id} className="flex min-h-[4.25rem] min-w-0 items-center gap-3 px-2">
            <MemberAvatar name={member.name} className="size-10 border-0 shadow-none" />
            <span className="min-w-0 flex-1 text-sm font-semibold break-words">{member.name}</span>
            {draftMethod === "equal" ? (
              <span className="shrink-0 text-sm font-bold text-[var(--ink)] tabular-nums">
                {formatter.format(
                  (Math.floor(totalCents / members.length) +
                    (index < totalCents % members.length ? 1 : 0)) /
                    100,
                )}
              </span>
            ) : (
              <span className="relative w-28 shrink-0">
                <Input
                  aria-label={`${member.name} ${draftMethod === "exact" ? "amount" : "percentage"}`}
                  inputMode="decimal"
                  value={values[member.id] ?? ""}
                  onChange={(event) => {
                    const update = { ...values, [member.id]: event.target.value };
                    if (draftMethod === "exact") setDraftAmounts(update);
                    else setDraftPercentages(update);
                  }}
                  className="h-11 rounded-xl pr-9 text-right tabular-nums"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[var(--muted)]"
                >
                  {draftMethod === "percentage"
                    ? "%"
                    : (currencies.find((item) => item.code === currency)?.symbol ?? currency)}
                </span>
              </span>
            )}
          </div>
        ))}
      </div>
      {draftMethod !== "equal" && (
        <p
          role="status"
          className={cn(
            "mt-3 border-t border-[var(--soft-line)] px-2 pt-3 text-xs",
            valid ? "text-[var(--brand)]" : "text-[var(--negative)]",
          )}
        >
          {valid
            ? "All accounted for"
            : `Shares must total ${draftMethod === "exact" ? total : "100%"}.`}
        </p>
      )}
    </Dialog>
  );
}
