// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SettlementForm } from "@/components/expenses/settlement-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/actions", () => ({
  saveSettlementAction: vi.fn(),
  updateSettlementAction: vi.fn(),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(cleanup);

describe("settlement form defaults", () => {
  it("accepts an exact suggested payment prefill", () => {
    render(
      React.createElement(SettlementForm, {
        householdId: "group-one",
        currentMemberId: "member-one",
        defaultReceivingMemberId: "member-two",
        defaultAmountCents: 150,
        defaultCurrency: "EUR",
        members: [
          { id: "member-one", name: "Andrea" },
          { id: "member-two", name: "Sam" },
        ],
      }),
    );

    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("1.50");
    expect((document.querySelector('input[name="payingMemberId"]') as HTMLInputElement).value).toBe(
      "member-one",
    );
    expect(
      (document.querySelector('input[name="receivingMemberId"]') as HTMLInputElement).value,
    ).toBe("member-two");
    expect((document.querySelector('input[name="currency"]') as HTMLInputElement).value).toBe(
      "EUR",
    );
  });

  it("swaps payer and receiver when the opposite member is selected", () => {
    render(
      React.createElement(SettlementForm, {
        householdId: "group-one",
        currentMemberId: "member-one",
        defaultReceivingMemberId: "member-two",
        defaultCurrency: "EUR",
        members: [
          { id: "member-one", name: "Andrea" },
          { id: "member-two", name: "Sam" },
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose payer" }));
    const sam = screen.getByRole("radio", { name: "Sam" });
    expect(sam.hasAttribute("disabled")).toBe(false);
    fireEvent.click(sam);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect((document.querySelector('input[name="payingMemberId"]') as HTMLInputElement).value).toBe(
      "member-two",
    );
    expect(
      (document.querySelector('input[name="receivingMemberId"]') as HTMLInputElement).value,
    ).toBe("member-one");
  });
});
