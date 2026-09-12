// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/household/settings-panel";

const { promote, demote, refresh } = vi.hoisted(() => ({
  promote: vi.fn(),
  demote: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions", () => ({ promoteMemberAction: promote, demoteAdminAction: demote }));

const props = {
  householdId: "group-one",
  home: {
    name: "Group",
    defaultCurrency: "EUR",
    formatLocale: "en-GB",
    houseCode: "FROSKO-9801",
    joinPin: "123456",
    joiningEnabled: true,
    landlordEnabled: false,
  },
  currentUserId: "user-one",
  isOwner: true,
  members: [
    {
      id: "one",
      userId: "user-one",
      name: "First",
      role: "owner" as const,
      removed: false,
      avatarColor: null,
    },
    {
      id: "two",
      userId: "user-two",
      name: "Second",
      role: "member" as const,
      removed: false,
      avatarColor: null,
    },
    {
      id: "three",
      userId: "user-three",
      name: "Third",
      role: "owner" as const,
      removed: false,
      avatarColor: null,
    },
    {
      id: "four",
      userId: "user-four",
      name: "Former",
      role: "member" as const,
      removed: true,
      avatarColor: null,
    },
  ],
  rules: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  promote.mockResolvedValue({ ok: true, data: undefined });
  demote.mockResolvedValue({ ok: true, data: undefined });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("group admin promotion", () => {
  it("confirms demotion and allows stepping down only while another admin remains", async () => {
    render(React.createElement(SettingsPanel, props));
    expect(screen.getByRole("button", { name: "Remove admin access for First" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove admin access for Third" }));
    expect(demote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove admin" }));
    await waitFor(() =>
      expect(demote).toHaveBeenCalledWith({ householdId: "group-one", memberId: "three" }),
    );
  });

  it("does not offer demotion for the last admin", () => {
    render(
      React.createElement(SettingsPanel, {
        ...props,
        members: props.members.filter((member) => member.id !== "three"),
      }),
    );
    expect(screen.queryByRole("button", { name: /Remove admin access/ })).toBeNull();
  });
  it("only offers promotion for another active regular member and confirms before saving", async () => {
    render(React.createElement(SettingsPanel, props));
    expect(screen.getAllByText(/^Admin/)).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Make Third admin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Make Former admin" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Make Second admin" }));
    expect(promote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Make admin" }));
    await waitFor(() =>
      expect(promote).toHaveBeenCalledWith({ householdId: "group-one", memberId: "two" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("does not offer promotion to regular members", () => {
    render(
      React.createElement(SettingsPanel, { ...props, isOwner: false, currentUserId: "user-two" }),
    );
    expect(screen.queryByRole("button", { name: /Make .* admin/ })).toBeNull();
  });
});
