import { ExpenseForm } from "@/components/expenses/expense-form";
import { ExpenseTypeNav } from "@/components/expenses/expense-type-nav";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ recurring?: string }>;
}) {
  const [{ householdId }, query] = await Promise.all([params, searchParams]);
  const [{ membership }, home, members] = await Promise.all([
    requireHouseholdMembership(householdId),
    getHousehold(householdId),
    getHouseholdMembers(householdId),
  ]);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] w-full max-w-2xl min-w-0 flex-col md:min-h-[calc(100dvh-7rem)]">
      <PageHeader title="Add expense" compact />
      <ExpenseTypeNav householdId={householdId} active="expense" />
      <ExpenseForm
        householdId={householdId}
        defaultCurrency={home?.default_currency ?? "EUR"}
        currentMemberId={membership.id}
        landlordEnabled={home?.landlord_enabled ?? false}
        members={members
          .filter((member) => !member.removed_at)
          .map((member) => ({ id: member.id, name: member.display_name }))}
        defaultRecurring={query.recurring === "1"}
      />
    </div>
  );
}
