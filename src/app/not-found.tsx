import { ButtonLink } from "@/components/ui/button";
import { CatMark } from "@/components/ui/brand";
export default function GlobalNotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-16 text-center">
      <div className="flex justify-center">
        <CatMark />
      </div>
      <p className="mt-16 text-7xl" aria-hidden="true">
        🙀
      </p>
      <h1 className="mt-6 text-4xl font-extrabold tracking-[-0.05em]">
        Froskolin can’t find that.
      </h1>
      <p className="mt-3 text-[var(--muted)]">
        The page may have moved, or this household isn’t yours.
      </p>
      <ButtonLink href="/" className="mt-7">
        Return to safety
      </ButtonLink>
    </main>
  );
}
