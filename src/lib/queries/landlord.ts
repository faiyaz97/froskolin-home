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
  payments: Array<{ id: string; amountCents: number; paymentDate: string }>;
};

export async function getLandlordBillBalances(householdId: string): Promise<LandlordBillBalance[]> {
  const { supabase, membership } = await requireHouseholdMembership(householdId);
  const { data: expenses, error: expensesError } = await supabase
    .from("expenses")
    .select("id, title, currency, expense_date, expense_shares!inner(member_id, share_cents)")
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
        .select("id, expense_id, amount_cents, payment_date")
        .eq("household_id", householdId)
        .eq("member_id", membership.id)
        .in("expense_id", expenseIds)
        .is("voided_at", null)
        .order("payment_date", { ascending: false })
    : { data: [], error: null };
  if (paymentsError) throw paymentsError;

  const paymentsByExpense = new Map<
    string,
    Array<{ id: string; amountCents: number; paymentDate: string }>
  >();
  for (const payment of payments ?? []) {
    const list = paymentsByExpense.get(payment.expense_id) ?? [];
    list.push({
      id: payment.id,
      amountCents: Number(payment.amount_cents),
      paymentDate: payment.payment_date,
    });
    paymentsByExpense.set(payment.expense_id, list);
  }

  return (expenses ?? []).map((expense) => {
    const shareRelation = expense.expense_shares;
    const share = Array.isArray(shareRelation) ? shareRelation[0] : shareRelation;
    const originalShareCents = Number(share?.share_cents ?? 0);
    const billPayments = paymentsByExpense.get(expense.id) ?? [];
    const paidCents = billPayments.reduce((total, payment) => total + payment.amountCents, 0);
    return {
      expenseId: expense.id,
      title: expense.title,
      currency: expense.currency,
      expenseDate: expense.expense_date,
      originalShareCents,
      paidCents,
      remainingCents: calculateLandlordRemainingCents(
        originalShareCents,
        billPayments.map((payment) => payment.amountCents),
      ),
      payments: billPayments,
    };
  });
}
