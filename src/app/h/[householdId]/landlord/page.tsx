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
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader title="Landlord balance" />
      {!home?.landlord_enabled && (
        <div className="mb-5">
          <StatusNote tone="warning" title="Landlord mode is off" />
        </div>
      )}
      <LandlordBalanceView householdId={householdId} rows={rows} locale={home?.locale ?? "en-GB"} />
    </div>
  );
}
