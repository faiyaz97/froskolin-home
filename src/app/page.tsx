import Link from "next/link";
import { redirect } from "next/navigation";

import { PublicForm } from "@/components/public/auth-form";
import { RememberedDeviceRedirect } from "@/components/public/remembered-device-redirect";
import { CatMark } from "@/components/ui/brand";
import { createClient } from "@/lib/supabase/server";

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();
    if (membership) redirect(`/h/${membership.household_id}`);
  }

  const mode = (await searchParams).mode === "join" ? "join" : "create";

  return (
    <main className="relative grid h-dvh place-items-center overflow-hidden overscroll-none bg-white px-4 sm:bg-[var(--canvas)]">
      <RememberedDeviceRedirect />
      <div className="pointer-events-none absolute -top-24 -right-28 size-72 rounded-full bg-[var(--violet-soft)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 size-72 rounded-full bg-[var(--brand-soft)] blur-3xl" />
      <div className="relative mx-auto w-full max-w-md sm:rounded-[28px] sm:border sm:border-[var(--line)] sm:bg-white sm:px-5 sm:py-3 sm:shadow-[var(--shadow)]">
        <header className="mb-1.5 flex justify-center sm:justify-start">
          <CatMark />
        </header>
        <nav
          className="mb-1.5 grid grid-cols-2 rounded-[14px] bg-[var(--soft-line)] p-1"
          aria-label="Household access"
        >
          <Link
            href="/?mode=create"
            className={`rounded-[11px] px-3 py-1.5 text-center text-xs font-extrabold no-underline transition-colors ${
              mode === "create"
                ? "bg-white text-[var(--brand-strong)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Create household
          </Link>
          <Link
            href="/?mode=join"
            className={`rounded-[11px] px-3 py-1.5 text-center text-xs font-extrabold no-underline transition-colors ${
              mode === "join"
                ? "bg-white text-[var(--brand-strong)] shadow-sm"
                : "text-[var(--muted)]"
            }`}
          >
            Join roommates
          </Link>
        </nav>
        <PublicForm kind={mode} />
      </div>
    </main>
  );
}
