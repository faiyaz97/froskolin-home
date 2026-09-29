import { beforeEach, expect, it, vi } from "vitest";

const {
  requireHouseholdMutation,
  createAdminClient,
  notifyExpense,
  schedulePush,
  getBalances,
  getPairBalances,
  getAllLandlordShareBalances,
  getHouseholdMembers,
} = vi.hoisted(() => ({
  requireHouseholdMutation: vi.fn(),
  createAdminClient: vi.fn(),
  notifyExpense: vi.fn(),
  schedulePush: vi.fn(),
  getBalances: vi.fn(),
  getPairBalances: vi.fn(),
  getAllLandlordShareBalances: vi.fn(),
  getHouseholdMembers: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireHouseholdMutation }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/push/expense-events", () => ({
  notifyExpense,
  readPushMemberNames: vi.fn().mockResolvedValue({}),
  settlementPushBodies: vi.fn().mockReturnValue({}),
}));
vi.mock("@/lib/push/delivery", () => ({ schedulePush }));
vi.mock("@/lib/queries", () => ({
  getBalances,
  getPairBalances,
  getAllLandlordShareBalances,
  getHouseholdMembers,
}));

import {
  recordSuggestedPaymentAction,
  saveExpenseAction,
  saveSettlementAction,
} from "@/lib/actions/financial";

const householdId = "00000000-0000-4000-8000-000000000001";
const payerId = "00000000-0000-4000-8000-000000000002";
const receiverId = "00000000-0000-4000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  const single = vi.fn().mockResolvedValue({
    data: {
      default_currency: "EUR",
      timezone: "UTC",
      balance_strategy: "default",
      landlord_enabled: false,
    },
    error: null,
  });
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
  getBalances.mockResolvedValue([]);
  getPairBalances.mockResolvedValue([
    {
      paying_member_id: payerId,
      receiving_member_id: receiverId,
      currency: "EUR",
      amount_cents: 500,
    },
  ]);
  getAllLandlordShareBalances.mockResolvedValue([]);
  getHouseholdMembers.mockResolvedValue([]);
});

it("records a confirmed current suggestion and rejects a stale amount", async () => {
  const stale = await recordSuggestedPaymentAction({
    householdId,
    receivingMemberId: receiverId,
    amountCents: 400,
    currency: "EUR",
  });
  expect(stale.ok).toBe(false);
  expect(createAdminClient).not.toHaveBeenCalled();

  const current = await recordSuggestedPaymentAction({
    householdId,
    receivingMemberId: receiverId,
    amountCents: 500,
    currency: "EUR",
  });
  expect(current.ok).toBe(true);
  expect(createAdminClient.mock.results[0].value.rpc).toHaveBeenCalledWith(
    "record_settlement",
    expect.objectContaining({
      p_paying_member_id: payerId,
      p_receiving_member_id: receiverId,
      p_amount_cents: 500,
    }),
  );
});

it("routes a confirmed landlord suggestion through the linked-payment RPC", async () => {
  const { supabase } = await requireHouseholdMutation(householdId);
  supabase
    .from()
    .select()
    .eq()
    .single.mockResolvedValue({
      data: {
        default_currency: "EUR",
        timezone: "UTC",
        balance_strategy: "super_simplified",
        landlord_enabled: true,
      },
      error: null,
    });
  getAllLandlordShareBalances.mockResolvedValue([
    { memberId: payerId, currency: "EUR", remainingCents: 500 },
  ]);
  const result = await recordSuggestedPaymentAction({
    householdId,
    receivingMemberId: "landlord",
    amountCents: 500,
    currency: "EUR",
  });
  expect(result.ok).toBe(true);
  expect(createAdminClient.mock.results.at(-1)!.value.rpc).toHaveBeenCalledWith(
    "record_landlord_balance_payment",
    expect.objectContaining({
      p_paying_member_id: payerId,
      p_amount_cents: 500,
      p_allocate_others: true,
    }),
  );
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
