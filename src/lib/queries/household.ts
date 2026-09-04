import "server-only";

import { requireHouseholdMembership } from "@/lib/auth";

export async function getHousehold(householdId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("households")
    .select(
      "id, name, default_currency, locale, timezone, joining_enabled, landlord_enabled, archived_at",
    )
    .eq("id", householdId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getHouseholdMembers(householdId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("household_members")
    .select("id, user_id, display_name, role, joined_at, removed_at")
    .eq("household_id", householdId)
    .order("joined_at");
  if (error) throw error;
  return data ?? [];
}
