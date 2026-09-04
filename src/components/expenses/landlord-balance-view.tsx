"use client";

import Link from "next/link";
import { CheckCircle2, House, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordLandlordPaymentAction, reopenLandlordBillAction } from "@/lib/actions";
import { totalLandlordOutstanding } from "@/lib/domain";
import type { LandlordBillBalance } from "@/lib/queries";
import { formatMoney } from "@/lib/format";
import { Button } from "../ui/button";
import { SectionTitle, StatusNote } from "../ui/page";
import { Surface } from "../ui/surface";

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
    <div className="grid gap-8">
      <Surface tone="peach" className="p-5">
        <p className="flex items-center gap-2 text-sm font-black">
          <House className="size-5 text-[var(--peach)]" aria-hidden="true" /> Outstanding
        </p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {totals.length ? (
            totals.map((total) => (
              <p key={total.currency} className="text-3xl font-black tabular-nums">
                {formatMoney(total.amountCents, total.currency, locale)}
              </p>
            ))
          ) : (
            <p className="flex items-center gap-2 text-xl font-black text-[var(--positive)]">
              <CheckCircle2 className="size-5" aria-hidden="true" /> All paid
            </p>
          )}
        </div>
      </Surface>

      {error && <StatusNote tone="error" title={error} />}

      <section>
        <SectionTitle>{outstanding.length ? "To pay" : "Nothing to pay"}</SectionTitle>
        {outstanding.length ? (
          <div className="grid gap-3">
            {outstanding.map((row) => (
              <article
                key={row.expenseId}
                className="rounded-[var(--radius-surface)] border border-[var(--line)] bg-white p-4 shadow-[var(--shadow-sm)]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[var(--pastel-peach)] text-[var(--peach)]">
                    <ReceiptText className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/h/${householdId}/expenses/${row.expenseId}`}
                      className="font-black text-[var(--ink)] no-underline hover:underline"
                    >
                      {row.title}
                    </Link>
                    <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-[var(--muted)]">Your share</dt>
                        <dd className="mt-0.5 font-black tabular-nums">
                          {formatMoney(row.originalShareCents, row.currency, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Paid</dt>
                        <dd className="mt-0.5 font-black tabular-nums">
                          {formatMoney(row.paidCents, row.currency, locale)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Remaining</dt>
                        <dd className="mt-0.5 font-black text-[var(--peach)] tabular-nums">
                          {formatMoney(row.remainingCents, row.currency, locale)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <div className="mt-4 flex justify-end border-t border-[var(--soft-line)] pt-3">
                  <Button tone="pastel" disabled={pending} onClick={() => markAsPaid(row)}>
                    Mark as paid
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-[var(--radius-surface)] border border-dashed border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)] p-6 text-center font-black text-[var(--positive)]">
            You have no outstanding landlord bills.
          </p>
        )}
      </section>

      <section>
        <SectionTitle>Payment history</SectionTitle>
        {completed.length ? (
          <div className="overflow-hidden rounded-[var(--radius-surface)] border border-[var(--line)] bg-white">
            {completed.map((row) => (
              <div
                key={row.expenseId}
                className="flex items-center gap-3 border-b border-[var(--soft-line)] p-4 last:border-0"
              >
                <CheckCircle2
                  className="size-5 shrink-0 text-[var(--positive)]"
                  aria-hidden="true"
                />
                <Link
                  href={`/h/${householdId}/expenses/${row.expenseId}`}
                  className="min-w-0 flex-1 truncate font-black text-[var(--ink)] no-underline hover:underline"
                >
                  {row.title}
                </Link>
                <span className="shrink-0 text-sm font-black tabular-nums">
                  {formatMoney(row.paidCents, row.currency, locale)} paid
                </span>
                <Button tone="quiet" disabled={pending} onClick={() => reopenBill(row)}>
                  Revert
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Paid bills will remain available here.</p>
        )}
      </section>
    </div>
  );
}
