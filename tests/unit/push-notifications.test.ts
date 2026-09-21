import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPushEndpoint, pushSubscriptionSchema } from "@/lib/push/subscription";
const { schedule, admin, send, config } = vi.hoisted(() => ({
  schedule: vi.fn(),
  admin: vi.fn(),
  send: vi.fn(),
  config: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: admin }));
vi.mock("@/lib/push/config", () => ({ getPushConfig: config }));
vi.mock("web-push", () => ({ default: { sendNotification: send } }));
vi.mock("@/lib/push/delivery", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/push/delivery")>();
  return { ...original, schedulePush: schedule };
});
import { notifyExpense, settlementPushBodies } from "@/lib/push/expense-events";
import { deliverPush } from "@/lib/push/delivery";

beforeEach(() => {
  vi.clearAllMocks();
  config.mockReturnValue({
    publicKey: "public",
    privateKey: "private",
    subject: "mailto:test@example.com",
  });
  const names = builder({
    data: [
      { id: "a", display_name: "Alex" },
      { id: "b", display_name: "Bea" },
      { id: "c", display_name: "Chris" },
    ],
    error: null,
  });
  admin.mockReturnValue({ from: vi.fn(() => names) });
});

it.each([
  "https://localhost/push",
  "http://fcm.googleapis.com/fcm/send/x",
  "https://127.0.0.1/x",
  "https://fcm.googleapis.com.evil.test/x",
  "https://evilpush.apple.com/x",
  "https://user:password@fcm.googleapis.com/x",
  "https://fcm.googleapis.com:8443/x",
])("rejects unsafe push endpoints: %s", (url) => {
  expect(isPushEndpoint(url)).toBe(false);
});
it.each([
  "https://fcm.googleapis.com/fcm/send/test",
  "https://web.push.apple.com/test",
  "https://updates.push.services.mozilla.com/wpush/v2/test",
  "https://wns2-db5p.notify.windows.com/w/?token=test",
])("allows browser push service: %s", (url) => {
  expect(isPushEndpoint(url)).toBe(true);
});
it("rejects missing encryption keys", () => {
  expect(
    pushSubscriptionSchema.safeParse({ endpoint: "https://fcm.googleapis.com/x", keys: {} })
      .success,
  ).toBe(false);
});

const base = {
  householdId: "group",
  expenseId: "expense",
  actorUserId: "actor",
  actorMemberId: "a",
  actorName: "Alex",
  title: "Breakfast",
  currency: "EUR",
  payer: "a",
  shares: [
    { member_id: "a", share_cents: 100 },
    { member_id: "b", share_cents: 200 },
  ],
};
describe("expense recipients", () => {
  it("uses the bill title and describes the payment from each recipient's perspective", async () => {
    await notifyExpense({ ...base, bill: true });
    expect(schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        memberIds: ["a", "b"],
        actorUserId: "actor",
        title: "Breakfast",
        body: "A new bill includes you.",
        memberBodies: {
          a: "You paid €3.00. Bea owes you €2.00.",
          b: "Alex paid €3.00. You owe €2.00.",
        },
        url: "/h/group/expenses/expense",
      }),
    );
  });
  it("updates everyone whose displayed total or share changed", async () => {
    await notifyExpense({
      ...base,
      before: { currency: "EUR", payer: "a", shares: { a: 100, b: 150, c: 200 } },
    });
    expect(schedule.mock.calls[0][0].memberIds).toEqual(["a", "b", "c"]);
    expect(schedule.mock.calls[0][0].memberBodies).toEqual({
      a: "You paid €3.00. Bea owes you €2.00.",
      b: "Alex paid €3.00. You owe €2.00.",
      c: "Alex paid €3.00. You are no longer included.",
    });
  });
  it("does not send for unchanged financial details", async () => {
    await notifyExpense({
      ...base,
      before: { currency: "EUR", payer: "a", shares: { a: 100, b: 200 } },
    });
    expect(schedule.mock.calls[0][0].memberIds).toEqual([]);
  });
  it("does not guess edit recipients when the old snapshot failed", async () => {
    await notifyExpense({ ...base, before: null });
    expect(schedule).not.toHaveBeenCalled();
  });
  it("notifies participants when currency changes", async () => {
    await notifyExpense({
      ...base,
      before: { currency: "USD", payer: "a", shares: { a: 100, b: 200 } },
    });
    expect(schedule.mock.calls[0][0].memberIds).toEqual(["a", "b"]);
  });
  it("identifies the landlord without mentioning who added the bill", async () => {
    await notifyExpense({ ...base, payer: null, bill: true });
    expect(schedule.mock.calls[0][0].memberBodies).toEqual({
      a: "Landlord paid €3.00. You owe €1.00.",
      b: "Landlord paid €3.00. You owe €2.00.",
    });
  });
  it("uses a concise collective amount when several members owe the payer", async () => {
    await notifyExpense({
      ...base,
      shares: [...base.shares, { member_id: "c", share_cents: 300 }],
    });
    expect(schedule.mock.calls[0][0].memberBodies.a).toBe("You paid €6.00. Others owe you €5.00.");
  });
});

