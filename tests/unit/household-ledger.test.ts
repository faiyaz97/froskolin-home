// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  HouseholdLedger,
  type LedgerExpense,
  type LedgerLandlordPayment,
} from "@/components/expenses/household-ledger";

const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.neq.mockReturnValue(builder);
  builder.in.mockResolvedValue({ data: [], error: null });
  builder.is.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  return { builder };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => query.builder }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function expense(id: number, overrides: Partial<LedgerExpense> = {}): LedgerExpense {
  return {
    id: `expense-${id}`,
    title: `Expense ${id}`,
    total_cents: id * 100,
    currency: "EUR",
    payer_member_id: "member-one",
    paid_by_landlord: false,
    expense_date: `2026-09-${String(20 - id).padStart(2, "0")}`,
    created_at: `2026-09-${String(20 - id).padStart(2, "0")}T12:00:00Z`,
    kind: "manual",
    split_method: "equal",
    recurring_rule_id: null,
    expense_shares: [{ member_id: "member-one", share_cents: id * 100 }],
    utility_bills: null,
    ...overrides,
  };
}

describe("home ledger pagination", () => {
  it("shows an empty expense card when there are no transactions", () => {
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea" },
        expenses: [],
        settlements: [],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );
    expect(screen.getByText("No expenses yet")).toBeTruthy();
  });

  it("shows ten transactions before loading the next batch", async () => {
    query.builder.range.mockResolvedValue({ data: [expense(11)], error: null });
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea" },
        expenses: Array.from({ length: 10 }, (_, index) => expense(index + 1)),
        settlements: [],
        expenseHasMore: true,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    expect(screen.getAllByRole("link")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(11));
    expect(query.builder.range).toHaveBeenCalledWith(10, 20);
  });

  it("paginates past linked settlements without showing them twice", async () => {
    const linkedId = "linked-settlement";
    query.builder.range.mockResolvedValue({
      data: [
        {
          id: linkedId,
          paying_member_id: "member-one",
          receiving_member_id: "member-two",
          amount_cents: 100,
          currency: "EUR",
          settlement_date: "2026-09-24",
          created_at: "2026-09-24T12:00:00Z",
        },
      ],
      error: null,
    });
    query.builder.in.mockResolvedValue({ data: [{ linked_settlement_id: linkedId }], error: null });
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea", "member-two": "Bea" },
        expenses: [],
        settlements: [],
        settlementReadCount: 11,
        expenseHasMore: false,
        settlementHasMore: true,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(query.builder.in).toHaveBeenCalled());
    expect(query.builder.range).toHaveBeenCalledWith(11, 21);
    expect(screen.queryByText("Payment")).toBeNull();
  });

  it("labels an assigned member share as Your share", () => {
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea", "member-two": "Bea" },
        expenses: [
          expense(1, {
            payer_member_id: "member-two",
            total_cents: 2_000,
            expense_shares: [{ member_id: "member-one", share_cents: 1_000 }],
          }),
        ],
        settlements: [],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    expect(screen.getByText("Your share")).toBeTruthy();
    expect(screen.getByText("Your share").parentElement?.className).toContain(
      "text-[var(--peach)]",
    );
    expect(screen.queryByText("you owe")).toBeNull();
  });

  it("uses the same Your share label for landlord-paid bills", () => {
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea" },
        expenses: [
          expense(1, {
            paid_by_landlord: true,
            payer_member_id: null,
            total_cents: 2_000,
            expense_shares: [{ member_id: "member-one", share_cents: 1_000 }],
          }),
        ],
        settlements: [],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    expect(screen.getByText("Landlord paid €20.00")).toBeTruthy();
    expect(screen.getByText("Your share")).toBeTruthy();
    expect(screen.getByText("Your share").parentElement?.className).toContain(
      "text-[var(--peach)]",
    );
    expect(screen.queryByText("to landlord")).toBeNull();
  });

  it("labels a current payer's amount covered for others", () => {
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea" },
        expenses: [
          expense(1, {
            total_cents: 2_000,
            expense_shares: [{ member_id: "member-one", share_cents: 1_000 }],
          }),
        ],
        settlements: [],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    expect(screen.getByText("covered for others")).toBeTruthy();
    expect(screen.getByText("covered for others").parentElement?.className).toContain(
      "text-[var(--positive)]",
    );
    expect(screen.queryByText("you owe")).toBeNull();
  });

  it("keeps a self-paid expense's original share orange", () => {
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea" },
        expenses: [expense(1)],
        settlements: [],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    expect(screen.getByText("Your share").parentElement?.className).toContain(
      "text-[var(--peach)]",
    );
  });

  it("colors member payments by the current member's role", () => {
    const { container } = render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: {
          "member-one": "Andrea",
          "member-two": "Bea",
          "member-three": "Chris",
        },
        expenses: [],
        settlements: [
          {
            id: "outgoing",
            paying_member_id: "member-one",
            receiving_member_id: "member-two",
            amount_cents: 1_000,
            currency: "EUR",
            settlement_date: "2026-09-24",
            created_at: "2026-09-24T12:00:00Z",
          },
          {
            id: "incoming",
            paying_member_id: "member-two",
            receiving_member_id: "member-one",
            amount_cents: 2_000,
            currency: "EUR",
            settlement_date: "2026-09-23",
            created_at: "2026-09-23T12:00:00Z",
          },
          {
            id: "between-others",
            paying_member_id: "member-two",
            receiving_member_id: "member-three",
            amount_cents: 3_000,
            currency: "EUR",
            settlement_date: "2026-09-22",
            created_at: "2026-09-22T12:00:00Z",
          },
        ],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    const outgoing = container.querySelector('a[href$="/settlements/outgoing"]');
    const incoming = container.querySelector('a[href$="/settlements/incoming"]');
    const betweenOthers = container.querySelector('a[href$="/settlements/between-others"]');
    expect(outgoing?.textContent).toContain("Paid");
    expect(outgoing?.querySelector(".tabular-nums")?.parentElement?.className).toContain(
      "text-[var(--brand)]",
    );
    expect(outgoing?.querySelector("svg")?.parentElement?.className).toContain(
      "bg-[var(--brand-soft)] text-[var(--brand)]",
    );
    expect(incoming?.textContent).toContain("Received");
    expect(incoming?.querySelector(".tabular-nums")?.parentElement?.className).toContain(
      "text-[var(--positive)]",
    );
    expect(incoming?.querySelector("svg")?.parentElement?.className).toContain(
      "bg-[var(--positive-soft)] text-[var(--positive)]",
    );
    expect(betweenOthers?.textContent).not.toContain("Paid");
    expect(betweenOthers?.textContent).not.toContain("Received");
    expect(betweenOthers?.querySelector(".tabular-nums")?.parentElement?.className).toContain(
      "text-[var(--muted)]",
    );
    expect(betweenOthers?.querySelector("svg")?.parentElement?.className).toContain(
      "bg-[var(--soft-line)] text-[var(--muted)]",
    );
  });

  it("shows recent landlord transfers as one linked activity row", () => {
    const landlordPayments: LedgerLandlordPayment[] = [
      {
        id: "transfer-one",
        expenseId: "bill-one",
        title: "Gas bill",
        utilityType: "gas",
        currency: "EUR",
        amountCents: 5_000,
        paymentDate: "2026-09-24",
        createdAt: "2026-09-24T12:00:00Z",
        paidByMemberId: "member-one",
        paidByName: "Andrea",
        affectedBillCount: 2,
      },
    ];

    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea" },
        expenses: [],
        settlements: [],
        landlordPayments,
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    const link = screen.getByRole("link", { name: /Andrea paid bills.*Gas bill/ });
    expect(link.getAttribute("href")).toBe("/h/house-one/expenses/bill-one");
    expect(screen.getByText("Gas bill + 1 more")).toBeTruthy();
    expect(link.textContent).toContain("Paid");
    expect(link.querySelector(".tabular-nums")?.parentElement?.className).toContain(
      "text-[var(--brand)]",
    );
    expect(link.querySelector("svg")?.parentElement?.className).toContain(
      "bg-[var(--brand-soft)] text-[var(--brand)]",
    );
  });

  it("shows someone else's landlord payment with a neutral amount", () => {
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea", "member-two": "Bea" },
        expenses: [],
        settlements: [],
        landlordPayments: [
          {
            id: "transfer-two",
            expenseId: "bill-two",
            title: "Gas bill",
            utilityType: "gas",
            currency: "EUR",
            amountCents: 5_000,
            paymentDate: "2026-09-24",
            createdAt: "2026-09-24T12:00:00Z",
            paidByMemberId: "member-two",
            paidByName: "Bea",
            affectedBillCount: 1,
          },
        ],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );

    const link = screen.getByRole("link", { name: /Bea paid Gas.*Gas bill/ });
    expect(link.querySelector(".tabular-nums")?.parentElement?.className).toContain(
      "text-[var(--muted)]",
    );
    expect(link.querySelector("svg")?.parentElement?.className).toContain(
      "bg-[var(--soft-line)] text-[var(--muted)]",
    );
    expect(link.textContent).not.toContain("Received");
  });

  it("mixes bills and landlord payments in date order", () => {
    render(
      React.createElement(HouseholdLedger, {
        householdId: "house-one",
        currentMemberId: "member-one",
        memberNames: { "member-one": "Andrea" },
        expenses: [
          expense(1, {
            id: "bill-one",
            title: "Electricity May 26 - Jun 26",
            kind: "utility",
            created_at: "2026-09-22T12:00:00Z",
          }),
        ],
        settlements: [],
        landlordPayments: [
          {
            id: "transfer-one",
            expenseId: "bill-one",
            title: "Electricity May 26 - Jun 26",
            utilityType: "electricity",
            currency: "EUR",
            amountCents: 5000,
            paymentDate: "2026-09-24",
            createdAt: "2026-09-24T12:00:00Z",
            paidByMemberId: "member-one",
            paidByName: "Andrea",
            affectedBillCount: 1,
          },
        ],
        expenseHasMore: false,
        settlementHasMore: false,
        locale: "en-GB",
        timezone: "UTC",
      }),
    );
    const links = screen.getAllByRole("link");
    expect(links[0].textContent).toContain("Andrea paid Electricity");
    expect(links[0].textContent).toContain("Electricity May 26 - Jun 26");
    expect(links[1].textContent).toContain("Electricity May 26 - Jun 26");
  });
});
