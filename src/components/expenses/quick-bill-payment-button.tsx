"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { recordBillQuickPaymentAction } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { announceSaveComplete } from "@/lib/save-feedback";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";

export function QuickBillPaymentButton({
  householdId,
  expenseId,
  amountCents,
  currency,
  locale,
}: {
  householdId: string;
  expenseId: string;
  amountCents: number;
  currency: string;
  locale: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function pay() {
    if (pending) return;
    startTransition(async () => {
      const result = await recordBillQuickPaymentAction({ householdId, expenseId, amountCents });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      announceSaveComplete("Payment recorded");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        tone="pastelWarm"
        aria-label={`Pay ${formatMoney(amountCents, currency, locale)} to Landlord for this bill`}
        className="min-h-[22px] rounded-full border-0 px-2.5 py-1 text-[10px] font-black shadow-[0_2px_6px_rgb(234_88_12/0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peach)]"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      >
        Pay
      </Button>
      {open && (
        <Dialog title="Confirm bill payment" onClose={() => setOpen(false)} dismissible={!pending}>
          <div className="px-2 pb-2">
            <p className="text-sm leading-6 text-[var(--ink-soft)]">
              Pay {formatMoney(amountCents, currency, locale)} to Landlord for this bill?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" tone="quiet" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" tone="primary" disabled={pending} onClick={pay}>
                {pending ? "Recording…" : "Confirm payment"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      <ErrorDialog error={error} onClose={() => setError("")} />
    </>
  );
}
