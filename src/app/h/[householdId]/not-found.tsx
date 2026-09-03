import { ButtonLink } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl" aria-hidden="true">
        🙀
      </p>
      <h1 className="mt-5 text-3xl font-extrabold">Nothing in this corner</h1>
      <p className="mt-2 text-[var(--muted)]">
        This item may have been voided, or you may not have permission to see it.
      </p>
      <ButtonLink href="/" className="mt-6">
        Go home
      </ButtonLink>
    </div>
  );
}
