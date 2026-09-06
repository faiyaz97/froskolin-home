import { redirect } from "next/navigation";

export default async function LegacyRecurringPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  redirect(`/h/${householdId}/add/expense?recurring=1`);
}
