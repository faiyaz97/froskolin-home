"use client";

import { Bell, BellOff, LoaderCircle } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getPushConfigurationAction,
  getPushSubscriptionStatusAction,
  registerPushSubscriptionAction,
  unregisterPushSubscriptionAction,
} from "@/lib/actions/push";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { StatusNote } from "../ui/page";

type SupportState = "checking" | "ready" | "unsupported" | "insecure" | "ios-home-screen";
type PermissionState = "default" | "granted" | "denied" | "unknown";

type PushSubscriptionDetails = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

const subscribeToHydration = () => () => undefined;
const promptedAccounts = new Set<string>();

function wasPrompted(key: string) {
  if (promptedAccounts.has(key)) return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberPrompt(key: string) {
  promptedAccounts.add(key);
  try {
    localStorage.setItem(key, "1");
  } catch {
    // If storage is unavailable, suppress repeat prompts for this session.
  }
}

function isIosDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectSupport(): SupportState {
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  if (!window.isSecureContext && !localHost) return "insecure";
  if (isIosDevice() && !isStandaloneApp()) return "ios-home-screen";
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return "ready";
}

function toApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function subscriptionDetails(subscription: PushSubscription): PushSubscriptionDetails | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth || !subscription.endpoint) return null;
  return { endpoint: subscription.endpoint, keys: { p256dh, auth } };
}

function isActionFailure(error: unknown): error is { ok: false; error: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "ok" in error &&
    (error as { ok?: unknown }).ok === false &&
    typeof (error as { error?: unknown }).error === "string"
  );
}

