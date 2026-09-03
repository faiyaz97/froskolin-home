import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";

import { CatMark } from "../ui/brand";
import { AppNavigation } from "./app-navigation";
import { MemberAvatar } from "./member-avatar";

export function AppShell({
  householdId,
  memberName,
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
    <div className="min-h-dvh bg-[var(--canvas)]">
      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-white/92 px-4 py-2.5 backdrop-blur-xl lg:px-8">
          <div className="mx-auto flex max-w-[980px] items-center justify-between">
            <CatMark />
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
                className="grid size-11 place-items-center rounded-full hover:bg-[var(--soft-line)]"
                aria-label="Household settings"
              >
                <MemberAvatar name={memberName} className="size-8" />
              </Link>
            </div>
          </div>
        </header>

        <main className="app-safe-bottom mx-auto w-full max-w-[980px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <AppNavigation householdId={householdId} />
      </Suspense>
    </div>
  );
}
