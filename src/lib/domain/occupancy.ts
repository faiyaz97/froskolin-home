import type { DateOnly, DateRange } from "./types";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

export function dateOnlyToEpochDay(value: DateOnly): number {
  const match = DATE_ONLY.exec(value);
  if (!match) throw new RangeError(`invalid date-only value: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day);
  const parsed = new Date(epoch);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError(`invalid calendar date: ${value}`);
  }
  return epoch / DAY_MS;
}

export function epochDayToDateOnly(epochDay: number): DateOnly {
  if (!Number.isSafeInteger(epochDay)) throw new RangeError("epoch day must be a safe integer");
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10);
}

function validateRange(range: DateRange): { start: number; end: number } {
  const start = dateOnlyToEpochDay(range.startDate);
  const end = dateOnlyToEpochDay(range.endDate);
  if (start > end) throw new RangeError("absence range start must be on or before its end");
  return { start, end };
}

/** Merges overlapping and adjacent inclusive date ranges in UTC calendar days. */
export function normalizeAbsenceRanges(ranges: readonly DateRange[]): DateRange[] {
  const sorted = ranges.map(validateRange).sort((a, b) => a.start - b.start || a.end - b.end);
  const normalized: Array<{ start: number; end: number }> = [];
  for (const range of sorted) {
    const previous = normalized.at(-1);
    if (previous && range.start <= previous.end + 1)
      previous.end = Math.max(previous.end, range.end);
    else normalized.push({ ...range });
  }
  return normalized.map((range) => ({
    startDate: epochDayToDateOnly(range.start),
    endDate: epochDayToDateOnly(range.end),
  }));
}

export function inclusiveDays(range: DateRange): number {
  const { start, end } = validateRange(range);
  return end - start + 1;
}

/** Counts days in servicePeriod where the member was not absent. Both boundaries are inclusive. */
export function calculatePresenceDays(
  servicePeriod: DateRange,
  absenceRanges: readonly DateRange[],
): number {
  const service = validateRange(servicePeriod);
  const clipped = normalizeAbsenceRanges(absenceRanges).flatMap((range) => {
    const absence = validateRange(range);
    const start = Math.max(service.start, absence.start);
    const end = Math.min(service.end, absence.end);
    return start <= end
      ? [{ startDate: epochDayToDateOnly(start), endDate: epochDayToDateOnly(end) }]
      : [];
  });
  const awayDays = normalizeAbsenceRanges(clipped).reduce(
    (sum, range) => sum + inclusiveDays(range),
    0,
  );
  return inclusiveDays(servicePeriod) - awayDays;
}
