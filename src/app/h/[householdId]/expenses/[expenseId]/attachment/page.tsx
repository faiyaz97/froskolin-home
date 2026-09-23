import { notFound } from "next/navigation";

import { AttachmentViewer } from "@/components/expenses/attachment-viewer";
import { MobilePageTitle } from "@/components/household/app-shell";
import { getExpenseAttachment, getExpenseDetail } from "@/lib/queries";

export default async function AttachmentPage({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  const expense = await getExpenseDetail(householdId, expenseId);
  if (!expense) notFound();

  const utilities = expense.utility_bills as
    { bill_document_id: string | null } | { bill_document_id: string | null }[] | null;
  const utility = Array.isArray(utilities) ? utilities[0] : utilities;
  const attachment = utility ? null : await getExpenseAttachment(householdId, expenseId);
  const documentId = utility?.bill_document_id;
  if (!documentId && !attachment) notFound();

  const source = documentId
    ? `/api/bills/${documentId}/view?householdId=${householdId}&inline=1`
    : `/api/expenses/${expenseId}/attachment?householdId=${householdId}&inline=1`;

  return (
    <>
      <MobilePageTitle title="Attachment" />
      <AttachmentViewer source={source} returnHref={`/h/${householdId}/expenses/${expenseId}`} />
    </>
  );
}
