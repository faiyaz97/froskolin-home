"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AuthorizationError,
  createHouseCode,
  createInternalAuthAlias,
  deriveSupabasePassword,
  digestAccessCode,
  digestJoinPin,
  decryptJoinPin,
  encryptJoinPin,
  matchesJoinPin,
  normalizeHouseCode,
  provisionAuthUser,
  requireAuthenticatedUser,
  requireHouseholdMembership,
  requireHouseholdOwner,
  signInWithInternalAlias,
} from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { callRpc } from "@/lib/supabase/rpc";
import { createClient } from "@/lib/supabase/server";
import {
  changePinSchema,
  createHouseholdSchema,
  joinHouseholdSchema,
  loginSchema,
  removeMemberSchema,
  updateHouseholdSchema,
  updateHouseholdAccessSchema,
  updatePersonalSettingsSchema,
} from "@/lib/validation";

import { actionFailure, type ActionResult, validationFailure } from "./result";

async function lookupAlias(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  // This wrapper is executable only by service_role. It keeps `private` off
  // PostgREST while avoiding aliases in browser-visible tables or responses.
  const { data, error } = await callRpc<string>(admin, "service_get_auth_alias", {
    p_user_id: userId,
  });
  if (error) throw new Error("Private authentication aliases are unavailable.");
  return data ?? null;
}

async function storeAlias(userId: string, alias: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await callRpc(admin, "service_put_auth_alias", {
    p_user_id: userId,
    p_email_alias: alias,
  });
  if (error) throw new Error("Private authentication aliases are unavailable.");
}

async function findHouseholdByCode(code: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("households")
    .select("id, joining_enabled, join_pin_digest")
    .eq("house_code", normalizeHouseCode(code))
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; joining_enabled: boolean; join_pin_digest: string | null } | null;
}

async function createUniqueHouseCode(): Promise<string> {
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const houseCode = createHouseCode();
    const { data, error } = await admin
      .from("households")
      .select("id")
      .eq("house_code", houseCode)
      .maybeSingle();
    if (error) throw error;
    if (!data) return houseCode;
  }
  throw new Error("Unable to allocate a unique House Code.");
}

export async function createHouseholdAction(
  input: unknown,
): Promise<ActionResult<{ householdId: string; houseCode: string }>> {
  const parsed = createHouseholdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  let createdUserId: string | undefined;
  try {
    const houseCode = await createUniqueHouseCode();
    const alias = createInternalAuthAlias();
    const user = await provisionAuthUser(alias, parsed.data.pin);
    createdUserId = user.id;
    await storeAlias(user.id, alias);

    await signInWithInternalAlias(alias, parsed.data.pin);
    const supabase = await createClient();
    const { data: householdId, error } = await callRpc(supabase, "create_household_with_owner", {
      p_name: parsed.data.householdName,
      p_default_currency: parsed.data.defaultCurrency,
      p_locale: parsed.data.locale,
      p_timezone: parsed.data.timezone,
      p_access_code_digest: digestAccessCode(houseCode),
      p_house_code: houseCode,
      p_join_pin_digest: digestJoinPin(parsed.data.joinPin),
      p_encrypted_join_pin: encryptJoinPin(parsed.data.joinPin),
      p_display_name: parsed.data.displayName,
    });
    if (error || !householdId) throw error ?? new Error("Household was not created.");
    return { ok: true, data: { householdId: String(householdId), houseCode } };
  } catch (error) {
    if (createdUserId)
      await createAdminClient()
        .auth.admin.deleteUser(createdUserId)
        .catch(() => undefined);
    return actionFailure(error) as ActionResult<{ householdId: string; houseCode: string }>;
  }
}

export async function loginAction(input: unknown): Promise<ActionResult<{ householdId: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "We couldn't sign you in with those details." };
  try {
    const household = await findHouseholdByCode(parsed.data.houseCode);
    if (!household) throw new Error("Invalid credentials.");
    const admin = createAdminClient();
    const { data: member, error } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", household.id)
      .eq("display_name_normalized", parsed.data.displayName.trim().toLowerCase())
      .is("removed_at", null)
      .maybeSingle();
    if (error || !member) throw new Error("Invalid credentials.");
    const alias = await lookupAlias(member.user_id as string);
    if (!alias) throw new Error("Invalid credentials.");
    await signInWithInternalAlias(alias, parsed.data.pin);
    return { ok: true, data: { householdId: household.id } };
  } catch {
    return { ok: false, error: "We couldn't sign you in with those details." };
  }
}

