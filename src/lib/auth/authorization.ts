import "server-only";

import { createClient } from "@/lib/supabase/server";

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this household.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AuthorizationError("Please sign in to continue.");
  return { supabase, user };
}

export async function requireHouseholdMembership(householdId: string) {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("household_members")
    .select("id, role, household_id, user_id, removed_at")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (error || !data) throw new AuthorizationError();
  return { supabase, user, membership: data as { id: string; role: "owner" | "member" } };
}

export async function requireHouseholdOwner(householdId: string) {
  const result = await requireHouseholdMembership(householdId);
  if (result.membership.role !== "owner") {
    throw new AuthorizationError("Only the household owner can do that.");
  }
  return result;
}
