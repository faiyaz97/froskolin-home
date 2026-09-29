"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireHouseholdMutation } from "@/lib/auth";
import {
  activeBillPeriod,
  calculateUtilityShares,
  dateOnlyToEpochDay,
  type DateRange,
} from "@/lib/domain";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { uuidSchema } from "@/lib/validation/common";

import { actionFailure, type ActionResult, validationFailure } from "./result";

const dateSchema = z.string().refine((value) => {
  try {
    dateOnlyToEpochDay(value);
    return true;
  } catch {
    return false;
  }
}, "Choose a valid date.");

const updateDatesSchema = z
  .object({
    householdId: uuidSchema,
    memberId: uuidSchema,
    inDate: dateSchema,
    outDate: dateSchema.nullable(),
  })
  .refine((value) => !value.outDate || value.outDate >= value.inDate, {
    message: "Out must be on or after In.",
  });
const exitSchema = z.object({ householdId: uuidSchema, memberId: uuidSchema.optional() });

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

type ShareRow = {
  member_id: string;
  share_cents: number;
  fixed_share_cents: number | null;
  variable_share_cents: number | null;
  presence_days: number | null;
  allocation_order: number;
};

function shareSnapshot(rows: ShareRow[]) {
  return rows
    .slice()
    .sort((a, b) => a.allocation_order - b.allocation_order)
    .map((row) => ({
      member_id: row.member_id,
      share_cents: Number(row.share_cents),
      fixed_share_cents: row.fixed_share_cents == null ? null : Number(row.fixed_share_cents),
      variable_share_cents:
        row.variable_share_cents == null ? null : Number(row.variable_share_cents),
      presence_days: row.presence_days,
      allocation_order: row.allocation_order,
    }));
}

