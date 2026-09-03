"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CircleDollarSign, History, Home, Plus } from "lucide-react";

import { cn } from "../ui/cn";

const items = [
  { label: "Home", path: "", icon: Home },
  { label: "Balances", path: "/balances", icon: CircleDollarSign },
  { label: "Add", path: "/add", icon: Plus, primary: true },
  { label: "Calendar", path: "/calendar", icon: CalendarDays },
  { label: "Activity", path: "/activity", icon: History },
];

function isActive(pathname: string, href: string, path: string) {
  if (!path) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({
  householdId,
  variant,
}: {
  householdId: string;
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const root = `/h/${householdId}`;

  if (variant === "desktop") {
    return (
      <nav aria-label="Primary" className="mt-7 grid gap-1.5">
        {items.map(({ label, path, icon: Icon, primary }) => {
          const href = `${root}${path}`;
          const active = isActive(pathname, href, path);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-[14px] px-3.5 text-sm font-extrabold no-underline transition-colors",
                primary
                  ? "mt-2 bg-[var(--brand)] text-white shadow-[0_8px_18px_rgb(15_118_110/0.18)] hover:bg-[var(--brand-strong)]"
                  : active
                    ? "bg-[var(--brand-soft)] text-[var(--brand-strong)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--soft-line)]",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.6 : 2} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Mobile primary"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--line)] bg-white/95 px-1 pt-1.5 pb-[max(.35rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgb(15_23_42/0.08)] backdrop-blur-xl lg:hidden"
    >
      {items.map(({ label, path, icon: Icon, primary }) => {
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
            {primary ? (
              <span className="absolute -top-5 grid size-13 place-items-center rounded-[18px] border-4 border-white bg-[var(--brand)] text-white shadow-[var(--shadow-float)]">
                <Icon className="size-6" strokeWidth={2.5} aria-hidden="true" />
              </span>
            ) : (
              <Icon className="size-[22px]" strokeWidth={active ? 2.7 : 2} aria-hidden="true" />
            )}
            <span className={primary ? "mt-auto" : undefined}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
