import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiBillExtractor, extractionSchema } from "@/lib/bills/gemini-extractor";
import {
  expandLeanExtraction,
  leanBillExtractionSchema,
  leanGenerationSchema,
} from "@/lib/bills/lean-extraction";
import { rawBill } from "../fixtures/bill-analysis";
import { repairSchema } from "@/lib/bills/repair-patch";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
function leanBill() {
  const bill = rawBill();
  return {
    schemaVersion: 3 as const,
    utilityType: bill.utilityType,
    servicePeriod: bill.servicePeriod,
    totalDueCents: bill.totalDueCents,
    currency: bill.currency,
    consumption: bill.consumption,
    coverageComplete: bill.coverageComplete === true,
    charges: bill.lineItems
      .filter((row) => row.includedInPayableTotal)
      .map((row) => ({
        id: row.id,
        label: row.originalLabel,
        amountCents: row.amountCents,
        classification: row.classification,
        kind: row.kind,
        adjustsChargeIds: row.adjustsChargeIds,
      })),
    vat: bill.vatLines
      .filter((row) => row.includedInPayableTotal)
      .map((row) => ({
        id: row.id,
        amountCents: row.amountCents,
        rateBasisPoints: row.rateBasisPoints,
        taxableBaseCents: row.taxableBaseCents,
        appliesToChargeIds: row.appliesToChargeIds,
      })),
  };
}
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BILL_AI_OPTIMIZED", "1");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("model extraction contract", () => {
  it("allows rollback to the existing detailed extractor", async () => {
    vi.stubEnv("BILL_AI_OPTIMIZED", "0");
    generateContent.mockResolvedValue({ text: JSON.stringify(rawBill()) });
    const result = await new GeminiBillExtractor("test-key").extract({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      filename: "test",
    });
    expect(result).toEqual(rawBill());
    expect(generateContent.mock.calls[0][0].config.responseJsonSchema).toEqual(extractionSchema);
  });
  it("uses compact extraction when no override is configured", async () => {
    vi.stubEnv("BILL_AI_OPTIMIZED", "");
    generateContent.mockResolvedValue({ text: JSON.stringify(leanBill()) });
    await new GeminiBillExtractor("test-key").extract({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      filename: "test",
    });
    expect(generateContent.mock.calls[0][0].config.responseJsonSchema).toEqual(
      leanGenerationSchema,
    );
  });
  it("repairs with the original document, existing facts and exact issues rather than re-extracting", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        lineUpdates: [],
        vatUpdates: [],
        addedLines: [],
        addedVat: [],
        coverage: null,
      }),
    });
    await new GeminiBillExtractor("test-key").repair(
      { bytes: new Uint8Array([1]), mimeType: "image/png", filename: "test" },
      rawBill(),
      ["VAT references need review."],
    );
    const request = generateContent.mock.calls[0][0];
    expect(request.config.temperature).toBe(0);
    expect(request.model).toBe("gemini-3.8-flash");
    expect(request.config.thinkingConfig).toEqual({ thinkingLevel: "MEDIUM" });
    expect(request.config.httpOptions).toEqual({ timeout: 75_000 });
    expect(request.config.responseJsonSchema).toEqual(repairSchema);
    expect(request.contents[0].parts[0].text).toContain("TARGETED REPAIR, NOT A NEW EXTRACTION");
    expect(request.contents[0].parts[0].text).toContain(JSON.stringify(rawBill()));
    expect(request.contents[0].parts[0].text).toContain("VAT references need review.");
    expect(request.contents[0].parts[1].inlineData).toEqual({
      mimeType: "image/png",
      data: "AQ==",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it("sends a compact Gemini schema but retains all fields and literal version", () => {
    const schema = JSON.stringify(leanGenerationSchema);
    expect(schema.length).toBeLessThan(JSON.stringify(extractionSchema).length * 0.7);
    for (const keyword of [
      "$schema",
      "const",
      "pattern",
      "minLength",
      "maxLength",
      "minimum",
      "maximum",
      "maxItems",
    ])
      expect(schema).not.toContain(`"${keyword}":`);
    expect((leanGenerationSchema.properties as Record<string, unknown>).schemaVersion).toEqual({
      type: "number",
      enum: [3],
    });
  });
  const document = {
    bytes: new Uint8Array([1]),
    mimeType: "image/png" as const,
    filename: "test.png",
  };
  it.each([
    [429, "Google did not provide a reset time"],
    [403, "couldn't access the API"],
    [400, "configuration problem"],
    [404, "configuration problem"],
    [503, "temporarily unavailable"],
  ])("reports safe API failure for status %s", async (status, message) => {
    generateContent.mockRejectedValue({
      status,
      message: "secret-key private bill user@example.com",
      response: "private",
    });
    await expect(new GeminiBillExtractor("secret-key").extract(document)).rejects.toThrow(message);
    expect(console.error).toHaveBeenCalledWith(
      "[bill-extraction] failed",
      JSON.stringify({
        provider: "gemini",
        model: "gemini-3.8-flash",
        phase: "request",
        status,
      }),
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-key");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private");
  });
  it("uses Gemini 3.8 Flash for both extraction and repair", async () => {
    generateContent
      .mockResolvedValueOnce({ text: JSON.stringify(leanBill()) })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          lineUpdates: [],
          vatUpdates: [],
          addedLines: [],
          addedVat: [],
          coverage: null,
        }),
      });
    const extractor = new GeminiBillExtractor("test-key");

    await extractor.extract(document);
    await extractor.repair(document, rawBill(), ["VAT references need review."]);

    expect(generateContent.mock.calls.map(([request]) => request.model)).toEqual([
      "gemini-3.8-flash",
      "gemini-3.8-flash",
    ]);
    expect(generateContent.mock.calls[1][0].config.thinkingConfig).toEqual({
      thinkingLevel: "MEDIUM",
    });
  });
  it("reports provider unavailability during repair without another model call", async () => {
    generateContent.mockRejectedValue({ status: 503 });
    await expect(
      new GeminiBillExtractor("test-key").repair(document, rawBill(), ["VAT review"]),
    ).rejects.toThrow("temporarily unavailable");
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].model).toBe("gemini-3.8-flash");
  });
  it("shows Google's retry time for a quota error without exposing its raw response", async () => {
    vi.setSystemTime(new Date("2026-09-29T23:30:00Z"));
    generateContent.mockRejectedValue({
      status: 429,
      message: JSON.stringify({
        error: {
          message: "private bill user@example.com",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.RetryInfo",
              retryDelay: "3600s",
            },
          ],
        },
      }),
    });
    try {
      await expect(new GeminiBillExtractor("test-key").extract(document)).rejects.toThrow(
        "Try again after 30/09/26 at 00:30 UTC",
      );
    } finally {
      vi.useRealTimers();
    }
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private bill");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, "not json", "{}"])(
    "distinguishes invalid responses from quota errors",
    async (text) => {
      generateContent.mockResolvedValue({ text });
      await expect(new GeminiBillExtractor("test-key").extract(document)).rejects.toThrow(
        "incomplete or invalid bill data",
      );
    },
  );
  it("uses one detailed pass when the compact response is invalid", async () => {
    generateContent
      .mockResolvedValueOnce({ text: "{}" })
      .mockResolvedValueOnce({ text: JSON.stringify(rawBill()) });
    const result = await new GeminiBillExtractor("test-key").extract(document);
    expect(result).toEqual(rawBill());
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][0].config.responseJsonSchema).not.toEqual(
      leanGenerationSchema,
    );
  });
  it("does not interpret arbitrary upstream text as a quota error", async () => {
    generateContent.mockRejectedValue(new Error("429 secret-key"));
    await expect(new GeminiBillExtractor("test-key").extract(document)).rejects.toThrow(
      "couldn't connect",
    );
  });
  it("requests structured facts only and does not let the model calculate financial buckets", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify(leanBill()) });
    const raw = await new GeminiBillExtractor("test-key").extract({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      filename: "test.png",
    });
    expect(raw).toEqual(expandLeanExtraction(leanBillExtractionSchema.parse(leanBill())));
    expect(generateContent.mock.calls[0][0].config.thinkingConfig).toEqual({
      thinkingLevel: "MEDIUM",
    });
    expect(raw).not.toHaveProperty("charges");
    const properties = leanGenerationSchema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty("charges");
    expect(properties).toHaveProperty("vat");
    expect(properties).not.toHaveProperty("supplier");
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          temperature: 0,
          responseJsonSchema: leanGenerationSchema,
        }),
      }),
    );
  });
  it("rejects legacy model-computed buckets rather than falling back to them", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ ...rawBill(), charges: { fixedCents: 4000, consumptionCents: 6000 } }),
    });
    await expect(
      new GeminiBillExtractor("test-key").extract({
        bytes: new Uint8Array([1]),
        mimeType: "image/png",
        filename: "test.png",
      }),
    ).rejects.toThrow("AI returned incomplete or invalid bill data");
  });
  it("sanitizes evidence and labels before returning structured extraction", async () => {
    const lean = leanBill();
    lean.charges[0].label = "Service user@example.com";
    generateContent.mockResolvedValue({ text: JSON.stringify(lean) });
    const raw = await new GeminiBillExtractor("test-key").extract({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      filename: "test.png",
    });
    expect(raw.lineItems[0].originalLabel).not.toContain("user@example.com");
  });
});
