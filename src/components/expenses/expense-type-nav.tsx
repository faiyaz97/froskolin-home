import Link from "next/link";
import { ReceiptText, Repeat2, ScanLine } from "lucide-react";

import { cn } from "../ui/cn";

const expenseTypes = [
  { id: "expense", label: "One-time", icon: ReceiptText },
  { id: "recurring", label: "Recurring", icon: Repeat2 },
  { id: "bill", label: "Utility bill", icon: ScanLine },
] as const;

export function ExpenseTypeNav({
  householdId,
  active,
}: {
  householdId: string;
  active: (typeof expenseTypes)[number]["id"];
}) {
  return (
    <nav
      aria-label="Expense type"
      className="mb-6 grid grid-cols-3 gap-1 rounded-[16px] bg-[var(--soft-line)] p-1"
    >
      {expenseTypes.map(({ id, label, icon: Icon }) => {
        const selected = active === id;
        return (
          <Link
            key={id}
            href={`/h/${householdId}/add/${id}`}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex min-h-12 items-center justify-center gap-1.5 rounded-[13px] px-2 text-center text-xs font-extrabold no-underline transition sm:text-sm",
              selected
                ? "bg-white text-[var(--brand-strong)] shadow-[var(--shadow-sm)]"
                : "text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
