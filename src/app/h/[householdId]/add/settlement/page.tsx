import { SettlementForm } from "@/components/expenses/settlement-form";
import { PageHeader } from "@/components/ui/page";
import { getHousehold, getHouseholdMembers } from "@/lib/queries";

export default async function SettlementPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [home, members] = await Promise.all([
    getHousehold(householdId),
    getHouseholdMembers(householdId),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Record a payment" />
      <SettlementForm
        householdId={householdId}
        defaultCurrency={home?.default_currency ?? "EUR"}
        members={members
          .filter((member) => !member.removed_at)
          .map((member) => ({ id: member.id, name: member.display_name }))}
      />
    </div>
  );
}
