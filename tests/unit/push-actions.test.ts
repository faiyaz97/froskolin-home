import { beforeEach, expect, it, vi } from "vitest";
const { authenticate, admin, config } = vi.hoisted(() => ({
  authenticate: vi.fn(),
  admin: vi.fn(),
  config: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAuthenticatedMutation: authenticate }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: admin }));
vi.mock("@/lib/push/config", () => ({ getPushConfig: config }));
import {
  registerPushSubscriptionAction,
  unregisterPushSubscriptionAction,
  getPushSubscriptionStatusAction,
} from "@/lib/actions/push";
function query(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "delete", "upsert"]) q[method] = vi.fn(() => q);
  q.maybeSingle = vi.fn(() => Promise.resolve(result));
  q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return q;
}
const input = {
  endpoint: "https://fcm.googleapis.com/fcm/send/device",
  keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
};
beforeEach(() => {
  vi.clearAllMocks();
  config.mockReturnValue({ publicKey: "public" });
});
it("rejects malformed endpoints before calling database", async () => {
  expect(
    (await registerPushSubscriptionAction({ ...input, endpoint: "https://127.0.0.1/secret" })).ok,
  ).toBe(false);
  expect(admin).not.toHaveBeenCalled();
});
it("rejects unauthenticated registration", async () => {
  authenticate.mockRejectedValue(new Error("Unauthenticated"));
  expect((await registerPushSubscriptionAction(input)).ok).toBe(false);
  expect(admin).not.toHaveBeenCalled();
});
it("requires an active membership", async () => {
  authenticate.mockResolvedValue({
    user: { id: "user" },
    supabase: { from: () => query({ data: null, error: null }) },
  });
  expect((await registerPushSubscriptionAction(input)).ok).toBe(false);
  expect(admin).not.toHaveBeenCalled();
});
it("binds registrations to authenticated identity, never caller supplied identity", async () => {
  authenticate.mockResolvedValue({
    user: { id: "user" },
    supabase: { from: () => query({ data: { id: "member" }, error: null }) },
  });
  const q = query({ data: null, error: null });
  admin.mockReturnValue({ from: () => q });
  expect((await registerPushSubscriptionAction(input)).ok).toBe(true);
  expect(q.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: "user", endpoint: input.endpoint }),
    { onConflict: "endpoint" },
  );
  expect((await registerPushSubscriptionAction({ ...input, user_id: "victim" })).ok).toBe(false);
});
it("rejects endpoint takeover with different encryption secrets", async () => {
  authenticate.mockResolvedValue({
    user: { id: "user" },
    supabase: { from: () => query({ data: { id: "member" }, error: null }) },
  });
  const q = query({ data: { p256dh: "other", auth: "other" }, error: null });
  admin.mockReturnValue({ from: () => q });
  expect((await registerPushSubscriptionAction(input)).ok).toBe(false);
  expect(q.upsert).not.toHaveBeenCalled();
});
it("scopes deletion and status to the current user", async () => {
  authenticate.mockResolvedValue({ user: { id: "user" } });
  const q = query({ data: null, error: null });
  admin.mockReturnValue({ from: () => q });
  expect((await unregisterPushSubscriptionAction({ endpoint: input.endpoint })).ok).toBe(true);
  expect(q.eq).toHaveBeenCalledWith("user_id", "user");
  expect(q.eq).toHaveBeenCalledWith("endpoint", input.endpoint);
  expect(await getPushSubscriptionStatusAction({ endpoint: input.endpoint })).toEqual({
    ok: true,
    data: { enabled: false },
  });
});
