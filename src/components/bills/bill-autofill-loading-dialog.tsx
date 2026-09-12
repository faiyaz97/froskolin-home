"use client";

import Image from "next/image";
import { LoaderCircle } from "lucide-react";

import readingCat from "../../../public/assets/froskolin-read-bill.png";
import { Dialog } from "../ui/dialog";

export function BillAutofillLoadingDialog() {
  return (
    <Dialog title="Reading your bill" dismissible={false} onClose={() => {}}>
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="flex flex-col items-center gap-5 px-4 pt-2 pb-7"
      >
        <Image
          src={readingCat}
          alt="Froskolin reading a bill"
          className="h-auto w-40 motion-safe:animate-pulse sm:w-44"
          preload
        />
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--brand)]">
          <LoaderCircle
            className="size-4 animate-spin motion-reduce:[animation-duration:3s]"
            aria-hidden="true"
          />
          <span>Autofilling…</span>
        </div>
      </div>
    </Dialog>
  );
}
