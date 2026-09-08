// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpenseAttachmentAction } from "@/components/expenses/expense-attachment-action";
import {
  CurrencyAction,
  ExpenseSharingControls,
  participantSummary,
} from "@/components/expenses/expense-sharing-controls";
import { ParticipantDisclosure } from "@/components/expenses/participant-disclosure";
import { PayerSelect } from "@/components/expenses/payer-select";
import { ExpenseTools } from "@/components/expenses/expense-tools";
import { TransactionNoteAction } from "@/components/expenses/transaction-note-action";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(cleanup);

describe("expense quick controls", () => {
  it("formats participant names naturally and collapses a full household to Everyone", () => {
    const members = [
      { id: "one", name: "Andrea" },
      { id: "two", name: "Luca" },
      { id: "three", name: "Maya" },
    ];

    expect(participantSummary(members, new Set(["one", "two", "three"]))).toBe("Everyone");
    expect(participantSummary(members, new Set(["one", "two"]))).toBe("Andrea & Luca");
    expect(
      participantSummary(
        [...members, { id: "four", name: "Noah" }],
        new Set(["one", "two", "three"]),
      ),
    ).toBe("Andrea, Luca, & Maya");
  });

  it("uses a symbol button and applies a currency only when Done is pressed", () => {
    const onChange = vi.fn();
    render(React.createElement(CurrencyAction, { value: "EUR", onChange }));

    expect(screen.getByRole("button", { name: "Currency" }).textContent).toBe("€");
    fireEvent.click(screen.getByRole("button", { name: "Currency" }));
    const dialog = screen.getByRole("dialog", { name: "Currency" });
    expect(dialog.querySelector('[aria-label="Back"]')).toBeTruthy();
    expect(dialog.querySelector('[aria-label="Done"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /GBP/ }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith("GBP");
  });

  it("edits payer, participants, and split settings in separate dialogs", () => {
    const members = [
      { id: "andrea", name: "Andrea" },
      { id: "luca", name: "Luca" },
    ];
    const onPayerChange = vi.fn();
    const onSelectedChange = vi.fn();
    const onSplitChange = vi.fn();
    render(
      React.createElement(ExpenseSharingControls, {
        members,
        currentMemberId: "andrea",
        landlordEnabled: false,
        payer: "andrea",
        onPayerChange,
        selected: new Set(["andrea", "luca"]),
        onSelectedChange,
        method: "equal",
        amounts: {},
        percentages: {},
        onSplitChange,
        totalCents: 1200,
        currency: "EUR",
      }),
    );

    expect(screen.getByText(/Paid by/).parentElement?.textContent).toContain(
      "Paid by You split Equally with Everyone",
    );

    fireEvent.click(screen.getByRole("button", { name: "Paid by" }));
    expect(screen.getByRole("dialog", { name: "Paid by" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Luca" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onPayerChange).toHaveBeenCalledWith("luca");

    fireEvent.click(screen.getByRole("button", { name: "Split method" }));
    expect(screen.getByRole("dialog", { name: "Split expense" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Percentages" }));
    expect((screen.getByLabelText("Andrea percentage") as HTMLInputElement).value).toBe("50.00");
    expect((screen.getByLabelText("Luca percentage") as HTMLInputElement).value).toBe("50.00");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSplitChange).toHaveBeenCalledWith(
      "percentage",
      {},
      { andrea: "50.00", luca: "50.00" },
    );

    fireEvent.click(screen.getByRole("button", { name: "Split with" }));
    expect(screen.getByRole("dialog", { name: "Split with" })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Luca" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onSelectedChange).toHaveBeenCalledWith(new Set(["andrea"]));
  });

  it("summarizes participants as text and lets members be changed", () => {
    const onSelectedChange = vi.fn();
    render(
      React.createElement(ParticipantDisclosure, {
        members: [
          { id: "andrea", name: "Andrea" },
          { id: "luca", name: "Luca" },
        ],
        selected: new Set(["andrea", "luca"]),
        onSelectedChange,
      }),
    );

    expect(screen.getByText("Everyone")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /split with/i }));
    expect(screen.queryByRole("checkbox", { name: "Everyone" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: "Luca" }));
    expect(onSelectedChange).toHaveBeenCalledWith(new Set(["andrea"]));
  });

  it("shows You only in the selected payer, not in the list", () => {
    render(
      React.createElement(PayerSelect, {
        name: "payer",
        currentMemberId: "andrea",
        landlordEnabled: true,
        variant: "inline",
        members: [
          { id: "andrea", name: "Andrea" },
          { id: "luca", name: "Luca" },
        ],
      }),
    );
    expect(screen.getByRole("button", { name: "Paid by" }).textContent).toBe("You");
    fireEvent.click(screen.getByRole("button", { name: "Paid by" }));
    expect(screen.queryByRole("option", { name: /You/ })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Luca" }));
    expect(screen.getByRole("button", { name: "Paid by" }).textContent).toBe("Luca");
    fireEvent.click(screen.getByRole("button", { name: "Paid by" }));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Home" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(screen.getByRole("button", { name: "Paid by" }).textContent).toBe("You");
  });

  it("moves the utility actions above the keyboard's visual viewport", () => {
    const viewport = Object.assign(new EventTarget(), {
      height: window.innerHeight - 280,
      offsetTop: 20,
    });
    const previous = Object.getOwnPropertyDescriptor(window, "visualViewport");
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    try {
      render(React.createElement(ExpenseTools, null, "Tools"));
      expect(
        screen
          .getByRole("group", { name: "Expense tools" })
          .style.getPropertyValue("--keyboard-inset"),
      ).toBe("260px");
    } finally {
      cleanup();
      if (previous) Object.defineProperty(window, "visualViewport", previous);
      else Reflect.deleteProperty(window, "visualViewport");
    }
  });

  it("commits a transaction note from the shared dialog and shows its filled state", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      React.createElement(TransactionNoteAction, { value: "", onChange }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Add notes" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), {
      target: { value: "  Paid in cash  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onChange).toHaveBeenCalledWith("Paid in cash");

    rerender(React.createElement(TransactionNoteAction, { value: "Paid in cash", onChange }));
    expect(screen.getByRole("button", { name: "Edit notes" })).toBeTruthy();
  });

  it("uses an empty outline state and accepts a valid local attachment", () => {
    const onFileChange = vi.fn();
    const onError = vi.fn();
    render(
      React.createElement(ExpenseAttachmentAction, {
        removed: false,
        onFileChange,
        onRemove: vi.fn(),
        onError,
      }),
    );

    expect(screen.getByRole("button", { name: "Add attachment" })).toBeTruthy();
    const file = new File(["receipt"], "receipt.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Choose attachment"), {
      target: { files: [file] },
    });
    expect(onFileChange).toHaveBeenCalledWith(file);
    expect(onError).toHaveBeenCalledWith("");
  });
});
