import { describe, expect, it } from "vitest";
import sharp from "sharp";

import type { BillExtractor, PreparedBillDocument } from "@/lib/bills";
import {
  BILL_EXTRACTION_PROMPT,
  normalizeExtractedBillBuckets,
  prepareBillUpload,
  redactSensitiveText,
} from "@/lib/bills";
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

  it("rejects materially incomplete raw charge lines instead of dumping the gap into variable", () => {
    const normalized = normalizeExtractedBillBuckets({
      ...fixture,
      charges: {
        consumptionCents: 4_373,
        fixedCents: 4_041,
        taxesCents: 1_583,
        adjustmentsCents: -2,
      },
    });
    expect(normalized.charges.fixedCents).toBeNull();
    expect(normalized.charges.consumptionCents).toBeNull();
    expect(normalized.extractionConfidence.fixedCharges).toBe(0);
  });

  it("uses exact final buckets when the optional component evidence is incomplete", () => {
    const normalized = normalizeExtractedBillBuckets({
      ...fixture,
      charges: {
        consumptionCents: 5_070,
        fixedCents: 4_930,
        taxesCents: 1_583,
        adjustmentsCents: -2,
      },
      chargeComponents: [
        { label: "Fixed quota", amountCents: 4_041, bucket: "fixed", kind: "base" },
        { label: "Usage quota", amountCents: 4_373, bucket: "variable", kind: "base" },
      ],
    });

    expect(normalized.charges).toMatchObject({ fixedCents: 4_930, consumptionCents: 5_070 });
  });

  it("accepts and proportionally allocates a whole-bill tax", () => {
    const normalized = normalizeExtractedBillBuckets({
      ...fixture,
      chargeComponents: [
        { label: "Fixed charges", amountCents: 4_000, bucket: "fixed", kind: "base" },
        { label: "Usage charges", amountCents: 5_000, bucket: "variable", kind: "base" },
        { label: "Bill-wide tax", amountCents: 1_000, bucket: "whole_bill", kind: "tax" },
      ],
    });

    expect(normalized.charges).toMatchObject({ fixedCents: 4_444, consumptionCents: 5_556 });
  });

  it("preserves complete tax-inclusive buckets and reconciles only cent rounding", () => {
    const classified = normalizeExtractedBillBuckets({
      ...fixture,
      charges: {
        consumptionCents: 5_070,
        fixedCents: 4_930,
        taxesCents: 1_583,
        adjustmentsCents: -2,
      },
    });
    expect(classified.charges).toMatchObject({ fixedCents: 4_930, consumptionCents: 5_070 });

    const rounded = normalizeExtractedBillBuckets({
      ...fixture,
      charges: { ...fixture.charges, fixedCents: 4_930, consumptionCents: 5_069 },
    });
    expect(rounded.charges).toMatchObject({ fixedCents: 4_930, consumptionCents: 5_070 });
  });

  it("calculates final buckets deterministically from semantic charge components", () => {
    const normalized = normalizeExtractedBillBuckets({
      ...fixture,
      charges: {
        consumptionCents: 4_373,
        fixedCents: 4_041,
        taxesCents: 1_583,
        adjustmentsCents: -2,
      },
      chargeComponents: [
        { label: "Fixed quota", amountCents: 4_041, bucket: "fixed", kind: "base" },
        { label: "Usage quota", amountCents: 4_373, bucket: "variable", kind: "base" },
        { label: "Fixed VAT", amountCents: 889, bucket: "fixed", kind: "tax" },
        { label: "Variable VAT", amountCents: 461, bucket: "variable", kind: "tax" },
        { label: "Excise", amountCents: 233, bucket: "variable", kind: "tax" },
        { label: "Recalculation", amountCents: 5, bucket: "variable", kind: "adjustment" },
        { label: "Previous rounding", amountCents: 96, bucket: "whole_bill", kind: "adjustment" },
        { label: "Current rounding", amountCents: -98, bucket: "whole_bill", kind: "adjustment" },
      ],
    });

    expect(normalized.charges).toMatchObject({ fixedCents: 4_929, consumptionCents: 5_071 });
  });

  it("instructs the model to return exhaustive final buckets", () => {
    expect(BILL_EXTRACTION_PROMPT).toContain(
      "charges.fixedCents + charges.consumptionCents MUST equal totalDueCents exactly",
    );
    expect(BILL_EXTRACTION_PROMPT).toContain("apportion that tax between the two");
    expect(BILL_EXTRACTION_PROMPT).toContain("Do not put all VAT/IVA into the variable bucket");
    expect(BILL_EXTRACTION_PROMPT).toContain(
      "fixedCents must include fixed charges PLUS all VAT/IVA",
    );
    expect(BILL_EXTRACTION_PROMPT).toContain("a taxable base equals an explicit fixed subtotal");
    expect(BILL_EXTRACTION_PROMPT).toContain("mutually exclusive and collectively exhaustive");
    expect(BILL_EXTRACTION_PROMPT).toContain("Never include both a subtotal and the child lines");
    expect(BILL_EXTRACTION_PROMPT).toContain("NEVER merge tax rows");
    expect(BILL_EXTRACTION_PROMPT).toContain("taxable base × rate");
    expect(BILL_EXTRACTION_PROMPT).toContain("whole_bill components proportionally");
    expect(BILL_EXTRACTION_PROMPT).toContain("final buckets independently from chargeComponents");
    expect(BILL_EXTRACTION_PROMPT).toContain("not by fixed provider names");
    expect(BILL_EXTRACTION_PROMPT).toContain("visual layout");
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
