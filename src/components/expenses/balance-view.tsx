"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordSuggestedPaymentAction } from "@/lib/actions";
import { LANDLORD_BALANCE_ID } from "@/lib/domain/all-balances";
import type { DebtSuggestion } from "@/lib/domain/balances";
import { formatMoney } from "@/lib/format";
import { announceSaveComplete } from "@/lib/save-feedback";
import {
  LandlordAvatar,
  MemberAvatar,
  type AvatarColor,
} from "@/components/household/member-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";

type Member = { id: string; name: string; avatarColor: AvatarColor | null };
type Balance = { memberId: string; currency: string; amountCents: number };

export function BalanceView({
  householdId,
  currentMemberId,
  locale,
  members,
  suggestions,
  balances,
  strategyLabel,
}: {
  householdId: string;
  currentMemberId: string;
  locale: string;
  members: Member[];
  suggestions: DebtSuggestion[];
  balances: Balance[];
  strategyLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<DebtSuggestion | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const profiles = new Map(members.map((member) => [member.id, member]));
  const currencies = [
    ...new Set([...balances.map((row) => row.currency), ...suggestions.map((row) => row.currency)]),
  ].sort();
  const nameFor = (id: string) =>
    id === LANDLORD_BALANCE_ID ? "Landlord" : (profiles.get(id)?.name ?? "Former member");
  const avatarFor = (id: string, size: string) =>
    id === LANDLORD_BALANCE_ID ? (
      <LandlordAvatar className={size} />
    ) : (
      <MemberAvatar
        name={nameFor(id)}
        color={profiles.get(id)?.avatarColor}
        className={`${size} border-0 shadow-none`}
      />
    );

  function recordPayment() {
    if (!selected || pending) return;
    const payment = selected;
    startTransition(async () => {
      const result = await recordSuggestedPaymentAction({
        householdId,
        receivingMemberId: payment.toMemberId,
        amountCents: payment.amountCents,
        currency: payment.currency,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(null);
      announceSaveComplete("Payment recorded");
      router.refresh();
    });
  }

  return (
    <>
      <section aria-labelledby="members-balance-title">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 id="members-balance-title" className="text-sm font-black">
            Members
          </h2>
          <span className="text-xs font-bold text-[var(--ink-soft)]">{strategyLabel}</span>
        </div>
        <div className="space-y-3">
          {currencies.map((currency) => {
            const currencyBalances = balances.filter((row) => row.currency === currency);
            const currencySuggestions = suggestions.filter((row) => row.currency === currency);
            const ids = [
              ...new Set([
                ...members.map((member) => member.id),
                ...currencyBalances.map((row) => row.memberId),
                ...currencySuggestions.flatMap((row) => [row.fromMemberId, row.toMemberId]),
              ]),
            ].filter((id) => id !== LANDLORD_BALANCE_ID);
            return (
              <div
                key={currency}
                className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]"
              >
                {ids.map((memberId) => {
                  const amount =
                    currencyBalances.find((row) => row.memberId === memberId)?.amountCents ?? 0;
                  const related = currencySuggestions.filter(
                    (row) => row.fromMemberId === memberId || row.toMemberId === memberId,
                  );
                  return (
                    <div
                      key={memberId}
                      className="border-b border-[var(--soft-line)] px-3.5 py-3 last:border-0 sm:px-5"
                    >
                      <div className="relative flex min-h-12 items-center gap-3">
                        {avatarFor(memberId, "size-10")}
                        <strong className="min-w-0 flex-1 truncate text-sm">
                          {nameFor(memberId)}
                        </strong>
                        <strong
                          className={cn(
                            "shrink-0 text-sm tabular-nums",
                            amount < 0
                              ? "text-[var(--negative)]"
                              : amount > 0
                                ? "text-[var(--positive)]"
                                : "text-[var(--muted)]",
                          )}
                        >
                          <span className="screen-reader-only">
                            {amount < 0 ? "Owes " : amount > 0 ? "Is owed " : "Balanced at "}
                          </span>
                          {formatMoney(Math.abs(amount), currency, locale)}
                        </strong>
                        {related.length > 0 && (
                          <span
                            className="absolute top-[calc(50%+20px)] -bottom-3 left-[19px] w-0.5 bg-[var(--pastel-mint-line)]"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      {related.length > 0 && (
                        <ul className="relative mt-1">
                          {related.map((payment, index) => {
                            const owes = payment.fromMemberId === memberId;
                            const otherId = owes ? payment.toMemberId : payment.fromMemberId;
                            return (
                              <li
                                key={`${payment.fromMemberId}-${payment.toMemberId}`}
                                className="relative flex min-h-11 items-center pl-12 text-xs"
                              >
                                {index < related.length - 1 && (
                                  <span
                                    className="absolute top-0 bottom-0 left-[19px] w-0.5 bg-[var(--pastel-mint-line)]"
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className="absolute top-0 left-[19px] h-1/2 w-[29px] rounded-bl-lg border-b-2 border-l-2 border-[var(--pastel-mint-line)]"
                                  aria-hidden="true"
                                />
                                <span className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
                                  {avatarFor(otherId, "size-7")}
                                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink-soft)]">
                                    {nameFor(otherId)}
                                  </span>
                                  <strong
                                    className={cn(
                                      "shrink-0 tabular-nums",
                                      owes ? "text-[var(--negative)]" : "text-[var(--positive)]",
                                    )}
                                  >
                                    {formatMoney(payment.amountCents, currency, locale)}
                                  </strong>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {currencies.length === 0 && (
            <div className="rounded-[22px] bg-white px-4 py-5 text-sm text-[var(--muted)] shadow-[var(--shadow-sm)]">
              No balances yet.
            </div>
          )}
        </div>
      </section>
      {suggestions.length > 0 && (
        <section className="mt-6" aria-labelledby="settle-up-title">
          <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
            <h2 id="settle-up-title" className="text-sm font-black">
              Settle up
            </h2>
            <span className="text-xs text-[var(--muted)]">
              {suggestions.length} {suggestions.length === 1 ? "payment" : "payments"}
            </span>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_max-content_max-content] overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]">
            {suggestions.map((payment) => (
              <div
                key={`${payment.currency}-${payment.fromMemberId}-${payment.toMemberId}`}
                className="col-span-3 grid min-h-[72px] grid-cols-subgrid items-center gap-x-2 border-b border-[var(--soft-line)] px-3 py-3 last:border-0 sm:gap-x-3 sm:px-5"
              >
                <div
                  className={cn(
                    "flex min-w-0 items-center gap-2",
                    payment.fromMemberId === currentMemberId
                      ? "col-span-3 sm:col-span-1"
                      : "col-span-2 sm:col-span-1",
                  )}
                >
                  {avatarFor(payment.fromMemberId, "size-8 sm:size-9")}
                  <strong className="min-w-0 truncate text-xs sm:text-sm">
                    {nameFor(payment.fromMemberId)}
                  </strong>
                  <ArrowRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                  {avatarFor(payment.toMemberId, "size-8 sm:size-9")}
                  <strong className="min-w-0 truncate text-xs sm:text-sm">
                    {nameFor(payment.toMemberId)}
                  </strong>
                </div>
                {payment.fromMemberId === currentMemberId && (
                  <Button
                    type="button"
                    tone="pastel"
                    className="col-start-2 row-start-2 min-h-[22px] rounded-full border-0 px-2.5 py-1 text-[10px] font-black shadow-[0_2px_6px_rgb(3_105_161/0.22)] hover:shadow-[0_2px_6px_rgb(3_105_161/0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:row-start-1"
                    onClick={() => {
                      setError("");
                      setSelected(payment);
                    }}
                  >
                    Settle up
                  </Button>
                )}
                <strong
                  className={cn(
                    "col-start-3 text-right text-sm whitespace-nowrap tabular-nums",
                    payment.fromMemberId === currentMemberId
                      ? "row-start-2 sm:row-start-1"
                      : "row-start-1",
                  )}
                >
                  {formatMoney(payment.amountCents, payment.currency, locale)}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}
      {selected && (
        <Dialog title="Confirm payment" onClose={() => setSelected(null)} dismissible={!pending}>
          <div className="px-2 pb-2">
            <p className="text-sm leading-6 text-[var(--ink-soft)]">
              Record that you paid {nameFor(selected.toMemberId)}{" "}
              {formatMoney(selected.amountCents, selected.currency, locale)}?
            </p>
            {selected.toMemberId === LANDLORD_BALANCE_ID && (
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                This will apply the payment to unpaid bills and record any linked member settlement.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                tone="quiet"
                className="rounded-full"
                disabled={pending}
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                tone="primary"
                className="rounded-full"
                disabled={pending}
                onClick={recordPayment}
              >
                {pending ? "Recording…" : "Confirm payment"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      <ErrorDialog error={error} onClose={() => setError("")} />
    </>
  );
}
