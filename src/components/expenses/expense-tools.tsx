"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

export function ExpenseTools({
  children,
  ariaLabel = "Expense tools",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    function update() {
      setKeyboardInset(
        viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0,
      );
    }
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ "--keyboard-inset": `${keyboardInset}px` } as CSSProperties}
      className="fixed inset-x-0 bottom-[var(--keyboard-inset)] z-30 flex justify-end gap-1 border-t border-[var(--soft-line)] bg-[var(--canvas)] px-3 pt-1 pb-[max(.5rem,env(safe-area-inset-bottom))] md:static md:mt-auto md:border-0 md:bg-transparent md:p-0"
    >
      {children}
    </div>
  );
}
