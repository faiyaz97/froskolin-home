// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HomeBalanceCard } from "@/components/household/home-balance-card";

afterEach(cleanup);

const baseProps = {
  householdId: "group-one",
  currency: "GBP",
  locale: "en-GB",
};

describe("HomeBalanceCard", () => {
  it.each([
    { amountCents: 1234, label: "You are owed", amount: "£12.34", color: "positive" },
    { amountCents: -1234, label: "You owe", amount: "£12.34", color: "negative" },
    { amountCents: 0, label: "All settled", amount: "£0.00", color: "ink-soft" },
    {
      amountCents: 123456789,
      label: "You are owed",
      amount: "£1,234,567.89",
      color: "positive",
    },
  ])(
    "shows the balance meaning for $amountCents cents",
    ({ amountCents, label, amount, color }) => {
      render(
        React.createElement(HomeBalanceCard, {
          ...baseProps,
          balances: [{ currency: "GBP", amountCents }],
        }),
      );

      const link = screen.getByRole("link", { name: `Open Balances. ${label} ${amount}` });
      expect(link.getAttribute("href")).toBe("/h/group-one/balances");
      expect(screen.getByText(amount).className).toContain(`text-[var(--${color})]`);
    },
  );

  it("labels each currency independently and falls back to a settled balance", () => {
    const { rerender } = render(
      React.createElement(HomeBalanceCard, {
        ...baseProps,
        balances: [
          { currency: "GBP", amountCents: 1000 },
          { currency: "EUR", amountCents: -500 },
        ],
      }),
    );
    expect(screen.getByRole("link").textContent).toContain("£10.00");
    expect(screen.getByRole("link").textContent).toContain("€5.00");
    expect(
      screen.getByRole("link", { name: "Open Balances. You are owed £10.00; You owe €5.00" }),
    ).toBeTruthy();

    rerender(React.createElement(HomeBalanceCard, { ...baseProps, balances: [] }));
    expect(screen.getByRole("link", { name: "Open Balances. All settled £0.00" })).toBeTruthy();
  });
});
