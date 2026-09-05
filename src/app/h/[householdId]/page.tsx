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
import { ButtonLink } from "@/components/ui/button";
import { PeekingFroskolin } from "@/components/ui/mascot";
import { Surface } from "@/components/ui/surface";
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
    getHouseholdTransactions(householdId),
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
      <Surface
        tone="plain"
        className="mb-5 overflow-hidden border-[var(--pastel-sky-line)]"
        aria-label={`${home?.name ?? "Household"} summary`}
      >
        <header className="relative flex min-h-[78px] items-center justify-between gap-4 border-b border-[var(--pastel-sky-line)] bg-[var(--pastel-sky)] px-3.5 py-3.5 sm:min-h-[82px] sm:px-5 sm:py-4">
          <div className="max-w-[calc(100%-7rem)] min-w-0 sm:flex sm:max-w-[calc(100%-10rem)] sm:items-center sm:gap-3">
            <h1 className="truncate text-[clamp(1.4rem,5.5vw,1.85rem)] leading-tight font-black tracking-[-0.04em] text-[var(--ink)]">
              {home?.name ?? "Home"}
            </h1>
            <p className="mt-0.5 flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-[var(--ink-soft)] sm:mt-0">
              <Users className="size-3.5 text-[var(--sky)]" aria-hidden="true" />
              {activeMembers.length} {activeMembers.length === 1 ? "person" : "people"}
            </p>
          </div>
          <PeekingFroskolin className="pointer-events-none absolute right-12 bottom-[-1px] h-auto w-[80px] sm:right-16 sm:w-[98px]" />
          <Link
            href={`/h/${householdId}/settings`}
            className="relative z-10 grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--pastel-sky-line)] bg-white/85 text-[var(--ink-soft)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--sky)] hover:text-[var(--sky)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sky)]"
            aria-label="Household settings"
          >
            <Settings className="size-[17px]" aria-hidden="true" />
          </Link>
        </header>

        <div
          className={`grid gap-2 bg-white p-2 ${home?.landlord_enabled ? "grid-cols-2" : "grid-cols-1"}`}
          aria-label="Your balances"
        >
          <Link
            href={`/h/${householdId}/balances`}
            className="group flex min-h-[68px] min-w-0 items-center gap-1 rounded-[15px] border border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)] px-2 py-2.5 text-[var(--ink)] no-underline transition-[border-color,background-color] hover:border-[#8fd2bf] hover:bg-[#d9f1e9] sm:gap-3 sm:px-4 sm:py-3"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#c9eadf] text-[var(--brand)] sm:size-8">
              <Users className="size-3.5 sm:size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
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
            <Link
              href={`/h/${householdId}/landlord`}
              className="group flex min-h-[68px] min-w-0 items-center gap-1 rounded-[15px] border border-[var(--pastel-peach-line)] bg-[var(--pastel-peach)] px-2 py-2.5 text-[var(--ink)] no-underline transition-[border-color,background-color] hover:border-[#efb99a] hover:bg-[#ffe8db] sm:gap-3 sm:px-4 sm:py-3"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#ffdac6] text-[var(--peach)] sm:size-8">
                <House className="size-3.5 sm:size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
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
          )}
        </div>
      </Surface>

      <div className="pb-60 sm:pb-64 lg:pb-56">
        <HouseholdLedger
          householdId={householdId}
          currentMemberId={membership.id}
          memberNames={memberNames}
          expenses={transactions.expenses}
          settlements={transactions.settlements}
          locale={locale}
          timezone={home?.timezone ?? "UTC"}
        />
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-[88px] z-20 lg:bottom-28">
        <div className="mx-auto flex w-full max-w-[980px] justify-end px-4 sm:px-6 lg:px-8">
          <div className="pointer-events-auto flex flex-col items-end gap-1.5">
            <ButtonLink
              href={`/h/${householdId}/add/settlement`}
              tone="pastelAccent"
              className="min-h-10 rounded-full px-3.5 py-2 text-xs"
            >
              <CircleDollarSign className="size-4" aria-hidden="true" /> Settle up
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/bill`}
              tone="pastelWarm"
              className="min-h-10 rounded-full px-3.5 py-2 text-xs"
            >
              <ScanLine className="size-4" aria-hidden="true" /> Upload bill
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/expense`}
              tone="pastel"
              className="min-h-11 rounded-full px-4 py-2 text-sm"
            >
              <Plus className="size-[18px]" aria-hidden="true" /> Add expense
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
