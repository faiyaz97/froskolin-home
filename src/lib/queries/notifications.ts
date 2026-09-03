import "server-only";

import { requireAuthenticatedUser, requireHouseholdMembership } from "@/lib/auth";

export async function getNotifications(householdId: string, limit = 50) {
  const { supabase, user } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("notifications")
    .select("id, message, event_type, related_entity_type, related_entity_id, created_at, read_at")
    .eq("household_id", householdId)
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;
  return data ?? [];
}

export async function getUnreadNotificationCount(householdId: string) {
  const { supabase, user } = await requireHouseholdMembership(householdId);
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("recipient_user_id", user.id)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const { supabase, user } = await requireAuthenticatedUser();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_user_id", user.id);
  if (error) throw error;
}

export async function markAllNotificationsRead(householdId: string) {
  const { supabase, user } = await requireHouseholdMembership(householdId);
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("recipient_user_id", user.id)
    .is("read_at", null);
  if (error) throw error;
}
