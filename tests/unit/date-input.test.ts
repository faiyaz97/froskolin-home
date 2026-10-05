// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DateInput } from "@/components/ui/date-input";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(cleanup);

describe("DateInput", () => {
  it("jumps directly to a selected year and month while keeping date selection available", () => {
    const { container } = render(
      React.createElement(DateInput, {
        name: "serviceStart",
        ariaLabel: "Service start date",
        defaultValue: "2026-10-05",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Service start date" }));
    const dialog = screen.getByRole("dialog", { name: "Choose service start date" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Choose year" }));
    fireEvent.click(within(dialog).getByRole("option", { name: "2024" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Choose month" }));
    fireEvent.click(within(dialog).getByRole("option", { name: "Jan" }));

    expect(within(dialog).getByRole("button", { name: "Choose month" }).textContent).toContain(
      "Jan",
    );
    expect(within(dialog).getByRole("button", { name: "Choose year" }).textContent).toContain(
      "2024",
    );
    fireEvent.click(within(dialog).getByText("15"));
    expect(container.querySelector<HTMLInputElement>('input[name="serviceStart"]')?.value).toBe(
      "2024-01-15",
    );
    expect(screen.queryByRole("dialog", { name: "Choose service start date" })).toBeNull();
  });
});
