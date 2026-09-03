import "server-only";

import { GoogleGenAI } from "@google/genai";

import { extractedBillSchema, type ExtractedBill } from "@/lib/validation";

import {
  BillExtractionError,
  type BillExtractor,
  type PreparedBillDocument,
} from "./bill-extractor";
import { redactSensitiveText } from "./preprocessing";

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "supplier",
    "utilityType",
    "billNumber",
    "issueDate",
    "servicePeriod",
    "totalDueCents",
    "currency",
    "consumption",
    "charges",
    "extractionConfidence",
    "evidence",
  ],
  properties: {
    supplier: { type: ["string", "null"] },
    utilityType: { type: "string", enum: ["electricity", "gas", "water", "internet", "other"] },
    billNumber: { type: ["string", "null"] },
    issueDate: { type: ["string", "null"] },
    servicePeriod: {
      type: "object",
      required: ["start", "end"],
      properties: { start: { type: "string" }, end: { type: "string" } },
    },
    totalDueCents: { type: "integer" },
    currency: { type: "string" },
    consumption: {
      type: "object",
      required: ["amount", "unit"],
      properties: { amount: { type: ["number", "null"] }, unit: { type: ["string", "null"] } },
    },
    charges: {
      type: "object",
      required: ["consumptionCents", "fixedCents", "taxesCents", "adjustmentsCents"],
      properties: {
        consumptionCents: { type: ["integer", "null"] },
        fixedCents: { type: ["integer", "null"] },
        taxesCents: { type: ["integer", "null"] },
        adjustmentsCents: { type: ["integer", "null"] },
      },
    },
    extractionConfidence: {
      type: "object",
      required: ["servicePeriod", "totalDue", "fixedCharges", "consumptionCharges"],
      properties: {
        servicePeriod: { type: "number" },
        totalDue: { type: "number" },
        fixedCharges: { type: "number" },
        consumptionCharges: { type: "number" },
      },
    },
    evidence: {
      type: "object",
      required: [],
      properties: {
        servicePeriod: { type: "string" },
        totalDue: { type: "string" },
        fixedCharges: { type: "string" },
        consumptionCharges: { type: "string" },
      },
    },
  },
} as const;

export class GeminiBillExtractor implements BillExtractor {
  constructor(private readonly apiKey = process.env.GEMINI_API_KEY) {}

  async extract(document: PreparedBillDocument): Promise<ExtractedBill> {
    if (!this.apiKey)
      throw new BillExtractionError("Bill extraction is not configured. Enter the bill manually.");

    try {
      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      const documentParts = document.extractedText
        ? [{ text: `Sanitized PDF text:\n${document.extractedText}` }]
        : document.pageImages?.length
          ? document.pageImages.map((page) => ({
              inlineData: {
                mimeType: page.mimeType,
                data: Buffer.from(page.bytes).toString("base64"),
              },
            }))
          : [
              {
                inlineData: {
                  mimeType: document.mimeType,
                  data: Buffer.from(document.bytes).toString("base64"),
                },
              },
            ];
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Extract facts from this household utility bill. Do not calculate roommates' shares. Return cents as integers, ISO dates, null for unknown facts, and brief evidence snippets without addresses, account numbers, or tax identifiers.",
              },
              ...documentParts,
            ],
          },
        ],
        config: { responseMimeType: "application/json", responseJsonSchema: extractionSchema },
      });
      if (!response.text) throw new BillExtractionError();
      const extracted = extractedBillSchema.parse(JSON.parse(response.text));
      return {
        ...extracted,
        evidence: Object.fromEntries(
          Object.entries(extracted.evidence).map(([key, value]) => [
            key,
            value ? redactSensitiveText(value) : value,
          ]),
        ),
      } as ExtractedBill;
    } catch (error) {
      if (error instanceof BillExtractionError) throw error;
      throw new BillExtractionError();
    }
  }
}