export async function joinHouseholdAction(
  input: unknown,
): Promise<ActionResult<{ householdId: string }>> {
  const parsed = joinHouseholdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  let createdUserId: string | undefined;
  try {
    const household = await findHouseholdByCode(parsed.data.houseCode);
    if (
      !household?.joining_enabled ||
      !matchesJoinPin(parsed.data.joinPin, household.join_pin_digest)
    ) {
      return { ok: false, error: "We couldn't join with those details." };
    }
    const alias = createInternalAuthAlias();
    const user = await provisionAuthUser(alias, parsed.data.pin);
    createdUserId = user.id;
    const admin = createAdminClient();
    await storeAlias(user.id, alias);
    // Verify the newly provisioned credential before creating the membership.
    // If anything below fails, deleting the user can still cascade its alias
    // without a membership foreign key blocking cleanup.
    await signInWithInternalAlias(alias, parsed.data.pin);
    const { error: memberError } = await admin.from("household_members").insert({
      household_id: household.id,
      user_id: user.id,
      display_name: parsed.data.displayName,
      role: "member",
    });
    if (memberError) throw memberError;
    return { ok: true, data: { householdId: household.id } };
  } catch (error) {
    if (createdUserId)
      await createAdminClient()
        .auth.admin.deleteUser(createdUserId)
        .catch(() => undefined);
    return actionFailure(error) as ActionResult<{ householdId: string }>;
  }
}

export async function changePinAction(input: unknown): Promise<ActionResult> {
  const parsed = changePinSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user } = await requireAuthenticatedUser();
    const alias = await lookupAlias(user.id);
    if (
      !alias ||
      deriveSupabasePassword(alias, parsed.data.currentPin) ===
        deriveSupabasePassword(alias, parsed.data.newPin)
    ) {
      // The generic result avoids leaking internal account details. A same PIN
      // is not a useful credential rotation either.
      return { ok: false, error: "Choose a different six-digit PIN." };
    }
    // Verify the current PIN against Auth before replacing it.
    await signInWithInternalAlias(alias, parsed.data.currentPin);
    const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
      password: deriveSupabasePassword(alias, parsed.data.newPin),
      app_metadata: { ...user.app_metadata, must_change_pin: false },
    });
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "We couldn't change your PIN." };
  }
}

export async function updateHouseholdAccessAction(
  input: unknown,
): Promise<ActionResult<{ houseCode: string; joinPin: string }>> {
  const parsed = updateHouseholdAccessSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase } = await requireHouseholdOwner(parsed.data.householdId);
    const { error } = await callRpc(supabase, "update_household_access", {
      p_household_id: parsed.data.householdId,
      p_house_code: parsed.data.houseCode,
      p_access_code_digest: digestAccessCode(parsed.data.houseCode),
      p_join_pin_digest: digestJoinPin(parsed.data.joinPin),
      p_encrypted_join_pin: encryptJoinPin(parsed.data.joinPin),
    });
    if (error) {
      if (error.message?.toLowerCase().includes("unique")) {
        return { ok: false, error: "That House Code is already in use." };
      }
      throw new Error(error.message ?? "Household access could not be updated.");
    }
    revalidatePath(`/h/${parsed.data.householdId}`, "layout");
    return {
      ok: true,
      data: { houseCode: parsed.data.houseCode, joinPin: parsed.data.joinPin },
    };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ houseCode: string; joinPin: string }>;
  }
}

export async function getHouseholdJoinPinAction(
  householdId: string,
): Promise<ActionResult<{ joinPin: string | null }>> {
  try {
    const { supabase } = await requireHouseholdOwner(householdId);
    const { data, error } = await callRpc<string>(supabase, "get_household_join_pin_secret", {
      p_household_id: householdId,
    });
    if (error) throw new Error(error.message ?? "Join PIN is unavailable.");
    return { ok: true, data: { joinPin: data ? decryptJoinPin(data) : null } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ joinPin: string | null }>;
  }
}

