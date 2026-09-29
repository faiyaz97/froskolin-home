// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LandlordBalanceView } from "@/components/expenses/landlord-balance-view";
import type { LandlordBillBalance } from "@/lib/queries";

afterEach(cleanup);

describe("landlord balance view", () => {
  it("shows the full bill ledger, outstanding payment link, and individual payment history", () => {
    const rows: LandlordBillBalance[] = [
      {
        expenseId: "outstanding",
        title: "Gas bill",
        currency: "EUR",
        expenseDate: "2026-09-08",
        originalShareCents: 3_353,
        paidCents: 1_000,
        remainingCents: 2_353,
        utilityType: "gas",
        payments: [{ id: "payment-1", amountCents: 1_000, paymentDate: "2026-09-09" }],
      },
      {
        expenseId: "paid",
        title: "Paid bill",
        currency: "EUR",
        expenseDate: "2026-09-01",
        originalShareCents: 2_000,
        paidCents: 2_000,
        remainingCents: 0,
        utilityType: null,
        payments: [
          { id: "payment-2", amountCents: 1_000, paymentDate: "2026-09-02" },
          { id: "payment-3", amountCents: 1_000, paymentDate: "2026-09-03" },
        ],
      },
    ];

    render(
      React.createElement(LandlordBalanceView, {
        householdId: "group-one",
        currentMemberId: "member-one",
        locale: "en-GB",
        rows,
      }),
    );

    expect(screen.getByText("Outstanding")).toBeTruthy();
    expect(screen.getAllByText("Original share")).toHaveLength(2);
    expect(screen.getAllByText("Paid")).toHaveLength(2);
    expect(screen.getAllByText("Remaining")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Record payment" }).getAttribute("href")).toBe(
      "/h/group-one/add/settlement?source=landlord&payingMemberId=member-one&receivingMemberId=landlord&amountCents=2353&currency=EUR",
    );

    expect(screen.getAllByRole("link", { name: "Gas bill" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Gas bill" })[0]?.getAttribute("href")).toBe(
      "/h/group-one/expenses/outstanding",
    );
    expect(screen.getAllByRole("link", { name: "Paid bill" })).toHaveLength(3);
    expect(screen.getByText("€33.53")).toBeTruthy();
    expect(screen.getAllByText("€23.53")).toHaveLength(2);
    expect(screen.getAllByText("€10.00")).toHaveLength(4);
    expect(screen.getAllByText("€20.00")).toHaveLength(2);
    expect(screen.getByText("Payment history")).toBeTruthy();
    expect(screen.getByText(/9 Sept 2026/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark paid" })).toBeNull();
    expect(screen.queryByText(/Reopen/)).toBeNull();
  });

  it("shows who paid when an All payment covers another member's share", () => {
    render(
      React.createElement(LandlordBalanceView, {
        householdId: "group-one",
        currentMemberId: "member-one",
        locale: "en-GB",
        rows: [],
        paymentHistory: [
          {
            id: "cross-payment",
            expenseId: "gas-bill",
            title: "Gas bill",
            currency: "EUR",
            amountCents: 2_000,
            paymentDate: "2026-09-09",
            paidByMemberId: "member-one",
            paidByName: "You",
            beneficiaryMemberId: "member-two",
            beneficiaryName: "Alex",
          },
        ],
      }),
    );
    expect(screen.getByText(/You paid for Alex's share/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Gas bill" })).toBeTruthy();
  });
});
