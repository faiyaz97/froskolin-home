// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicForm } from "@/components/public/auth-form";
import { GroupInvitationAction } from "@/components/household/group-invitation-action";
import { createGroupInvitationUrl, parseGroupInvitationHash } from "@/lib/group-invitation";

const { join, replace, createImage } = vi.hoisted(() => ({
  join: vi.fn(),
  replace: vi.fn(),
  createImage: vi.fn(),
}));
vi.mock("@/lib/group-invitation-image", () => ({ createGroupInvitationImage: createImage }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/actions", () => ({
  joinHouseholdAction: join,
  createHouseholdAction: vi.fn(),
  loginAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  createImage.mockResolvedValue(new Blob(["image"], { type: "image/png" }));
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => "blob:invitation"),
      revokeObjectURL: vi.fn(),
    }),
  );
  window.history.replaceState(null, "", "/join#code=FROSKO-2847&pin=654321");
  join.mockResolvedValue({ ok: true, data: { householdId: "new-group" } });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("invitation sharing", () => {
  const props = {
    groupName: "Weekend group",
    houseCode: "FROSKO-2847",
    joinPin: "654321",
    joiningEnabled: true,
  };

  it("shares image and caption together, with an optional text fallback and no automatic second share", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: vi.fn(() => true) });
    render(React.createElement(GroupInvitationAction, props));
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    await screen.findByRole("img");
    expect(share).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share on WhatsApp" }));
    await waitFor(() => expect(share).toHaveBeenCalledOnce());
    const payload = share.mock.calls[0][0];
    expect(payload.files[0]).toBeInstanceOf(File);
    expect(payload.files[0].type).toBe("image/png");
    const invitationUrl = (screen.getByLabelText("Invitation link") as HTMLInputElement).value;
    const expectedText = `Join Weekend group on Froskolin!\n\nGroup code: FROSKO-2847\nGroup pin: 654321\n\n${invitationUrl}`;
    expect(payload.text).toBe(expectedText);
    await screen.findByRole("button", { name: "Share invitation text" });
    expect(share).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Share invitation text" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(share.mock.calls[1][0].text).toBe(expectedText);
    expect(share.mock.calls[1][0].files).toBeUndefined();
    expect(screen.queryByText(/localhost link/)).toBeNull();
  });

  it.each(["WhatsApp", "Telegram", "Instagram", "Facebook"])(
    "offers an honest image-download fallback for %s",
    async (target) => {
      vi.stubGlobal("navigator", {});
      render(React.createElement(GroupInvitationAction, props));
      fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
      await screen.findByRole("img");
      fireEvent.click(screen.getByRole("button", { name: `Share on ${target}` }));
      expect(screen.getByRole("status").textContent).toContain("Save the invitation image");
      const download = screen.getByRole("link", { name: "Download invitation image" });
      expect(download.getAttribute("download")).toBe("froskolin-invitation.png");
      const fallbackLink = screen.getByRole("link", {
        name: `Open ${target}${target === "Instagram" ? "" : " with link"}`,
      });
      expect(fallbackLink.getAttribute("rel")).toBe("noopener noreferrer");
      const fallbackUrl = new URL(fallbackLink.getAttribute("href")!);
      const invitationUrl = (screen.getByLabelText("Invitation link") as HTMLInputElement).value;
      const intro =
        "Join Weekend group on Froskolin!\n\nGroup code: FROSKO-2847\nGroup pin: 654321";
      if (target === "WhatsApp") {
        expect(fallbackUrl.searchParams.get("text")).toBe(`${intro}\n\n${invitationUrl}`);
      }
      if (target === "Telegram") {
        expect(fallbackUrl.searchParams.get("text")).toBe(intro);
        expect(fallbackUrl.searchParams.get("url")).toBe(invitationUrl);
      }
    },
  );

  it("does not treat cancelled sharing as an error or open a social site", async () => {
    vi.stubGlobal("navigator", {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError")),
    });
    render(React.createElement(GroupInvitationAction, props));
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "Share on Instagram" }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(screen.queryByRole("link", { name: "Open Instagram" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Share invitation text" })).toBeNull();
  });

  it("recovers a stalled share and ignores its late completion", async () => {
    let resolveShare!: () => void;
    const share = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveShare = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    render(React.createElement(GroupInvitationAction, props));
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    await screen.findByRole("img");
    vi.useFakeTimers();
    const button = screen.getByRole("button", { name: "Share on WhatsApp" }) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(share).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(15000);
    });
    expect(button.disabled).toBe(false);
    expect(screen.getByRole("link", { name: "Open WhatsApp with link" })).toBeTruthy();
    await act(async () => {
      resolveShare();
    });
    expect(screen.queryByRole("button", { name: "Share invitation text" })).toBeNull();
    await act(async () => {
      fireEvent.click(button);
    });
    expect(share).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Share invitation text" })).toBeTruthy();
  });

  it("recovers after the native share API throws synchronously", async () => {
    const share = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new DOMException("Busy", "InvalidStateError");
      })
      .mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });
    render(React.createElement(GroupInvitationAction, props));
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    await screen.findByRole("img");
    const button = screen.getByRole("button", { name: "Share on Telegram" }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(false);
    expect(screen.getByRole("link", { name: "Open Telegram with link" })).toBeTruthy();
    fireEvent.click(button);
    await screen.findByRole("button", { name: "Share invitation text" });
  });

  it("lets image rendering retry without disabling link copying", async () => {
    createImage.mockRejectedValueOnce(new Error("Asset unavailable"));
    render(React.createElement(GroupInvitationAction, props));
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    await screen.findByText("The invitation image could not be created.");
    expect((screen.getByRole("button", { name: "Copy link" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("img");
    expect(createImage).toHaveBeenCalledTimes(2);
  });

  it("copies a link using the current address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(React.createElement(GroupInvitationAction, props));
    fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
    const link = (screen.getByLabelText("Invitation link") as HTMLInputElement).value;
    expect(new URL(link).origin).toBe(window.location.origin);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(link));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copied."));
  });

  it.each([false, true])(
    "offers manual copy when clipboard is unavailable or rejected: %s",
    async (rejects) => {
      vi.stubGlobal(
        "navigator",
        rejects ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("Denied")) } } : {},
      );
      render(React.createElement(GroupInvitationAction, props));
      fireEvent.click(screen.getByRole("button", { name: "Invite members" }));
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
      await waitFor(() => expect(screen.getByRole("status").textContent).toContain("manually"));
      const input = screen.getByLabelText("Invitation link") as HTMLInputElement;
      expect(document.activeElement).toBe(input);
      expect(input.selectionEnd).toBe(input.value.length);
    },
  );

  it.each([{ joiningEnabled: false }, { joinPin: "" }, { disabled: true }])(
    "disables invitation creation when unavailable: %j",
    (override) => {
      render(React.createElement(GroupInvitationAction, { ...props, ...override }));
      expect(
        (screen.getByRole("button", { name: "Invite members" }) as HTMLButtonElement).disabled,
      ).toBe(true);
    },
  );
});

