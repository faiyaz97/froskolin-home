import type { ExtractedBill } from "@/lib/validation";

export type PreparedBillDocument = {
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  bytes: Uint8Array;
  /** Sanitized plain PDF text when it is substantial enough for extraction. */
  extractedText?: string;
  /** Metadata-free page images used when a PDF has no useful text layer. */
  pageImages?: Array<{ mimeType: "image/png"; bytes: Uint8Array }>;
  pageCount?: number;
  filename: string;
};

export interface BillExtractor {
  extract(document: PreparedBillDocument): Promise<ExtractedBill>;
}

export class BillExtractionError extends Error {
  constructor(message = "We couldn't read this bill. You can enter it manually instead.") {
    super(message);
    this.name = "BillExtractionError";
  }
}
