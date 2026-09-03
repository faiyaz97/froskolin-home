import { dateOnlyToEpochDay, epochDayToDateOnly } from "./occupancy";
import type { DateOnly } from "./types";

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/**
 * Lists monthly occurrences from the original start-date anchor through a date.
 * An anchor on the 29th–31st clamps in short months, then returns to its original
 * day when available; already-generated dates can be excluded for idempotency.
 */
export function enumerateDueOccurrences(input: {
  startDate: DateOnly;
  throughDate: DateOnly;
  endDate?: DateOnly;
  generatedOccurrenceDates?: Iterable<DateOnly>;
}): DateOnly[] {
  const startEpochDay = dateOnlyToEpochDay(input.startDate);
  const throughEpochDay = dateOnlyToEpochDay(input.throughDate);
  const endEpochDay = input.endDate ? dateOnlyToEpochDay(input.endDate) : undefined;
  if (endEpochDay !== undefined && endEpochDay < startEpochDay)
    throw new RangeError("endDate cannot be before startDate");
  if (throughEpochDay < startEpochDay) return [];
  const generated = new Set(input.generatedOccurrenceDates ?? []);
  const start = new Date(startEpochDay * 86_400_000);
  const anchorDay = start.getUTCDate();
  const baseMonth = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const maxEpochDay =
    endEpochDay === undefined ? throughEpochDay : Math.min(throughEpochDay, endEpochDay);
  const result: DateOnly[] = [];
  for (let offset = 0; ; offset += 1) {
    const month = baseMonth + offset;
    const year = Math.floor(month / 12);
    const monthIndex = month % 12;
    const occurrence = epochDayToDateOnly(
      Math.floor(
        Date.UTC(year, monthIndex, Math.min(anchorDay, lastDayOfMonth(year, monthIndex))) /
          86_400_000,
      ),
    );
    const occurrenceEpochDay = dateOnlyToEpochDay(occurrence);
    if (occurrenceEpochDay > maxEpochDay) break;
    if (!generated.has(occurrence)) result.push(occurrence);
  }
  return result;
}
