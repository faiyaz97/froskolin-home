import { assertCents, assertSharesTotal, assertUniqueMemberIds, allocateByWeights } from "./money";
import { activeBillPeriod, calculatePresenceDays, inclusiveDays } from "./occupancy";
import type { DateRange, UtilityShare, UtilityVariableMode } from "./types";

export interface UtilityParticipant {
  memberId: string;
  absenceRanges?: readonly DateRange[];
  inDate?: string;
  outDate?: string | null;
}

export interface UtilitySplitInput {
  totalCents: number;
  fixedCents: number;
  variableCents: number;
  servicePeriod: DateRange;
  participants: readonly UtilityParticipant[];
}

export interface UtilitySplitResult {
  shares: UtilityShare[];
  totalPresenceDays: number;
  variableMode: UtilityVariableMode;
}

export function calculateUtilityShares(input: UtilitySplitInput): UtilitySplitResult {
  assertCents(input.totalCents, "totalCents");
  assertCents(input.fixedCents, "fixedCents");
  assertCents(input.variableCents, "variableCents");
  if (input.fixedCents + input.variableCents !== input.totalCents) {
    throw new RangeError("fixedCents plus variableCents must equal totalCents");
  }
  const memberIds = input.participants.map((participant) => participant.memberId);
  assertUniqueMemberIds(memberIds);
  const activePeriods = input.participants.map((participant) =>
    activeBillPeriod(input.servicePeriod, participant.inDate, participant.outDate),
  );
  const activeDays = activePeriods.map((period) => (period ? inclusiveDays(period) : 0));
  if (activeDays.every((days) => days === 0))
    throw new RangeError("At least one member must be in the group during the bill period.");
  const presenceDays = input.participants.map((participant, index) =>
    activePeriods[index]
      ? calculatePresenceDays(activePeriods[index], participant.absenceRanges ?? [])
      : 0,
  );
  const totalPresenceDays = presenceDays.reduce((sum, days) => sum + days, 0);
  const fixedShares = allocateByWeights(input.fixedCents, memberIds, activeDays);
  const variableShares =
    totalPresenceDays === 0
      ? allocateByWeights(
          input.variableCents,
          memberIds,
          activeDays.map((days) => (days > 0 ? 1 : 0)),
        )
      : allocateByWeights(input.variableCents, memberIds, presenceDays);
  const shares = memberIds.map((memberId, index) => ({
    memberId,
    fixedCents: fixedShares[index]!.amountCents,
    variableCents: variableShares[index]!.amountCents,
    presenceDays: presenceDays[index]!,
    amountCents: fixedShares[index]!.amountCents + variableShares[index]!.amountCents,
  }));
  assertSharesTotal(shares, input.totalCents);
  if (shares.reduce((sum, share) => sum + share.fixedCents, 0) !== input.fixedCents)
    throw new Error("fixed allocation did not conserve cents");
  if (shares.reduce((sum, share) => sum + share.variableCents, 0) !== input.variableCents)
    throw new Error("variable allocation did not conserve cents");
  return {
    shares,
    totalPresenceDays,
    variableMode: totalPresenceDays === 0 ? "equal_zero_presence_fallback" : "occupancy",
  };
}
