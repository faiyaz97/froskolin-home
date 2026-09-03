import "server-only";

import { createCanvas } from "@napi-rs/canvas";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { BillExtractionError, type PreparedBillDocument } from "./bill-extractor";

// The upload currently passes through a Vercel Function, whose request-body
// ceiling is 4.5 MB. Four MiB leaves room for multipart framing.
export const MAX_BILL_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_BILL_PAGES = 10;
export const acceptedBillMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const);

type BillMimeType = PreparedBillDocument["mimeType"];

function isAcceptedMimeType(value: string): value is BillMimeType {
  return acceptedBillMimeTypes.has(value as BillMimeType);
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi, "[bank identifier redacted]")
    .replace(
      /\b(account|customer|client|tax|fiscal|meter)\s*(number|no\.?|id|code)?\s*[:#-]?\s*[A-Z0-9-]{6,}\b/gi,
      "$1 $2: [redacted]",
    );
}

function usefulText(value: string): boolean {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length >= 120 && /\d/.test(compact) && /[A-Za-z]{4}/.test(compact);
}

async function preparePdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  try {
    if (pdf.numPages > MAX_BILL_PAGES) {
      throw new BillExtractionError("Bills must have 10 pages or fewer.");
    }

    const textParts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      textParts.push(
        content.items
          .flatMap((item) => ("str" in item && typeof item.str === "string" ? [item.str] : []))
          .join(" "),
      );
    }
    const extractedText = redactSensitiveText(textParts.join("\n")).slice(0, 30_000);
    if (usefulText(extractedText)) {
      return { pageCount: pdf.numPages, extractedText, pageImages: undefined };
    }

    const pageImages: Array<{ mimeType: "image/png"; bytes: Uint8Array }> = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.6, 2200 / Math.max(baseViewport.width, baseViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;
      pageImages.push({
        mimeType: "image/png",
        bytes: new Uint8Array(canvas.toBuffer("image/png")),
      });
    }
    return { pageCount: pdf.numPages, extractedText: undefined, pageImages };
  } finally {
    await loadingTask.destroy();
  }
}

export async function prepareBillUpload(file: File): Promise<PreparedBillDocument> {
  if (!file.size) throw new BillExtractionError("Choose a non-empty bill file.");
  if (file.size > MAX_BILL_FILE_BYTES)
    throw new BillExtractionError("Bills must be 4 MiB or smaller.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(bytes);
  const mimeType = detected?.mime ?? file.type;
  if (!isAcceptedMimeType(mimeType)) {
    throw new BillExtractionError("Upload a PDF, JPEG, PNG, or WebP bill.");
  }
  if (mimeType === "application/pdf") {
    const preparedPdf = await preparePdf(bytes);
    return {
      bytes,
      mimeType,
      filename: file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150) || "bill.pdf",
      ...preparedPdf,
    };
  }

  // Re-encoding strips EXIF/XMP and bounds pixel dimensions before any AI call.
  const sanitizedImage = await sharp(bytes)
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    bytes: new Uint8Array(sanitizedImage),
    mimeType: "image/png",
    filename: file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150) || "bill",
  };
}

/** Prevent raw upstream/provider errors and personal document content leaking to UI/logs. */
export function sanitizeBillError(error: unknown): string {
  if (error instanceof BillExtractionError) return error.message;
  return "We couldn't extract this bill. You can fill in the details manually.";
}
