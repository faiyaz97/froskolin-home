"use client";

import { ArrowRight } from "lucide-react";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { MemberAvatar, type AvatarColor } from "@/components/household/member-avatar";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { simplifyDebts } from "@/lib/domain";
import { formatMoney } from "@/lib/format";

type Member = { id: string; name: string; avatarColor: AvatarColor | null };
type Balance = { memberId: string; currency: string; amountCents: number };
type PairBalance = {
  payingMemberId: string;
  receivingMemberId: string;
  currency: string;
  amountCents: number;
};
type Suggestion = {
  fromMemberId: string;
  toMemberId: string;
  currency: string;
  amountCents: number;
};

function balanceModeStorageKey(householdId: string, memberId: string) {
  return `froskolin:balance-mode:${householdId}:${memberId}`;
}

const balanceModeEvent = "froskolin:balance-mode-change";

function subscribeToBalanceMode(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(balanceModeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(balanceModeEvent, onStoreChange);
  };
}

export function GroupBalancesView({
  householdId,
  currentMemberId,
  members,
  balances,
  pairBalances,
  locale,
}: {
  householdId: string;
  currentMemberId: string;
  members: Member[];
  balances: Balance[];
  pairBalances: PairBalance[];
  locale: string;
}) {
  const storageKey = balanceModeStorageKey(householdId, currentMemberId);
  const getStoredMode = useCallback(() => {
    try {
      return window.localStorage.getItem(storageKey) === "actual" ? "actual" : "simplified";
    } catch {
      return "simplified";
    }
  }, [storageKey]);
  const mode = useSyncExternalStore(subscribeToBalanceMode, getStoredMode, () => "simplified");
  const simplified = mode === "simplified";

  function toggleBalanceMode() {
    try {
      window.localStorage.setItem(storageKey, simplified ? "actual" : "simplified");
      window.dispatchEvent(new Event(balanceModeEvent));
    } catch {
      // Keep the current selection when browser storage is unavailable.
    }
  }

  const names = useMemo(
    () => new Map(members.map((member) => [member.id, member.name])),
    [members],
  );
  const avatarColors = useMemo(
    () => new Map(members.map((member) => [member.id, member.avatarColor])),
    [members],
  );
  const simplifiedSuggestions = useMemo(() => simplifyDebts(balances), [balances]);
  const actualSuggestions = useMemo<Suggestion[]>(
    () =>
      pairBalances.map((row) => ({
        fromMemberId: row.payingMemberId,
        toMemberId: row.receivingMemberId,
        currency: row.currency,
        amountCents: row.amountCents,
      })),
    [pairBalances],
  );
  const suggestions = simplified ? simplifiedSuggestions : actualSuggestions;
  const currencies = [...new Set(balances.map((row) => row.currency))].sort();

  return (
    <>
      <section aria-labelledby="members-balance-title">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2 id="members-balance-title" className="text-sm font-black tracking-[-0.01em]">
            Members
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={simplified}
            aria-label="Use simplified balances"
            className="group flex items-center gap-2 rounded-full px-1 py-1 text-xs font-bold text-[var(--ink-soft)] transition-colors outline-none hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
            onClick={toggleBalanceMode}
          >
            <span>{simplified ? "Simplified" : "Actual"}</span>
            <span
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                simplified ? "bg-[var(--brand)]" : "bg-[#cbd5e1]",
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                  simplified ? "translate-x-4" : "translate-x-0",
                )}
              />
            </span>
          </button>
        </div>

        <div className="space-y-3">
          {currencies.map((currency) => {
            const ledger = balances.filter((row) => row.currency === currency);
            const currencySuggestions = suggestions.filter(
              (suggestion) => suggestion.currency === currency,
            );

            return (
              <div
                key={currency}
                className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]"
              >
                {ledger.map((row) => {
                  const name = names.get(row.memberId) ?? "Former member";
                  const isCredit = row.amountCents >= 0;
                  const relatedSuggestions = currencySuggestions.filter(
                    (suggestion) =>
                      suggestion.fromMemberId === row.memberId ||
                      suggestion.toMemberId === row.memberId,
                  );

                  return (
                    <div
                      key={row.memberId}
                      className="border-b border-[var(--soft-line)] px-3.5 py-3 last:border-0 sm:px-5"
                    >
                      <div className="relative flex min-h-12 items-center gap-3">
                        <MemberAvatar
                          name={name}
                          color={avatarColors.get(row.memberId)}
                          className="size-10 border-0 shadow-none"
                        />
                        <p className="min-w-0 flex-1 truncate text-sm font-black">{name}</p>
                        <p
                          className={cn(
                            "shrink-0 text-sm font-black tabular-nums",
                            isCredit ? "text-[var(--positive)]" : "text-[var(--negative)]",
                          )}
                        >
                          {formatMoney(Math.abs(row.amountCents), currency, locale)}
                        </p>
                        {relatedSuggestions.length > 0 && (
                          <span
                            className="absolute top-[calc(50%+20px)] -bottom-3 left-[19px] w-0.5 bg-[var(--pastel-mint-line)]"
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      {relatedSuggestions.length > 0 && (
                        <ul className="relative mt-1">
                          {relatedSuggestions.map((suggestion, index) => {
                            const rowOwes = suggestion.fromMemberId === row.memberId;
                            const counterpartId = rowOwes
                              ? suggestion.toMemberId
                              : suggestion.fromMemberId;
                            const counterpartName = names.get(counterpartId) ?? "Former member";
                            return (
                              <li
                                key={`${suggestion.fromMemberId}-${suggestion.toMemberId}`}
                                className="relative flex min-h-10 items-center pl-12 text-xs"
                              >
                                {index < relatedSuggestions.length - 1 && (
                                  <span
                                    className="absolute top-0 bottom-0 left-[19px] w-0.5 bg-[var(--pastel-mint-line)]"
                                    aria-hidden="true"
                                  />
                                )}
                                <span
                                  className="absolute top-0 left-[19px] h-1/2 w-[29px] rounded-bl-lg border-b-2 border-l-2 border-[var(--pastel-mint-line)]"
                                  aria-hidden="true"
                                />
                                <span
                                  className={cn(
                                    "flex min-w-0 flex-1 items-center gap-2 py-1.5",
                                    index < relatedSuggestions.length - 1 &&
                                      "border-b border-[var(--soft-line)]",
                                  )}
                                >
                                  <MemberAvatar
                                    name={counterpartName}
                                    color={avatarColors.get(counterpartId)}
                                    className="size-7 border-0 shadow-none"
                                  />
                                  <span className="min-w-0 flex-1 truncate font-bold text-[var(--ink-soft)]">
                                    {counterpartName}
                                  </span>
                                  <span
                                    className={cn(
                                      "shrink-0 font-black tabular-nums opacity-70",
                                      rowOwes ? "text-[var(--negative)]" : "text-[var(--positive)]",
                                    )}
                                  >
                                    {formatMoney(suggestion.amountCents, currency, locale)}
                                  </span>
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
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]">
            {suggestions.map((suggestion) => {
              const fromName = names.get(suggestion.fromMemberId) ?? "Former member";
              const toName = names.get(suggestion.toMemberId) ?? "Former member";
              return (
                <div
                  key={`${suggestion.currency}-${suggestion.fromMemberId}-${suggestion.toMemberId}`}
                  className="flex min-h-[72px] items-center gap-2 border-b border-[var(--soft-line)] px-3 py-3 last:border-0 sm:gap-3 sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <MemberAvatar
                      name={fromName}
                      color={avatarColors.get(suggestion.fromMemberId)}
                      className="size-8 border-0 shadow-none sm:size-9"
                    />
                    <strong className="min-w-0 truncate text-xs sm:text-sm">{fromName}</strong>
                    <ArrowRight
                      className="size-4 shrink-0 text-[var(--muted)]"
                      aria-hidden="true"
                    />
                    <MemberAvatar
                      name={toName}
                      color={avatarColors.get(suggestion.toMemberId)}
                      className="size-8 border-0 shadow-none sm:size-9"
                    />
                    <strong className="min-w-0 truncate text-xs sm:text-sm">{toName}</strong>
                  </div>
                  {suggestion.fromMemberId === currentMemberId && (
                    <ButtonLink
                      href={`/h/${householdId}/add/settlement?payingMemberId=${encodeURIComponent(suggestion.fromMemberId)}&receivingMemberId=${encodeURIComponent(suggestion.toMemberId)}&amountCents=${suggestion.amountCents}&currency=${encodeURIComponent(suggestion.currency)}`}
                      tone="pastel"
                      className="min-h-8 shrink-0 rounded-full border-0 px-2.5 py-1 text-xs shadow-none sm:px-3"
                    >
                      Settle up
                    </ButtonLink>
                  )}
                  <strong className="shrink-0 text-sm tabular-nums">
                    {formatMoney(suggestion.amountCents, suggestion.currency, locale)}
                  </strong>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
