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

function assertPinChangeComplete(user: { app_metadata?: Record<string, unknown> }) {
  if (user.app_metadata?.must_change_pin === true) {
    throw new AuthorizationError("Change your personal PIN before continuing.");
  }
}

export async function requireAuthenticatedMutation() {
  const result = await requireAuthenticatedUser();
  assertPinChangeComplete(result.user);
  return result;
}

export async function requireHouseholdMembership(householdId: string) {
  const { supabase, user } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("household_members")
    .select("id, role, household_id, user_id, display_name, avatar_color, removed_at")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (error || !data) throw new AuthorizationError();
  return {
    supabase,
    user,
    membership: data as {
      id: string;
      role: "owner" | "member";
      display_name: string;
      avatar_color: string | null;
    },
  };
}

export async function requireHouseholdOwner(householdId: string) {
  const result = await requireHouseholdMembership(householdId);
  if (result.membership.role !== "owner") {
    throw new AuthorizationError("Only the household owner can do that.");
  }
  return result;
}

export async function requireHouseholdMutation(householdId: string) {
  const result = await requireHouseholdMembership(householdId);
  assertPinChangeComplete(result.user);
  return result;
}

export async function requireHouseholdOwnerMutation(householdId: string) {
  const result = await requireHouseholdMutation(householdId);
  if (result.membership.role !== "owner") {
    throw new AuthorizationError("Only the household owner can do that.");
  }
  return result;
}
