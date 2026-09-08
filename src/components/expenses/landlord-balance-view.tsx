"use client";

import { Check, CheckCircle2, House, ReceiptText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordLandlordPaymentAction, reopenLandlordBillAction } from "@/lib/actions";
import { totalLandlordOutstanding } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import type { LandlordBillBalance } from "@/lib/queries";
import { Button } from "../ui/button";
import { StatusNote } from "../ui/page";

function formatBillDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function LandlordBalanceView({
  householdId,
  rows,
  locale,
}: {
  householdId: string;
  rows: LandlordBillBalance[];
  locale: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const totals = totalLandlordOutstanding(
    rows.map((row) => ({
      currency: row.currency,
      originalShareCents: row.originalShareCents,
      paymentCents: row.payments.map((payment) => payment.amountCents),
    })),
  );
  const outstanding = rows.filter((row) => row.remainingCents > 0);
  const completed = rows.filter((row) => row.remainingCents === 0);

  function markAsPaid(row: LandlordBillBalance) {
    setError("");
    startTransition(async () => {
      const result = await recordLandlordPaymentAction({
        householdId,
        expenseId: row.expenseId,
        markAsPaid: true,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function reopenBill(row: LandlordBillBalance) {
    setError("");
    startTransition(async () => {
      const result = await reopenLandlordBillAction({
        householdId,
        expenseId: row.expenseId,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-7">
      <section
        aria-label="Outstanding landlord balance"
        className="rounded-[24px] bg-[var(--pastel-peach)] px-4 py-5 shadow-[var(--shadow-sm)] sm:px-5"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/75 text-[var(--peach)]">
            <House className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black tracking-[0.12em] text-[var(--peach)] uppercase">
              Outstanding
            </p>
            <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1">
              {totals.length ? (
                totals.map((total) => (
                  <p
                    key={total.currency}
                    className="text-2xl leading-tight font-black tracking-[-0.035em] tabular-nums sm:text-3xl"
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
      </section>

      {error && <StatusNote tone="error" title={error} />}

      <section aria-labelledby="landlord-to-pay">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 id="landlord-to-pay" className="text-sm font-black">
            To pay
          </h2>
          {outstanding.length > 0 && (
            <span className="text-xs text-[var(--muted)]">
              {outstanding.length} {outstanding.length === 1 ? "bill" : "bills"}
            </span>
          )}
        </div>

        {outstanding.length ? (
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]">
            {outstanding.map((row) => (
              <article
                key={row.expenseId}
                className="border-b border-[var(--soft-line)] px-3.5 py-3.5 last:border-0 sm:px-5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--pastel-peach)] text-[var(--peach)]">
                    <ReceiptText className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/h/${householdId}/expenses/${row.expenseId}`}
                      className="block truncate text-sm font-black text-[var(--ink)] no-underline hover:text-[var(--brand)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {formatBillDate(row.expenseDate, locale)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-[var(--peach)] tabular-nums">
                      {formatMoney(row.remainingCents, row.currency, locale)}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold text-[var(--muted)]">left</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 pl-[52px]">
                  <p className="min-w-0 text-[11px] text-[var(--muted)]">
                    Paid {formatMoney(row.paidCents, row.currency, locale)} of{" "}
                    {formatMoney(row.originalShareCents, row.currency, locale)}
                  </p>
                  <Button
                    tone="pastel"
                    disabled={pending}
                    onClick={() => markAsPaid(row)}
                    className="min-h-9 shrink-0 rounded-full border-0 px-3 py-1.5 text-xs shadow-none"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                    Mark paid
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-4 shadow-[var(--shadow-sm)]">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-black">All paid</p>
          </div>
        )}
      </section>

      <section aria-labelledby="landlord-history">
        <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
          <h2 id="landlord-history" className="text-sm font-black">
            Payment history
          </h2>
          {completed.length > 0 && (
            <span className="text-xs text-[var(--muted)]">{completed.length} paid</span>
          )}
        </div>

        {completed.length ? (
          <div className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]">
            {completed.map((row) => (
              <div
                key={row.expenseId}
                className="flex min-h-[68px] items-center gap-3 border-b border-[var(--soft-line)] px-3.5 py-3 last:border-0 sm:px-5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
                  <CheckCircle2 className="size-[18px]" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/h/${householdId}/expenses/${row.expenseId}`}
                    className="block truncate text-sm font-black text-[var(--ink)] no-underline hover:text-[var(--brand)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
                  >
                    {row.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {formatMoney(row.paidCents, row.currency, locale)} paid
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => reopenBill(row)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--canvas)] hover:text-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Reopen ${row.title}`}
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                </button>
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
