"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser, requireHouseholdMembership } from "@/lib/auth";

import { actionFailure, type ActionResult } from "./result";

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireAuthenticatedUser();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("recipient_user_id", user.id);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}

export async function markAllNotificationsReadAction(householdId: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await requireHouseholdMembership(householdId);
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("household_id", householdId)
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
    if (error) throw error;
    revalidatePath(`/h/${householdId}/notifications`);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error);
  }
}
