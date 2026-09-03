import { ArrowLeft, CalendarDays, FileText, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, SectionTitle, StatusNote } from "@/components/ui/page";
import { voidExpenseAction } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { getExpenseDetail, getHousehold, getHouseholdMembers } from "@/lib/queries";

type ShareRow = {
  member_id: string;
  share_cents: number | string;
  fixed_share_cents: number | string | null;
  variable_share_cents: number | string | null;
  presence_days: number | null;
  allocation_order: number;
};
type UtilityRow = {
  utility_type: string;
  supplier: string | null;
  service_start_date: string;
  service_end_date: string;
  fixed_cents: number | string;
  variable_cents: number | string;
  variable_split_mode: string;
  bill_document_id: string | null;
};

export default async function ExpenseDetail({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  const [home, members, rawExpense] = await Promise.all([
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getExpenseDetail(householdId, expenseId),
  ]);
  if (!rawExpense) notFound();
  const expense = rawExpense as typeof rawExpense & {
    expense_shares: ShareRow[];
    utility_bills: UtilityRow | UtilityRow[] | null;
  };
  const utility = Array.isArray(expense.utility_bills)
    ? expense.utility_bills[0]
    : expense.utility_bills;
  const names = new Map(members.map((member) => [member.id, member.display_name]));
  const locale = home?.locale ?? "en-GB";
  const payer = names.get(String(expense.payer_member_id)) ?? "Former roommate";
  const shares = [...(expense.expense_shares ?? [])].sort(
    (a, b) => a.allocation_order - b.allocation_order,
  );
  const voidExpense = async () => {
    "use server";
    const result = await voidExpenseAction({
      householdId,
      expenseId,
      reason: "Voided from the expense detail page.",
    });
    if (result.ok) redirect(`/h/${householdId}`);
  };

  return (
    <>
      <Link
        href={`/h/${householdId}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[var(--muted)] no-underline"
      >
        <ArrowLeft className="size-4" /> Home
      </Link>
      <PageHeader
        eyebrow={
          utility
            ? "Utility bill"
            : expense.kind === "recurring"
              ? "Recurring occurrence"
              : "Expense"
        }
        title={expense.title}
        description={
          utility
            ? `${utility.service_start_date} – ${utility.service_end_date}`
            : expense.expense_date
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[var(--brand)] p-5 text-white sm:col-span-1">
          <p className="text-xs font-bold tracking-wider text-white/70 uppercase">Total</p>
          <p className="mt-2 text-3xl font-extrabold">
            {formatMoney(Number(expense.total_cents), expense.currency, locale)}
          </p>
          <p className="mt-3 text-sm text-white/75">Paid by {payer}</p>
        </div>
        {utility ? (
          <dl className="grid grid-cols-2 rounded-2xl border border-[var(--line)] bg-[var(--paper)] sm:col-span-2">
            <div className="border-r border-[var(--soft-line)] p-5">
              <dt className="text-xs font-bold tracking-wider text-[var(--muted)] uppercase">
                Fixed portion
              </dt>
              <dd className="mt-2 text-xl font-extrabold">
                {formatMoney(Number(utility.fixed_cents), expense.currency, locale)}
              </dd>
              <p className="mt-2 text-xs text-[var(--muted)]">Equal for everyone</p>
            </div>
            <div className="p-5">
              <dt className="text-xs font-bold tracking-wider text-[var(--muted)] uppercase">
                Variable portion
              </dt>
              <dd className="mt-2 text-xl font-extrabold">
                {formatMoney(Number(utility.variable_cents), expense.currency, locale)}
              </dd>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {utility.variable_split_mode === "equal_zero_presence_fallback"
                  ? "Equal fallback: nobody present"
                  : "By days at home"}
              </p>
            </div>
          </dl>
        ) : (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:col-span-2">
            <p className="text-xs font-bold tracking-wider text-[var(--muted)] uppercase">
              Split method
            </p>
            <p className="mt-2 text-xl font-extrabold capitalize">{expense.split_method}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {shares.length} participant{shares.length === 1 ? "" : "s"}
            </p>
          </div>
        )}
      </div>
      <section className="mt-9">
        <SectionTitle aside={`${shares.length} shares`}>How it was split</SectionTitle>
        <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead className="border-b border-[var(--line)] text-xs tracking-wider text-[var(--muted)] uppercase">
              <tr>
                <th className="p-4">Roommate</th>
                {utility && (
                  <>
                    <th className="p-4 text-right">Fixed</th>
                    <th className="p-4 text-right">At home</th>
                    <th className="p-4 text-right">Usage</th>
                  </>
                )}
                <th className="p-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {shares.map((share) => (
                <tr
                  key={share.member_id}
                  className="border-b border-[var(--soft-line)] last:border-0"
                >
                  <th className="p-4 font-extrabold">
                    {names.get(share.member_id) ?? "Former roommate"}
                  </th>
                  {utility && (
                    <>
                      <td className="p-4 text-right tabular-nums">
                        {formatMoney(
                          Number(share.fixed_share_cents ?? 0),
                          expense.currency,
                          locale,
                        )}
                      </td>
                      <td className="p-4 text-right">{share.presence_days ?? 0} days</td>
                      <td className="p-4 text-right tabular-nums">
                        {formatMoney(
                          Number(share.variable_share_cents ?? 0),
                          expense.currency,
                          locale,
                        )}
                      </td>
                    </>
                  )}
                  <td className="p-4 text-right font-extrabold tabular-nums">
                    {formatMoney(Number(share.share_cents), expense.currency, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {utility && (
          <StatusNote title="Why these amounts?">
            The fixed cost is shared equally even when someone was away. Usage follows inclusive
            days at home. Largest-remainder rounding assigns final cents in stable participant
            order, so the shares always equal the bill total.
          </StatusNote>
        )}
      </section>
      {utility?.bill_document_id && (
        <section className="mt-9">
          <SectionTitle>Bill document</SectionTitle>
          <div className="flex items-center gap-3 border-y border-[var(--line)] bg-white px-4 py-4 sm:rounded-xl sm:border">
            <FileText className="size-5 text-[var(--brand)]" />
            <div className="flex-1">
              <strong className="text-sm">Private uploaded bill</strong>
              <p className="text-xs text-[var(--muted)]">
                Signed viewing link expires after one minute
              </p>
            </div>
            <ButtonLink
              href={`/api/bills/${utility.bill_document_id}/view?householdId=${householdId}`}
              tone="quiet"
            >
              View
            </ButtonLink>
          </div>
        </section>
      )}
      <div className="mt-8 flex flex-wrap justify-between gap-3">
        <form action={voidExpense}>
          <Button type="submit" tone="danger" disabled={Boolean(expense.voided_at)}>
            Void expense
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {utility && (
            <ButtonLink href={`/h/${householdId}/calendar`} tone="secondary">
              <CalendarDays className="size-4" /> Check away dates
            </ButtonLink>
          )}
          {!expense.voided_at && (
            <ButtonLink href={`/h/${householdId}/expenses/${expenseId}/edit`} tone="secondary">
              <Pencil className="size-4" /> Edit expense
            </ButtonLink>
          )}
        </div>
      </div>
    </>
  );
}
