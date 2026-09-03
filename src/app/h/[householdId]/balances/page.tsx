import { ArrowRight } from "lucide-react";

import { MemberAvatar } from "@/components/household/member-avatar";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { simplifyDebts } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { getBalances, getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [home, members, rows] = await Promise.all([
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getBalances(householdId),
  ]);
  const locale = home?.locale ?? "en-GB";
  const names = new Map(members.map((member) => [member.id, member.display_name]));
  const currencies = [...new Set(rows.map((row) => row.currency))].sort();

  return (
    <>
      <PageHeader
        title="Balances"
        action={
          <ButtonLink href={`/h/${householdId}/add/settlement`} className="hidden sm:inline-flex">
            Settle up
          </ButtonLink>
        }
      />
      {!currencies.length && (
        <p className="rounded-2xl border border-dashed border-[#a7f3d0] bg-[#f0fdfa] p-8 text-center font-extrabold text-[var(--positive)]">
          All settled up
        </p>
      )}
      {currencies.map((currency) => {
        const ledger = rows
          .filter((row) => row.currency === currency)
          .map((row) => ({
            memberId: row.member_id,
            currency,
            amountCents: Number(row.net_cents),
          }));
        const suggestions = simplifyDebts(ledger);
        return (
          <section key={currency} className="mb-10">
            <SectionTitle aside={`${currency} ledger`}>{currency}</SectionTitle>
            <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
              {ledger.map((row) => {
                const name = names.get(row.memberId) ?? "Former roommate";
                return (
                  <div
                    key={row.memberId}
                    className="flex items-center gap-3 border-b border-[var(--soft-line)] px-4 py-4 last:border-0"
                  >
                    <MemberAvatar name={name} />
                    <p className="flex-1 font-extrabold">{name}</p>
                    <p
                      className={`font-extrabold tabular-nums ${row.amountCents >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
                    >
                      {row.amountCents >= 0 ? "+" : "−"}
                      {formatMoney(Math.abs(row.amountCents), currency, locale)}
                    </p>
                  </div>
                );
              })}
            </div>
            {suggestions.length > 0 && (
              <div className="mt-7">
                <SectionTitle
                  aside={`${suggestions.length} payment${suggestions.length === 1 ? "" : "s"}`}
                >
                  A simple way to settle
                </SectionTitle>
                <div className="divide-y divide-[var(--soft-line)] overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
                  {suggestions.map((suggestion) => (
                    <div
                      key={`${suggestion.fromMemberId}-${suggestion.toMemberId}`}
                      className="flex items-center gap-3 px-4 py-4"
                    >
                      <div className="min-w-0 flex-1 text-sm">
                        <strong>{names.get(suggestion.fromMemberId) ?? "Former roommate"}</strong>
                        <ArrowRight
                          className="mx-2 inline size-4 text-[var(--muted)]"
                          aria-hidden="true"
                        />
                        <strong>{names.get(suggestion.toMemberId) ?? "Former roommate"}</strong>
                      </div>
                      <strong className="tabular-nums">
                        {formatMoney(suggestion.amountCents, currency, locale)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
