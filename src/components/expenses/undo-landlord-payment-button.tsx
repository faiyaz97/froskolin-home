"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { voidLandlordPaymentAction } from "@/lib/actions";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorDialog } from "@/components/ui/error-dialog";

export function UndoLandlordPaymentButton({
  householdId,
  paymentId,
  totalCents,
  currency,
  locale,
  coversOtherBills,
}: {
  householdId: string;
  paymentId: string;
  totalCents: number;
  currency: string;
  locale: string;
  coversOtherBills: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function undo() {
    startTransition(async () => {
      const result = await voidLandlordPaymentAction({
        householdId,
        paymentId,
        reason: "Reversed from bill payment history.",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="Undo payment"
        title="Undo payment"
        className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--negative)] hover:bg-[var(--negative-soft)]"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <Dialog title="Undo this payment?" onClose={() => setOpen(false)} dismissible={!pending}>
          <div className="px-2 pb-2">
            <p className="text-sm leading-5 text-[var(--ink-soft)]">
              This reverses the full {formatMoney(totalCents, currency, locale)}{" "}
              {coversOtherBills ? "payment and every bill share it covered." : "payment."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" tone="quiet" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" tone="danger" disabled={pending} onClick={undo}>
                {pending ? "Undoing…" : "Undo payment"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
      <ErrorDialog error={error} onClose={() => setError(null)} />
    </>
  );
}
