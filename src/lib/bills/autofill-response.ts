import { billAutofillSchema, type ExtractedBill } from "@/lib/validation";

export function toBillAutofill(extraction: ExtractedBill) {
  return billAutofillSchema.parse({
    utilityType: extraction.utilityType,
    servicePeriod: extraction.servicePeriod,
    totalDueCents: extraction.totalDueCents,
    currency: extraction.currency,
    consumption: extraction.consumption,
    charges: {
      fixedCents: extraction.charges.fixedCents,
      consumptionCents: extraction.charges.consumptionCents,
    },
    extractionConfidence: extraction.extractionConfidence,
    review: {
      status: extraction.analysis?.status ?? "needs_review",
    },
  });
}
