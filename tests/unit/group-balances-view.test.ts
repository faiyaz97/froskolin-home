// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GroupBalancesView } from "@/components/expenses/group-balances-view";

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

const props = {
  householdId: "group-one",
  currentMemberId: "member-b",
  locale: "en-GB",
  members: [
    { id: "member-a", name: "Andrea", avatarColor: null },
    { id: "member-b", name: "Bill", avatarColor: null },
    { id: "member-c", name: "Casey", avatarColor: null },
  ],
  balances: [
    { memberId: "member-a", currency: "EUR", amountCents: 100 },
    { memberId: "member-b", currency: "EUR", amountCents: -50 },
    { memberId: "member-c", currency: "EUR", amountCents: -50 },
  ],
  pairBalances: [
    {
      payingMemberId: "member-b",
      receivingMemberId: "member-c",
      currency: "EUR",
      amountCents: 50,
    },
    {
      payingMemberId: "member-c",
      receivingMemberId: "member-a",
      currency: "EUR",
      amountCents: 100,
    },
  ],
};

describe("group balance modes", () => {
  it("uses the selected breakdown for both rows and settlement links", () => {
    render(
      React.createElement(GroupBalancesView, {
        ...props,
      }),
    );

    const modeSwitch = screen.getByRole("switch", { name: "Use simplified balances" });
    expect(modeSwitch.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("link", { name: "Settle up" }).getAttribute("href")).toContain(
      "receivingMemberId=member-a",
    );

    fireEvent.click(modeSwitch);

    expect(modeSwitch.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Actual")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Settle up" }).getAttribute("href")).toContain(
      "receivingMemberId=member-c",
    );
    expect(window.localStorage.getItem("froskolin:balance-mode:group-one:member-b")).toBe("actual");
  });

  it("restores the last mode for the current member and group", () => {
    window.localStorage.setItem("froskolin:balance-mode:group-one:member-b", "actual");

    render(React.createElement(GroupBalancesView, props));

    expect(
      screen.getByRole("switch", { name: "Use simplified balances" }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(screen.getByText("Actual")).toBeTruthy();
  });
});