export async function updateHouseholdAction(input: unknown): Promise<ActionResult> {
  const parsed = updateHouseholdSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase } = await requireHouseholdOwner(parsed.data.householdId);
    const { error } = await supabase
      .from("households")
      .update({
        name: parsed.data.name,
        default_currency: parsed.data.defaultCurrency,
        locale: parsed.data.locale,
        timezone: parsed.data.timezone,
        joining_enabled: parsed.data.joiningEnabled,
        landlord_enabled: parsed.data.landlordEnabled,
      })
      .eq("id", parsed.data.householdId);
    if (error) throw error;
    revalidatePath(`/h/${parsed.data.householdId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function updatePersonalSettingsAction(input: unknown): Promise<ActionResult> {
  const parsed = updatePersonalSettingsSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, membership } = await requireHouseholdMembership(parsed.data.householdId);
    const { error } = await supabase
      .from("household_members")
      .update({
        display_name: parsed.data.displayName,
        avatar_color: parsed.data.avatarColor,
      })
      .eq("id", membership.id)
      .eq("household_id", parsed.data.householdId);
    if (error?.code === "23505") {
      return { ok: false, error: "That name is already used in this household." };
    }
    if (error) throw error;
    revalidatePath(`/h/${parsed.data.householdId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function removeMemberAction(input: unknown): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { supabase, user } = await requireHouseholdOwner(parsed.data.householdId);
    const { data: target, error: targetError } = await supabase
      .from("household_members")
      .select("user_id, role")
      .eq("id", parsed.data.memberId)
      .eq("household_id", parsed.data.householdId)
      .is("removed_at", null)
      .maybeSingle();
    if (targetError || !target) throw targetError ?? new AuthorizationError("Member not found.");
    if (target.user_id === user.id || target.role === "owner") {
      return { ok: false, error: "Transfer ownership before removing the owner." };
    }
    const { error } = await supabase
      .from("household_members")
      .update({
        removed_at: new Date().toISOString(),
        removed_by: user.id,
      })
      .eq("id", parsed.data.memberId)
      .eq("household_id", parsed.data.householdId);
    if (error) throw error;
    revalidatePath(`/h/${parsed.data.householdId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function resetMemberPinAction(
  householdId: string,
  memberId: string,
): Promise<ActionResult<{ temporaryPin: string }>> {
  try {
    const { supabase, user: actor } = await requireHouseholdOwner(householdId);
    const { data: member, error } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("id", memberId)
      .eq("household_id", householdId)
      .is("removed_at", null)
      .maybeSingle();
    if (error || !member) throw new AuthorizationError("Member not found.");
    const alias = await lookupAlias(member.user_id as string);
    if (!alias) throw new Error("No account found.");
    const temporaryPin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const admin = createAdminClient();
    const { error: updateError } = await admin.auth.admin.updateUserById(member.user_id as string, {
      password: deriveSupabasePassword(alias, temporaryPin),
      app_metadata: { must_change_pin: true },
    });
    if (updateError) throw updateError;
    const { error: auditError } = await callRpc(admin, "service_record_pin_reset", {
      p_household_id: householdId,
      p_member_id: memberId,
      p_actor_user_id: actor.id,
    });
    if (auditError) {
      const { error: recoveryError } = await admin.from("audit_events").insert({
        household_id: householdId,
        actor_user_id: actor.id,
        action_type: "pin_reset",
        entity_type: "household_member",
        entity_id: memberId,
        new_values: { member_id: memberId },
        summary: "A household member reset a PIN.",
      });
      if (recoveryError)
        return {
          ok: true,
          data: { temporaryPin },
          message: "The PIN changed, but its audit entry needs administrator attention.",
        };
    }
    return { ok: true, data: { temporaryPin } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ temporaryPin: string }>;
  }
}

export async function signOutAction(destination: "/" | "/login" = "/login"): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    return actionFailure(error) as ActionResult;
  }
  redirect(destination === "/" ? "/" : "/login");
}
