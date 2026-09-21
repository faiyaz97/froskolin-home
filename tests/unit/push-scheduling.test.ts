import { beforeEach, expect, it, vi } from "vitest";

const { admin, config, send } = vi.hoisted(() => ({
  admin: vi.fn(),
  config: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: admin }));
vi.mock("@/lib/push/config", () => ({ getPushConfig: config }));
vi.mock("web-push", () => ({ default: { sendNotification: send } }));

import { schedulePush } from "@/lib/push/delivery";

function builder(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const name of ["select", "eq", "in", "is", "delete"]) query[name] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  config.mockReturnValue({
    publicKey: "public",
    privateKey: "private",
    subject: "mailto:test@example.com",
  });
});

it("keeps the action alive until push delivery finishes", async () => {
  const members = builder({ data: [{ id: "member", user_id: "recipient" }], error: null });
  const devices = builder({
    data: [
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/device",
        p256dh: "B".repeat(87),
        auth: "a".repeat(22),
        user_id: "recipient",
      },
    ],
    error: null,
  });
  admin.mockReturnValue({
    from: vi.fn((table) => (table === "household_members" ? members : devices)),
  });
  send.mockResolvedValue({ statusCode: 201 });

  await schedulePush({
    householdId: "group",
    actorUserId: "actor",
    title: "Breakfast",
    memberIds: ["member"],
    body: "A new expense includes you.",
    url: "/h/group/expenses/expense",
  });

  expect(send).toHaveBeenCalledOnce();
});
