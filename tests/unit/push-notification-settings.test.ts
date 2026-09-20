// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfiguration: vi.fn(),
  getStatus: vi.fn(),
  register: vi.fn(),
  unregister: vi.fn(),
  requestPermission: vi.fn(),
}));

vi.mock("@/lib/actions/push", () => ({
  getPushConfigurationAction: mocks.getConfiguration,
  getPushSubscriptionStatusAction: mocks.getStatus,
  registerPushSubscriptionAction: mocks.register,
  unregisterPushSubscriptionAction: mocks.unregister,
}));

import {
  PushNotificationSettings,
  unregisterCurrentDevicePushSubscription,
} from "@/components/household/push-notification-settings";

const endpoint = "https://push.example/subscription-1";

function makeSubscription() {
  return {
    endpoint,
    toJSON: () => ({
      endpoint,
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> };
}

function setupBrowser(subscription: PushSubscription | null = null) {
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscription),
    subscribe: vi.fn().mockResolvedValue(subscription ?? makeSubscription()),
  };
  const registration = { pushManager, active: {} as ServiceWorker };
  const serviceWorker = {
    ready: Promise.resolve(registration),
    register: vi.fn().mockResolvedValue(registration),
    getRegistration: vi.fn().mockResolvedValue(registration),
  };
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 Chrome/140",
    platform: "Win32",
    maxTouchPoints: 0,
    serviceWorker,
  });
  vi.stubGlobal("PushManager", class PushManager {});
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: mocks.requestPermission,
  });
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  return { pushManager, registration, serviceWorker };
}

