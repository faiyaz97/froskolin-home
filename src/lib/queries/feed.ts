import "server-only";

import { requireHouseholdMembership } from "@/lib/auth";

export async function getActivityFeed(householdId: string, limit = 50, before?: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  let query = supabase
    .from("audit_events")
    .select(
      "id, action_type, entity_type, entity_id, summary, occurred_at, actor_user_id, new_values",
    )
    .eq("household_id", householdId)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (before) query = query.lt("occurred_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getHouseholdTransactions(householdId: string, limit = 50) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const rowLimit = Math.min(Math.max(limit, 1), 100);
  const [expensesResult, settlementsResult] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, title, total_cents, currency, payer_member_id, expense_date, created_at, kind, split_method, recurring_rule_id, expense_shares(member_id, share_cents)",
      )
      .eq("household_id", householdId)
      .is("voided_at", null)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(rowLimit),
    supabase
      .from("settlements")
      .select(
        "id, paying_member_id, receiving_member_id, amount_cents, currency, settlement_date, created_at",
      )
      .eq("household_id", householdId)
      .is("voided_at", null)
      .order("settlement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(rowLimit),
  ]);
  if (expensesResult.error) throw expensesResult.error;
  if (settlementsResult.error) throw settlementsResult.error;
  return {
    expenses: expensesResult.data ?? [],
    settlements: settlementsResult.data ?? [],
  };
}

export async function getExpenseDetail(householdId: string, expenseId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("expenses")
    .select("*, expense_shares(*), utility_bills(*)")
    .eq("household_id", householdId)
    .eq("id", expenseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
