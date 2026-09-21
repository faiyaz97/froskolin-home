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

export type PushDeliveryResult = {
  status:
    | "completed"
    | "not-configured"
    | "no-members"
    | "member-query-failed"
    | "no-recipients"
    | "subscription-query-failed"
    | "unexpected-error";
  recipients: number;
  subscriptions: number;
  delivered: number;
  failed: number;
  expired: number;
};

function deliveryResult(
  status: PushDeliveryResult["status"],
  values: Partial<Omit<PushDeliveryResult, "status">> = {},
): PushDeliveryResult {
  return {
    status,
    recipients: 0,
    subscriptions: 0,
    delivered: 0,
    failed: 0,
    expired: 0,
    ...values,
  };
}

/** Best effort, no inbox or persistent queue. Never affect the financial result. */
export async function schedulePush(event: PushEvent) {
  if (!event.memberIds.length) return;
  const result = await deliverPush(event);
  console.info("[push] delivery", result);
}

export async function deliverPush(event: PushEvent): Promise<PushDeliveryResult> {
  try {
    const config = getPushConfig();
    if (!config) return deliveryResult("not-configured");
    if (!event.memberIds.length) return deliveryResult("no-members");
    const admin = createAdminClient();
    const { data: members, error } = await admin
      .from("household_members")
      .select("user_id")
      .eq("household_id", event.householdId)
      .in("id", [...new Set(event.memberIds)])
      .is("removed_at", null);
    if (error) return deliveryResult("member-query-failed", { failed: 1 });
    const userIds = [...new Set((members ?? []).map((member) => String(member.user_id)))].filter(
      (id) => id !== event.actorUserId,
    );
    if (!userIds.length) return deliveryResult("no-recipients");
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, user_id")
      .in("user_id", userIds);
    if (subscriptionError)
      return deliveryResult("subscription-query-failed", {
        recipients: userIds.length,
        failed: 1,
      });
    let delivered = 0;
    let failed = 0;
    let expired = 0;
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
            delivered += 1;
          } catch (error) {
            const status =
              error && typeof error === "object" && "statusCode" in error ? error.statusCode : null;
            if (status === 404 || status === 410) {
              expired += 1;
              await admin
                .from("push_subscriptions")
                .delete()
                .eq("endpoint", subscription.endpoint)
                .eq("user_id", subscription.user_id);
            } else {
              failed += 1;
            }
          }
        }),
      );
    }
    return deliveryResult("completed", {
      recipients: userIds.length,
      subscriptions: subscriptions?.length ?? 0,
      delivered,
      failed,
      expired,
    });
  } catch {
    /* Delivery failures must not escape into financial writes. */
    return deliveryResult("unexpected-error", { failed: 1 });
  }
}
