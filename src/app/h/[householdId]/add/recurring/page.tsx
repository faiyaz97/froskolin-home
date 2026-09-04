import { RecurringForm } from "@/components/expenses/recurring-form";
import { ExpenseTypeNav } from "@/components/expenses/expense-type-nav";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function RecurringPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [{ membership }, home, members] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add an expense" />
      <ExpenseTypeNav householdId={householdId} active="recurring" />
      <RecurringForm
        householdId={householdId}
        defaultCurrency={home?.default_currency ?? "EUR"}
        currentMemberId={membership.id}
        landlordEnabled={home?.landlord_enabled ?? false}
        members={members
          .filter((member) => !member.removed_at)
          .map((member) => ({ id: member.id, name: member.display_name }))}
      />
    </div>
  );
}
