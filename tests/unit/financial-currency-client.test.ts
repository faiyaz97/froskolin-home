import { beforeEach, expect, it, vi } from "vitest";

const { requireHouseholdMutation, createAdminClient, notifyExpense, schedulePush } = vi.hoisted(
  () => ({
    requireHouseholdMutation: vi.fn(),
    createAdminClient: vi.fn(),
    notifyExpense: vi.fn(),
    schedulePush: vi.fn(),
  }),
);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireHouseholdMutation }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/push/expense-events", () => ({
  notifyExpense,
  readPushMemberNames: vi.fn().mockResolvedValue({}),
  settlementPushBodies: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/push/delivery", () => ({ schedulePush }));

import { saveExpenseAction, saveSettlementAction } from "@/lib/actions/financial";

const householdId = "00000000-0000-4000-8000-000000000001";
const payerId = "00000000-0000-4000-8000-000000000002";
const receiverId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  const single = vi.fn().mockResolvedValue({ data: { default_currency: "EUR" }, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const supabase = {
    from: vi.fn().mockReturnValue({ select }),
  };
  requireHouseholdMutation.mockResolvedValue({
    supabase,
    user: { id: "00000000-0000-4000-8000-000000000004" },
    membership: { id: payerId, display_name: "Member" },
  });
  createAdminClient.mockReturnValue({
    from: vi.fn(() => {
      throw new Error("Service role has no direct household SELECT grant");
    }),
    rpc: vi.fn().mockResolvedValue({ data: "00000000-0000-4000-8000-000000000005", error: null }),
  });
  notifyExpense.mockResolvedValue(undefined);
  schedulePush.mockResolvedValue(undefined);
});

it("saves an expense using the member-scoped currency read", async () => {
  const result = await saveExpenseAction({
    householdId,
    title: "Shared cost",
    totalCents: 1000,
    payerMemberId: payerId,
    expenseDate: "2026-09-23",
    splitConfig: { method: "equal", participants: [{ memberId: payerId, order: 0 }] },
  });

  expect(result.ok).toBe(true);
  expect(createAdminClient.mock.results[0].value.from).not.toHaveBeenCalled();
  expect(createAdminClient.mock.results[0].value.rpc).toHaveBeenCalledWith(
    "create_expense_with_landlord_support",
    expect.objectContaining({ p_currency: "EUR" }),
  );
});

it("saves a settlement using the member-scoped currency read", async () => {
  const result = await saveSettlementAction({
    householdId,
    payingMemberId: payerId,
    receivingMemberId: receiverId,
    amountCents: 500,
    settlementDate: "2026-09-23",
  });

  expect(result.ok).toBe(true);
  expect(createAdminClient.mock.results[0].value.from).not.toHaveBeenCalled();
  expect(createAdminClient.mock.results[0].value.rpc).toHaveBeenCalledWith(
    "record_settlement",
    expect.objectContaining({ p_currency: "EUR" }),
  );
});
