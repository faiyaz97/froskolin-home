import { structuredBillExtractionSchema, type ExtractedBill } from "@/lib/validation";

export const BILL_ROUNDING_TOLERANCE_CENTS = 2;
export const MAX_EXPLICIT_ROUNDING_CENTS = 100;
const abs = (n: bigint) => (n < 0n ? -n : n);
const order = <T extends { id: string }>(items: T[]) =>
  [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Signed, exact largest-remainder allocation; fixed first on a tie. */
function allocate(amount: bigint, fixed: bigint, usage: bigint) {
  const weight = fixed + usage;
  if (fixed < 0n || usage < 0n || weight <= 0n) return null;
  const sign = amount < 0n ? -1n : 1n;
  const f = abs(amount) * fixed;
  const u = abs(amount) * usage;
  let a = f / weight;
  let b = u / weight;
  if (a + b < abs(amount)) {
    if (f % weight >= u % weight) a++;
    else b++;
  }
  return { fixed: a * sign, usage: b * sign };
}

/** Pure analysis: accepts model facts only, never AI-computed final buckets. */
export function calculateBillTotals(input: unknown): ExtractedBill {
  const data = structuredBillExtractionSchema.parse(input);
  const issues = new Set<string>();
  const issue = (message: string) => issues.add(message);
  const all = [...data.lineItems, ...data.vatLines];
  const rows = new Map(all.map((row) => [row.id, row]));
  const charges = new Map(data.lineItems.map((row) => [row.id, row]));
  const counted = (row: (typeof all)[number]) => row.includedInPayableTotal === true;
  const isRounding = (kind: string) => ["rounding", "previous_rounding"].includes(kind);
  const allocations: Array<{ id: string; fixedCents: number; usageCents: number }> = [];
  let fixed = 0n,
    usage = 0n,
    taxes = 0n,
    adjustments = 0n,
    reconciliation = 0n;
  const record = (id: string, f: bigint, u: bigint) => {
    fixed += f;
    usage += u;
    allocations.push({ id, fixedCents: Number(f), usageCents: Number(u) });
  };
  if (rows.size !== all.length) issue("Duplicate charge references need review.");
  if (data.coverageComplete !== true) issue("The extracted payable breakdown is incomplete.");
  if (Object.values(data.extractionConfidence).some((value) => value < 0.8))
    issue("The billing dates or amount due need review.");
  for (const row of all) {
    if (row.includedInPayableTotal === null)
      issue(`Check whether ${row.originalLabel} is included in the amount due.`);
    if (counted(row) && (row.amountCents === null || row.confidence < 0.8))
      issue(`${row.originalLabel} has an uncertain amount or classification.`);
    if (counted(row) && row.classification === "informational")
      issue(`${row.originalLabel} cannot be both informational and payable.`);
    const visited = new Set([row.id]);
    let parent = row.parentId;
    while (parent !== null) {
      const ancestor = rows.get(parent);
      if (!ancestor || visited.has(parent)) {
        issue(`The breakdown relationship for ${row.originalLabel} needs review.`);
        break;
      }
      if (counted(row) && counted(ancestor))
        issue(`${row.originalLabel} is already included in a counted parent charge.`);
      visited.add(parent);
      parent = ancestor.parentId;
    }
  }
  for (const row of order(data.lineItems)) {
    if (!counted(row) || row.amountCents === null) continue;
    const amount = BigInt(row.amountCents);
    if (isRounding(row.kind)) {
      if (abs(amount) > BigInt(MAX_EXPLICIT_ROUNDING_CENTS))
        issue(`${row.originalLabel} is too large to be treated as accounting rounding.`);
      adjustments += amount;
      continue;
    }
    if (row.classification !== "fixed" && row.classification !== "usage") {
      issue(`Classify ${row.originalLabel} as fixed or usage before confirming.`);
      continue;
    }
    for (const ref of new Set(row.adjustsChargeIds)) {
      const target = charges.get(ref);
      if (
        !target ||
        target.id === row.id ||
        !counted(target) ||
        target.classification !== row.classification
      )
        issue(`Check which charges ${row.originalLabel} adjusts.`);
    }
    if (row.kind === "tax" || row.kind === "excise") taxes += amount;
    if (["recalculation", "discount", "credit"].includes(row.kind)) adjustments += amount;
    record(
      row.id,
      row.classification === "fixed" ? amount : 0n,
      row.classification === "usage" ? amount : 0n,
    );
  }
  for (const vat of order(data.vatLines)) {
    if (!counted(vat) || vat.amountCents === null) continue;
    taxes += BigInt(vat.amountCents);
    if (
      vat.taxableBaseCents === null ||
      vat.rateBasisPoints === null ||
      !vat.appliesToChargeIds.length
    ) {
      issue(`The taxable base and underlying charges for ${vat.originalLabel} need review.`);
      continue;
    }
    let f = 0n,
      u = 0n;
    let valid = new Set(vat.appliesToChargeIds).size === vat.appliesToChargeIds.length;
    for (const ref of new Set(vat.appliesToChargeIds)) {
      const charge = charges.get(ref);
      if (!charge || !counted(charge) || charge.amountCents === null || isRounding(charge.kind)) {
        valid = false;
        continue;
      }
      if (charge.classification === "fixed") f += BigInt(charge.amountCents);
      else if (charge.classification === "usage") u += BigInt(charge.amountCents);
      else valid = false;
    }
    const base = BigInt(vat.taxableBaseCents),
      tax = BigInt(vat.amountCents);
    const expected =
      ((abs(base) * BigInt(vat.rateBasisPoints) + 5000n) / 10000n) * (base < 0n ? -1n : 1n);
    if (
      !valid ||
      abs(f + u - base) > 1n ||
      abs(expected - tax) > 1n ||
      (f < 0n && u > 0n) ||
      (f > 0n && u < 0n)
    ) {
      issue(`The rate, taxable base, or references for ${vat.originalLabel} do not reconcile.`);
      continue;
    }
    const split = allocate(tax, abs(f), abs(u));
    if (!split && tax !== 0n) issue(`The allocation basis for ${vat.originalLabel} needs review.`);
    else record(vat.id, split?.fixed ?? 0n, split?.usage ?? 0n);
  }
  // Explicit current/previous accounting rounding is separate, with stable post-tax weights.
  const fixedWeight = fixed,
    usageWeight = usage;
  for (const row of order(
    data.lineItems.filter((item) => counted(item) && isRounding(item.kind)),
  )) {
    if (row.amountCents === null) continue;
    const amount = BigInt(row.amountCents),
      split = allocate(amount, fixedWeight, usageWeight);
    if (!split && amount !== 0n) issue("Accounting rounding has no valid cost allocation basis.");
    else record(row.id, split?.fixed ?? 0n, split?.usage ?? 0n);
  }
  const drift = BigInt(data.totalDueCents) - fixed - usage;
  if (abs(drift) > BigInt(BILL_ROUNDING_TOLERANCE_CENTS))
    issue("The charge breakdown does not match the actual amount due.");
  else if (drift !== 0n && issues.size === 0) {
    const split = allocate(drift, fixed, usage);
    if (!split) issue("The final cent rounding cannot be reconciled.");
    else {
      reconciliation = drift;
      record("__cent_reconciliation", split.fixed, split.usage);
    }
  }
  if (
    fixed < 0n ||
    usage < 0n ||
    fixed > BigInt(data.totalDueCents) ||
    usage > BigInt(data.totalDueCents)
  )
    issue("The calculated fixed or usage total is invalid.");
  if (
    abs(taxes) > BigInt(Number.MAX_SAFE_INTEGER) ||
    abs(adjustments) > BigInt(Number.MAX_SAFE_INTEGER)
  )
    issue("The tax or adjustment amounts exceed the supported monetary range.");
  const ready = issues.size === 0;
  const confidence = ready
    ? Math.min(
        ...all.filter(counted).map((row) => row.confidence),
        data.extractionConfidence.totalDue,
      )
    : 0;
  return {
    supplier: data.supplier,
    utilityType: data.utilityType,
    billNumber: data.billNumber,
    issueDate: data.issueDate,
    servicePeriod: data.servicePeriod,
    totalDueCents: data.totalDueCents,
    currency: data.currency,
    consumption: data.consumption,
    evidence: data.evidence,
    structuredData: data,
    charges: {
      fixedCents: ready ? Number(fixed) : null,
      consumptionCents: ready ? Number(usage) : null,
      taxesCents: ready && taxes >= 0n ? Number(taxes) : null,
      adjustmentsCents: ready ? Number(adjustments) : null,
    },
    extractionConfidence: {
      ...data.extractionConfidence,
      fixedCharges: confidence,
      consumptionCharges: confidence,
    },
    analysis: {
      version: 2,
      status: ready ? "ready" : "needs_review",
      issues: [...issues].slice(0, 400),
      reconciliationCents: Number(reconciliation),
      allocations: ready ? allocations : [],
    },
  };
}
