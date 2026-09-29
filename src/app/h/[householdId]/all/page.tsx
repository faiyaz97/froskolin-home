import { redirect } from "next/navigation";

export default async function AllBalancesPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  redirect(`/h/${householdId}/balances`);
}
