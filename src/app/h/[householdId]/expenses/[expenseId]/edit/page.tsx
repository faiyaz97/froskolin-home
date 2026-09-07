import { notFound } from "next/navigation";

import { BillWorkspace } from "@/components/bills/bill-workspace";
import { ExpenseForm } from "@/components/expenses/expense-form";
import type { AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { billEntryModeSchema, normalSplitConfigSchema, utilityTypeSchema } from "@/lib/validation";
import { getExpenseDetail, getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  const [auth, home, memberRows, expense] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getExpenseDetail(householdId, expenseId),
  ]);
  const { membership, supabase } = auth;
  if (!expense || expense.voided_at) notFound();

  if (expense.kind === "utility") {
    const utilityValue = Array.isArray(expense.utility_bills)
      ? expense.utility_bills[0]
      : expense.utility_bills;
    const utilityType = utilityTypeSchema.safeParse(utilityValue?.utility_type);
    const splitConfig = expense.split_config as { entryMode?: unknown } | null;
    const entryMode = billEntryModeSchema.safeParse(splitConfig?.entryMode);
    if (!utilityValue || !utilityType.success) notFound();
    const shares = [...(expense.expense_shares ?? [])].sort(
      (a, b) => a.allocation_order - b.allocation_order,
    );
    const participantIds = new Set(shares.map((share) => share.member_id));
    const members = memberRows
      .filter((member) => !member.removed_at || participantIds.has(member.id))
      .map((member) => ({
        id: member.id,
        name: member.display_name,
        avatarColor: member.avatar_color as AvatarColor | null,
      }));
    const { data: absenceRows, error } = await supabase
      .from("absence_periods")
      .select("member_id, start_date, end_date")
      .eq("household_id", householdId)
      .is("voided_at", null);
    if (error) throw error;

    return (
      <div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-2xl min-w-0 flex-col md:min-h-[calc(100dvh-7rem)]">
        <PageHeader title="Edit utility bill" compact />
        <BillWorkspace
          householdId={householdId}
          documentId={utilityValue.bill_document_id ?? undefined}
          defaultCurrency={home?.default_currency ?? expense.currency}
          locale={home?.locale ?? "en-GB"}
          currentMemberId={membership.id}
          landlordEnabled={home?.landlord_enabled ?? false}
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
            payerMemberId: expense.paid_by_landlord ? "landlord" : expense.payer_member_id,
            participantIds: shares.map((share) => share.member_id),
            consumptionAmount:
              utilityValue.consumption_amount == null
                ? null
                : Number(utilityValue.consumption_amount),
            consumptionUnit: utilityValue.consumption_unit,
            classificationNote: utilityValue.classification_note,
            entryMode: entryMode.success ? entryMode.data : "manual",
          }}
          cancelHref={`/h/${householdId}/expenses/${expenseId}`}
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
    .map((member) => ({
      id: member.id,
      name: member.display_name,
      avatarColor: member.avatar_color as AvatarColor | null,
    }));
  const { data: attachment, error: attachmentError } = await supabase
    .from("expense_attachments")
    .select("original_file_name")
    .eq("household_id", householdId)
    .eq("expense_id", expenseId)
    .is("removed_at", null)
    .maybeSingle();
  if (attachmentError) throw attachmentError;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-2xl min-w-0 flex-col md:min-h-[calc(100dvh-7rem)]">
      <PageHeader title="Edit expense" compact />
      <ExpenseForm
        householdId={householdId}
        defaultCurrency={home?.default_currency ?? expense.currency}
        currentMemberId={membership.id}
        landlordEnabled={home?.landlord_enabled ?? false}
        members={members}
        initialAttachment={
          attachment
            ? {
                fileName: attachment.original_file_name,
                viewUrl: `/api/expenses/${expenseId}/attachment?householdId=${householdId}`,
              }
            : undefined
        }
        initial={{
          expenseId,
          title: expense.title,
          totalCents: Number(expense.total_cents),
          currency: expense.currency,
          payerMemberId: expense.paid_by_landlord ? "landlord" : expense.payer_member_id,
          expenseDate: expense.expense_date,
          splitConfig: splitConfig.data,
        }}
        cancelHref={`/h/${householdId}/expenses/${expenseId}`}
      />
    </div>
  );
}
