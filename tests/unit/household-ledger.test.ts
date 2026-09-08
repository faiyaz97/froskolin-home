// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HouseholdLedger, type LedgerExpense } from "@/components/expenses/household-ledger";

const query = vi.hoisted(() => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
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

function expense(id: number): LedgerExpense {
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
  };
}

describe("home ledger pagination", () => {
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
});
