import { CatMark } from "@/components/ui/brand";

export function PublicAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--canvas)] px-4 py-5">
      <div className="mx-auto w-full max-w-sm rounded-[28px] bg-white p-5 shadow-[var(--shadow)] sm:p-6">
        <header className="mb-5 flex justify-center">
          <CatMark />
        </header>
        {children}
      </div>
    </main>
  );
}
