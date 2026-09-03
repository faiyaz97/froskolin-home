import { notFound } from "next/navigation";

import { BillConfirmation } from "@/components/bills/bill-confirmation";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader, StatusNote } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { normalSplitConfigSchema, utilityTypeSchema } from "@/lib/validation";
import { getExpenseDetail, getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  const [home, memberRows, expense] = await Promise.all([
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getExpenseDetail(householdId, expenseId),
  ]);
  if (!expense || expense.voided_at) notFound();

  if (expense.kind === "utility") {
    const utilityValue = Array.isArray(expense.utility_bills)
      ? expense.utility_bills[0]
      : expense.utility_bills;
    const utilityType = utilityTypeSchema.safeParse(utilityValue?.utility_type);
    if (!utilityValue || !utilityType.success) notFound();
    const shares = [...(expense.expense_shares ?? [])].sort(
      (a, b) => a.allocation_order - b.allocation_order,
    );
    const participantIds = new Set(shares.map((share) => share.member_id));
    const members = memberRows
      .filter((member) => !member.removed_at || participantIds.has(member.id))
      .map((member) => ({ id: member.id, name: member.display_name }));
    const { supabase } = await requireHouseholdMembership(householdId);
    const { data: absenceRows, error } = await supabase
      .from("absence_periods")
      .select("member_id, start_date, end_date")
      .eq("household_id", householdId)
      .is("voided_at", null);
    if (error) throw error;

    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Utility bill"
          title={`Edit ${expense.title}`}
          description="Changing dates, participants, or cost buckets recalculates every share from the current away periods and records the edit in Activity."
        />
        <BillConfirmation
          householdId={householdId}
          documentId={utilityValue.bill_document_id ?? undefined}
          defaultCurrency={home?.default_currency ?? expense.currency}
          locale={home?.locale ?? "en-GB"}
          members={members}
          absences={(absenceRows ?? []).map((range) => ({
            memberId: range.member_id,
            startDate: range.start_date,
            endDate: range.end_date,
          }))}
          existing={{
            expenseId,
            title: expense.title,
            utilityType: utilityType.data,
            supplier: utilityValue.supplier,
            issueDate: utilityValue.issue_date,
            serviceStart: utilityValue.service_start_date,
            serviceEnd: utilityValue.service_end_date,
            totalCents: Number(expense.total_cents),
            fixedCents: Number(utilityValue.fixed_cents),
            variableCents: Number(utilityValue.variable_cents),
            currency: expense.currency,
            payerMemberId: expense.payer_member_id,
            participantIds: shares.map((share) => share.member_id),
            consumptionAmount:
              utilityValue.consumption_amount == null
                ? null
                : Number(utilityValue.consumption_amount),
            consumptionUnit: utilityValue.consumption_unit,
            classificationNote: utilityValue.classification_note,
          }}
        />
      </div>
    );
  }

  const splitConfig = normalSplitConfigSchema.safeParse(expense.split_config);
  if (!splitConfig.success) notFound();

  const participantIds = new Set(
    splitConfig.data.participants.map((participant) => participant.memberId),
  );
  const members = memberRows
    .filter((member) => !member.removed_at || participantIds.has(member.id))
    .map((member) => ({ id: member.id, name: member.display_name }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={expense.kind === "recurring" ? "Generated occurrence" : "Manual expense"}
        title={`Edit ${expense.title}`}
        description="This updates the explicit shares, recalculates balances, and records the before-and-after values in Activity."
      />
      {expense.kind === "recurring" && (
        <StatusNote title="This occurrence only">
          Editing this expense does not change its monthly recurring rule.
        </StatusNote>
      )}
      <ExpenseForm
        householdId={householdId}
        defaultCurrency={home?.default_currency ?? expense.currency}
        members={members}
        initial={{
          expenseId,
          title: expense.title,
          totalCents: Number(expense.total_cents),
          currency: expense.currency,
          payerMemberId: expense.payer_member_id,
          expenseDate: expense.expense_date,
          splitConfig: splitConfig.data,
        }}
      />
    </div>
  );
}
