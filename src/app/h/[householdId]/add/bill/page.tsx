import { BillWorkspace } from "@/components/bills/bill-workspace";
import { ExpenseTypeNav } from "@/components/expenses/expense-type-nav";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function NewBillPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [{ supabase, membership }, home, memberRows] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
  ]);
  const { data: absenceRows, error } = await supabase
    .from("absence_periods")
    .select("member_id, start_date, end_date")
    .eq("household_id", householdId)
    .is("voided_at", null);
  if (error) throw error;
  const members = memberRows
    .filter((member) => !member.removed_at)
    .map((member) => ({ id: member.id, name: member.display_name }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add an expense" />
      <ExpenseTypeNav householdId={householdId} active="bill" />
      <BillWorkspace
        householdId={householdId}
        defaultCurrency={home?.default_currency ?? "EUR"}
        locale={home?.locale ?? "en-GB"}
        currentMemberId={membership.id}
        landlordEnabled={home?.landlord_enabled ?? false}
        members={members}
        absences={(absenceRows ?? []).map((range) => ({
          memberId: range.member_id,
          startDate: range.start_date,
          endDate: range.end_date,
        }))}
      />
    </div>
  );
}
