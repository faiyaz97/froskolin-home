import { LandlordBalanceView } from "@/components/expenses/landlord-balance-view";
import { PageHeader, StatusNote } from "@/components/ui/page";
import { getHousehold, getLandlordBillBalances } from "@/lib/queries";

export default async function LandlordBalancePage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  const [home, rows] = await Promise.all([
    getHousehold(householdId),
    getLandlordBillBalances(householdId),
  ]);
  return (
    <>
      <PageHeader title="Landlord" />
      {!home?.landlord_enabled && (
        <StatusNote title="Landlord is disabled">
          Existing payment history remains available. Enable the landlord in Household Settings to
          add new landlord-paid expenses.
        </StatusNote>
      )}
      <LandlordBalanceView householdId={householdId} rows={rows} locale={home?.locale ?? "en-GB"} />
    </>
  );
}
