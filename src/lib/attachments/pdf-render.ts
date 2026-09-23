export const MAX_PREVIEW_PAGES = 16;

const MAX_PAGE_PIXELS = 2_000_000;
const MAX_DOCUMENT_PIXELS = 12_000_000;

export function pdfRenderSize({
  pageCount,
  pageWidth,
  pageHeight,
  availableWidth,
  devicePixelRatio,
}: {
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
  availableWidth: number;
  devicePixelRatio: number;
}) {
  if (
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > MAX_PREVIEW_PAGES ||
    !Number.isFinite(pageWidth) ||
    !Number.isFinite(pageHeight) ||
    pageWidth <= 0 ||
    pageHeight <= 0
  ) {
    throw new Error("This PDF is too large to preview.");
  }

  const scale = Math.min(1.5, Math.min(availableWidth, 800) / pageWidth, 1200 / pageHeight);
  const width = pageWidth * scale;
  const height = pageHeight * scale;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 32 || height < 32) {
    throw new Error("This PDF page cannot be previewed.");
  }

  const pixelBudget = Math.min(MAX_PAGE_PIXELS, Math.floor(MAX_DOCUMENT_PIXELS / pageCount));
  const pixelRatio = Math.min(
    Math.max(1, devicePixelRatio || 1),
    2,
    Math.sqrt(pixelBudget / (width * height)),
  );
  return {
    scale,
    pixelRatio,
    canvasWidth: Math.max(1, Math.floor(width * pixelRatio)),
    canvasHeight: Math.max(1, Math.floor(height * pixelRatio)),
  };
}