let promptUser = 0;
beforeEach(() => {
  promptUser += 1;
  window.localStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.clearAllMocks();
  mocks.getConfiguration.mockResolvedValue({
    ok: true,
    data: { publicKey: "AQID", userId: `user-${promptUser}` },
  });
  mocks.getStatus.mockResolvedValue({ ok: true, data: { enabled: false } });
  mocks.register.mockResolvedValue({ ok: true, data: undefined });
  mocks.unregister.mockResolvedValue({ ok: true, data: undefined });
  mocks.requestPermission.mockResolvedValue("granted");
  setupBrowser();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function findNotificationSwitch() {
  const toggle = await screen.findByRole("switch", { name: "Notifications on this device" });
  await waitFor(() => expect(toggle.hasAttribute("disabled")).toBe(false));
  return toggle;
}

describe("push notification settings", () => {
  it("does not request permission until the user explicitly enables notifications", async () => {
    const { pushManager, serviceWorker } = setupBrowser();
    render(React.createElement(PushNotificationSettings));

    const toggle = await findNotificationSwitch();
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(mocks.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(toggle);

    await waitFor(() => expect(mocks.requestPermission).toHaveBeenCalledOnce());
    expect(serviceWorker.register).toHaveBeenCalledWith("/push-sw.js", { scope: "/" });
    expect(pushManager.subscribe).toHaveBeenCalledOnce();
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps the device disabled when notification permission is denied", async () => {
    const { serviceWorker } = setupBrowser();
    mocks.requestPermission.mockResolvedValue("denied");
    render(React.createElement(PushNotificationSettings));

    fireEvent.click(await findNotificationSwitch());

    await screen.findByText(
      "Notifications are blocked. Allow them in your browser settings, then try again.",
    );
    expect(serviceWorker.register).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("shows a recoverable error when the server rejects the subscription", async () => {
    setupBrowser();
    mocks.register.mockResolvedValue({ ok: false, error: "Notifications are not available yet." });
    render(React.createElement(PushNotificationSettings));

    fireEvent.click(await findNotificationSwitch());

    await screen.findByText("Notifications are not available yet.");
    expect(
      screen
        .getByRole("switch", { name: "Notifications on this device" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("checks an existing browser subscription before showing the device as enabled", async () => {
    const subscription = makeSubscription();
    const { serviceWorker } = setupBrowser(subscription);
    mocks.getStatus.mockResolvedValue({ ok: true, data: { enabled: true } });
    render(React.createElement(PushNotificationSettings));

    expect((await findNotificationSwitch()).getAttribute("aria-checked")).toBe("true");
    expect(mocks.getStatus).toHaveBeenCalledWith({ endpoint });
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it("unregisters and unsubscribes the current device when disabled", async () => {
    const subscription = makeSubscription();
    setupBrowser(subscription);
    mocks.getStatus.mockResolvedValue({ ok: true, data: { enabled: true } });
    render(React.createElement(PushNotificationSettings));

    fireEvent.click(await findNotificationSwitch());

    await screen.findByText("Notifications are off on this device.");
    expect(mocks.unregister).toHaveBeenCalledWith({ endpoint });
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });

  it("cleans up the current browser subscription before sign-out", async () => {
    const subscription = makeSubscription();
    setupBrowser(subscription);

    await unregisterCurrentDevicePushSubscription();

    expect(mocks.unregister).toHaveBeenCalledWith({ endpoint });
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });
  it("waits for worker activation on first install", async () => {
    const { registration, serviceWorker, pushManager } = setupBrowser();
    registration.active = null as unknown as ServiceWorker;
    let activate!: (value: typeof registration) => void;
    serviceWorker.ready = new Promise((resolve) => {
      activate = resolve;
    });
    render(React.createElement(PushNotificationSettings));
    fireEvent.click(await findNotificationSwitch());
    await waitFor(() => expect(serviceWorker.register).toHaveBeenCalledOnce());
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    activate(registration);
    await waitFor(() => expect(pushManager.subscribe).toHaveBeenCalledOnce());
    expect((await findNotificationSwitch()).getAttribute("aria-checked")).toBe("true");
  });

  it("shows a recoverable configuration error after a network failure", async () => {
    mocks.getConfiguration.mockRejectedValue(new Error("Offline"));
    render(React.createElement(PushNotificationSettings));
    await screen.findByText("Could not check notifications. Refresh the page to try again.");
  });

  it("unsubscribes locally on sign-out even when server cleanup fails", async () => {
    const subscription = makeSubscription();
    setupBrowser(subscription);
    mocks.unregister.mockRejectedValue(new Error("Offline"));
    await unregisterCurrentDevicePushSubscription();
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
  });
});

describe("installed app notification prompt", () => {
  function installed() {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  }
  it("shows minimal copy and asks permission only after Enable", async () => {
    installed();
    render(React.createElement(PushNotificationSettings, { promptOnly: true }));
    await screen.findByRole("dialog", { name: "Enable notifications?" });
    expect(mocks.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("remembers Not now for this account and device", async () => {
    installed();
    const view = render(React.createElement(PushNotificationSettings, { promptOnly: true }));
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(window.localStorage.getItem(`froskolin:push-prompt:user-${promptUser}`)).toBe("1");
    view.unmount();
    render(React.createElement(PushNotificationSettings, { promptOnly: true }));
    await waitFor(() => expect(mocks.getConfiguration).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.requestPermission).not.toHaveBeenCalled();
  });
  it("does not prompt in a normal browser tab", async () => {
    render(React.createElement(PushNotificationSettings, { promptOnly: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.getConfiguration).not.toHaveBeenCalled();
  });
  it.each(["denied", "enabled", "unconfigured", "unsupported"])(
    "does not prompt when %s",
    async (state) => {
      const subscription = makeSubscription();
      setupBrowser(subscription);
      installed();
      if (state === "denied")
        vi.stubGlobal("Notification", {
          permission: "denied",
          requestPermission: mocks.requestPermission,
        });
      if (state === "enabled")
        mocks.getStatus.mockResolvedValue({ ok: true, data: { enabled: true } });
      if (state === "unconfigured")
        mocks.getConfiguration.mockResolvedValue({
          ok: true,
          data: { publicKey: null, userId: `user-${promptUser}` },
        });
      if (state === "unsupported") Reflect.deleteProperty(window, "PushManager");
      render(React.createElement(PushNotificationSettings, { promptOnly: true }));
      if (state !== "unsupported")
        await waitFor(() => expect(mocks.getConfiguration).toHaveBeenCalled());
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(mocks.requestPermission).not.toHaveBeenCalled();
    },
  );
});
