import Link from "next/link";
import {
  ChevronRight,
  CircleDollarSign,
  House,
  Plus,
  ScanLine,
  Settings,
  Users,
} from "lucide-react";

import { HouseholdLedger } from "@/components/expenses/household-ledger";
import { BottomMascotReveal } from "@/components/household/bottom-mascot-reveal";
import { ButtonLink } from "@/components/ui/button";
import { iconActionClass } from "@/components/ui/icon-action";
import { PeekingFroskolin } from "@/components/ui/mascot";
import { Surface } from "@/components/ui/surface";
import { HomeSummaryMotion } from "@/components/household/home-summary-motion";
import { requireHouseholdMembership } from "@/lib/auth";
import { totalLandlordOutstanding } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import {
  getBalances,
  getHousehold,
  getHouseholdMembers,
  getHouseholdTransactions,
  getLandlordBillBalances,
} from "@/lib/queries";

const HOME_PAGE_SIZE = 10;

export default async function HouseholdHome({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [{ membership }, home, members, balances, transactions, landlordBills] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getBalances(householdId),
    getHouseholdTransactions(householdId, HOME_PAGE_SIZE + 1),
    getLandlordBillBalances(householdId),
  ]);
  const locale = home?.locale ?? "en-GB";
  const activeMembers = members.filter((member) => !member.removed_at);
  const ownBalances = balances.filter(
    (balance) => balance.member_id === membership.id && Number(balance.net_cents) !== 0,
  );
  const landlordTotals = totalLandlordOutstanding(
    landlordBills.map((bill) => ({
      currency: bill.currency,
      originalShareCents: bill.originalShareCents,
      paymentCents: bill.payments.map((payment) => payment.amountCents),
    })),
  );
  const memberNames = Object.fromEntries(
    members.map((member) => [String(member.id), String(member.display_name)]),
  );

  return (
    <>
      <HomeSummaryMotion>
        <Surface
          tone="plain"
          className="home-summary-surface mb-4 overflow-hidden rounded-none border-0 shadow-none md:mb-5 md:rounded-[var(--radius-surface)] md:shadow-[var(--shadow-sm)]"
          aria-label={`${home?.name ?? "Household"} summary`}
        >
          <header className="home-summary-header relative flex items-center justify-between gap-4 bg-[var(--pastel-sky)] px-3.5 pt-[max(.875rem,env(safe-area-inset-top))] pb-3.5 sm:px-5">
            <div className="max-w-[calc(100%-7rem)] min-w-0 sm:flex sm:max-w-[calc(100%-10rem)] sm:items-center sm:gap-3">
              <h1 className="home-summary-title truncate leading-tight font-black tracking-[-0.04em] text-[var(--ink)]">
                {home?.name ?? "Home"}
              </h1>
              <p className="home-summary-members mt-0.5 flex shrink-0 items-center gap-1.5 overflow-hidden text-[11px] font-bold text-[var(--ink-soft)] sm:mt-0">
                <Users className="size-3.5 text-[var(--sky)]" aria-hidden="true" />
                {activeMembers.length} {activeMembers.length === 1 ? "person" : "people"}
              </p>
            </div>
            <PeekingFroskolin className="home-summary-mascot pointer-events-none absolute right-12 bottom-[-1px] h-auto sm:right-16" />
            <Link
              href={`/h/${householdId}/settings`}
              className={iconActionClass({
                tone: "sky",
                className:
                  "relative z-10 size-9 !bg-white/80 shadow-[var(--shadow-sm)] hover:!bg-white",
              })}
              aria-label="Group settings"
            >
              <Settings className="size-[17px]" aria-hidden="true" />
            </Link>
          </header>

          <div
            className={`home-summary-balances grid items-center bg-white ${home?.landlord_enabled ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "grid-cols-1"}`}
            aria-label="Your balances"
          >
            <Link
              href={`/h/${householdId}/balances`}
              className="home-summary-card home-summary-card-group group flex min-w-0 items-center px-2 py-2 text-[var(--ink)] no-underline sm:px-4"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#c9eadf] text-[var(--brand)] sm:size-8">
                <Users className="size-3.5 sm:size-4" aria-hidden="true" />
              </span>
              <span className="home-summary-copy min-w-0 flex-1 overflow-hidden whitespace-nowrap">
                <span className="block truncate text-[10px] leading-4 font-black text-[var(--ink)] sm:text-sm">
                  Group
                </span>
                {ownBalances.length ? (
                  <span className="block truncate text-[9px] leading-3 font-bold text-[var(--muted)] sm:text-[10px]">
                    {Number(ownBalances[0]?.net_cents ?? 0) > 0 ? "You are owed" : "You owe"}
                  </span>
                ) : (
                  <span className="block truncate text-[9px] leading-3 font-bold text-[var(--muted)] sm:text-[10px]">
                    All settled
                  </span>
                )}
              </span>
              <span className="min-w-0 shrink-0 text-right tabular-nums">
                {ownBalances.length ? (
                  <span className="grid gap-0.5">
                    {ownBalances.map((balance) => {
                      const netCents = Number(balance.net_cents);
                      return (
                        <span
                          key={balance.currency}
                          className={`block max-w-[4.4rem] truncate text-[clamp(.8rem,3.6vw,1.15rem)] leading-5 font-black sm:max-w-none ${netCents > 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
                        >
                          {formatMoney(Math.abs(netCents), balance.currency, locale)}
                        </span>
                      );
                    })}
                  </span>
                ) : (
                  <span className="block text-[clamp(.8rem,3.6vw,1.15rem)] leading-5 font-black text-[var(--ink)]">
                    {formatMoney(0, home?.default_currency ?? "EUR", locale)}
                  </span>
                )}
              </span>
              <ChevronRight
                className="size-3 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 sm:size-4"
                aria-hidden="true"
              />
            </Link>

            {home?.landlord_enabled && (
              <>
                <span className="home-summary-divider block w-px" aria-hidden="true" />
                <Link
                  href={`/h/${householdId}/landlord`}
                  className="home-summary-card home-summary-card-landlord group flex min-w-0 items-center px-2 py-2 text-[var(--ink)] no-underline sm:px-4"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#ffdac6] text-[var(--peach)] sm:size-8">
                    <House className="size-3.5 sm:size-4" aria-hidden="true" />
                  </span>
                  <span className="home-summary-copy min-w-0 flex-1 overflow-hidden whitespace-nowrap">
                    <span className="block truncate text-[10px] leading-4 font-black text-[var(--ink)] sm:text-sm">
                      Landlord
                    </span>
                    <span className="block truncate text-[9px] leading-3 font-bold text-[var(--muted)] sm:text-[10px]">
                      {landlordTotals.length ? "You owe" : "All settled"}
                    </span>
                  </span>
                  <span className="min-w-0 shrink-0 text-right tabular-nums">
                    {landlordTotals.length ? (
                      <span className="grid gap-0.5">
                        {landlordTotals.map((row) => (
                          <span
                            key={row.currency}
                            className="block max-w-[4.4rem] truncate text-[clamp(.8rem,3.6vw,1.15rem)] leading-5 font-black text-[var(--negative)] sm:max-w-none"
                          >
                            {formatMoney(row.amountCents, row.currency, locale)}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="block text-[clamp(.8rem,3.6vw,1.15rem)] leading-5 font-black text-[var(--ink)]">
                        {formatMoney(0, home?.default_currency ?? "EUR", locale)}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    className="size-3 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 sm:size-4"
                    aria-hidden="true"
                  />
                </Link>
              </>
            )}
          </div>
        </Surface>
      </HomeSummaryMotion>

      <div>
        <HouseholdLedger
          householdId={householdId}
          currentMemberId={membership.id}
          memberNames={memberNames}
          expenses={transactions.expenses.slice(0, HOME_PAGE_SIZE)}
          settlements={transactions.settlements.slice(0, HOME_PAGE_SIZE)}
          expenseHasMore={transactions.expenses.length > HOME_PAGE_SIZE}
          settlementHasMore={transactions.settlements.length > HOME_PAGE_SIZE}
          locale={locale}
          timezone={home?.timezone ?? "UTC"}
        />
        <BottomMascotReveal />
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-20 lg:bottom-28">
        <div className="mx-auto flex w-full max-w-[980px] justify-end px-3 sm:px-6 lg:px-8">
          <div className="pointer-events-auto flex flex-col items-end gap-1.5">
            <ButtonLink
              href={`/h/${householdId}/add/settlement`}
              tone="pastelAccent"
              appearance="floating"
              className="min-h-10 rounded-full border-0 px-3.5 py-2 text-xs"
            >
              <CircleDollarSign className="size-4" aria-hidden="true" /> Settle up
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/bill`}
              tone="pastelWarm"
              appearance="floating"
              className="min-h-10 rounded-full border-0 px-3.5 py-2 text-xs"
            >
              <ScanLine className="size-4" aria-hidden="true" /> Upload bill
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/expense`}
              tone="pastel"
              appearance="floating"
              className="min-h-11 rounded-full border-0 px-4 py-2 text-sm"
            >
              <Plus className="size-[18px]" aria-hidden="true" /> Add expense
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
