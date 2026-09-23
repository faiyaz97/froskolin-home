import Link from "next/link";
import {
  ChevronRight,
  CircleDollarSign,
  House,
  PawPrint,
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
          className="home-summary-surface mb-4 overflow-hidden rounded-none border-0 shadow-none md:mb-5 md:rounded-[var(--radius-surface)] md:bg-[var(--home-header-blue)] md:shadow-[var(--shadow-sm)]"
          aria-label={`${home?.name ?? "Household"} summary`}
        >
          <header className="home-summary-header relative flex items-center justify-between gap-4 bg-[var(--pastel-sky)] px-3.5 pt-[max(.875rem,env(safe-area-inset-top))] pb-3.5 sm:px-5 md:bg-[var(--home-header-blue)]">
            <div
              aria-hidden="true"
              className="home-header-pattern pointer-events-none absolute inset-0 overflow-hidden text-[var(--sky)]"
            >
              <PawPrint className="absolute top-2 left-[3%] size-5 -rotate-[25deg] opacity-[0.05]" />
              <PawPrint className="absolute bottom-2 left-[15%] size-6 rotate-[15deg] opacity-[0.05]" />
              <PawPrint className="absolute top-3 left-[28%] size-7 -rotate-[20deg] opacity-[0.06]" />
              <PawPrint className="absolute bottom-3 left-[38%] size-5 rotate-[25deg] opacity-[0.06]" />
              <PawPrint className="absolute right-[42%] bottom-4 size-7 -rotate-[25deg] opacity-[0.07]" />
              <PawPrint className="absolute top-5 right-[32%] size-8 rotate-[15deg] opacity-[0.09]" />
              <PawPrint className="absolute right-[22%] bottom-4 size-9 -rotate-[20deg] opacity-[0.08]" />
              <PawPrint className="absolute top-3 right-[13%] size-6 rotate-[20deg] opacity-[0.07]" />
            </div>
            <div className="relative z-10 max-w-[calc(100%-7rem)] min-w-0 sm:max-w-[calc(100%-10rem)]">
              <h1 className="home-summary-title truncate leading-tight font-black tracking-[-0.04em] text-[var(--ink)]">
                {home?.name ?? "Home"}
              </h1>
              <p className="home-summary-members mt-1 flex shrink-0 items-center gap-1.5 overflow-hidden text-[11px] font-medium text-[var(--ink-soft)]">
                <Users className="size-3.5 text-[var(--sky)]" aria-hidden="true" />
                {activeMembers.length} {activeMembers.length === 1 ? "person" : "people"}
              </p>
            </div>
            <PeekingFroskolin className="home-summary-mascot pointer-events-none absolute right-12 bottom-[-5px] h-auto sm:right-16" />
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
            className={`home-summary-balances grid items-center bg-white md:mx-2 md:mb-2 md:rounded-[14px] ${home?.landlord_enabled ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]" : "grid-cols-1"}`}
            aria-label="Your balances"
          >
            <Link
              href={`/h/${householdId}/balances`}
              className="home-summary-card home-summary-card-group group flex min-w-0 items-center px-1.5 py-2 text-[var(--ink)] no-underline sm:px-4"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] min-[360px]:size-8 sm:size-9">
                <Users className="size-5 min-[360px]:size-6" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-center">
                <span className="home-summary-copy mx-auto block overflow-hidden whitespace-nowrap">
                  <span className="block truncate text-[10px] leading-4 font-black text-[var(--ink)] sm:text-sm">
                    Group
                  </span>
                </span>
                <span className="mt-0.5 block min-w-0 tabular-nums">
                  {ownBalances.length ? (
                    <span className="grid gap-0.5">
                      {ownBalances.map((balance) => {
                        const netCents = Number(balance.net_cents);
                        return (
                          <span
                            key={balance.currency}
                            className={`home-summary-amount block font-black ${netCents > 0 ? "text-[var(--positive)]" : netCents < 0 ? "text-[var(--negative)]" : "text-[var(--ink)]"}`}
                          >
                            <span className="screen-reader-only">
                              {netCents > 0
                                ? "You are owed "
                                : netCents < 0
                                  ? "You owe "
                                  : "All settled: "}
                            </span>
                            <span aria-hidden="true">
                              {netCents > 0 ? "+" : netCents < 0 ? "−" : ""}
                            </span>
                            {formatMoney(Math.abs(netCents), balance.currency, locale)}
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    <span className="home-summary-amount block font-black text-[var(--ink)]">
                      <span className="screen-reader-only">All settled: </span>
                      {formatMoney(0, home?.default_currency ?? "EUR", locale)}
                    </span>
                  )}
                </span>
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
                  className="home-summary-card home-summary-card-landlord group flex min-w-0 items-center px-1.5 py-2 text-[var(--ink)] no-underline sm:px-4"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#ffdac6] text-[var(--peach)] min-[360px]:size-8 sm:size-9">
                    <House className="size-5 min-[360px]:size-6" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 overflow-hidden text-center">
                    <span className="home-summary-copy mx-auto block overflow-hidden whitespace-nowrap">
                      <span className="block truncate text-[10px] leading-4 font-black text-[var(--ink)] sm:text-sm">
                        Landlord
                      </span>
                    </span>
                    <span className="mt-0.5 block min-w-0 tabular-nums">
                      {landlordTotals.length ? (
                        <span className="grid gap-0.5">
                          {landlordTotals.map((row) => (
                            <span
                              key={row.currency}
                              className="home-summary-amount block font-black text-[var(--negative)]"
                            >
                              <span className="screen-reader-only">You owe </span>
                              <span aria-hidden="true">−</span>
                              {formatMoney(row.amountCents, row.currency, locale)}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="home-summary-amount block font-black text-[var(--ink)]">
                          <span className="screen-reader-only">All settled: </span>
                          {formatMoney(0, home?.default_currency ?? "EUR", locale)}
                        </span>
                      )}
                    </span>
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

      <div className="w-full max-w-full min-w-0">
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

      <div className="pointer-events-none fixed inset-x-0 bottom-[max(88px,calc(80px+env(safe-area-inset-bottom)))] z-20 max-w-full lg:bottom-28">
        <div className="mx-auto flex w-full max-w-[980px] justify-end px-3 sm:px-6 lg:px-8">
          <div className="pointer-events-auto flex flex-col items-end gap-2.5">
            <ButtonLink
              href={`/h/${householdId}/add/settlement`}
              tone="pastelSky"
              appearance="floating"
              className="min-h-12 w-32 rounded-full border-0 px-4 py-2.5 text-sm"
            >
              <CircleDollarSign className="size-[18px]" aria-hidden="true" /> Settle up
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/bill`}
              tone="pastelWarm"
              appearance="floating"
              className="min-h-12 w-36 rounded-full border-0 px-4 py-2.5 text-sm"
            >
              <ScanLine className="size-[18px]" aria-hidden="true" /> Add bill
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/expense`}
              tone="pastel"
              appearance="floating"
              className="min-h-12 w-40 rounded-full border-0 bg-[var(--home-add-expense-bg)] px-4 py-2.5 text-sm text-[var(--home-add-expense-text)] shadow-[0_8px_18px_rgb(15_118_110/0.14)] hover:bg-[var(--home-add-expense-hover)] hover:shadow-[0_12px_24px_rgb(15_118_110/0.22)]"
            >
              <Plus className="size-[18px]" aria-hidden="true" /> Add expense
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
