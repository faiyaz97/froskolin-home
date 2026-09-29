import "server-only";

import { requireHouseholdMembership } from "@/lib/auth";
import { calculateLandlordRemainingCents } from "@/lib/domain";

export type LandlordBillBalance = {
  expenseId: string;
  title: string;
  currency: string;
  expenseDate: string;
  originalShareCents: number;
  paidCents: number;
  remainingCents: number;
  utilityType: "electricity" | "gas" | "water" | "internet" | "other" | null;
  payments: Array<{
    id: string;
    amountCents: number;
    paymentDate: string;
    paidByMemberId?: string | null;
    paidByName?: string | null;
  }>;
};

export type LandlordShareBalance = {
  expenseId: string;
  memberId: string;
  currency: string;
  expenseDate: string;
  createdAt: string;
  originalShareCents: number;
  paidCents: number;
  remainingCents: number;
};

export type LandlordPaymentHistoryItem = {
  id: string;
  expenseId: string;
  title: string;
  currency: string;
  amountCents: number;
  paymentDate: string;
  paidByMemberId: string | null;
  paidByName: string | null;
  beneficiaryMemberId: string;
  beneficiaryName: string | null;
};

export type LandlordBillPaymentGroup = {
  id: string;
  paymentId: string;
  paymentDate: string;
  paidByMemberId: string | null;
  createdByUserId: string;
  totalCents: number;
  onThisBillCents: number;
  breakdown: Array<{
    expenseId: string;
    expenseTitle: string;
    memberId: string;
    amountCents: number;
  }>;
};

/** One physical transfer may cover several bill shares; keep its allocations together. */
export async function getLandlordBillPaymentGroups(
  householdId: string,
  expenseId: string,
): Promise<LandlordBillPaymentGroup[]> {
  const { supabase } = await requireHouseholdMembership(householdId);
  const columns =
    "id, all_payment_id, expense_id, member_id, paid_by_member_id, created_by, amount_cents, payment_date" as const;
  const { data: billPayments, error: billError } = await supabase
    .from("landlord_payments")
    .select(columns)
    .eq("household_id", householdId)
    .eq("expense_id", expenseId)
    .is("voided_at", null)
    .order("payment_date", { ascending: false });
  if (billError) throw billError;
  if (!billPayments?.length) return [];

  const groupIds = [
    ...new Set(billPayments.map((row) => row.all_payment_id).filter(Boolean)),
  ] as string[];
  const { data: grouped, error: groupError } = groupIds.length
    ? await supabase
        .from("landlord_payments")
        .select(columns)
        .eq("household_id", householdId)
        .in("all_payment_id", groupIds)
        .is("voided_at", null)
    : { data: [], error: null };
  if (groupError) throw groupError;

  const byGroup = new Map<string, (typeof billPayments)[number][]>();
  for (const row of [...(grouped ?? []), ...billPayments.filter((item) => !item.all_payment_id)]) {
    const key = row.all_payment_id ?? row.id;
    const entries = byGroup.get(key) ?? [];
    entries.push(row);
    byGroup.set(key, entries);
  }
  const expenseIds = [
    ...new Set([...byGroup.values()].flatMap((rows) => rows.map((row) => row.expense_id))),
  ];
  const { data: titles, error: titlesError } = await supabase
    .from("expenses")
    .select("id, title")
    .eq("household_id", householdId)
    .in("id", expenseIds);
  if (titlesError) throw titlesError;
  const titleById = new Map((titles ?? []).map((row) => [row.id, row.title]));
  return [...byGroup.entries()]
    .map(([id, rows]) => ({
      id,
      paymentId: rows[0]!.id,
      paymentDate: rows[0]!.payment_date,
      paidByMemberId: rows[0]!.paid_by_member_id,
      createdByUserId: rows[0]!.created_by,
      totalCents: rows.reduce((sum, row) => sum + Number(row.amount_cents), 0),
      onThisBillCents: rows
        .filter((row) => row.expense_id === expenseId)
        .reduce((sum, row) => sum + Number(row.amount_cents), 0),
      breakdown: rows.map((row) => ({
        expenseId: row.expense_id,
        expenseTitle: titleById.get(row.expense_id) ?? "Bill",
        memberId: row.member_id,
        amountCents: Number(row.amount_cents),
      })),
    }))
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate) || b.id.localeCompare(a.id));
}

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Payments affecting the current member's share or physically made by them. */
export async function getLandlordPaymentHistory(
  householdId: string,
): Promise<LandlordPaymentHistoryItem[]> {
  const { supabase, membership } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("landlord_payments")
    .select(
      "id, expense_id, member_id, paid_by_member_id, amount_cents, payment_date, expenses!inner(title, currency), payer:household_members!landlord_payments_actual_payer_fk(display_name), beneficiary:household_members!landlord_payments_member_id_household_id_fkey(display_name)",
    )
    .eq("household_id", householdId)
    .or(`member_id.eq.${membership.id},paid_by_member_id.eq.${membership.id}`)
    .is("voided_at", null)
    .order("payment_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((payment) => {
    const bill = firstRelation(payment.expenses);
    const payer = firstRelation(payment.payer);
    const beneficiary = firstRelation(payment.beneficiary);
    return {
      id: payment.id,
      expenseId: payment.expense_id,
      title: bill?.title ?? "Landlord bill",
      currency: bill?.currency ?? "EUR",
      amountCents: Number(payment.amount_cents),
      paymentDate: payment.payment_date,
      paidByMemberId: payment.paid_by_member_id,
      paidByName: payer?.display_name ?? null,
      beneficiaryMemberId: payment.member_id,
      beneficiaryName: beneficiary?.display_name ?? null,
    };
  });
}

