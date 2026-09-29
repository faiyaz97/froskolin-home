import { CheckCircle2, House, ReceiptText } from "lucide-react";
import Link from "next/link";

import { totalLandlordOutstanding } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import type { LandlordBillBalance, LandlordPaymentHistoryItem } from "@/lib/queries";
import { UtilityTypeIcon } from "../bills/bill-meta-controls";
import { ButtonLink } from "../ui/button";

function formatBillDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function recordPaymentHref(
  householdId: string,
  currentMemberId: string,
  currency: string,
  amountCents: number,
) {
  const params = new URLSearchParams({
    source: "landlord",
    payingMemberId: currentMemberId,
    receivingMemberId: "landlord",
    amountCents: String(amountCents),
    currency,
  });
  return `/h/${householdId}/add/settlement?${params.toString()}`;
}

export function LandlordBalanceView({
  householdId,
  currentMemberId,
  rows,
  paymentHistory,
  locale,
}: {
  householdId: string;
  currentMemberId: string;
  rows: LandlordBillBalance[];
  paymentHistory?: LandlordPaymentHistoryItem[];
  locale: string;
}) {
  const totals = totalLandlordOutstanding(
    rows.map((row) => ({
      currency: row.currency,
      originalShareCents: row.originalShareCents,
      paymentCents: row.payments.map((payment) => payment.amountCents),
    })),
  );
  const payments = (
    paymentHistory ??
    rows.flatMap((row) =>
      row.payments.map((payment) => ({
        ...payment,
        currency: row.currency,
        expenseId: row.expenseId,
        title: row.title,
        beneficiaryMemberId: currentMemberId,
        beneficiaryName: null,
      })),
    )
  ).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id.localeCompare(a.id));

  return (
    <div className="grid gap-6">
      <section
        aria-label="Outstanding landlord balance"
        className="rounded-[22px] bg-white px-3.5 py-3 shadow-[var(--shadow-sm)] sm:px-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--pastel-peach)] text-[var(--peach)]">
            <House className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black">Outstanding</h2>
            <div className="mt-0.5 flex min-w-0 flex-wrap gap-x-3 gap-y-1">
              {totals.length ? (
                totals.map((total) => (
                  <p
                    key={total.currency}
                    className="max-w-full text-[clamp(1rem,5vw,1.25rem)] leading-tight font-black tracking-[-0.035em] [overflow-wrap:anywhere] text-[var(--peach)] tabular-nums"
                  >
                    {formatMoney(total.amountCents, total.currency, locale)}
                  </p>
                ))
              ) : (
                <p className="text-lg font-black text-[var(--positive)]">All paid</p>
              )}
            </div>
          </div>
        </div>
        {totals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 sm:justify-end">
            {totals.map((total) => (
              <ButtonLink
                key={total.currency}
                href={recordPaymentHref(
                  householdId,
                  currentMemberId,
                  total.currency,
                  total.amountCents,
                )}
                tone="pastelWarm"
                className="min-h-10 rounded-full px-4 py-2 text-xs"
              >
                {totals.length === 1 ? "Record payment" : `Record ${total.currency} payment`}
              </ButtonLink>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="landlord-bills">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 id="landlord-bills" className="text-sm font-black">
            Landlord bills
          </h2>
          {rows.length > 0 && (
            <span className="text-xs text-[var(--muted)]">
              {rows.length} {rows.length === 1 ? "bill" : "bills"}
            </span>
          )}
        </div>

        {rows.length ? (
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]">
            {rows.map((row) => (
              <article
                key={row.expenseId}
                className="border-b border-[var(--soft-line)] px-3.5 py-3 last:border-0 sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                  <LandlordExpenseIcon row={row} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/h/${householdId}/expenses/${row.expenseId}`}
                      className="line-clamp-2 text-sm leading-5 font-black [overflow-wrap:anywhere] break-words text-[var(--ink)] no-underline hover:text-[var(--brand)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {formatBillDate(row.expenseDate, locale)}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 pl-[50px] sm:pl-[52px]">
                  <BillAmount
                    label="Original share"
                    amountCents={row.originalShareCents}
                    currency={row.currency}
                    locale={locale}
                  />
                  <BillAmount
                    label="Paid"
                    amountCents={row.paidCents}
                    currency={row.currency}
                    locale={locale}
                    tone="positive"
                  />
                  <BillAmount
                    label="Remaining"
                    amountCents={row.remainingCents}
                    currency={row.currency}
                    locale={locale}
                    tone={row.remainingCents > 0 ? "peach" : "positive"}
                  />
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="px-1 text-sm text-[var(--muted)]">No landlord bills yet.</p>
        )}
      </section>

      <section aria-labelledby="landlord-history">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 id="landlord-history" className="text-sm font-black">
            Payment history
          </h2>
          {payments.length > 0 && (
            <span className="text-xs text-[var(--muted)]">
              {payments.length} {payments.length === 1 ? "payment" : "payments"}
            </span>
          )}
        </div>

        {payments.length ? (
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex min-h-[68px] items-center gap-3 border-b border-[var(--soft-line)] px-3.5 py-3 last:border-0 sm:px-5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
                  <CheckCircle2 className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/h/${householdId}/expenses/${payment.expenseId}`}
                    className="line-clamp-2 text-sm leading-5 font-black [overflow-wrap:anywhere] break-words text-[var(--ink)] no-underline hover:text-[var(--brand)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                  >
                    {payment.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {formatBillDate(payment.paymentDate, locale)} ·{" "}
                    {payment.paidByMemberId && payment.paidByMemberId !== currentMemberId
                      ? `${payment.paidByName ?? "A member"} paid for your share`
                      : payment.beneficiaryMemberId !== currentMemberId
                        ? `You paid for ${payment.beneficiaryName ?? "another member"}'s share`
                        : "You paid"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-black text-[var(--positive)] tabular-nums">
                  {formatMoney(payment.amountCents, payment.currency, locale)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-1 text-sm text-[var(--muted)]">No payments yet.</p>
        )}
      </section>
    </div>
  );
}

function BillAmount({
  label,
  amountCents,
  currency,
  locale,
  tone = "default",
}: {
  label: string;
  amountCents: number;
  currency: string;
  locale: string;
  tone?: "default" | "positive" | "peach";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--positive)]"
      : tone === "peach"
        ? "text-[var(--peach)]"
        : "text-[var(--ink)]";
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] font-bold text-[var(--muted)]">{label}</dt>
      <dd className={`mt-0.5 truncate text-xs font-black tabular-nums ${toneClass}`}>
        {formatMoney(amountCents, currency, locale)}
      </dd>
    </div>
  );
}

function LandlordExpenseIcon({ row }: { row: LandlordBillBalance }) {
  if (row.utilityType) return <UtilityTypeIcon value={row.utilityType} className="size-10" />;
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)]">
      <ReceiptText className="size-5" aria-hidden="true" />
    </span>
  );
}
