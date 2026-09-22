"use client";

import { cn } from "./cn";

export function LoadMoreAction({
  pending,
  onLoad,
  className,
}: {
  pending: boolean;
  onLoad: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-center pt-2 pb-4", className)}>
      <button
        type="button"
        onClick={onLoad}
        disabled={pending}
        className="text-xs font-bold text-[var(--muted)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:text-[var(--brand)] hover:decoration-[var(--brand)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--brand)] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
