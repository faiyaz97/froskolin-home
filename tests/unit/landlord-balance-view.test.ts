// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandlordBalanceView } from "@/components/expenses/landlord-balance-view";
import type { LandlordBillBalance } from "@/lib/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  recordLandlordPaymentAction: vi.fn(),
  reopenLandlordBillAction: vi.fn(),
}));

afterEach(cleanup);

function paidBill(index: number): LandlordBillBalance {
  const date = `2026-09-0${index}`;
  return {
    expenseId: `paid-${index}`,
    title: `Paid bill ${index}`,
    currency: "EUR",
    expenseDate: date,
    originalShareCents: 1_000,
    paidCents: 1_000,
    remainingCents: 0,
    utilityType: index === 7 ? "gas" : null,
    payments: [{ id: `payment-${index}`, amountCents: 1_000, paymentDate: date }],
  };
}

describe("landlord balance view", () => {
  it("keeps outstanding rows compact and shows only the latest five paid bills", () => {
    const outstanding: LandlordBillBalance = {
      expenseId: "outstanding",
      title: "Gas bill with an exceptionally long supplier reference that must remain readable",
      currency: "EUR",
      expenseDate: "2026-09-08",
      originalShareCents: 3_353,
      paidCents: 0,
      remainingCents: 3_353,
      utilityType: "gas",
      payments: [],
    };

    render(
      React.createElement(LandlordBalanceView, {
        householdId: "group-one",
        locale: "en-GB",
        rows: [outstanding, ...Array.from({ length: 7 }, (_, index) => paidBill(index + 1))],
      }),
    );

    expect(screen.queryByText("left", { exact: true })).toBeNull();
    expect(screen.queryByText(/Paid .* of/)).toBeNull();
    const markPaid = screen.getByRole("button", { name: "Mark paid" });
    expect(markPaid.className).toContain("size-9");
    expect(markPaid.className).toContain("rounded-full");
    expect(markPaid.getAttribute("title")).toBe("Mark paid");
    expect(markPaid.textContent).toBe("");
    expect(markPaid.parentElement?.className).toContain("items-center");
    expect(
      screen.getByRole("link", {
        name: "Gas bill with an exceptionally long supplier reference that must remain readable",
      }).className,
    ).toContain("line-clamp-2");
    expect(screen.queryByText("Paid bill 1", { exact: true })).toBeNull();
    expect(screen.queryByText("Paid bill 2", { exact: true })).toBeNull();
    expect(screen.getByText("Paid bill 7", { exact: true })).toBeTruthy();
    expect(document.querySelectorAll('[data-utility-type="gas"]')).toHaveLength(2);
  });
});
