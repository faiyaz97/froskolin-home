"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleDollarSign, History, Home } from "lucide-react";

import { cn } from "../ui/cn";

const items = [
  { label: "Home", path: "", icon: Home },
  { label: "Balances", path: "/balances", icon: CircleDollarSign },
  { label: "Calendar", path: "/calendar", icon: CalendarDays },
  { label: "Activity", path: "/activity", icon: History },
];

function isActive(pathname: string, href: string, path: string) {
  if (!path) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ householdId }: { householdId: string }) {
  const pathname = usePathname();
  const root = `/h/${householdId}`;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--line)] bg-white/95 px-1 pt-1.5 pb-[max(.35rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgb(15_23_42/0.08)] backdrop-blur-xl lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-[min(520px,calc(100vw-2rem))] lg:-translate-x-1/2 lg:rounded-[20px] lg:border lg:px-2 lg:pb-1.5"
    >
      {items.map(({ label, path, icon: Icon }) => {
        const href = `${root}${path}`;
        const active = isActive(pathname, href, path);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-[58px] flex-col items-center justify-end gap-1 rounded-xl pb-1 text-[10px] font-extrabold no-underline",
              active ? "text-[var(--brand)]" : "text-[var(--muted)]",
            )}
          >
            <Icon className="size-[22px]" strokeWidth={active ? 2.7 : 2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
