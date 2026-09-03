"use server";

import { revalidatePath } from "next/cache";

import { requireHouseholdMembership } from "@/lib/auth";
import {
  calculateEqualShares,
  calculateExactShares,
  calculatePercentageShares,
  calculateUtilityShares,
  dateOnlyToEpochDay,
  enumerateDueOccurrences,
  epochDayToDateOnly,
  type DateRange,
} from "@/lib/domain";
import { callRpc } from "@/lib/supabase/rpc";
import { generateDueRecurringExpenses } from "@/lib/services/recurring";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  expenseInputSchema,
  archiveRecurringExpenseRuleSchema,
  recurringExpenseRuleSchema,
  replaceAbsencesSchema,
  setRecurringExpenseRuleActiveSchema,
  settlementInputSchema,
  updateExpenseSchema,
  updateRecurringExpenseRuleSchema,
  updateSettlementSchema,
  utilityConfirmationSchema,
  utilityUpdateSchema,
  voidExpenseSchema,
  voidSettlementSchema,
} from "@/lib/validation";
import { uuidSchema } from "@/lib/validation/common";

import { actionFailure, type ActionResult, validationFailure } from "./result";

/**
 * Database RPCs are reserved for multi-row financial writes. Calculation is
 * always performed in the pure domain layer before the validated allocations
 * cross this boundary.
 */
const rpc = {
  createExpense: "create_expense_with_shares",
  createUtility: "create_utility_bill_with_shares",
  replaceAbsences: "replace_absences_and_utility_shares",
  recordSettlement: "record_settlement",
} as const;

function refreshHousehold(householdId: string) {
  revalidatePath(`/h/${householdId}`);
  revalidatePath(`/h/${householdId}/balances`);
  revalidatePath(`/h/${householdId}/activity`);
  revalidatePath(`/h/${householdId}/calendar`);
}

function localDateOnly(timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalExpenseShares(input: ReturnType<typeof expenseInputSchema.parse>) {
  const config = input.splitConfig;
  const shares =
    config.method === "equal"
      ? calculateEqualShares(
          input.totalCents,
          config.participants.map((participant) => participant.memberId),
        )
      : config.method === "exact"
        ? calculateExactShares(
            input.totalCents,
            config.participants.map((participant) => ({
              memberId: participant.memberId,
              amountCents: participant.amountCents,
            })),
          )
        : calculatePercentageShares(
            input.totalCents,
            config.participants.map((participant) => ({
              memberId: participant.memberId,
              basisPoints: participant.basisPoints,
            })),
          );
  return shares.map((share, allocationOrder) => ({
    member_id: share.memberId,
    share_cents: share.amountCents,
    allocation_order: allocationOrder,
  }));
}

export async function saveExpenseAction(
  input: unknown,
): Promise<ActionResult<{ expenseId: string }>> {
  const parsed = expenseInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data, error } = await callRpc<string>(createAdminClient(), rpc.createExpense, {
      p_household_id: parsed.data.householdId,
      p_title: parsed.data.title,
      p_total_cents: parsed.data.totalCents,
      p_currency: parsed.data.currency,
      p_payer_member_id: parsed.data.payerMemberId,
      p_expense_date: parsed.data.expenseDate,
      p_kind: "manual",
      p_split_method: parsed.data.splitConfig.method,
      p_split_config: parsed.data.splitConfig,
      p_shares: normalExpenseShares(parsed.data),
      p_actor_user_id: user.id,
      p_recurring_rule_id: null,
      p_occurrence_date: null,
    });
    if (error || !data) throw error ?? new Error("No expense returned.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: { expenseId: String(data) } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ expenseId: string }>;
  }
}

