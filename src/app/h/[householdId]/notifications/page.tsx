import { CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions";
import { formatDateTime } from "@/lib/format";
import { getHousehold, getNotifications } from "@/lib/queries";

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [home, notifications] = await Promise.all([
    getHousehold(householdId),
    getNotifications(householdId),
  ]);
  const markAll = async () => {
    "use server";
    await markAllNotificationsReadAction(householdId);
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        action={
          notifications.some((item) => !item.read_at) ? (
            <form action={markAll}>
              <Button type="submit" tone="quiet" className="hidden sm:inline-flex">
                <CheckCheck className="size-4" /> Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
        {!notifications.length && (
          <p className="p-8 text-center text-sm text-[var(--muted)]">No roommate updates yet.</p>
        )}
        {notifications.map((item) => {
          const markOne = async () => {
            "use server";
            await markNotificationReadAction(item.id);
          };
          return (
            <article
              key={item.id}
              className="flex gap-3 border-b border-[var(--soft-line)] px-4 py-4 last:border-0"
            >
              <span
                className={`mt-1 size-2.5 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : "bg-[var(--peach)]"}`}
              >
                <span className="screen-reader-only">{item.read_at ? "Read" : "Unread"}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className={item.read_at ? "font-bold" : "font-extrabold"}>{item.message}</p>
                <time className="mt-2 block text-xs text-[var(--muted)]">
                  {formatDateTime(
                    item.created_at,
                    home?.locale ?? "en-GB",
                    home?.timezone ?? "UTC",
                  )}
                </time>
              </div>
              {!item.read_at && (
                <form action={markOne} className="self-center">
                  <Button type="submit" tone="quiet" className="px-3">
                    Mark read
                  </Button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
