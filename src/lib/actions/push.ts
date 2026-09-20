"use server";

import { z } from "zod";
import { requireAuthenticatedMutation } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPushConfig } from "@/lib/push/config";
import { pushEndpointSchema, pushSubscriptionSchema } from "@/lib/push/subscription";
import { type ActionResult, actionFailure, validationFailure } from "./result";

export async function getPushConfigurationAction(): Promise<
  ActionResult<{ publicKey: string | null; userId: string }>
> {
  try {
    const { user } = await requireAuthenticatedMutation();
    return { ok: true, data: { publicKey: getPushConfig()?.publicKey ?? null, userId: user.id } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ publicKey: string | null; userId: string }>;
  }
}

export async function registerPushSubscriptionAction(input: unknown): Promise<ActionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user, supabase } = await requireAuthenticatedMutation();
    if (!getPushConfig()) return { ok: false, error: "Notifications are not available yet." };
    const { data: member, error: membershipError } = await supabase
      .from("household_members")
      .select("id")
      .eq("user_id", user.id)
      .is("removed_at", null)
      .maybeSingle();
    if (membershipError || !member)
      return { ok: false, error: "Join a group before enabling notifications." };
    const admin = createAdminClient();
    const { endpoint, keys } = parsed.data;
    // Possession of both encryption secrets is required to reassign a shared device.
    const { data: previous, error: readError } = await admin
      .from("push_subscriptions")
      .select("p256dh, auth")
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (readError) throw readError;
    if (previous && (previous.p256dh !== keys.p256dh || previous.auth !== keys.auth))
      return { ok: false, error: "Reset this device's notification permission and try again." };
    const { error } = await admin
      .from("push_subscriptions")
      .upsert(
        { endpoint, user_id: user.id, ...keys, updated_at: new Date().toISOString() },
        { onConflict: "endpoint" },
      );
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function unregisterPushSubscriptionAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ endpoint: pushEndpointSchema }).strict().safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  try {
    const { user } = await requireAuthenticatedMutation();
    const { error } = await createAdminClient()
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", parsed.data.endpoint)
      .eq("user_id", user.id);
    if (error) throw error;
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function getPushSubscriptionStatusAction(
  input: unknown,
): Promise<ActionResult<{ enabled: boolean }>> {
  const parsed = z.object({ endpoint: pushEndpointSchema }).strict().safeParse(input);
  if (!parsed.success) return validationFailure<{ enabled: boolean }>(parsed.error);
  try {
    const { user } = await requireAuthenticatedMutation();
    const { data, error } = await createAdminClient()
      .from("push_subscriptions")
      .select("endpoint")
      .eq("endpoint", parsed.data.endpoint)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return { ok: true, data: { enabled: Boolean(data) } };
  } catch (error) {
    return actionFailure(error) as ActionResult<{ enabled: boolean }>;
  }
}
