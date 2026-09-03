import type { Share } from "./types";

export function assertCents(value: number, field = "amountCents", allowZero = true): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new RangeError(
      `${field} must be a ${allowZero ? "non-negative" : "positive"} safe integer number of cents`,
    );
  }
}

export function assertUniqueMemberIds(memberIds: readonly string[]): void {
  if (memberIds.length === 0) throw new RangeError("at least one participant is required");
  const seen = new Set<string>();
  for (const memberId of memberIds) {
    if (!memberId || seen.has(memberId))
      throw new RangeError("participant IDs must be non-empty and unique");
    seen.add(memberId);
  }
}

export function assertSharesTotal(shares: readonly Share[], expectedCents: number): void {
  assertCents(expectedCents, "expectedCents");
  const actual = shares.reduce((sum, share) => {
    assertCents(share.amountCents, `share for ${share.memberId}`);
    return sum + share.amountCents;
  }, 0);
  if (actual !== expectedCents) {
    throw new RangeError(`share total ${actual} does not equal expected total ${expectedCents}`);
  }
}

/**
 * Allocates integer cents by positive integer weights. BigInt intermediates avoid
 * precision loss, and input order is the deterministic tiebreaker.
 */
export function allocateByWeights(
  totalCents: number,
  memberIds: readonly string[],
  weights: readonly number[],
): Share[] {
  assertCents(totalCents, "totalCents");
  assertUniqueMemberIds(memberIds);
  if (weights.length !== memberIds.length) throw new RangeError("weights must match participants");
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0)
      throw new RangeError("weights must be non-negative safe integers");
  }

  const totalWeight = weights.reduce((sum, value) => sum + BigInt(value), 0n);
  if (totalWeight === 0n) throw new RangeError("at least one allocation weight must be positive");

  const total = BigInt(totalCents);
  const allocations = weights.map((weight, index) => {
    const numerator = total * BigInt(weight);
    return { index, cents: Number(numerator / totalWeight), remainder: numerator % totalWeight };
  });
  let remaining = totalCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  allocations
    .slice()
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    )
    .slice(0, remaining)
    .forEach((allocation) => {
      allocations[allocation.index]!.cents += 1;
    });
  remaining = totalCents - allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  if (remaining !== 0) throw new Error("cent allocation failed to conserve the total");

  return allocations.map((allocation) => ({
    memberId: memberIds[allocation.index]!,
    amountCents: allocation.cents,
  }));
}