async function applyDates(input: {
  householdId: string;
  memberId: string;
  inDate: string | null;
  outDate: string | null;
  remove: boolean;
}): Promise<ActionResult> {
  try {
    const { supabase, user, membership } = await requireHouseholdMutation(input.householdId);
    if (
      (!input.remove && membership.role !== "owner") ||
      (input.remove && membership.id !== input.memberId && membership.role !== "owner")
    )
      return { ok: false, error: "Only an admin can change another member's dates." };

    const [{ data: target, error: targetError }, { data: home, error: homeError }] =
      await Promise.all([
        supabase
          .from("household_members")
          .select("id, role, in_date, out_date, removed_at")
          .eq("household_id", input.householdId)
          .eq("id", input.memberId)
          .is("removed_at", null)
          .maybeSingle(),
        supabase.from("households").select("timezone").eq("id", input.householdId).single(),
      ]);
    if (targetError || !target) return { ok: false, error: "Member is unavailable." };
    if (homeError || !home) return { ok: false, error: "Group is unavailable." };
    if (input.remove && membership.id !== input.memberId && target.role === "owner")
      return { ok: false, error: "Demote this admin before removing them." };
    const exitDay = input.remove ? localDateOnly(home.timezone) : null;
    const inDate = input.inDate ?? target.in_date;
    const outDate = input.remove
      ? target.out_date && target.out_date <= exitDay!
        ? target.out_date
        : exitDay
      : input.outDate;
    if (outDate && outDate < inDate) return { ok: false, error: "Out must be on or after In." };

    const { data: utilities, error: utilitiesError } = await supabase
      .from("utility_bills")
      .select(
        "expense_id, service_start_date, service_end_date, total_cents, fixed_cents, variable_cents, expenses!inner(voided_at)",
      )
      .eq("household_id", input.householdId)
      .is("expenses.voided_at", null);
    if (utilitiesError) throw utilitiesError;
    const expenseIds = (utilities ?? []).map((row) => row.expense_id);
    const { data: shareRows, error: sharesError } = expenseIds.length
      ? await supabase
          .from("expense_shares")
          .select(
            "expense_id, member_id, share_cents, fixed_share_cents, variable_share_cents, presence_days, allocation_order",
          )
          .in("expense_id", expenseIds)
      : { data: [], error: null };
    if (sharesError) throw sharesError;
    const sharesByExpense = new Map<string, ShareRow[]>();
    for (const row of shareRows ?? []) {
      const list = sharesByExpense.get(row.expense_id) ?? [];
      list.push(row);
      sharesByExpense.set(row.expense_id, list);
    }
    const affected = (utilities ?? []).filter((row) => {
      if (
        !(sharesByExpense.get(row.expense_id) ?? []).some(
          (share) => share.member_id === input.memberId,
        )
      )
        return false;
      const period = { startDate: row.service_start_date, endDate: row.service_end_date };
      return (
        JSON.stringify(activeBillPeriod(period, target.in_date, target.out_date)) !==
        JSON.stringify(activeBillPeriod(period, inDate, outDate))
      );
    });
    const participantIds = [
      ...new Set(
        affected.flatMap((row) =>
          (sharesByExpense.get(row.expense_id) ?? []).map((share) => share.member_id),
        ),
      ),
    ];
    const [{ data: members, error: membersError }, { data: absences, error: absencesError }] =
      await Promise.all([
        participantIds.length
          ? supabase
              .from("household_members")
              .select("id, in_date, out_date")
              .eq("household_id", input.householdId)
              .in("id", participantIds)
          : Promise.resolve({ data: [], error: null }),
        participantIds.length
          ? supabase
              .from("absence_periods")
              .select("member_id, start_date, end_date")
              .eq("household_id", input.householdId)
              .in("member_id", participantIds)
              .is("voided_at", null)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (membersError || absencesError) throw membersError ?? absencesError;
    const datesByMember = new Map((members ?? []).map((row) => [row.id, row]));
    const absenceByMember = new Map<string, DateRange[]>();
    for (const row of absences ?? []) {
      const list = absenceByMember.get(row.member_id) ?? [];
      list.push({ startDate: row.start_date, endDate: row.end_date });
      absenceByMember.set(row.member_id, list);
    }
    const updates = affected.flatMap((utility) => {
      const original = shareSnapshot(sharesByExpense.get(utility.expense_id) ?? []);
      const calculated = calculateUtilityShares({
        totalCents: Number(utility.total_cents),
        fixedCents: Number(utility.fixed_cents),
        variableCents: Number(utility.variable_cents),
        servicePeriod: { startDate: utility.service_start_date, endDate: utility.service_end_date },
        participants: original.map((share) => ({
          memberId: share.member_id,
          inDate:
            share.member_id === input.memberId
              ? inDate
              : datesByMember.get(share.member_id)?.in_date,
          outDate:
            share.member_id === input.memberId
              ? outDate
              : datesByMember.get(share.member_id)?.out_date,
          absenceRanges: absenceByMember.get(share.member_id),
        })),
      });
      const shares = calculated.shares.map((share, allocation_order) => ({
        member_id: share.memberId,
        share_cents: share.amountCents,
        fixed_share_cents: share.fixedCents,
        variable_share_cents: share.variableCents,
        presence_days: share.presenceDays,
        allocation_order,
      }));
      return [
        {
          expense_id: utility.expense_id,
          expected_shares: original,
          expected_service_start: utility.service_start_date,
          expected_service_end: utility.service_end_date,
          expected_total_cents: utility.total_cents,
          expected_fixed_cents: utility.fixed_cents,
          expected_variable_cents: utility.variable_cents,
          shares,
          variable_split_mode: calculated.variableMode,
        },
      ];
    });

    const { error } = await callRpc(createAdminClient(), "apply_member_billing_dates", {
      p_household_id: input.householdId,
      p_member_id: input.memberId,
      p_in_date: inDate,
      p_out_date: outDate,
      p_expected_in_date: target.in_date,
      p_expected_out_date: target.out_date,
      p_utility_updates: updates,
      p_remove: input.remove,
      p_actor_user_id: user.id,
    });
    if (error?.message?.includes("reverse landlord payments"))
      return {
        ok: false,
        error: "A bill has recorded payments. Undo them before changing these dates.",
      };
    if (error?.message?.includes("group requires at least one admin"))
      return { ok: false, error: "Promote another admin before leaving the group." };
    if (error?.message?.includes("active recurring rule"))
      return { ok: false, error: "Remove this member from active recurring expenses first." };
    if (error?.message?.includes("must settle"))
      return { ok: false, error: "Settle the remaining balance before leaving the group." };
    if (error?.code === "40001")
      return { ok: false, error: "Group details changed. Refresh and try again." };
    if (error) throw error;
    revalidatePath(`/h/${input.householdId}`, "layout");
    revalidatePath(`/h/${input.householdId}/balances`);
    revalidatePath(`/h/${input.householdId}/activity`);
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, error: error.message };
    return actionFailure(error);
  }
}

export async function updateMemberBillingDatesAction(input: unknown): Promise<ActionResult> {
  const parsed = updateDatesSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  return applyDates({ ...parsed.data, remove: false });
}

export async function leaveGroupAction(input: unknown): Promise<ActionResult> {
  const parsed = exitSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { membership } = await requireHouseholdMutation(parsed.data.householdId);
    return applyDates({
      householdId: parsed.data.householdId,
      memberId: membership.id,
      inDate: null,
      outDate: null,
      remove: true,
    });
  } catch (error) {
    return actionFailure(error);
  }
}

export async function removeMemberWithBillingAction(input: unknown): Promise<ActionResult> {
  const parsed = exitSchema.safeParse(input);
  if (!parsed.success || !parsed.data.memberId)
    return { ok: false, error: "Choose a member to remove." };
  return applyDates({
    householdId: parsed.data.householdId,
    memberId: parsed.data.memberId,
    inDate: null,
    outDate: null,
    remove: true,
  });
}
