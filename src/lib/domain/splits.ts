import { allocateByWeights, assertCents, assertSharesTotal, assertUniqueMemberIds } from "./money";
import type { Share } from "./types";

export function calculateEqualShares(
  totalCents: number,
  participantIds: readonly string[],
): Share[] {
  assertCents(totalCents, "totalCents");
  assertUniqueMemberIds(participantIds);
  return allocateByWeights(
    totalCents,
    participantIds,
    participantIds.map(() => 1),
  );
}

export function calculateExactShares(totalCents: number, shares: readonly Share[]): Share[] {
  assertCents(totalCents, "totalCents");
  assertUniqueMemberIds(shares.map((share) => share.memberId));
  assertSharesTotal(shares, totalCents);
  return shares.map((share) => ({ ...share }));
}

export interface PercentageShareInput {
  memberId: string;
  /** Integer basis points; all participant values must add to 10,000. */
  basisPoints: number;
}

export function calculatePercentageShares(
  totalCents: number,
  shares: readonly PercentageShareInput[],
): Share[] {
  assertCents(totalCents, "totalCents");
  assertUniqueMemberIds(shares.map((share) => share.memberId));
  const basisPointTotal = shares.reduce((sum, share) => {
    if (!Number.isSafeInteger(share.basisPoints) || share.basisPoints < 0) {
      throw new RangeError("basis points must be non-negative safe integers");
    }
    return sum + share.basisPoints;
  }, 0);
  if (basisPointTotal !== 10_000)
    throw new RangeError("percentage shares must total exactly 10,000 basis points");
  return allocateByWeights(
    totalCents,
    shares.map((share) => share.memberId),
    shares.map((share) => share.basisPoints),
  );
}
