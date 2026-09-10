"use client";

import { ArrowRight, Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { saveSettlementAction, updateSettlementAction } from "@/lib/actions";
import { MemberAvatar, resolveAvatarColor, type AvatarColor } from "../household/member-avatar";
import { Button } from "../ui/button";
import { cn } from "../ui/cn";
import { Dialog } from "../ui/dialog";
import { StatusNote } from "../ui/page";
import { ExpenseDateAction } from "./expense-date-action";
import { ChoiceRow, CurrencyAction } from "./expense-sharing-controls";
import { ExpenseTools } from "./expense-tools";
import { TransactionNoteAction } from "./transaction-note-action";

type MemberOption = { id: string; name: string; avatarColor?: AvatarColor | null };
type MemberDialog = "payer" | "receiver" | null;

function localToday() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function MemberAction({
  member,
  label,
  disabled,
  onClick,
}: {
  member?: MemberOption;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const background = member ? resolveAvatarColor(member.name, member.avatarColor) : "#e2e8f0";
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-14 min-w-0 items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition-[filter,transform] hover:brightness-[0.98] active:translate-y-px disabled:opacity-50"
      style={{ background: `color-mix(in srgb, ${background} 38%, white)` }}
    >
      {member ? (
        <>
          <MemberAvatar
            name={member.name}
            color={member.avatarColor}
            className="size-10 border-0 shadow-none"
          />
          <span className="min-w-0 truncate text-sm font-extrabold text-[var(--ink)]">
            {member.name}
          </span>
        </>
      ) : (
        <span className="text-sm font-bold text-[var(--muted)]">Choose person</span>
      )}
    </button>
  );
}

export function SettlementForm({
  householdId,
  defaultCurrency,
  currentMemberId,
  defaultReceivingMemberId,
  defaultAmountCents,
  members,
  initial,
  cancelHref,
}: {
  householdId: string;
  defaultCurrency: string;
  currentMemberId: string;
  defaultReceivingMemberId?: string;
  defaultAmountCents?: number;
  members: MemberOption[];
  cancelHref?: string;
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
  const fallbackReceiver = members.find((member) => member.id !== currentMemberId)?.id ?? "";
  const [payer, setPayer] = useState(initial?.payingMemberId ?? currentMemberId);
  const [receiver, setReceiver] = useState(
    initial?.receivingMemberId ?? defaultReceivingMemberId ?? fallbackReceiver,
  );
  const [amount, setAmount] = useState(
    initial
      ? (initial.amountCents / 100).toFixed(2)
      : defaultAmountCents
        ? (defaultAmountCents / 100).toFixed(2)
        : "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [paymentDate, setPaymentDate] = useState(initial?.settlementDate ?? localToday());
  const [note, setNote] = useState(initial?.note ?? "");
  const [dialog, setDialog] = useState<MemberDialog>(null);
  const [draftMemberId, setDraftMemberId] = useState("");
  const [pending, startTransition] = useTransition();
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState("");
  const payerMember = members.find((member) => member.id === payer);
  const receiverMember = members.find((member) => member.id === receiver);
  const amountCents = Math.round(Number(amount) * 100);
  const amountValid = amount !== "" && Number.isSafeInteger(amountCents) && amountCents > 0;
  const partiesValid = Boolean(payer && receiver && payer !== receiver);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAttemptedSubmit(true);
    setError("");
    if (!amountValid || !partiesValid || !paymentDate) return;
    startTransition(async () => {
      const input = {
        householdId,
        payingMemberId: payer,
        receivingMemberId: receiver,
        amountCents,
        currency,
        settlementDate: paymentDate,
        note: note || undefined,
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
    <form
      data-mobile-submit
      className="flex w-full min-w-0 flex-1 flex-col gap-3"
      onSubmit={submit}
      aria-busy={pending}
      noValidate
    >
      {error && <StatusNote tone="error" title={error} />}

      <section className="flex w-full min-w-0 flex-1 flex-col px-1 py-2 sm:px-4 sm:py-4">
        <div className="my-auto w-full min-w-0 py-4 md:py-6">
          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-center gap-1.5 sm:gap-3">
            <MemberAction
              member={payerMember}
              label="Choose payer"
              disabled={pending}
              onClick={() => {
                setDraftMemberId(payer);
                setDialog("payer");
              }}
            />
            <ArrowRight className="mx-auto size-5 text-[var(--muted)]" aria-hidden="true" />
            <MemberAction
              member={receiverMember}
              label="Choose receiver"
              disabled={pending}
              onClick={() => {
                setDraftMemberId(receiver);
                setDialog("receiver");
              }}
            />
          </div>
          {attemptedSubmit && !partiesValid && (
            <p role="alert" className="mt-2 text-center text-xs font-bold text-[var(--negative)]">
              Choose two different people.
            </p>
          )}

          <div
            className={cn(
              "mt-7 flex w-full min-w-0 items-end gap-3 border-b-2 border-[var(--pastel-mint-line)] py-2 focus-within:border-[var(--brand)]",
              attemptedSubmit && !amountValid && "border-[var(--negative)]",
            )}
          >
            <CurrencyAction value={currency} onChange={setCurrency} disabled={pending} />
            <label className="screen-reader-only" htmlFor="settlement-amount">
              Amount
            </label>
            <input
              id="settlement-amount"
              name="amount"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              autoFocus={!initial}
              aria-invalid={(attemptedSubmit && !amountValid) || undefined}
              className="expense-primary-input h-14 w-0 min-w-0 flex-1 bg-transparent text-[2.2rem] leading-none font-black tracking-[-0.045em] text-[var(--ink)] tabular-nums outline-none placeholder:text-[#94a3b8]"
            />
          </div>
          {attemptedSubmit && !amountValid && (
            <p role="alert" className="mt-1 text-xs font-bold text-[var(--negative)]">
              Enter an amount greater than zero.
            </p>
          )}
        </div>

        <input type="hidden" name="payingMemberId" value={payer} />
        <input type="hidden" name="receivingMemberId" value={receiver} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="settlementDate" value={paymentDate} />
        <input type="hidden" name="note" value={note} />
      </section>

      <div className="md:mt-2 md:flex md:items-center md:justify-between md:gap-4">
        <ExpenseTools ariaLabel="Payment tools">
          <ExpenseDateAction
            value={paymentDate}
            onValueChange={setPaymentDate}
            recurring={false}
            frequency="monthly"
            onFrequencyChange={() => undefined}
            onRecurringChange={() => undefined}
            recurringEnd=""
            onRecurringEndChange={() => undefined}
            allowRecurrence={false}
            disabled={pending}
          />
          <TransactionNoteAction
            value={note}
            onChange={setNote}
            disabled={pending}
            title="Payment notes"
            placeholder="Bank transfer, cash, etc."
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
            className="min-w-40 rounded-full px-5"
            disabled={pending}
          >
            {initial ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-[18px]" aria-hidden="true" />
            )}
            {pending ? "Saving…" : initial ? "Save changes" : "Record payment"}
          </Button>
        </div>
      </div>

      {dialog && (
        <Dialog
          title={dialog === "payer" ? "Payer" : "Receiver"}
          onClose={() => setDialog(null)}
          doneDisabled={
            !draftMemberId ||
            (dialog === "payer" ? draftMemberId === receiver : draftMemberId === payer)
          }
          onDone={() => {
            if (dialog === "payer") setPayer(draftMemberId);
            else setReceiver(draftMemberId);
            setDialog(null);
          }}
        >
          <div
            role="radiogroup"
            aria-label={dialog === "payer" ? "Payer" : "Receiver"}
            className="grid gap-1"
          >
            {members.map((member) => {
              const unavailable = dialog === "payer" ? member.id === receiver : member.id === payer;
              return (
                <ChoiceRow
                  key={member.id}
                  selected={draftMemberId === member.id}
                  disabled={unavailable}
                  onClick={() => setDraftMemberId(member.id)}
                >
                  <span className="flex items-center gap-3">
                    <MemberAvatar
                      name={member.name}
                      color={member.avatarColor}
                      className="size-9 border-0 shadow-none"
                    />
                    <span className="font-semibold break-words">{member.name}</span>
                  </span>
                </ChoiceRow>
              );
            })}
          </div>
        </Dialog>
      )}
    </form>
  );
}
