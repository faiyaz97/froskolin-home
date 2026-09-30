"use client";

import { ToastNotice } from "./toast-notice";

/** Compatibility wrapper for action failures; field hints stay beside their inputs. */
export function ErrorDialog({
  error,
  onClose,
  hint,
}: {
  error: string | null | undefined;
  onClose: () => void;
  hint?: string;
}) {
  return <ToastNotice message={error} tone="error" onClose={onClose} hint={hint} />;
}