export async function updateExpenseAction(input: unknown): Promise<ActionResult> {
  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user } = await requireHouseholdMembership(parsed.data.householdId);
    const { error } = await callRpc(createAdminClient(), "replace_expense_with_shares", {
      p_expense_id: parsed.data.expenseId,
      p_title: parsed.data.title,
      p_total_cents: parsed.data.totalCents,
      p_currency: parsed.data.currency,
      p_payer_member_id: parsed.data.payerMemberId,
      p_expense_date: parsed.data.expenseDate,
      p_split_method: parsed.data.splitConfig.method,
      p_split_config: parsed.data.splitConfig,
      p_shares: normalExpenseShares(parsed.data),
      p_actor_user_id: user.id,
    });
    if (error) throw error;
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function replaceAbsencesAction(input: unknown): Promise<ActionResult> {
  const parsed = replaceAbsencesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user, membership } = await requireHouseholdMembership(
      parsed.data.householdId,
    );
    if (membership.id !== parsed.data.memberId && membership.role !== "owner") {
      return { ok: false, error: "You can only edit your own away periods." };
    }
    const { data: utilities, error: utilityError } = await supabase
      .from("utility_bills")
      .select(
        "expense_id, service_start_date, service_end_date, total_cents, fixed_cents, variable_cents",
      )
      .eq("household_id", parsed.data.householdId);
    if (utilityError) throw utilityError;
    const utilityRows = (utilities ?? []) as Array<{
      expense_id: string;
      service_start_date: string;
      service_end_date: string;
      total_cents: number;
      fixed_cents: number;
      variable_cents: number;
    }>;
    const expenseIds = utilityRows.map((utility) => utility.expense_id);
    const { data: allShares, error: sharesError } = expenseIds.length
      ? await supabase
          .from("expense_shares")
          .select("expense_id, member_id, allocation_order")
          .in("expense_id", expenseIds)
      : { data: [], error: null };
    if (sharesError) throw sharesError;
    const sharesByExpense = new Map<
      string,
      Array<{ member_id: string; allocation_order: number }>
    >();
    for (const share of (allShares ?? []) as Array<{
      expense_id: string;
      member_id: string;
      allocation_order: number;
    }>) {
      const list = sharesByExpense.get(share.expense_id) ?? [];
      list.push(share);
      sharesByExpense.set(share.expense_id, list);
    }
    const affectedUtilities = utilityRows.filter((utility) =>
      (sharesByExpense.get(utility.expense_id) ?? []).some(
        (share) => share.member_id === parsed.data.memberId,
      ),
    );
    const participantIds = [
      ...new Set(
        affectedUtilities.flatMap((utility) =>
          (sharesByExpense.get(utility.expense_id) ?? []).map((share) => share.member_id),
        ),
      ),
    ];
    const { data: absences, error: absencesError } = participantIds.length
      ? await supabase
          .from("absence_periods")
          .select("member_id, start_date, end_date")
          .eq("household_id", parsed.data.householdId)
          .in("member_id", participantIds)
          .is("voided_at", null)
      : { data: [], error: null };
    if (absencesError) throw absencesError;
    const absenceByMember = new Map<string, DateRange[]>();
    for (const row of (absences ?? []) as Array<{
      member_id: string;
      start_date: string;
      end_date: string;
    }>) {
      if (row.member_id === parsed.data.memberId) continue;
      const list = absenceByMember.get(row.member_id) ?? [];
      list.push({ startDate: row.start_date, endDate: row.end_date });
      absenceByMember.set(row.member_id, list);
    }
    absenceByMember.set(
      parsed.data.memberId,
      parsed.data.ranges.map((range) => ({ startDate: range.startDate, endDate: range.endDate })),
    );
    const utilityUpdates = affectedUtilities.map((utility) => {
      const participants = (sharesByExpense.get(utility.expense_id) ?? []).sort(
        (a, b) => a.allocation_order - b.allocation_order,
      );
      const calculated = calculateUtilityShares({
        totalCents: utility.total_cents,
        fixedCents: utility.fixed_cents,
        variableCents: utility.variable_cents,
        servicePeriod: { startDate: utility.service_start_date, endDate: utility.service_end_date },
        participants: participants.map((participant) => ({
          memberId: participant.member_id,
          absenceRanges: absenceByMember.get(participant.member_id),
        })),
      });
      return {
        expense_id: utility.expense_id,
        variable_split_mode: calculated.variableMode,
        shares: calculated.shares.map((share, allocationOrder) => ({
          member_id: share.memberId,
          share_cents: share.amountCents,
          fixed_share_cents: share.fixedCents,
          variable_share_cents: share.variableCents,
          presence_days: share.presenceDays,
          allocation_order: allocationOrder,
        })),
      };
    });
    const { error } = await callRpc(createAdminClient(), rpc.replaceAbsences, {
      p_household_id: parsed.data.householdId,
      p_member_id: parsed.data.memberId,
      p_ranges: parsed.data.ranges.map((range) => ({
        start_date: range.startDate,
        end_date: range.endDate,
      })),
      p_utility_updates: utilityUpdates,
      p_expected_absences: (absences ?? [])
        .filter((row) => row.member_id !== parsed.data.memberId)
        .map((row) => ({
          member_id: row.member_id,
          start_date: row.start_date,
          end_date: row.end_date,
        })),
      p_actor_user_id: user.id,
    });
    if (error) throw error;
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function confirmUtilityBillAction(
  input: unknown,
): Promise<ActionResult<{ expenseId: string }>> {
  const parsed = utilityConfirmationSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const ids = parsed.data.participants.map((participant) => participant.memberId);
    const { data: absenceRows, error: absenceError } = await supabase
      .from("absence_periods")
      .select("member_id, start_date, end_date")
      .eq("household_id", parsed.data.householdId)
      .in("member_id", ids)
      .is("voided_at", null)
      .lte("start_date", parsed.data.serviceEnd)
      .gte("end_date", parsed.data.serviceStart);
    if (absenceError) throw absenceError;
    const absenceByMember = new Map<string, DateRange[]>();
    for (const absence of (absenceRows ?? []) as Array<{
      member_id: string;
      start_date: string;
      end_date: string;
    }>) {
      const list = absenceByMember.get(absence.member_id) ?? [];
      list.push({ startDate: absence.start_date, endDate: absence.end_date });
      absenceByMember.set(absence.member_id, list);
    }
    const utility = calculateUtilityShares({
      totalCents: parsed.data.totalCents,
      fixedCents: parsed.data.fixedCents,
      variableCents: parsed.data.variableCents,
      servicePeriod: { startDate: parsed.data.serviceStart, endDate: parsed.data.serviceEnd },
      participants: parsed.data.participants.map((participant) => ({
        memberId: participant.memberId,
        absenceRanges: absenceByMember.get(participant.memberId),
      })),
    });
    const { data, error } = await callRpc<string>(createAdminClient(), rpc.createUtility, {
      p_household_id: parsed.data.householdId,
      p_title: parsed.data.title,
      p_total_cents: parsed.data.totalCents,
      p_currency: parsed.data.currency,
      p_payer_member_id: parsed.data.payerMemberId,
      p_expense_date: parsed.data.issueDate ?? parsed.data.serviceEnd,
      p_split_config: {
        method: "utility",
        participants: parsed.data.participants,
        fixedCents: parsed.data.fixedCents,
        variableCents: parsed.data.variableCents,
      },
      p_shares: utility.shares.map((share, allocationOrder) => ({
        member_id: share.memberId,
        share_cents: share.amountCents,
        fixed_share_cents: share.fixedCents,
        variable_share_cents: share.variableCents,
        presence_days: share.presenceDays,
        allocation_order: allocationOrder,
      })),
      p_utility_type: parsed.data.utilityType,
      p_supplier: parsed.data.supplier ?? null,
      p_issue_date: parsed.data.issueDate ?? null,
      p_service_start_date: parsed.data.serviceStart,
      p_service_end_date: parsed.data.serviceEnd,
      p_fixed_cents: parsed.data.fixedCents,
      p_variable_cents: parsed.data.variableCents,
      p_consumption_amount: parsed.data.consumptionAmount ?? null,
      p_consumption_unit: parsed.data.consumptionUnit ?? null,
      p_bill_document_id: parsed.data.documentId ?? null,
      p_classification_note: parsed.data.classificationNote ?? null,
      p_variable_split_mode: utility.variableMode,
      p_actor_user_id: user.id,
    });
    if (error || !data) throw error ?? new Error("No bill returned.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: { expenseId: String(data) } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ expenseId: string }>;
  }
}

