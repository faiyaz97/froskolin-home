import "server-only";

import { requireHouseholdMembership } from "@/lib/auth";

/**
 * The balance view is a database projection over payments, shares, and
 * settlements. It is not a mutable stored balance. The migration exposes it
 * as a security-invoker view so RLS remains in force.
 */
export async function getBalances(householdId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("household_balances")
    .select("household_id, member_id, currency, net_cents")
    .eq("household_id", householdId)
    .order("currency")
    .order("member_id");
  if (error) throw error;
  return data ?? [];
}

/**
 * Direct debts between the original payer and participant after pairwise
 * settlements. Unlike `getBalances`, this projection is intentionally not
 * simplified through unrelated members.
 */
export async function getPairBalances(householdId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("household_pair_balances")
    .select("household_id, currency, paying_member_id, receiving_member_id, amount_cents")
    .eq("household_id", householdId)
    .order("currency")
    .order("paying_member_id")
    .order("receiving_member_id");
  if (error) throw error;
  return data ?? [];
}