/** All active landlord shares, used only to project combined balances and validate suggestions. */
export async function getAllLandlordShareBalances(
  householdId: string,
): Promise<LandlordShareBalance[]> {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("id, currency, expense_date, created_at, expense_shares(member_id, share_cents)")
    .eq("household_id", householdId)
    .eq("paid_by_landlord", true)
    .is("voided_at", null)
    .order("expense_date");
  if (expensesError) throw expensesError;
  const ids = (expenses ?? []).map((expense) => expense.id);
  const { data: payments, error: paymentsError } = ids.length
    ? await supabase
        .from("landlord_payments")
        .select("expense_id, member_id, amount_cents")
        .eq("household_id", householdId)
        .in("expense_id", ids)
        .is("voided_at", null)
    : { data: [], error: null };
  if (paymentsError) throw paymentsError;
  const paid = new Map<string, number>();
  for (const payment of payments ?? []) {
    const key = `${payment.expense_id}\u0000${payment.member_id}`;
    paid.set(key, (paid.get(key) ?? 0) + Number(payment.amount_cents));
  }
  return (expenses ?? [])
    .flatMap((expense) =>
      (expense.expense_shares ?? []).map((share) => {
        const originalShareCents = Number(share.share_cents);
        const paidCents = paid.get(`${expense.id}\u0000${share.member_id}`) ?? 0;
        return {
          expenseId: expense.id,
          memberId: share.member_id,
          currency: expense.currency,
          expenseDate: expense.expense_date,
          createdAt: expense.created_at,
          originalShareCents,
          paidCents,
          remainingCents: Math.max(0, originalShareCents - paidCents),
        };
      }),
    )
    .sort(
      (a, b) =>
        a.expenseDate.localeCompare(b.expenseDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.expenseId.localeCompare(b.expenseId) ||
        a.memberId.localeCompare(b.memberId),
    );
}

export async function getLandlordBillBalances(householdId: string): Promise<LandlordBillBalance[]> {
  const { supabase, membership } = await requireHouseholdMembership(householdId);
  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select(
      "id, title, currency, expense_date, expense_shares!inner(member_id, share_cents), utility_bills(utility_type)",
    )
    .eq("household_id", householdId)
    .eq("paid_by_landlord", true)
    .eq("expense_shares.member_id", membership.id)
    .is("voided_at", null)
    .order("expense_date", { ascending: false });
  if (expensesError) throw expensesError;

  const expenseIds = (expenses ?? []).map((expense) => expense.id);
  const { data: payments, error: paymentsError } = expenseIds.length
    ? await supabase
        .from("landlord_payments")
        .select(
          "id, expense_id, amount_cents, payment_date, paid_by_member_id, paid_by:household_members!landlord_payments_actual_payer_fk(display_name)",
        )
        .eq("household_id", householdId)
        .eq("member_id", membership.id)
        .in("expense_id", expenseIds)
        .is("voided_at", null)
        .order("payment_date", { ascending: false })
    : { data: [], error: null };
  if (paymentsError) throw paymentsError;

  const paymentsByExpense = new Map<string, LandlordBillBalance["payments"]>();
  for (const payment of payments ?? []) {
    const list = paymentsByExpense.get(payment.expense_id) ?? [];
    list.push({
      id: payment.id,
      amountCents: Number(payment.amount_cents),
      paymentDate: payment.payment_date,
      paidByMemberId: payment.paid_by_member_id,
      paidByName: firstRelation(payment.paid_by)?.display_name ?? null,
    });
    paymentsByExpense.set(payment.expense_id, list);
  }

  return (expenses ?? []).map((expense) => {
    const shareRelation = expense.expense_shares;
    const share = Array.isArray(shareRelation) ? shareRelation[0] : shareRelation;
    const originalShareCents = Number(share?.share_cents ?? 0);
    const billPayments = paymentsByExpense.get(expense.id) ?? [];
    const utilityRelation = expense.utility_bills;
    const utility = Array.isArray(utilityRelation) ? utilityRelation[0] : utilityRelation;
    const paidCents = billPayments.reduce((total, payment) => total + payment.amountCents, 0);
    return {
      expenseId: expense.id,
      title: expense.title,
      currency: expense.currency,
      expenseDate: expense.expense_date,
      originalShareCents,
      paidCents,
      utilityType: utility?.utility_type ?? null,
      remainingCents: calculateLandlordRemainingCents(
        originalShareCents,
        billPayments.map((payment) => payment.amountCents),
      ),
      payments: billPayments,
    };
  });
}
