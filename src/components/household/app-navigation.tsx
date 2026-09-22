"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, Home } from "lucide-react";

import { cn } from "../ui/cn";
import { MemberAvatar, type AvatarColor } from "./member-avatar";

const items = [
  { label: "Home", path: "", icon: Home },
  { label: "Calendar", path: "/calendar", icon: CalendarDays },
  { label: "Activity", path: "/activity", icon: History },
  { label: "Account", path: "/account", icon: null },
];

function isActive(pathname: string, href: string, path: string) {
  if (!path) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({
  householdId,
  memberName,
  memberAvatarColor,
  showOnMobile,
}: {
  householdId: string;
  memberName: string;
  memberAvatarColor: string | null;
  showOnMobile: boolean;
}) {
  const pathname = usePathname();
  const root = `/h/${householdId}`;
  const activeIndex = items.findIndex(({ path }) => isActive(pathname, `${root}${path}`, path));

  return (
    <nav
      aria-label="Primary"
      style={{ "--app-nav-index": activeIndex } as CSSProperties}
      className={cn(
        "app-navigation fixed inset-x-0 bottom-0 z-40 grid-cols-4 border-t border-[var(--line)] px-1.5 pt-1 pb-[max(.375rem,env(safe-area-inset-bottom))] shadow-[0_-6px_20px_rgb(23_32_51/0.05)] md:inset-x-3 md:bottom-3 md:grid md:rounded-[24px] md:border md:p-1.5 md:shadow-[0_12px_36px_rgb(23_32_51/0.14),0_2px_8px_rgb(23_32_51/0.06)] md:backdrop-blur-xl lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-[min(520px,calc(100vw-2rem))] lg:-translate-x-1/2",
        showOnMobile ? "grid" : "hidden",
      )}
    >
      {activeIndex >= 0 && <span className="app-navigation-indicator" aria-hidden="true" />}
      {items.map(({ label, path, icon: Icon }) => {
        const href = `${root}${path}`;
        const active = isActive(pathname, href, path);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11px] leading-none font-bold no-underline transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sky)] md:min-h-[58px]",
              active
                ? "font-extrabold text-[var(--sky)]"
                : "text-[var(--muted)] hover:text-[var(--sky)]",
            )}
          >
            <span className="grid size-7 place-items-center transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
              {Icon ? (
                <Icon className="size-[22px]" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
              ) : (
                <MemberAvatar
                  name={memberName}
                  color={memberAvatarColor as AvatarColor | null}
                  className={cn(
                    "size-6 border-0 text-[9px] shadow-none",
                    active && "ring-2 ring-[var(--sky)] ring-offset-2",
                  )}
                />
              )}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
