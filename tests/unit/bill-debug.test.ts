import { describe, expect, it, vi } from "vitest";

import {
  BillExtractionDebugger,
  billDebugExtractionSnapshot,
  createDevelopmentBillExtractionDebugger,
} from "@/lib/bills/debug";
import { rawBill } from "../fixtures/bill-analysis";

describe("development bill extraction diagnostics", () => {
  it("keeps financial rows but removes invoice identity", () => {
    const snapshot = billDebugExtractionSnapshot(
      rawBill({
        supplier: "Private supplier",
        billNumber: "personal-number",
      }),
    );

    expect(snapshot).toMatchObject({
      supplier: "[omitted]",
      billNumber: "[omitted]",
      coverageComplete: true,
      lineItems: [
        expect.objectContaining({ id: "fixed", amountCents: 4000, classification: "fixed" }),
        expect.objectContaining({ id: "usage", amountCents: 6000, classification: "usage" }),
      ],
      vatLines: [],
    });
    expect(JSON.stringify(snapshot)).not.toContain("Private supplier");
    expect(JSON.stringify(snapshot)).not.toContain("personal-number");
  });

  it("logs the exact Gemini input mode without document content", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const debug = new BillExtractionDebugger("test");
    debug.preparation({
      bytes: new Uint8Array([1, 2, 3]),
      filename: "personal.pdf",
      mimeType: "application/pdf",
      pageCount: 4,
      pageImages: [
        { mimeType: "image/png", bytes: new Uint8Array([4]) },
        { mimeType: "image/png", bytes: new Uint8Array([5]) },
      ],
    });

    const output = String(log.mock.calls[0]?.[1]);
    expect(output).toContain('"pageCount":4');
    expect(output).toContain('"inputMode":"rendered_page_images"');
    expect(output).toContain('"renderedPageImageCount":2');
    expect(output).not.toContain("personal.pdf");
    log.mockRestore();
  });

  it("is disabled outside development", () => {
    expect(createDevelopmentBillExtractionDebugger("test")).toBeUndefined();
  });
});
