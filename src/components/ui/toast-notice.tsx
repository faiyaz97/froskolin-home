"use client";

import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "./cn";

export function ToastNotice({
  message,
  tone = "success",
  onClose,
  hint,
}: {
  message: string | null | undefined;
  tone?: "success" | "error" | "info";
  onClose: () => void;
  hint?: string;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const openDialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      setTarget(message ? (openDialogs.item(openDialogs.length - 1) ?? document.body) : null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!message || tone === "error") return;
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [message, tone, onClose]);

  if (!message || !target) return null;
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? AlertTriangle : Info;

  return createPortal(
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "fixed right-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] left-3 z-50 mx-auto flex w-fit max-w-[min(28rem,calc(100vw-1.5rem))] items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-sm leading-5 shadow-[var(--shadow-float)] md:bottom-24",
        tone === "success" && "border-[var(--positive-soft)] text-[var(--positive)]",
        tone === "error" && "border-[var(--negative-soft)] text-[var(--negative)]",
        tone === "info" && "border-[var(--brand-soft)] text-[var(--brand)]",
      )}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[var(--ink)]">
        <p className="font-bold wrap-break-word">{message}</p>
        {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="-m-2 grid size-10 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        aria-label="Dismiss message"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>,
    target,
  );
}
