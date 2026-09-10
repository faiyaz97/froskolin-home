import type { ReactNode } from "react";

export function ExpenseTools({
  children,
  ariaLabel = "Expense tools",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex justify-end gap-1 md:justify-start">
      {children}
    </div>
  );
}
