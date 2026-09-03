import { CatMark } from "@/components/ui/brand";
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid h-dvh place-items-center overflow-hidden overscroll-none bg-white px-4 sm:bg-[var(--canvas)]">
      <div className="pointer-events-none absolute -top-24 -right-28 size-72 rounded-full bg-[var(--violet-soft)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 size-72 rounded-full bg-[var(--brand-soft)] blur-3xl" />
      <div className="relative mx-auto w-full max-w-md sm:rounded-[28px] sm:border sm:border-[var(--line)] sm:bg-white sm:px-5 sm:py-3 sm:shadow-[var(--shadow)]">
        <header className="mb-1.5 flex justify-center sm:justify-start">
          <CatMark />
        </header>
        {children}
      </div>
    </main>
  );
}
