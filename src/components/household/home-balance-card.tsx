import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatMoney } from "@/lib/format";

function balanceLabel(amountCents: number) {
  return amountCents > 0 ? "You are owed" : amountCents < 0 ? "You owe" : "All settled";
}

export function HomeBalanceCard({
  householdId,
  currency,
  locale,
  balances,
}: {
  householdId: string;
  currency: string;
  locale: string;
  balances: Array<{ currency: string; amountCents: number }>;
}) {
  const displayBalances = balances.length ? balances : [{ currency, amountCents: 0 }];
  const accessibleLabel = `Open Balances. ${displayBalances
    .map(
      ({ currency: balanceCurrency, amountCents }) =>
        `${balanceLabel(amountCents)} ${formatMoney(Math.abs(amountCents), balanceCurrency, locale)}`,
    )
    .join("; ")}`;
  return (
    <div className="home-summary-balances md:mx-2 md:mb-2">
      <div className="home-summary-balance-frame">
        <Link
          href={`/h/${householdId}/balances`}
          aria-label={accessibleLabel}
          className="home-summary-card home-summary-card-all group flex min-w-0 items-center gap-3 px-4 py-1 text-[var(--ink)] no-underline sm:px-5"
        >
          <span className="min-w-0 flex-1 text-sm font-black sm:text-base">Balances</span>
          <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-right tabular-nums">
            {displayBalances.map((balance) => (
              <strong
                key={balance.currency}
                className={`home-summary-card-amount text-xl leading-tight font-black tracking-tight sm:text-2xl ${balance.amountCents === 0 ? "text-[var(--ink-soft)]" : balance.amountCents > 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
              >
                {formatMoney(Math.abs(balance.amountCents), balance.currency, locale)}
              </strong>
            ))}
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </div>
  );
}