export async function updateUtilityBillAction(input: unknown): Promise<ActionResult> {
  const parsed = utilityUpdateSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const ids = parsed.data.participants.map((participant) => participant.memberId);
    const { data: absenceRows, error: absenceError } = await supabase
      .from("absence_periods")
      .select("member_id, start_date, end_date")
      .eq("household_id", parsed.data.householdId)
      .in("member_id", ids)
      .is("voided_at", null)
      .lte("start_date", parsed.data.serviceEnd)
      .gte("end_date", parsed.data.serviceStart);
    if (absenceError) throw absenceError;
    const absenceByMember = new Map<string, DateRange[]>();
    for (const absence of (absenceRows ?? []) as Array<{
      member_id: string;
      start_date: string;
      end_date: string;
    }>) {
      const list = absenceByMember.get(absence.member_id) ?? [];
      list.push({ startDate: absence.start_date, endDate: absence.end_date });
      absenceByMember.set(absence.member_id, list);
    }
    const utility = calculateUtilityShares({
      totalCents: parsed.data.totalCents,
      fixedCents: parsed.data.fixedCents,
      variableCents: parsed.data.variableCents,
      servicePeriod: { startDate: parsed.data.serviceStart, endDate: parsed.data.serviceEnd },
      participants: parsed.data.participants.map((participant) => ({
        memberId: participant.memberId,
        absenceRanges: absenceByMember.get(participant.memberId),
      })),
    });
    const { error } = await callRpc(createAdminClient(), "replace_utility_bill_with_shares", {
      p_expense_id: parsed.data.expenseId,
      p_title: parsed.data.title,
      p_total_cents: parsed.data.totalCents,
      p_currency: parsed.data.currency,
      p_payer_member_id: parsed.data.payerMemberId,
      p_expense_date: parsed.data.issueDate ?? parsed.data.serviceEnd,
      p_split_config: {
        method: "utility",
        participants: parsed.data.participants,
        fixedCents: parsed.data.fixedCents,
        variableCents: parsed.data.variableCents,
      },
      p_shares: utility.shares.map((share, allocationOrder) => ({
        member_id: share.memberId,
        share_cents: share.amountCents,
        fixed_share_cents: share.fixedCents,
        variable_share_cents: share.variableCents,
        presence_days: share.presenceDays,
        allocation_order: allocationOrder,
      })),
      p_utility_type: parsed.data.utilityType,
      p_supplier: parsed.data.supplier ?? null,
      p_issue_date: parsed.data.issueDate ?? null,
      p_service_start_date: parsed.data.serviceStart,
      p_service_end_date: parsed.data.serviceEnd,
      p_fixed_cents: parsed.data.fixedCents,
      p_variable_cents: parsed.data.variableCents,
      p_consumption_amount: parsed.data.consumptionAmount ?? null,
      p_consumption_unit: parsed.data.consumptionUnit ?? null,
      p_classification_note: parsed.data.classificationNote ?? null,
      p_variable_split_mode: utility.variableMode,
      p_actor_user_id: user.id,
    });
    if (error) throw error;
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveSettlementAction(
  input: unknown,
): Promise<ActionResult<{ settlementId: string }>> {
  const parsed = settlementInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data, error } = await callRpc<string>(createAdminClient(), rpc.recordSettlement, {
      p_household_id: parsed.data.householdId,
      p_paying_member_id: parsed.data.payingMemberId,
      p_receiving_member_id: parsed.data.receivingMemberId,
      p_amount_cents: parsed.data.amountCents,
      p_currency: parsed.data.currency,
      p_settlement_date: parsed.data.settlementDate,
      p_note: parsed.data.note ?? null,
      p_actor_user_id: user.id,
    });
    if (error || !data) throw error ?? new Error("No settlement returned.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: { settlementId: String(data) } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ settlementId: string }>;
  }
}