describe("invitation join form", () => {
  it.each(["http://localhost:3000", "http://192.168.1.11:3000", "https://example.com"])(
    "keeps invitation credentials out of the HTTP query on %s",
    (origin) => {
      const url = new URL(
        createGroupInvitationUrl({ origin, houseCode: "FROSKO-2847", joinPin: "654321" }),
      );
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe("/join");
      expect(url.search).toBe("");
      expect(parseGroupInvitationHash(url.hash)).toEqual({ code: "FROSKO-2847", pin: "654321" });
    },
  );
  it("prefills only group credentials under StrictMode and waits for explicit submission", async () => {
    render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(PublicForm, { kind: "join" }),
      ),
    );
    await waitFor(() =>
      expect((screen.getByLabelText("Group code") as HTMLInputElement).value).toBe("FROSKO-2847"),
    );
    expect((screen.getByLabelText("Group PIN") as HTMLInputElement).value).toBe("654321");
    expect((screen.getByLabelText("Personal PIN") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe("");
    expect(join).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Group code"), { target: { value: "OTHER-1234" } });
    fireEvent.change(screen.getByLabelText("Group PIN"), { target: { value: "112233" } });
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Sam" } });
    fireEvent.change(screen.getByLabelText("Personal PIN"), { target: { value: "998877" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() =>
      expect(join).toHaveBeenCalledWith({
        houseCode: "OTHER-1234",
        joinPin: "112233",
        displayName: "Sam",
        pin: "998877",
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/h/new-group"));
  });

  it.each([
    "#code=%3Cscript%3E&pin=654321",
    "#code=FROSKO-2847&pin=invalid",
    "#code=FROSKO-2847",
    "#pin=654321",
  ])("ignores malformed or incomplete invitations: %s", async (hash) => {
    window.history.replaceState(null, "", `/join${hash}`);
    render(React.createElement(PublicForm, { kind: "join" }));
    await waitFor(() =>
      expect((screen.getByLabelText("Group code") as HTMLInputElement).value).toBe(""),
    );
    expect((screen.getByLabelText("Group PIN") as HTMLInputElement).value).toBe("");
    expect(join).not.toHaveBeenCalled();
  });

  it.each(["login", "create"] as const)(
    "does not prefill %s credentials from an invitation",
    (kind) => {
      render(React.createElement(PublicForm, { kind }));
      expect((screen.getByLabelText("Personal PIN") as HTMLInputElement).value).toBe("");
      const code = screen.queryByLabelText("Group code") as HTMLInputElement | null;
      const pin = screen.queryByLabelText("Group PIN") as HTMLInputElement | null;
      if (code) expect(code.value).toBe("");
      if (pin) expect(pin.value).toBe("");
    },
  );
});
