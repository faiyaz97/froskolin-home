import { LockKeyhole } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
export default async function PermissionDenied({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--peach-soft)]">
        <LockKeyhole className="size-6 text-[var(--peach)]" />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.04em]">Owner permission needed</h1>
      <p className="mt-3 leading-7 text-[var(--muted)]">
        Only the household owner can rotate the invite code, reset another roommate’s PIN, or remove
        a member.
      </p>
      <ButtonLink href={`/h/${householdId}`} className="mt-6">
        Return home
      </ButtonLink>
    </div>
  );
}
