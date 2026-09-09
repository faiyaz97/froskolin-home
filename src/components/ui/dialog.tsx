"use client";

import { ArrowLeft, Check, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { iconActionClass } from "./icon-action";

/** Native modal provides focus containment, Escape and a full-screen backdrop. */
export function Dialog({
  title,
  onClose,
  onDone,
  doneDisabled,
  dismissible = true,
  children,
}: {
  title: string;
  onClose: () => void;
  onDone?: () => void;
  doneDisabled?: boolean;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Enter" &&
          event.target instanceof HTMLInputElement &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          if (onDone && !doneDisabled) onDone();
        }
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-3xl border border-[var(--line)] bg-white p-0 text-[var(--ink)] shadow-xl backdrop:bg-[#1f2a44]/25"
    >
      <div className="p-3">
        {onDone ? (
          <div className="sticky top-0 z-10 mb-2 grid grid-cols-[2.75rem_1fr_2.75rem] items-center rounded-t-2xl bg-white">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className={iconActionClass({ className: "size-11 disabled:invisible" })}
              disabled={!dismissible}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </button>
            <h2 id={titleId} className="truncate text-center text-sm font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onDone}
              disabled={doneDisabled}
              aria-label="Done"
              className={iconActionClass({ tone: "brand", className: "size-11" })}
            >
              <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 rounded-t-2xl bg-white pl-2">
            <h2 id={titleId} className="text-sm font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className={iconActionClass({ className: "size-11" })}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
