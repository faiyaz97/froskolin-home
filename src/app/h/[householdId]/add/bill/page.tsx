import { BillUpload } from "@/components/bills/bill-upload";
import { PageHeader } from "@/components/ui/page";
export default async function NewBillPage({
  params,
}: {
  params: Promise<{ householdId: string }>;
}) {
  const { householdId } = await params;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Scan a utility bill"
        description="Upload a PDF or photo, then check the details."
      />
      <BillUpload householdId={householdId} />
    </div>
  );
}