it("formats settlement copy from each party's perspective", () => {
  expect(
    settlementPushBodies({
      payingMemberId: "a",
      receivingMemberId: "b",
      payerName: "Alex",
      receiverName: "Bea",
      amount: "€20.00",
    }),
  ).toEqual({
    a: "You paid Bea €20.00.",
    b: "Alex paid you €20.00.",
  });
});

function builder(result: unknown) {
  const query: Record<string, unknown> = {};
  for (const name of ["select", "eq", "in", "is", "delete"]) query[name] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}
const event = {
  householdId: "group",
  actorUserId: "actor",
  title: "Breakfast",
  memberIds: ["a", "b", "removed"],
  body: "A new expense includes you.",
  memberBodies: { b: "Alex added an expense: Breakfast. You owe Alex €2.00." },
  url: "/h/group/expenses/expense",
};
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/device",
  p256dh: "B".repeat(87),
  auth: "a".repeat(22),
  user_id: "recipient",
};
it("filters recipients and sends each member's own copy", async () => {
  const members = builder({
    data: [
      { id: "a", user_id: "actor" },
      { id: "b", user_id: "recipient" },
    ],
    error: null,
  });
  const devices = builder({ data: [subscription], error: null });
  admin.mockReturnValue({
    from: vi.fn((table) => (table === "household_members" ? members : devices)),
  });
  send.mockResolvedValue({});
  await deliverPush(event);
  expect(members.eq).toHaveBeenCalledWith("household_id", "group");
  expect(members.is).toHaveBeenCalledWith("removed_at", null);
  expect(devices.in).toHaveBeenCalledWith("user_id", ["recipient"]);
  expect(send).toHaveBeenCalledOnce();
  expect(JSON.parse(send.mock.calls[0][1])).toEqual({
    title: "Breakfast",
    body: event.memberBodies.b,
    url: event.url,
  });
});
it("removes expired endpoints but tolerates delivery failure", async () => {
  const members = builder({ data: [{ id: "b", user_id: "recipient" }], error: null });
  const devices = builder({ data: [subscription], error: null });
  admin.mockReturnValue({
    from: vi.fn((table) => (table === "household_members" ? members : devices)),
  });
  send.mockRejectedValue({ statusCode: 410 });
  await expect(deliverPush(event)).resolves.toMatchObject({
    status: "completed",
    delivered: 0,
    failed: 0,
    expired: 1,
  });
  expect(devices.delete).toHaveBeenCalledOnce();
  expect(devices.eq).toHaveBeenCalledWith("user_id", "recipient");
});
it("does not delete devices after a temporary push failure", async () => {
  const members = builder({ data: [{ user_id: "recipient" }], error: null });
  const devices = builder({ data: [subscription], error: null });
  admin.mockReturnValue({
    from: vi.fn((table) => (table === "household_members" ? members : devices)),
  });
  send.mockRejectedValue({ statusCode: 503 });
  await deliverPush(event);
  expect(devices.delete).not.toHaveBeenCalled();
});
it("does nothing when delivery is not configured", async () => {
  config.mockReturnValue(null);
  await deliverPush(event);
  expect(admin).not.toHaveBeenCalled();
});
