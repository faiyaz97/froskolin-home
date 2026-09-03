import { describe, expect, it } from "vitest";
import sharp from "sharp";

import type { BillExtractor, PreparedBillDocument } from "@/lib/bills";
import { prepareBillUpload, redactSensitiveText } from "@/lib/bills";
import { extractedBillSchema } from "@/lib/validation";

const fixture = {
  supplier: "Example Energia",
  utilityType: "gas" as const,
  billNumber: null,
  issueDate: "2028-06-03",
  servicePeriod: { start: "2028-03-01", end: "2028-05-31" },
  totalDueCents: 10_000,
  currency: "EUR",
  consumption: { amount: 92, unit: "m³" },
  charges: {
    consumptionCents: 5_959,
    fixedCents: 4_041,
    taxesCents: null,
    adjustmentsCents: null,
  },
  extractionConfidence: {
    servicePeriod: 0.98,
    totalDue: 0.99,
    fixedCharges: 0.81,
    consumptionCharges: 0.84,
  },
  evidence: {
    servicePeriod: "Billing period 01/03/2028–31/05/2028",
    totalDue: "Total due €100.00",
  },
};

class FixtureExtractor implements BillExtractor {
  async extract(document: PreparedBillDocument) {
    void document;
    return extractedBillSchema.parse(fixture);
  }
}

describe("bill extraction boundary", () => {
  it("accepts a provider-independent structured fixture", async () => {
    const result = await new FixtureExtractor().extract({
      bytes: new Uint8Array([1]),
      filename: "fixture.pdf",
      mimeType: "application/pdf",
    });
    expect(result.totalDueCents).toBe(10_000);
    expect(result.servicePeriod).toEqual({ start: "2028-03-01", end: "2028-05-31" });
  });

  it("rejects invalid service periods and confidence values", () => {
    expect(() =>
      extractedBillSchema.parse({
        ...fixture,
        servicePeriod: { start: "2028-06-01", end: "2028-05-01" },
      }),
    ).toThrow();
    expect(() =>
      extractedBillSchema.parse({
        ...fixture,
        extractionConfidence: { ...fixture.extractionConfidence, totalDue: 1.1 },
      }),
    ).toThrow();
  });

  it("re-encodes image uploads and strips the original MIME metadata", async () => {
    const onePixelPng = await sharp({
      create: { width: 1, height: 1, channels: 4, background: "#ffffff" },
    })
      .png()
      .toBuffer();
    const prepared = await prepareBillUpload(
      new File([onePixelPng], "account-123.png", { type: "image/png" }),
    );
    expect(prepared.mimeType).toBe("image/png");
    expect(prepared.bytes.byteLength).toBeGreaterThan(0);
    expect(prepared.filename).toBe("account-123.png");
  });

  it("redacts common identifiers before text or evidence is retained", () => {
    const redacted = redactSensitiveText(
      "Email andrea@example.com, IBAN IT60X0542811101000000123456, customer no. ABCD-123456",
    );
    expect(redacted).not.toContain("andrea@example.com");
    expect(redacted).not.toContain("IT60X0542811101000000123456");
    expect(redacted).not.toContain("ABCD-123456");
  });
});
