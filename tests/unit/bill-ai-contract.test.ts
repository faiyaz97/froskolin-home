import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiBillExtractor, extractionSchema } from "@/lib/bills/gemini-extractor";
import { rawBill } from "../fixtures/bill-analysis";
import { repairSchema } from "@/lib/bills/repair-patch";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("model extraction contract", () => {
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
    const schema = JSON.stringify(extractionSchema);
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
    expect((extractionSchema.properties as Record<string, unknown>).schemaVersion).toEqual({
      type: "number",
      enum: [2],
    });
  });
  const document = {
    bytes: new Uint8Array([1]),
    mimeType: "image/png" as const,
    filename: "test.png",
  };
  it.each([
    [429, "rate or quota limit"],
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
        model: "gemini-3.1-flash-lite",
        phase: "request",
        status,
      }),
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-key");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private");
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
  it("does not interpret arbitrary upstream text as a quota error", async () => {
    generateContent.mockRejectedValue(new Error("429 secret-key"));
    await expect(new GeminiBillExtractor("test-key").extract(document)).rejects.toThrow(
      "couldn't connect",
    );
  });
  it("requests structured facts only and does not let the model calculate financial buckets", async () => {
    const input = rawBill();
    generateContent.mockResolvedValue({ text: JSON.stringify(input) });
    const raw = await new GeminiBillExtractor("test-key").extract({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      filename: "test.png",
    });
    expect(raw).toEqual(input);
    expect(raw).not.toHaveProperty("charges");
    const properties = extractionSchema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty("lineItems");
    expect(properties).toHaveProperty("vatLines");
    expect(properties).not.toHaveProperty("charges");
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ temperature: 0, responseJsonSchema: extractionSchema }),
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
    const input = rawBill();
    input.lineItems[0].evidence = "Contact user@example.com";
    input.lineItems[0].originalLabel = "Service user@example.com";
    generateContent.mockResolvedValue({ text: JSON.stringify(input) });
    const raw = await new GeminiBillExtractor("test-key").extract({
      bytes: new Uint8Array([1]),
      mimeType: "image/png",
      filename: "test.png",
    });
    expect(raw.lineItems[0].evidence).not.toContain("user@example.com");
    expect(raw.lineItems[0].originalLabel).not.toContain("user@example.com");
  });
});
