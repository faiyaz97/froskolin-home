// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillWorkspace } from "@/components/bills/bill-workspace";

vi.mock("next/image", () => ({
  default: ({ alt, className }: { alt: string; className: string }) =>
    React.createElement("img", { alt, className }),
}));
vi.mock("@/components/bills/bill-confirmation", () => ({ BillConfirmation: () => null }));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AI bill loading dialog", () => {
  it("shows the mascot while extraction is pending, prevents dismissal, and closes on failure", async () => {
    let complete!: (response: unknown) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      ),
    );
    render(
      React.createElement(BillWorkspace, {
        householdId: "group",
        defaultCurrency: "EUR",
        locale: "en-GB",
        members: [],
        absences: [],
        currentMemberId: "member",
        landlordEnabled: false,
      }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [new File(["bill"], "bill.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Autofill" }));
    const dialog = screen.getByRole("dialog", { name: "Reading your bill" });
    expect(screen.getByAltText("Froskolin reading a bill")).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(
      (screen.getByRole("button", { name: "Close dialog" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent(dialog, new Event("cancel", { cancelable: true, bubbles: false }));
    fireEvent.click(dialog);
    expect(screen.getByRole("dialog")).toBeTruthy();
    complete({ ok: false, json: async () => ({ error: "Could not read bill" }) });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Could not read bill")).toBeTruthy();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
