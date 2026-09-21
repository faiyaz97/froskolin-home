import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPushConfig } from "./config";
import { pushSubscriptionSchema } from "./subscription";

export type PushEvent = {
  householdId: string;
  actorUserId: string | null;
  memberIds: string[];
  body: string;
  url: string;
};

/** Best effort, no inbox or persistent queue. Never affect the financial result. */
export async function schedulePush(event: PushEvent) {
  if (!getPushConfig() || !event.memberIds.length) return;
  await deliverPush(event);
}

export async function deliverPush(event: PushEvent) {
  try {
    const config = getPushConfig();
    if (!config || !event.memberIds.length) return;
    const admin = createAdminClient();
    const { data: members, error } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", event.householdId)
      .in("id", [...new Set(event.memberIds)])
      .is("removed_at", null);
    if (error) return;
    const userIds = [...new Set((members ?? []).map((member) => String(member.user_id)))].filter(
      (id) => id !== event.actorUserId,
    );
    if (!userIds.length) return;
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", userIds);
    if (subscriptionError) return;
    // Small concurrent batches bound resource use. No endpoints or payloads in logs.
    for (let index = 0; index < (subscriptions?.length ?? 0); index += 8) {
      await Promise.allSettled(
        subscriptions!.slice(index, index + 8).map(async (subscription) => {
          const parsed = pushSubscriptionSchema.safeParse({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          });
          if (!parsed.success) return;
          try {
            await webpush.sendNotification(
              parsed.data,
              JSON.stringify({ title: "Froskolin", body: event.body, url: event.url }),
              {
                vapidDetails: config,
                TTL: 3600,
                timeout: 5000,
                urgency: "normal",
              },
            );
          } catch (error) {
            const status =
              error && typeof error === "object" && "statusCode" in error ? error.statusCode : null;
            if (status === 404 || status === 410) {
              await admin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", subscription.endpoint)
                .eq("user_id", subscription.user_id);
            }
          }
        }),
      );
    }
  } catch {
    /* Delivery failures must not escape into financial writes. */
  }
}
