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

    render(React.createElement(BillUpload, { onPrepared }));

    const input = screen.getByLabelText(/choose a bill/i);
    const file = new File(["bill"], "utility.pdf", { type: "application/pdf" });
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    expect(onPrepared).toHaveBeenCalledWith({ file });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("utility.pdf")).toBeTruthy();
    expect(screen.getByText(/tap to change/i)).toBeTruthy();
  });
});
