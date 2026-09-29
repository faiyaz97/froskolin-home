// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BalanceView } from "@/components/expenses/balance-view";

HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};

const mocks = vi.hoisted(() => ({
  record: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/actions", () => ({ recordSuggestedPaymentAction: mocks.record }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BalanceView", () => {
  it("shows the member tree including landlord and confirms only the current user's payment", async () => {
    render(
      React.createElement(BalanceView, {
        householdId: "group-one",
        currentMemberId: "admin",
        locale: "en-GB",
        strategyLabel: "Combined",
        members: [
          { id: "admin", name: "Admin", avatarColor: null },
          { id: "schiavo", name: "Schiavo", avatarColor: null },
        ],
        balances: [
          { memberId: "admin", currency: "GBP", amountCents: -3034 },
          { memberId: "schiavo", currency: "GBP", amountCents: -2000 },
        ],
        suggestions: [
          { fromMemberId: "admin", toMemberId: "landlord", currency: "GBP", amountCents: 3034 },
          { fromMemberId: "schiavo", toMemberId: "landlord", currency: "GBP", amountCents: 2000 },
        ],
      }),
    );
    expect(screen.getAllByText("Landlord").length).toBeGreaterThan(0);
    expect(screen.getAllByText("£30.34").length).toBeGreaterThan(0);
    expect(screen.getAllByText("£20.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Combined")).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Members" })).queryByRole("button"),
    ).toBeNull();
    expect(screen.getAllByRole("button", { name: "Settle up" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Settle up" }));
    expect(screen.getByText(/Record that you paid Landlord £30.34/)).toBeTruthy();
    expect(mocks.record).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm payment" }));
    await waitFor(() =>
      expect(mocks.record).toHaveBeenCalledWith({
        householdId: "group-one",
        receivingMemberId: "landlord",
        amountCents: 3034,
        currency: "GBP",
      }),
    );
  });
});
