import "server-only";

import { GoogleGenAI } from "@google/genai";

import { extractedBillSchema, type ExtractedBill } from "@/lib/validation";

import {
  BillExtractionError,
  type BillExtractor,
  type PreparedBillDocument,
} from "./bill-extractor";
import { normalizeExtractedBillBuckets } from "./normalize-extraction";
import { redactSensitiveText } from "./preprocessing";

export const BILL_EXTRACTION_PROMPT = `Extract and semantically classify facts from this household utility bill. Do not calculate roommates' shares.

Return cents as integers, ISO dates, null for unknown facts, and brief evidence snippets without addresses, account numbers, meter identifiers, or tax identifiers.

Interpret charges by their economic meaning, not by fixed provider names, coordinates, page positions, visual templates, or one language. Providers may use different labels and may place the same information in summaries, line-item tables, or tax tables.
Use the source document's visual layout to associate values in rows and columns. The accompanying text layer is only a search aid and may flatten tables into a misleading order.

The final payable amount must be classified into exactly two exhaustive user-facing buckets:
- charges.fixedCents: charges that arise from time, access, subscription, account, capacity, meter rental, or service availability and would still be payable with zero usage, INCLUDING the share of taxes, credits, discounts, and adjustments attributable to those charges.
- charges.consumptionCents: charges driven by measured usage, units consumed, usage tiers, or consumption-linked transport, duties, or excise, INCLUDING the share of taxes, credits, discounts, and adjustments attributable to those charges.

Also return chargeComponents: the auditable list of signed monetary components that TypeScript will sum into the two buckets. For every component return a short non-sensitive label, integer amountCents, bucket (fixed, variable, or whole_bill), and kind (base, tax, or adjustment).
- Components MUST be mutually exclusive and collectively exhaustive: their signed amountCents must sum exactly to totalDueCents.
- Use the most detailed level that composes the payable total. Never include both a subtotal and the child lines already contained in that subtotal.
- When a percentage tax base covers both buckets, return two tax components: its fixed share and variable share.
- Preserve every explicit tax-table row as its own component. NEVER merge tax rows that have different rates, taxable bases, or tax amounts. A tax component's amountCents is that row's tax amount only, not the sum of several tax rows.
- For every percentage-tax row, verify before classifying that tax amount is consistent with taxable base × rate after cent rounding. Use the taxable base—not the tax row's position, heading, or nearby usage lines—to decide its bucket.
- Return credits and negative rounding as negative adjustment components. Keep separate previous/current rounding or recalculation lines separate when the document does.
- Use whole_bill for an adjustment that applies to the invoice as a whole, or for a tax only when the document provides no defensible fixed/variable attribution. Never guess a bucket for an unlabelled invoice-wide line. TypeScript will allocate whole_bill components proportionally.
- Do not invent an adjustment merely to force the component list to sum. If the document cannot support a complete component list, return null for chargeComponents (or omit uncertain components), but still return the best-supported tax-inclusive final fixedCents and consumptionCents when both can be determined confidently and sum exactly to totalDueCents.
The application will calculate charges.fixedCents and charges.consumptionCents deterministically by summing these classified components.

Follow this classification process:
1. Use the final amount actually payable, not an intermediate subtotal.
2. Classify each pre-tax line by its cost driver. A label containing "fixed" is useful evidence but is not required; a flat charge is fixed even under another name. A quantity- or usage-based excise is variable. A flat time-based tax is fixed.
3. Allocate percentage taxes such as VAT/IVA to the charges in each taxable base. If a tax base contains both fixed and variable charges, apportion that tax between the two in proportion to their taxable amounts. If the document gives separate taxable bases or rates, calculate each base separately before summing the results. Do not put all VAT/IVA into the variable bucket merely because it is shown on a separate tax line.
4. Assign a recalculation, credit, discount, or fee to the charge it references. If it genuinely applies to the whole bill, apportion it between the fixed and variable subtotals. Treat invoice rounding the same way and use it to reconcile the final payable amount.
5. Return final bucket totals only after all taxes and adjustments are allocated. Use integer-cent arithmetic. For proportional allocation, use largest-remainder rounding and a stable fixed-then-variable tie break.

MANDATORY TAX CHECK before returning JSON:
- Read tax tables row by row as (rate, taxable base, tax amount) tuples. Do not treat a tax-table subtotal as one tax row and do not relabel the combined tax total as one of its child rates.
- Arithmetic-check every tuple: for example, a 22% row with a 4,041-cent taxable base produces 889 cents, while a 10% row with a 4,611-cent taxable base produces 461 cents. Those remain two separate components.
- Compare every taxable base with the classified pre-tax subtotals. If a taxable base equals an explicit fixed subtotal, the tax on that base belongs entirely to fixedCents unless the bill explicitly shows otherwise.
- fixedCents must include fixed charges PLUS all VAT/IVA and other taxes attributable to them. It must not merely repeat a pre-tax "fixed quota" line when the bill taxes that line separately.
- consumptionCents must include variable charges PLUS usage-based excise/duties and all VAT/IVA attributable to those variable charges.

Provider-neutral example: a bill has a 4,000-cent fixed taxable base with 880 cents VAT, plus a 6,000-cent usage taxable base with 600 cents VAT. The final buckets are fixedCents 4,880 and consumptionCents 6,600, not fixedCents 4,000. If a later whole-bill credit or rounding changes the payable total, allocate it using steps 4 and 5.

Whenever both buckets are known, charges.fixedCents + charges.consumptionCents MUST equal totalDueCents exactly. Calculate these final buckets independently from chargeComponents so they remain usable when an optional supporting component is missed. taxesCents and adjustmentsCents are informational subsets already included in those two final buckets and must not be added twice. adjustmentsCents may be signed. If the source does not contain enough information to identify and tax the fixed portion confidently, return null for BOTH fixedCents and consumptionCents rather than guessing or returning incomplete raw line totals.`;

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
    "chargeComponents",
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
    chargeComponents: {
      type: ["array", "null"],
      items: {
        type: "object",
        required: ["label", "amountCents", "bucket", "kind"],
        properties: {
          label: { type: "string" },
          amountCents: { type: "integer" },
          bucket: { type: "string", enum: ["fixed", "variable", "whole_bill"] },
          kind: { type: "string", enum: ["base", "tax", "adjustment"] },
        },
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
        ? [
            { text: `Sanitized PDF text for search support:\n${document.extractedText}` },
            ...(document.mimeType === "application/pdf"
              ? [
                  {
                    inlineData: {
                      mimeType: document.mimeType,
                      data: Buffer.from(document.bytes).toString("base64"),
                    },
                  },
                ]
              : []),
          ]
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
                text: BILL_EXTRACTION_PROMPT,
              },
              ...documentParts,
            ],
          },
        ],
        config: { responseMimeType: "application/json", responseJsonSchema: extractionSchema },
      });
      if (!response.text) throw new BillExtractionError();
      const extracted = normalizeExtractedBillBuckets(
        extractedBillSchema.parse(JSON.parse(response.text)),
      );
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
