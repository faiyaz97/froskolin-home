import Link from "next/link";
import { CheckCircle2, CircleDollarSign, Plus, Settings, Users } from "lucide-react";

import { HouseholdLedger } from "@/components/expenses/household-ledger";
import { CatBadge } from "@/components/ui/brand";
import { requireHouseholdMembership } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import {
  getBalances,
  getHousehold,
  getHouseholdMembers,
  getHouseholdTransactions,
} from "@/lib/queries";

export default async function HouseholdHome({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [{ membership }, home, members, balances, transactions] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getBalances(householdId),
    getHouseholdTransactions(householdId),
  ]);
  const locale = home?.locale ?? "en-GB";
  const activeMembers = members.filter((member) => !member.removed_at);
  const ownBalances = balances.filter(
    (balance) => balance.member_id === membership.id && Number(balance.net_cents) !== 0,
  );
  const memberNames = Object.fromEntries(
    members.map((member) => [String(member.id), String(member.display_name)]),
  );

  return (
    <>
      <section className="relative mb-5 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0f766e] via-[#0e7490] to-[#6d28d9] px-5 pt-5 pb-4 text-white shadow-[0_18px_40px_rgb(15_118_110/0.2)] sm:px-7 sm:pt-7 sm:pb-5">
        <div className="pointer-events-none absolute -top-20 -right-12 size-52 rotate-12 rounded-[44px] bg-white/8" />
        <div className="pointer-events-none absolute -right-8 -bottom-16 size-40 rounded-full bg-[#fb923c]/20" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black tracking-[0.13em] text-white/70 uppercase">
              Our home
            </p>
            <h1 className="mt-1 pr-10 text-[clamp(1.8rem,8vw,2.65rem)] leading-tight font-black tracking-[-0.05em] sm:pr-0">
              {home?.name ?? "Home"}
            </h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-white/75">
              <Users className="size-4" aria-hidden="true" />
              {activeMembers.length} roommate{activeMembers.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CatBadge className="hidden border border-white/20 bg-white/15 shadow-none sm:grid" />
            <Link
              href={`/h/${householdId}/settings`}
              className="grid size-10 place-items-center rounded-full bg-white/12 text-white hover:bg-white/20"
              aria-label="Household settings"
            >
              <Settings className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section
        className="mb-7 rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]"
        aria-labelledby="balances-title"
      >
        <h2
          id="balances-title"
          className="text-xs font-black tracking-[0.08em] text-[var(--muted)] uppercase"
        >
          Your balance
        </h2>
        {ownBalances.length ? (
          <div className="mt-2 grid gap-1.5">
            {ownBalances.map((balance) => {
              const cents = Number(balance.net_cents);
              return (
                <p key={balance.currency} className="text-xl font-black tracking-[-0.03em]">
                  {cents > 0 ? "You are owed " : "You owe "}
                  <span className={cents > 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}>
                    {formatMoney(Math.abs(cents), balance.currency, locale)}
                  </span>
                </p>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 flex items-center gap-2 text-lg font-black text-[var(--positive)]">
            <CheckCircle2 className="size-5" aria-hidden="true" /> All settled up
          </p>
        )}
      </section>

      <HouseholdLedger
        householdId={householdId}
        currentMemberId={membership.id}
        memberNames={memberNames}
        expenses={transactions.expenses}
        settlements={transactions.settlements}
        locale={locale}
      />

      <div className="fixed right-4 bottom-[88px] z-20 flex flex-col items-end gap-2 lg:right-8 lg:bottom-28">
        <Link
          href={`/h/${householdId}/add/settlement`}
          className="flex min-h-11 items-center gap-2 rounded-full bg-[var(--violet)] px-4 text-sm font-extrabold text-white no-underline shadow-[0_10px_22px_rgb(124_58_237/0.26)]"
        >
          <CircleDollarSign className="size-5" aria-hidden="true" /> Settle up
        </Link>
        <Link
          href={`/h/${householdId}/add/expense`}
          className="flex min-h-12 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-extrabold text-white no-underline shadow-[var(--shadow-float)]"
        >
          <Plus className="size-5" aria-hidden="true" /> Add expense
        </Link>
      </div>
    </>
  );
}