export async function updateSettlementAction(input: unknown): Promise<ActionResult> {
  const parsed = updateSettlementSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data, error } = await supabase
      .from("settlements")
      .update({
        paying_member_id: parsed.data.payingMemberId,
        receiving_member_id: parsed.data.receivingMemberId,
        amount_cents: parsed.data.amountCents,
        currency: parsed.data.currency,
        settlement_date: parsed.data.settlementDate,
        note: parsed.data.note ?? null,
        updated_by: user.id,
      })
      .eq("id", parsed.data.settlementId)
      .eq("household_id", parsed.data.householdId)
      .is("voided_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("Settlement is unavailable.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function voidSettlementAction(input: unknown): Promise<ActionResult> {
  const parsed = voidSettlementSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data, error } = await supabase
      .from("settlements")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        void_reason: parsed.data.reason,
        updated_by: user.id,
      })
      .eq("id", parsed.data.settlementId)
      .eq("household_id", parsed.data.householdId)
      .is("voided_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("Settlement is unavailable.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function saveRecurringExpenseRuleAction(
  input: unknown,
): Promise<ActionResult<{ ruleId: string }>> {
  const parsed = recurringExpenseRuleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data, error } = await supabase
      .from("recurring_expense_rules")
      .insert({
        household_id: parsed.data.householdId,
        title: parsed.data.title,
        amount_cents: parsed.data.amountCents,
        currency: parsed.data.currency,
        payer_member_id: parsed.data.payerMemberId,
        split_method: parsed.data.splitConfig.method,
        split_config: parsed.data.splitConfig,
        anchor_date: parsed.data.startDate,
        end_date: parsed.data.endDate ?? null,
        next_due_date: parsed.data.startDate,
        active: parsed.data.active,
        created_by: user.id,
        updated_by: user.id,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("No rule returned.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: { ruleId: String((data as { id: string }).id) } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ ruleId: string }>;
  }
}

export async function generateDueRecurringExpensesAction(
  input: unknown,
): Promise<ActionResult<number>> {
  const parsed = uuidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid household." };
  try {
    await requireHouseholdMembership(parsed.data);
    const result = await generateDueRecurringExpenses(parsed.data);
    refreshHousehold(parsed.data);
    if (result.failed)
      return {
        ok: false,
        error: `${result.failed} recurring rule${result.failed === 1 ? " needs" : "s need"} correction before generation.`,
      };
    return { ok: true, data: result.generated };
  } catch (error) {
    return actionFailure(error) as ActionResult<number>;
  }
}

export async function updateRecurringExpenseRuleAction(input: unknown): Promise<ActionResult> {
  const parsed = updateRecurringExpenseRuleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data: home, error: homeError } = await supabase
      .from("households")
      .select("timezone")
      .eq("id", parsed.data.householdId)
      .single();
    if (homeError) throw homeError;
    const today = localDateOnly(home.timezone);
    const through = epochDayToDateOnly(
      Math.max(dateOnlyToEpochDay(today), dateOnlyToEpochDay(parsed.data.startDate)) + 400,
    );
    const nextDueDate = enumerateDueOccurrences({
      startDate: parsed.data.startDate,
      throughDate: through,
      endDate: parsed.data.endDate ?? undefined,
    }).find((date) => date >= today);
    if (!nextDueDate) return { ok: false, error: "This recurring rule has no future occurrence." };
    const { data, error } = await supabase
      .from("recurring_expense_rules")
      .update({
        title: parsed.data.title,
        amount_cents: parsed.data.amountCents,
        currency: parsed.data.currency,
        payer_member_id: parsed.data.payerMemberId,
        split_method: parsed.data.splitConfig.method,
        split_config: parsed.data.splitConfig,
        anchor_date: parsed.data.startDate,
        end_date: parsed.data.endDate ?? null,
        next_due_date: nextDueDate,
        active: parsed.data.active,
        updated_by: user.id,
      })
      .eq("id", parsed.data.ruleId)
      .eq("household_id", parsed.data.householdId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("Recurring rule is unavailable.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function archiveRecurringExpenseRuleAction(input: unknown): Promise<ActionResult> {
  const parsed = archiveRecurringExpenseRuleSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data, error } = await supabase
      .from("recurring_expense_rules")
      .update({ active: false, archived_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", parsed.data.ruleId)
      .eq("household_id", parsed.data.householdId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("Recurring rule is unavailable.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setRecurringExpenseRuleActiveAction(input: unknown): Promise<ActionResult> {
  const parsed = setRecurringExpenseRuleActiveSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    let nextDueDate: string | undefined;
    if (parsed.data.active) {
      const [{ data: rule, error: ruleError }, { data: home, error: homeError }] =
        await Promise.all([
          supabase
            .from("recurring_expense_rules")
            .select("anchor_date, end_date")
            .eq("id", parsed.data.ruleId)
            .eq("household_id", parsed.data.householdId)
            .is("archived_at", null)
            .single(),
          supabase.from("households").select("timezone").eq("id", parsed.data.householdId).single(),
        ]);
      if (ruleError || homeError) throw ruleError ?? homeError;
      const today = localDateOnly(home.timezone);
      const through = epochDayToDateOnly(dateOnlyToEpochDay(today) + 62);
      nextDueDate = enumerateDueOccurrences({
        startDate: rule.anchor_date,
        throughDate: through,
        endDate: rule.end_date ?? undefined,
      }).find((date) => date >= today);
      if (!nextDueDate) return { ok: false, error: "This recurring rule has already ended." };
    }
    const { data, error } = await supabase
      .from("recurring_expense_rules")
      .update({
        active: parsed.data.active,
        ...(nextDueDate ? { next_due_date: nextDueDate } : {}),
        updated_by: user.id,
      })
      .eq("id", parsed.data.ruleId)
      .eq("household_id", parsed.data.householdId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("Recurring rule is unavailable.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function voidExpenseAction(input: unknown): Promise<ActionResult> {
  const parsed = voidExpenseSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdMembership(parsed.data.householdId);
    const { data, error } = await supabase
      .from("expenses")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: user.id,
        void_reason: parsed.data.reason,
      })
      .eq("id", parsed.data.expenseId)
      .eq("household_id", parsed.data.householdId)
      .is("voided_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("Expense is unavailable.");
    refreshHousehold(parsed.data.householdId);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}
