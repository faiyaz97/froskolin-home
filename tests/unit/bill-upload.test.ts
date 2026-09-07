// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BillUpload } from "@/components/bills/bill-upload";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("bill upload", () => {
  it("keeps the selected file local until confirmation", () => {
    const onPrepared = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      React.createElement(BillUpload, {
        onPrepared,
        onRemove: vi.fn(),
        onError: vi.fn(),
      }),
    );

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    const file = new File(["bill"], "utility.pdf", { type: "application/pdf" });
    fireEvent.change(input!, {
      target: {
        files: [file],
      },
    });

    expect(onPrepared).toHaveBeenCalledWith({ file });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("utility.pdf")).toBeTruthy();
    expect(screen.getByText(/tap for options/i)).toBeTruthy();
  });

  it("shows document actions for an existing bill", () => {
    render(
      React.createElement(BillUpload, {
        onPrepared: vi.fn(),
        onRemove: vi.fn(),
        onError: vi.fn(),
        initialFileName: "Current bill document",
        initialViewUrl: "/api/bills/document/view",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /bill document: current bill document/i }));

    expect(screen.getByRole("button", { name: /view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /replace/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove/i })).toBeTruthy();
  });
});
