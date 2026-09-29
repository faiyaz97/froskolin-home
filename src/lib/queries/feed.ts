import "server-only";

import { requireHouseholdMembership } from "@/lib/auth";

export async function getActivityFeed(householdId: string, limit = 10) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("audit_events")
    .select(
      "id, action_type, entity_type, entity_id, summary, occurred_at, actor_user_id, previous_values, new_values",
    )
    .eq("household_id", householdId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw error;
  return data ?? [];
}

export async function getActivityUtilityTypes(householdId: string, expenseIds: string[]) {
  if (!expenseIds.length) return {};

  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("utility_bills")
    .select("expense_id, utility_type")
    .eq("household_id", householdId)
    .in("expense_id", [...new Set(expenseIds)]);
  if (error) throw error;

  return Object.fromEntries((data ?? []).map((bill) => [bill.expense_id, bill.utility_type]));
}

export async function getHouseholdTransactions(householdId: string, limit = 50) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const rowLimit = Math.min(Math.max(limit, 1), 100);
  const [expensesResult, settlementsResult, landlordPaymentsResult] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, title, total_cents, currency, payer_member_id, paid_by_landlord, expense_date, created_at, kind, split_method, recurring_rule_id, expense_shares(member_id, share_cents), utility_bills(utility_type)",
      )
      .eq("household_id", householdId)
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(rowLimit),
    supabase
      .from("settlements")
      .select(
        "id, paying_member_id, receiving_member_id, amount_cents, currency, settlement_date, created_at",
      )
      .eq("household_id", householdId)
      .is("voided_at", null)
      .order("settlement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(rowLimit),
    supabase
      .from("landlord_payments")
      .select(
        "id, all_payment_id, linked_settlement_id, expense_id, paid_by_member_id, amount_cents, payment_date, created_at, expenses!inner(title, currency, utility_bills(utility_type)), payer:household_members!landlord_payments_actual_payer_fk(display_name)",
      )
      .eq("household_id", householdId)
      .is("voided_at", null)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      // A physical transfer can span several bill shares. Read a bounded
      // window large enough to keep recent transfers together.
      .limit(Math.min(rowLimit * 10, 100)),
  ]);
  if (expensesResult.error) throw expensesResult.error;
  if (settlementsResult.error) throw settlementsResult.error;
  if (landlordPaymentsResult.error) throw landlordPaymentsResult.error;

  const landlordPaymentRows = (landlordPaymentsResult.data ??
    []) as unknown as RawLandlordPayment[];
  const linkedSettlementIds = new Set(
    landlordPaymentRows
      .map((payment) => payment.linked_settlement_id)
      .filter((id): id is string => Boolean(id)),
  );
  return {
    expenses: expensesResult.data ?? [],
    settlements: (settlementsResult.data ?? []).filter(
      (settlement) => !linkedSettlementIds.has(settlement.id),
    ),
    settlementReadCount: (settlementsResult.data ?? []).length,
    settlementHasMore: (settlementsResult.data ?? []).length > rowLimit - 1,
    landlordLinkedSettlementIds: [...linkedSettlementIds],
    landlordPayments: groupLandlordPayments(landlordPaymentRows),
  };
}

type UtilityType = "electricity" | "gas" | "water" | "internet" | "other";

type RawLandlordBill = {
  title: string;
  currency: string;
  utility_bills: { utility_type: UtilityType } | { utility_type: UtilityType }[] | null;
};

export type RawLandlordPayment = {
  id: string;
  all_payment_id: string | null;
  linked_settlement_id: string | null;
  expense_id: string;
  paid_by_member_id: string | null;
  amount_cents: number;
  payment_date: string;
  created_at: string;
  expenses: RawLandlordBill | RawLandlordBill[] | null;
  payer: { display_name: string } | { display_name: string }[] | null;
};

export type HouseholdLandlordPayment = {
  id: string;
  expenseId: string;
  title: string;
  utilityType: UtilityType | null;
  currency: string;
  amountCents: number;
  paymentDate: string;
  createdAt: string;
  paidByMemberId: string | null;
  paidByName: string | null;
  affectedBillCount: number;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** Groups allocation rows into the physical landlord transfers shown on Home. */
export function groupLandlordPayments(rows: RawLandlordPayment[]): HouseholdLandlordPayment[] {
  const groups = new Map<string, RawLandlordPayment[]>();
  for (const row of rows) {
    const key = row.all_payment_id ?? row.id;
    const entries = groups.get(key) ?? [];
    entries.push(row);
    groups.set(key, entries);
  }

  return [...groups.entries()]
    .map(([id, entries]) => {
      const first = entries[0]!;
      const bill = firstRelation(first.expenses);
      const payer = entries.map((entry) => firstRelation(entry.payer)).find(Boolean) ?? null;
      const affectedBillIds = new Set(entries.map((entry) => entry.expense_id));
      return {
        id,
        expenseId: first.expense_id,
        title: bill?.title ?? "Landlord bill",
        utilityType: firstRelation(bill?.utility_bills ?? null)?.utility_type ?? null,
        currency: bill?.currency ?? "EUR",
        amountCents: entries.reduce((total, entry) => total + Number(entry.amount_cents), 0),
        paymentDate: first.payment_date,
        createdAt: first.created_at,
        paidByMemberId: entries.find((entry) => entry.paid_by_member_id)?.paid_by_member_id ?? null,
        paidByName: payer?.display_name ?? null,
        affectedBillCount: affectedBillIds.size,
      };
    })
    .sort(
      (a, b) =>
        b.paymentDate.localeCompare(a.paymentDate) || b.createdAt.localeCompare(a.createdAt),
    );
}

export async function getExpenseDetail(householdId: string, expenseId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("expenses")
    .select("*, expense_shares(*), utility_bills(*)")
    .eq("household_id", householdId)
    .eq("id", expenseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getExpenseAttachment(householdId: string, expenseId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("expense_attachments")
    .select("original_file_name")
    .eq("household_id", householdId)
    .eq("expense_id", expenseId)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getRecurringExpenseSchedule(householdId: string, ruleId: string) {
  const { supabase } = await requireHouseholdMembership(householdId);
  const { data, error } = await supabase
    .from("recurring_expense_rules")
    .select("next_due_date, end_date, active, archived_at")
    .eq("household_id", householdId)
    .eq("id", ruleId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
