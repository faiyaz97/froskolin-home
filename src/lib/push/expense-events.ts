import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { schedulePush } from "./delivery";
import { getPushConfig } from "./config";

export type ExpensePushSnapshot = {
  currency: string;
  payer: string | null;
  shares: Record<string, number>;
};

export async function readExpensePushSnapshot(
  householdId: string,
  expenseId: string,
): Promise<ExpensePushSnapshot | null> {
  if (!getPushConfig()) return null;
  try {
    const { data, error } = await createAdminClient()
      .from("expenses")
      .select("currency, payer_member_id, expense_shares(member_id, share_cents)")
      .eq("household_id", householdId)
      .eq("id", expenseId)
      .is("voided_at", null)
      .maybeSingle();
    if (error || !data) return null;
    return {
      currency: data.currency,
      payer: data.payer_member_id,
      shares: Object.fromEntries(
        (data.expense_shares ?? []).map((share: { member_id: string; share_cents: number }) => [
          share.member_id,
          Number(share.share_cents),
        ]),
      ),
    };
  } catch {
    return null;
  }
}

export function notifyExpense(input: {
  householdId: string;
  expenseId: string;
  actorUserId: string | null;
  shares: Array<{ member_id: string; share_cents: number }>;
  currency: string;
  payer: string | null;
  bill?: boolean;
  // undefined = new expense; null = edit snapshot unavailable, skip rather than guess.
  before?: ExpensePushSnapshot | null;
}) {
  if (input.before === null) return;
  const next = Object.fromEntries(
    input.shares.map((share) => [share.member_id, share.share_cents]),
  );
  const before = input.before;
  const ids = before
    ? [...new Set([...Object.keys(before.shares), ...Object.keys(next)])].filter(
        (id) =>
          before.shares[id] !== next[id] ||
          before.currency !== input.currency ||
          before.payer !== input.payer,
      )
    : Object.keys(next);
  schedulePush({
    householdId: input.householdId,
    actorUserId: input.actorUserId,
    memberIds: ids,
    body: before
      ? "An update changed your share of an expense."
      : input.bill
        ? "A new bill includes you."
        : "A new expense includes you.",
    url: `/h/${input.householdId}/expenses/${input.expenseId}`,
  });
}
