import { BillConfirmation } from "@/components/bills/bill-confirmation";
import { PageHeader } from "@/components/ui/page";
import { requireHouseholdMembership } from "@/lib/auth";
import { extractedBillSchema } from "@/lib/validation";

export default async function ConfirmBillPage({
  params,
}: {
  params: Promise<{ householdId: string; documentId: string }>;
}) {
  const { householdId, documentId } = await params;
  const { supabase } = await requireHouseholdMembership(householdId);
  const [homeResult, membersResult, absencesResult, documentResult] = await Promise.all([
    supabase.from("households").select("default_currency, locale").eq("id", householdId).single(),
    supabase
      .from("household_members")
      .select("id, display_name, removed_at")
      .eq("household_id", householdId)
      .is("removed_at", null)
      .order("joined_at"),
    supabase
      .from("absence_periods")
      .select("member_id, start_date, end_date")
      .eq("household_id", householdId)
      .is("voided_at", null),
    documentId === "manual"
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from("bill_documents")
          .select("id, status, page_count, extraction, confidence")
          .eq("id", documentId)
          .eq("household_id", householdId)
          .maybeSingle(),
  ]);
  if (homeResult.error || membersResult.error || absencesResult.error || documentResult.error) {
    throw homeResult.error ?? membersResult.error ?? absencesResult.error ?? documentResult.error;
  }
  const extraction = extractedBillSchema.safeParse(documentResult.data?.extraction);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Review extraction"
        title="Check this bill"
        description="Nothing affects balances until you confirm. Correct any value the document reader got wrong."
      />
      <BillConfirmation
        householdId={householdId}
        documentId={documentId === "manual" ? undefined : documentId}
        defaultCurrency={homeResult.data.default_currency}
        locale={homeResult.data.locale}
        initial={extraction.success ? extraction.data : undefined}
        pageCount={Number(documentResult.data?.page_count ?? 0) || undefined}
        members={(membersResult.data ?? []).map((member) => ({
          id: member.id,
          name: member.display_name,
        }))}
        absences={(absencesResult.data ?? []).map((range) => ({
          memberId: range.member_id,
          startDate: range.start_date,
          endDate: range.end_date,
        }))}
      />
    </div>
  );
}
