export default function Loading() {
  return (
    <div aria-live="polite" aria-label="Loading household" className="animate-pulse">
      <div className="h-4 w-28 rounded bg-[var(--line)]" />
      <div className="mt-4 h-11 w-72 max-w-full rounded bg-[var(--line)]" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="h-36 rounded-2xl bg-[var(--brand-soft)]" />
        <div className="h-36 rounded-2xl bg-[var(--line)]" />
      </div>
      <div className="mt-8 h-80 rounded-2xl bg-[var(--line)]" />
    </div>
  );
}
