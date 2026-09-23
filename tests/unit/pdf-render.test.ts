import { describe, expect, it } from "vitest";

import { MAX_PREVIEW_PAGES, pdfRenderSize } from "@/lib/attachments/pdf-render";

describe("PDF attachment preview bounds", () => {
  it("keeps an ordinary four-page bill readable within the pixel budget", () => {
    const size = pdfRenderSize({
      pageCount: 4,
      pageWidth: 612,
      pageHeight: 792,
      availableWidth: 390 - 32,
      devicePixelRatio: 3,
    });

    expect(size.canvasWidth).toBeGreaterThan(600);
    expect(size.canvasWidth * size.canvasHeight).toBeLessThanOrEqual(2_000_000);
  });

  it("limits the combined pixel area for the longest supported bill", () => {
    const size = pdfRenderSize({
      pageCount: MAX_PREVIEW_PAGES,
      pageWidth: 612,
      pageHeight: 792,
      availableWidth: 1000,
      devicePixelRatio: 3,
    });

    expect(size.canvasWidth * size.canvasHeight * MAX_PREVIEW_PAGES).toBeLessThanOrEqual(
      12_000_000,
    );
  });

  it("rejects excessive pages and extreme page geometry", () => {
    const input = {
      pageCount: MAX_PREVIEW_PAGES + 1,
      pageWidth: 612,
      pageHeight: 792,
      availableWidth: 390,
      devicePixelRatio: 2,
    };
    expect(() => pdfRenderSize(input)).toThrow();
    expect(() => pdfRenderSize({ ...input, pageCount: 1, pageHeight: 0.01 })).toThrow();
  });
});
