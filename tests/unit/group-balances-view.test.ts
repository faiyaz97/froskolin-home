// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GroupBalancesView } from "@/components/expenses/group-balances-view";

afterEach(cleanup);

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
  it("uses the persisted simplified strategy for member suggestions", () => {
    render(
      React.createElement(GroupBalancesView, {
        ...props,
        strategy: "simplified",
      }),
    );
    expect(screen.getByRole("link", { name: "Settle up" }).getAttribute("href")).toContain(
      "receivingMemberId=member-a",
    );
  });

  it.each(["default", "super_simplified"] as const)(
    "keeps real group debts under %s strategy",
    (strategy) => {
      render(React.createElement(GroupBalancesView, { ...props, strategy }));
      expect(screen.getByRole("link", { name: "Settle up" }).getAttribute("href")).toContain(
        "receivingMemberId=member-c",
      );
    },
  );
});
