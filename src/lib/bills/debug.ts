import "server-only";

import type { ExtractedBill, StructuredBillExtraction } from "@/lib/validation";

import type { PreparedBillDocument } from "./bill-extractor";
import { redactSensitiveText } from "./preprocessing";

type ExtractionStage = "initial" | "repair-returned" | "repair-accepted";
type CalculationStage = "initial" | "after-repair";
type GeminiPass = "initial" | "repair";

/**
 * Preserve financial/extraction diagnostics while excluding invoice identity fields.
 * Row labels have already been redacted by the extractor and are redacted again
 * here. Free-form evidence is omitted because it can quote personal bill content.
 */
export function billDebugExtractionSnapshot(extraction: StructuredBillExtraction) {
  return {
    schemaVersion: extraction.schemaVersion,
    supplier: extraction.supplier ? "[omitted]" : null,
    utilityType: extraction.utilityType,
    billNumber: extraction.billNumber ? "[omitted]" : null,
    issueDate: extraction.issueDate,
    servicePeriod: extraction.servicePeriod,
    totalDueCents: extraction.totalDueCents,
    currency: extraction.currency,
    consumption: extraction.consumption,
    coverageComplete: extraction.coverageComplete,
    lineItems: extraction.lineItems.map((row) => ({
      ...row,
      originalLabel: redactSensitiveText(row.originalLabel),
      evidence: row.evidence ? "[omitted]" : null,
    })),
    vatLines: extraction.vatLines.map((row) => ({
      ...row,
      originalLabel: redactSensitiveText(row.originalLabel),
      evidence: row.evidence ? "[omitted]" : null,
    })),
    extractionConfidence: extraction.extractionConfidence,
    evidence: Object.fromEntries(
      Object.entries(extraction.evidence).map(([key, value]) => [key, value ? "[omitted]" : value]),
    ),
  };
}

function calculationSnapshot(result: ExtractedBill) {
  return {
    charges: result.charges,
    analysis: result.analysis
      ? {
          ...result.analysis,
          issues: result.analysis.issues.map((issue) => redactSensitiveText(issue)),
        }
      : null,
  };
}

function inputMode(document: PreparedBillDocument) {
  if (document.extractedText && document.mimeType === "application/pdf")
    return "original_pdf_with_sanitized_text";
  if (document.pageImages?.length) return "rendered_page_images";
  if (document.mimeType === "application/pdf") return "original_pdf";
  return "sanitized_image";
}

export class BillExtractionDebugger {
  constructor(private readonly route: string) {}

  private log(event: string, detail: unknown) {
    console.info("[bill-debug]", JSON.stringify({ route: this.route, event, detail }));
  }

  preparation(document: PreparedBillDocument) {
    this.log("preparation", {
      pageCount: document.pageCount ?? null,
      inputMode: inputMode(document),
      renderedPageImageCount: document.pageImages?.length ?? 0,
      hasSanitizedTextSupport: Boolean(document.extractedText),
    });
  }

  geminiInput(document: PreparedBillDocument, pass: GeminiPass) {
    this.log("gemini-input", {
      pass,
      pageCount: document.pageCount ?? null,
      inputMode: inputMode(document),
      renderedPageImageCount: document.pageImages?.length ?? 0,
      hasSanitizedTextSupport: Boolean(document.extractedText),
    });
  }

  structured(stage: ExtractionStage, extraction: StructuredBillExtraction) {
    this.log(`structured-${stage}`, billDebugExtractionSnapshot(extraction));
  }

  calculation(stage: CalculationStage, result: ExtractedBill) {
    this.log(`calculation-${stage}`, calculationSnapshot(result));
  }

  repairIssues(issues: string[]) {
    this.log(
      "repair-issues",
      issues.map((issue) => redactSensitiveText(issue)),
    );
  }

  repairRejected(reason: string) {
    this.log("repair-rejected", { reason: redactSensitiveText(reason) });
  }

  repairFailed(error: unknown) {
    const candidate = error as {
      name?: unknown;
      issues?: Array<{ code?: unknown; path?: unknown }>;
    };
    this.log("repair-failed", {
      name: typeof candidate?.name === "string" ? candidate.name : "UnknownError",
      validationIssues: Array.isArray(candidate?.issues)
        ? candidate.issues.map((issue) => ({ code: issue.code, path: issue.path }))
        : [],
    });
  }
}

export function createDevelopmentBillExtractionDebugger(route: string) {
  return process.env.NODE_ENV === "development" ? new BillExtractionDebugger(route) : undefined;
}
