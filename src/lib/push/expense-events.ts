import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney } from "@/lib/format";
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

export async function notifyExpense(input: {
  householdId: string;
  expenseId: string;
  actorUserId: string | null;
  actorMemberId?: string;
  actorName?: string;
  title?: string;
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
  const item = input.title?.trim() || (input.bill ? "a bill" : "an expense");
  const action = before ? "updated" : input.actorName ? "added" : "was added";
  const subject = input.actorName
    ? `${input.actorName} ${action} ${input.title ? `${input.bill ? "a bill" : "an expense"}: ` : ""}${item}.`
    : `${input.bill ? "A bill" : "A recurring expense"} ${action}${input.title ? `: ${item}` : ""}.`;
  const memberBodies = Object.fromEntries(
    ids.map((memberId) => {
      const share = next[memberId];
      if (share === undefined) return [memberId, `${subject} You are no longer included.`];
      const amount = formatMoney(share, input.currency);
      const amountText =
        input.actorName && input.actorMemberId === input.payer && memberId !== input.payer
          ? `You ${before ? "now " : ""}owe ${input.actorName} ${amount}.`
          : `Your share is ${before ? "now " : ""}${amount}.`;
      return [memberId, `${subject} ${amountText}`];
    }),
  );
  await schedulePush({
    householdId: input.householdId,
    actorUserId: input.actorUserId,
    memberIds: ids,
    memberBodies,
    body: before
      ? "An update changed your share of an expense."
      : input.bill
        ? "A new bill includes you."
        : "A new expense includes you.",
    url: `/h/${input.householdId}/expenses/${input.expenseId}`,
  });
}
