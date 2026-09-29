// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/household/settings-panel";

const { promote, demote, updateGroup, updateDates, leaveGroup, refresh, replace } = vi.hoisted(
  () => ({
    promote: vi.fn(),
    demote: vi.fn(),
    updateGroup: vi.fn(),
    updateDates: vi.fn(),
    leaveGroup: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace }) }));
vi.mock("@/lib/actions", () => ({
  promoteMemberAction: promote,
  demoteAdminAction: demote,
  updateHouseholdAction: updateGroup,
  updateMemberBillingDatesAction: updateDates,
  leaveGroupAction: leaveGroup,
}));

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
    balanceStrategy: "simplified" as const,
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
      inDate: "2026-01-02",
      outDate: null,
    },
    {
      id: "two",
      userId: "user-two",
      name: "Second",
      role: "member" as const,
      removed: false,
      avatarColor: null,
      inDate: "2026-01-02",
      outDate: null,
    },
    {
      id: "three",
      userId: "user-three",
      name: "Third",
      role: "owner" as const,
      removed: false,
      avatarColor: null,
      inDate: "2026-01-02",
      outDate: "2026-03-31",
    },
    {
      id: "four",
      userId: "user-four",
      name: "Former",
      role: "member" as const,
      removed: true,
      avatarColor: null,
      inDate: "2026-01-02",
      outDate: "2026-02-01",
    },
  ],
  rules: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  promote.mockResolvedValue({ ok: true, data: undefined });
  demote.mockResolvedValue({ ok: true, data: undefined });
  updateGroup.mockResolvedValue({ ok: true, data: undefined });
  updateDates.mockResolvedValue({ ok: true, data: undefined });
  leaveGroup.mockResolvedValue({ ok: true, data: undefined });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("Balance Mode defaults", () => {
  it("follows the Landlord toggle from Simplified to Combined and back", async () => {
    render(React.createElement(SettingsPanel, props));
    expect(screen.getByText("Balance Mode").closest("button")?.textContent).toContain("Simplified");

    fireEvent.click(screen.getByRole("switch", { name: "Landlord mode" }));
    await waitFor(() =>
      expect(screen.getByText("Balance Mode").closest("button")?.textContent).toContain("Combined"),
    );
    expect(updateGroup).toHaveBeenCalledWith(expect.objectContaining({ landlordEnabled: true }));

    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Landlord mode" }).hasAttribute("disabled")).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Landlord mode" }));
    await waitFor(() =>
      expect(screen.getByText("Balance Mode").closest("button")?.textContent).toContain(
        "Simplified",
      ),
    );
    expect(updateGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({ landlordEnabled: false }),
    );
  });
});

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

describe("member bill dates and departure", () => {
  it("shows each member's in/out dates and lets an admin edit them", async () => {
    render(React.createElement(SettingsPanel, props));
    expect(
      screen.getByText((_, element) => element?.textContent === "Admin · in 02/01/26"),
    ).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Admin · in 02/01/26 and out 31/03/26",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Edit billing dates for Third" }));
    fireEvent.click(screen.getByRole("button", { name: "Out date" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(updateDates).toHaveBeenCalledWith({
        householdId: "group-one",
        memberId: "three",
        inDate: "2026-01-02",
        outDate: null,
      }),
    );
  });

  it("confirms before leaving the group", async () => {
    render(React.createElement(SettingsPanel, props));
    fireEvent.click(screen.getByRole("button", { name: "Leave group" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Leave group" })[1]);
    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith({ householdId: "group-one" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("shows a failed leave action in a dismissible dialog", async () => {
    leaveGroup.mockResolvedValue({
      ok: false,
      error: "Settle every balance before leaving this group.",
    });
    render(React.createElement(SettingsPanel, props));
    fireEvent.click(screen.getByRole("button", { name: "Leave group" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Leave group" })[1]);

    await waitFor(() =>
      expect(screen.getByRole("dialog", { name: "Something went wrong" })).toBeTruthy(),
    );
    expect(screen.getByRole("alert").textContent).toContain("Settle every balance");
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Something went wrong" })).toBeNull(),
    );
  });
});