export function PushNotificationSettings({
  promptOnly = false,
  embedded = false,
}: {
  promptOnly?: boolean;
  embedded?: boolean;
}) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const support: SupportState = hydrated ? detectSupport() : "checking";
  const eligible = !promptOnly || (hydrated && isStandaloneApp());
  const [promptOpen, setPromptOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("unknown");
  const [configuration, setConfiguration] = useState<{
    publicKey: string;
    userId: string;
  } | null>(null);
  const [configurationChecked, setConfigurationChecked] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [configurationError, setConfigurationError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (support !== "ready" || !eligible) return;
    let active = true;
    void getPushConfigurationAction()
      .then((result) => {
        if (!active) return;
        if (isActionFailure(result)) {
          setConfigurationError(result.error);
          setConfigurationChecked(true);
          return;
        }
        const publicKey = result.data.publicKey;
        if (publicKey) {
          setSubscriptionChecked(false);
          setConfiguration({ publicKey, userId: result.data.userId });
        } else {
          setConfiguration(null);
          setSubscriptionChecked(true);
        }
        setConfigurationChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setConfigurationError("Could not check notifications. Refresh the page to try again.");
        setConfigurationChecked(true);
      });
    return () => {
      active = false;
    };
  }, [support, eligible]);

  useEffect(() => {
    if (!configuration || support !== "ready") return;
    let active = true;
    void navigator.serviceWorker
      .getRegistration("/")
      .then((registration) => registration?.pushManager.getSubscription())
      .then(async (subscription) => {
        if (!subscription) return null;
        return getPushSubscriptionStatusAction({ endpoint: subscription.endpoint });
      })
      .then((result) => {
        if (!active) return;
        if (result && isActionFailure(result)) {
          setConfigurationError(result.error);
          return;
        }
        setEnabled(result !== null && result.data.enabled);
        setSubscriptionChecked(true);
      })
      .catch(() => {
        if (!active) return;
        setConfigurationError("Could not check notifications. Refresh the page to try again.");
      });
    return () => {
      active = false;
    };
  }, [configuration, support]);

  useEffect(() => {
    if (
      !promptOnly ||
      !eligible ||
      !configuration ||
      !subscriptionChecked ||
      enabled ||
      support !== "ready" ||
      Notification.permission === "denied"
    )
      return;
    const key = `froskolin:push-prompt:${configuration.userId}`;
    const timer = setTimeout(() => {
      if (wasPrompted(key) || document.querySelector("dialog[open]")) return;
      rememberPrompt(key);
      setPromptOpen(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [promptOnly, eligible, configuration, subscriptionChecked, enabled, support]);

  async function enableNotifications() {
    if (!configuration || busy || support !== "ready") return;
    setBusy(true);
    setMessage("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        if (promptOnly) setPromptOpen(false);
        setMessage(
          nextPermission === "denied"
            ? "Notifications are blocked. Allow them in your browser settings, then try again."
            : "Notifications need permission before they can be enabled.",
        );
        return;
      }

      let registration = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      if (!registration.active) {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
          registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) => {
              timeout = setTimeout(() => reject(new Error("Worker activation timed out")), 10000);
            }),
          ]);
        } finally {
          if (timeout) clearTimeout(timeout);
        }
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(configuration.publicKey),
        });
      }
      const details = subscriptionDetails(subscription);
      if (!details) throw new Error("The browser returned an incomplete push subscription.");

      const result = await registerPushSubscriptionAction(details);
      if (isActionFailure(result)) {
        setMessage(result.error);
        return;
      }
      setEnabled(true);
      setPromptOpen(false);
      setMessage("");
    } catch {
      setMessage("We couldn't enable notifications on this device. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disableNotifications() {
    if (!configuration || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const result = await unregisterPushSubscriptionAction({ endpoint: subscription.endpoint });
        if (isActionFailure(result)) {
          setMessage(result.error);
          return;
        }
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setMessage("Notifications are off on this device.");
    } catch {
      setMessage("We couldn't turn off notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const unavailableMessage =
    support === "checking"
      ? "Checking notification support…"
      : support === "insecure"
        ? "Open Froskolin over HTTPS on this device to enable notifications."
        : support === "ios-home-screen"
          ? "Add Froskolin to your Home Screen, then enable notifications here."
          : support === "unsupported"
            ? "Notifications aren't supported in this browser."
            : !configurationChecked
              ? "Checking notification setup…"
              : configurationError ||
                (configuration ? "" : "Push notifications aren't configured for this app yet.");

  const canInteract =
    support === "ready" &&
    configuration !== null &&
    configurationChecked &&
    subscriptionChecked &&
    !configurationError;

  if (promptOnly) {
    if (!promptOpen || !canInteract || enabled) return null;
    return (
      <NotificationPermissionDialog
        busy={busy}
        message={message}
        onEnable={enableNotifications}
        onClose={() => setPromptOpen(false)}
      />
    );
  }

  const settingsContent = (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Notifications on this device"
        aria-busy={busy}
        disabled={!canInteract || busy}
        onClick={enabled ? disableNotifications : enableNotifications}
        className="group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-soft)] focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-70 sm:px-5"
      >
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${enabled ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--pastel-sky)] text-[var(--sky)]"}`}
        >
          {enabled ? (
            <Bell className="size-5" aria-hidden="true" />
          ) : (
            <BellOff className="size-5" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-black text-[var(--ink)]">
            Notifications on this device
          </span>
          <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
            Get alerts for expenses, bills, and payments involving you.
          </p>
        </div>
        <span className="relative h-6 w-11 shrink-0" aria-hidden="true">
          <span
            className={`absolute inset-0 rounded-full transition-colors ${enabled ? "bg-[var(--brand)]" : "bg-[var(--line)]"}`}
          />
          <span
            className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
          {busy && (
            <span className="absolute inset-0 grid place-items-center rounded-full bg-white/75">
              <LoaderCircle className="size-4 animate-spin text-[var(--brand)]" />
            </span>
          )}
        </span>
      </button>
      {!enabled && unavailableMessage && (
        <div className="border-t border-[var(--soft-line)] px-4 py-3 sm:px-5">
          <StatusNote tone={configurationError ? "error" : "info"} title={unavailableMessage} />
        </div>
      )}
      {message && (
        <div
          className="border-t border-[var(--soft-line)] px-4 py-3 text-sm font-bold text-[var(--brand-strong)] sm:px-5"
          role="status"
        >
          {message}
        </div>
      )}
      {permission === "denied" && !enabled && !message && (
        <p className="px-4 pb-4 text-xs text-[var(--muted)] sm:px-5">
          Your browser has blocked notifications for this site.
        </p>
      )}
    </>
  );

  if (embedded) return settingsContent;

  return (
    <section className="overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)]">
      {settingsContent}
    </section>
  );
}

/**
 * Best-effort cleanup used immediately before signing out. The server action
 * is still scoped to the authenticated user, while unsubscribe removes the
 * browser's device subscription so the next account cannot inherit it.
 */
export async function unregisterCurrentDevicePushSubscription() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
      await unregisterPushSubscriptionAction({ endpoint: subscription.endpoint });
    } finally {
      await subscription.unsubscribe();
    }
  } catch {
    // Sign-out should continue even if notification cleanup is unavailable.
  }
}

export function NotificationPermissionDialog({
  busy,
  message,
  onEnable,
  onClose,
}: {
  busy: boolean;
  message: string;
  onEnable: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog title="Enable notifications?" onClose={onClose} dismissible={!busy}>
      <div className="px-2 pb-2">
        <p className="text-sm leading-6 text-[var(--muted)]">
          Alerts for expenses and payments involving you.
        </p>
        {message && (
          <p role="status" className="mt-3 text-sm text-[var(--ink-soft)]">
            {message}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button tone="quiet" onClick={onClose} disabled={busy}>
            Not now
          </Button>
          <Button onClick={onEnable} disabled={busy}>
            {busy ? "Enabling…" : "Enable"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
