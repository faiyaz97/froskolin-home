import type { ExtractedBill } from "@/lib/validation";

const MAX_ROUNDING_DRIFT_CENTS = 2;

function allocateWholeBillComponent(
  amountCents: number,
  fixedWeight: number,
  variableWeight: number,
) {
  if (fixedWeight < 0 || variableWeight < 0) return null;

  const sign = Math.sign(amountCents);
  const absoluteAmount = BigInt(Math.abs(amountCents));
  const fixedWeightBigInt = BigInt(fixedWeight);
  const variableWeightBigInt = BigInt(variableWeight);
  const totalWeightBigInt = fixedWeightBigInt + variableWeightBigInt;
  if (totalWeightBigInt <= 0n) return null;
  const fixedNumerator = absoluteAmount * fixedWeightBigInt;
  const variableNumerator = absoluteAmount * variableWeightBigInt;
  let fixedCents = fixedNumerator / totalWeightBigInt;
  let variableCents = variableNumerator / totalWeightBigInt;
  let remainder = absoluteAmount - fixedCents - variableCents;

  // Largest-remainder allocation, with fixed first as the stable tie-break.
  if (remainder > 0n) {
    if (fixedNumerator % totalWeightBigInt >= variableNumerator % totalWeightBigInt)
      fixedCents += 1n;
    else variableCents += 1n;
    remainder -= 1n;
  }
  if (remainder !== 0n) return null;

  return {
    fixedCents: Number(fixedCents) * sign,
    variableCents: Number(variableCents) * sign,
  };
}

function invalidateBuckets(extracted: ExtractedBill): ExtractedBill {
  return {
    ...extracted,
    charges: { ...extracted.charges, fixedCents: null, consumptionCents: null },
    extractionConfidence: {
      ...extracted.extractionConfidence,
      fixedCharges: 0,
      consumptionCharges: 0,
    },
  };
}

/**
 * Accepts the model's semantic, tax-inclusive fixed/variable classification
 * only when it is complete. Tiny invoice-rounding drift is reconciled to the
 * variable bucket; a material gap is rejected so the confirmation UI asks the
 * user instead of silently treating every unclassified charge as usage.
 */
export function normalizeExtractedBillBuckets(extracted: ExtractedBill): ExtractedBill {
  const components = extracted.chargeComponents;
  const componentsAreComplete =
    components != null &&
    components.every(
      (component) => component.bucket !== "whole_bill" || component.kind !== "base",
    ) &&
    components.reduce((sum, component) => sum + component.amountCents, 0) ===
      extracted.totalDueCents;
  let fixedCents = componentsAreComplete
    ? components
        .filter((component) => component.bucket === "fixed")
        .reduce((sum, component) => sum + component.amountCents, 0)
    : extracted.charges.fixedCents;
  let variableCents = componentsAreComplete
    ? components
        .filter((component) => component.bucket === "variable")
        .reduce((sum, component) => sum + component.amountCents, 0)
    : extracted.charges.consumptionCents;
  if (fixedCents == null || variableCents == null) return invalidateBuckets(extracted);

  if (componentsAreComplete) {
    const wholeBillCents = components
      .filter((component) => component.bucket === "whole_bill")
      .reduce((sum, component) => sum + component.amountCents, 0);
    const allocation = allocateWholeBillComponent(wholeBillCents, fixedCents, variableCents);
    if (!allocation) return invalidateBuckets(extracted);
    fixedCents += allocation.fixedCents;
    variableCents += allocation.variableCents;
  }

  if (
    fixedCents < 0 ||
    variableCents < 0 ||
    fixedCents > extracted.totalDueCents ||
    variableCents > extracted.totalDueCents
  )
    return invalidateBuckets(extracted);

  const drift = extracted.totalDueCents - fixedCents - variableCents;
  if (drift === 0) {
    return {
      ...extracted,
      charges: { ...extracted.charges, fixedCents, consumptionCents: variableCents },
    };
  }
  if (Math.abs(drift) > MAX_ROUNDING_DRIFT_CENTS) return invalidateBuckets(extracted);

  return {
    ...extracted,
    charges: { ...extracted.charges, consumptionCents: variableCents + drift },
    extractionConfidence: {
      ...extracted.extractionConfidence,
      consumptionCharges: Math.min(
        extracted.extractionConfidence.totalDue,
        extracted.extractionConfidence.fixedCharges,
      ),
    },
  };
}
