export default function Loading() {
  return (
    <div role="status" className="group-loading-skeleton mx-auto">
      <span className="screen-reader-only">Loading page…</span>
      <div
        aria-hidden="true"
        className="flex h-full min-h-0 flex-col gap-3 motion-safe:animate-pulse"
      >
        <div className="shrink-0 space-y-3 px-1 py-1">
          <div className="h-3 w-24 rounded-full bg-[var(--line)]" />
          <div className="h-8 w-2/3 max-w-72 rounded-lg bg-[var(--line)]" />
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3">
          <div className="flex h-20 items-center gap-3 rounded-[18px] bg-[var(--pastel-mint)] px-3">
            <div className="size-8 shrink-0 rounded-lg bg-white/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 w-2/3 rounded-full bg-white/80" />
              <div className="h-3 w-4/5 rounded-full bg-white/80" />
            </div>
          </div>
          <div className="flex h-20 items-center gap-3 rounded-[18px] bg-[var(--pastel-peach)] px-3">
            <div className="size-8 shrink-0 rounded-lg bg-white/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-2.5 w-2/3 rounded-full bg-white/80" />
              <div className="h-3 w-4/5 rounded-full bg-white/80" />
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-[22px] bg-white px-4 py-4 shadow-[var(--shadow-sm)] sm:px-5">
          <div className="h-3 w-28 rounded-full bg-[var(--line)]" />
          <div className="mt-4">
            {Array.from({ length: 7 }, (_, index) => (
              <div
                key={index}
                className="flex h-17 items-center gap-3 border-t border-[var(--soft-line)] first:border-0"
              >
                <div className="h-8 w-7 shrink-0 rounded-md bg-[var(--soft-line)]" />
                <div className="size-9 shrink-0 rounded-xl bg-[var(--pastel-sky)]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded-full bg-[var(--line)]" />
                  <div className="h-2.5 w-1/2 rounded-full bg-[var(--soft-line)]" />
                </div>
                <div className="h-3 w-12 shrink-0 rounded-full bg-[var(--line)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
