export default function Loading() {
  return (
    <div
      role="status"
      className="group-loading-skeleton mx-auto w-full max-w-2xl"
    >
      <span className="screen-reader-only">Loading page…</span>
      <div
        aria-hidden="true"
        className="rounded-[22px] bg-white px-4 py-4 shadow-[var(--shadow-sm)] motion-safe:animate-pulse sm:px-5"
      >
        <div className="h-3 w-24 rounded-full bg-[var(--line)]" />
        <div className="mt-5 flex items-center gap-3">
          <div className="size-9 shrink-0 rounded-xl bg-[var(--pastel-mint)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-3/5 rounded-full bg-[var(--line)]" />
            <div className="h-2.5 w-2/5 rounded-full bg-[var(--soft-line)]" />
          </div>
        </div>
        <div className="my-4 h-px bg-[var(--soft-line)]" />
        <div className="flex items-center gap-3">
          <div className="size-9 shrink-0 rounded-xl bg-[var(--pastel-sky)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded-full bg-[var(--line)]" />
            <div className="h-2.5 w-1/3 rounded-full bg-[var(--soft-line)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
