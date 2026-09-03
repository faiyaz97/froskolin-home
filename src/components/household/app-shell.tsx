import Link from "next/link";
import { Suspense } from "react";
import { Bell, ChevronRight, Settings } from "lucide-react";

import { CatMark } from "../ui/brand";
import { AppNavigation } from "./app-navigation";
import { MemberAvatar } from "./member-avatar";

export function AppShell({
  householdId,
  householdName,
  memberName,
  memberRole,
  memberCount,
  unreadCount,
  children,
}: {
  householdId: string;
  householdName: string;
  memberName: string;
  memberRole: "owner" | "member";
  memberCount: number;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const root = `/h/${householdId}`;

  return (
    <div className="min-h-dvh bg-[var(--canvas)] lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden border-r border-[var(--line)] bg-white px-5 py-6 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <CatMark />
        <Link
          href={root}
          className="mt-8 rounded-2xl bg-gradient-to-br from-[#0f766e] via-[#0e7490] to-[#6d28d9] p-4 text-white no-underline shadow-[0_12px_26px_rgb(15_118_110/0.16)]"
        >
          <span className="block text-[11px] font-black tracking-[0.14em] text-white/70 uppercase">
            Your household
          </span>
          <span className="mt-2 block truncate text-lg font-black tracking-[-0.025em]">
            {householdName}
          </span>
          <span className="mt-1 block text-xs font-semibold text-white/75">
            {memberCount} roommate{memberCount === 1 ? "" : "s"}
          </span>
        </Link>

        <Suspense fallback={null}>
          <AppNavigation householdId={householdId} variant="desktop" />
        </Suspense>

        <Link
          href={`${root}/settings`}
          className="mt-auto flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-2.5 text-sm text-[var(--ink)] no-underline hover:bg-white"
        >
          <MemberAvatar name={memberName} />
          <span className="min-w-0 flex-1">
            <strong className="block truncate font-extrabold">{memberName}</strong>
            <small className="block text-[11px] font-semibold text-[var(--muted)] capitalize">
              {memberRole}
            </small>
          </span>
          <ChevronRight className="size-4 text-[var(--muted)]" aria-hidden="true" />
        </Link>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/92 px-4 py-2.5 backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-[980px] items-center justify-between">
            <div className="lg:hidden">
              <CatMark />
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-black">{householdName}</p>
              <p className="text-xs text-[var(--muted)]">
                {memberCount} roommate{memberCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`${root}/notifications`}
                className="relative grid size-11 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--soft-line)]"
                aria-label={`Notifications, ${unreadCount} unread`}
              >
                <Bell className="size-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-[var(--peach)] px-0.5 text-[9px] font-black text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                href={`${root}/settings`}
                className="grid size-11 place-items-center rounded-full hover:bg-[var(--soft-line)] lg:hidden"
                aria-label="Household settings"
              >
                <MemberAvatar name={memberName} className="size-8" />
              </Link>
              <Link
                href={`${root}/settings`}
                className="hidden size-11 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--soft-line)] lg:grid"
                aria-label="Household settings"
              >
                <Settings className="size-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </header>

        <main className="app-safe-bottom mx-auto w-full max-w-[980px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <AppNavigation householdId={householdId} variant="mobile" />
      </Suspense>
    </div>
  );
}
