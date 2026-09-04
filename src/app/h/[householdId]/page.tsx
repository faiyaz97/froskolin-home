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
      <Surface tone="lavender" className="relative mb-4 overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -top-14 -right-10 size-36 rounded-full bg-white/45" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[clamp(1.75rem,7vw,2.5rem)] leading-tight font-black tracking-[-0.045em]">
              {home?.name ?? "Home"}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-[var(--muted)]">
              <Users className="size-4" aria-hidden="true" />
              {activeMembers.length} {activeMembers.length === 1 ? "person" : "people"}
            </p>
          </div>
          <Link
            href={`/h/${householdId}/settings`}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-[var(--pastel-lavender-line)] bg-white/75 text-[var(--violet-strong)] shadow-[var(--shadow-sm)] transition-colors hover:bg-white"
            aria-label="Group settings"
          >
            <Settings className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </Surface>

      <Surface tone="mint" className="mb-7 flex overflow-hidden" aria-label="My balances">
        <Link
          href={`/h/${householdId}/balances`}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-4 text-[var(--ink)] no-underline transition-colors hover:bg-white/45 sm:px-5"
        >
          <Users className="size-5 shrink-0 text-[var(--brand)]" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-[var(--muted)]">Group</span>
            {ownBalances.length ? (
              <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-base font-black tabular-nums">
                {ownBalances.map((balance) => {
                  const netCents = Number(balance.net_cents);
                  return (
                    <span
                      key={balance.currency}
                      className={netCents > 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}
                    >
                      {netCents > 0 ? "You get " : "You owe "}
                      {formatMoney(Math.abs(netCents), balance.currency, locale)}
                    </span>
                  );
                })}
              </span>
            ) : (
              <span className="block text-base font-black text-[var(--positive)]">Settled</span>
            )}
          </span>
          <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
        </Link>
        {home?.landlord_enabled && (
          <Link
            href={`/h/${householdId}/landlord`}
            className="flex min-w-0 flex-1 items-center gap-2 border-l border-[var(--pastel-mint-line)] px-3 py-4 text-[var(--ink)] no-underline transition-colors hover:bg-white/45 sm:px-5"
          >
            <House className="size-5 shrink-0 text-[var(--peach)]" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-[var(--muted)]">Landlord</span>
              {landlordTotals.length ? (
                <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-base font-black text-[var(--negative)] tabular-nums">
                  {landlordTotals.map((row) => (
                    <span key={row.currency}>
                      You owe {formatMoney(row.amountCents, row.currency, locale)}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="block text-base font-black text-[var(--positive)]">Settled</span>
              )}
            </span>
            <ChevronRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          </Link>
        )}
      </Surface>

      <div className="pb-48 sm:pb-52 lg:pb-48">
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
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <ButtonLink
              href={`/h/${householdId}/add/settlement`}
              tone="pastelAccent"
              className="rounded-full"
            >
              <CircleDollarSign className="size-5" aria-hidden="true" /> Settle up
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/bill`}
              tone="pastelWarm"
              className="rounded-full"
            >
              <ScanLine className="size-5" aria-hidden="true" /> Upload bill
            </ButtonLink>
            <ButtonLink
              href={`/h/${householdId}/add/expense`}
              tone="pastel"
              className="min-h-12 rounded-full px-5"
            >
              <Plus className="size-5" aria-hidden="true" /> Add expense
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
