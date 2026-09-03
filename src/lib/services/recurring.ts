import "server-only";

import {
  calculateEqualShares,
  calculateExactShares,
  calculatePercentageShares,
  dateOnlyToEpochDay,
  enumerateDueOccurrences,
  epochDayToDateOnly,
} from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { normalSplitConfigSchema } from "@/lib/validation";

export type RecurringGenerationResult = { generated: number; failed: number };

export async function generateDueRecurringExpenses(
  householdId?: string,
): Promise<RecurringGenerationResult> {
  const admin = createAdminClient();
  let rulesQuery = admin
    .from("recurring_expense_rules")
    .select("id, household_id, amount_cents, split_config, anchor_date, end_date, next_due_date")
    .eq("active", true)
    .is("archived_at", null);
  if (householdId) rulesQuery = rulesQuery.eq("household_id", householdId);

  const { data: rules, error: rulesError } = await rulesQuery;
  if (rulesError) throw rulesError;

  const householdIds = [...new Set((rules ?? []).map((rule) => String(rule.household_id)))];
  const { data: households, error: householdsError } = householdIds.length
    ? await admin.from("households").select("id, timezone").in("id", householdIds)
    : { data: [], error: null };
  if (householdsError) throw householdsError;
  const timezones = new Map(
    (households ?? []).map((home) => [String(home.id), String(home.timezone)]),
  );

  let generated = 0;
  let failed = 0;
  for (const rule of rules ?? []) {
    try {
      const timezone = timezones.get(String(rule.household_id)) ?? "UTC";
      const today = localDateOnly(timezone);
      const occurrences = enumerateDueOccurrences({
        startDate: String(rule.anchor_date),
        throughDate: today,
        endDate: rule.end_date ? String(rule.end_date) : undefined,
      })
        .filter((date) => date >= String(rule.next_due_date))
        .slice(0, 120);

      const splitConfig = normalSplitConfigSchema.parse(rule.split_config);
      const shares = calculateRecurringShares(Number(rule.amount_cents), splitConfig).map(
        (share, allocationOrder) => ({
          member_id: share.memberId,
          share_cents: share.amountCents,
          allocation_order: allocationOrder,
        }),
      );

      for (const occurrenceDate of occurrences) {
        const { data, error } = await callRpc<string | null>(
          admin,
          "service_create_recurring_occurrence",
          {
            p_rule_id: rule.id,
            p_occurrence_date: occurrenceDate,
            p_shares: shares,
            p_next_due_date: nextOccurrence(String(rule.anchor_date), occurrenceDate),
          },
        );
        if (error) throw error;
        if (data) generated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { generated, failed };
}

function localDateOnly(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function nextOccurrence(anchorDate: string, afterDate: string): string {
  const throughDate = epochDayToDateOnly(dateOnlyToEpochDay(afterDate) + 62);
  const next = enumerateDueOccurrences({ startDate: anchorDate, throughDate }).find(
    (date) => date > afterDate,
  );
  if (!next) throw new Error("Could not calculate the next recurring date.");
  return next;
}

function calculateRecurringShares(
  amountCents: number,
  config: ReturnType<typeof normalSplitConfigSchema.parse>,
) {
  if (config.method === "equal") {
    const participants = [...config.participants].sort((a, b) => a.order - b.order);
    return calculateEqualShares(
      amountCents,
      participants.map((participant) => participant.memberId),
    );
  }
  if (config.method === "exact") {
    const participants = [...config.participants].sort((a, b) => a.order - b.order);
    return calculateExactShares(
      amountCents,
      participants.map((participant) => ({
        memberId: participant.memberId,
        amountCents: participant.amountCents,
      })),
    );
  }
  const participants = [...config.participants].sort((a, b) => a.order - b.order);
  return calculatePercentageShares(
    amountCents,
    participants.map((participant) => ({
      memberId: participant.memberId,
      basisPoints: participant.basisPoints,
    })),
  );
}
