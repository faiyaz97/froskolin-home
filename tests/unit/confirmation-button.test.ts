// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmationButton } from "@/components/ui/confirmation-button";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(cleanup);

describe("ConfirmationButton", () => {
  it("requires an explicit confirmation before running a sensitive action", async () => {
    const action = vi.fn();
    render(
      React.createElement(ConfirmationButton, {
        title: "Remove this item?",
        description: "This item will be removed.",
        confirmLabel: "Remove",
        triggerLabel: "Remove item",
        onConfirmAction: action,
        children: "Open",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove item" }));
    expect(screen.getByRole("dialog", { name: "Remove this item?" })).toBeTruthy();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Remove this item?" })).toBeNull();
    expect(action).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove item" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });
});
