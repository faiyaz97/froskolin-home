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

export async function readPushMemberNames(
  householdId: string,
  memberIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(memberIds)].filter(Boolean);
  if (!ids.length) return {};
  try {
    const { data, error } = await createAdminClient()
      .from("household_members")
      .select("id, display_name")
      .eq("household_id", householdId)
      .in("id", ids);
    if (error) return {};
    return Object.fromEntries(
      (data ?? []).map((member) => [String(member.id), String(member.display_name)]),
    );
  } catch {
    return {};
  }
}

export function settlementPushBodies(input: {
  payingMemberId: string;
  receivingMemberId: string;
  payerName: string;
  receiverName: string;
  amount: string;
}): Record<string, string> {
  return {
    [input.payingMemberId]: `You paid ${input.receiverName} ${input.amount}.`,
    [input.receivingMemberId]: `${input.payerName} paid you ${input.amount}.`,
  };
}

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
  const nextIds = [...Object.keys(next), ...(input.payer ? [input.payer] : [])];
  const beforeIds = before
    ? [...Object.keys(before.shares), ...(before.payer ? [before.payer] : [])]
    : [];
  const nextTotal = Object.values(next).reduce((total, share) => total + share, 0);
  const beforeTotal = before
    ? Object.values(before.shares).reduce((total, share) => total + share, 0)
    : null;
  const ids = before
    ? [...new Set([...beforeIds, ...nextIds])].filter(
        (id) =>
          before.shares[id] !== next[id] ||
          before.currency !== input.currency ||
          before.payer !== input.payer ||
          beforeTotal !== nextTotal,
      )
    : [...new Set(nextIds)];
  const names = await readPushMemberNames(input.householdId, nextIds);
  const notificationTitle = input.title?.trim() || (input.bill ? "Bill" : "Expense");
  const payerName = input.payer ? (names[input.payer] ?? "The payer") : "Landlord";
  const total = formatMoney(nextTotal, input.currency);
  const debtors = Object.entries(next).filter(
    ([memberId, share]) => memberId !== input.payer && share > 0,
  );
  const memberBodies = Object.fromEntries(
    ids.map((memberId) => {
      const share = next[memberId];
      if (memberId === input.payer) {
        const payerShare = share ?? 0;
        const owed = nextTotal - payerShare;
        if (owed <= 0) return [memberId, `You paid ${total}.`];
        const owedBy = debtors.length === 1 ? (names[debtors[0][0]] ?? "Another member") : "Others";
        return [
          memberId,
          `You paid ${total}. ${owedBy} ${debtors.length === 1 ? "owes" : "owe"} you ${formatMoney(owed, input.currency)}.`,
        ];
      }
      if (share === undefined)
        return [memberId, `${payerName} paid ${total}. You are no longer included.`];
      const amount = formatMoney(share, input.currency);
      return [memberId, `${payerName} paid ${total}. You owe ${amount}.`];
    }),
  );
  await schedulePush({
    householdId: input.householdId,
    actorUserId: input.actorUserId,
    title: notificationTitle,
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
