import { CatMark } from "@/components/ui/brand";
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-white px-4 py-5 sm:grid sm:place-items-center sm:bg-[var(--canvas)] sm:py-10">
      <div className="pointer-events-none absolute -top-24 -right-28 size-72 rounded-full bg-[var(--violet-soft)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 size-72 rounded-full bg-[var(--brand-soft)] blur-3xl" />
      <div className="relative mx-auto w-full max-w-md sm:rounded-[28px] sm:border sm:border-[var(--line)] sm:bg-white sm:p-8 sm:shadow-[var(--shadow)]">
        <header className="mb-8 flex justify-center sm:justify-start">
          <CatMark />
        </header>
        {children}
      </div>
    </main>
  );
}
