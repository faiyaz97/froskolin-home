import Link from "next/link";
import { ArrowRight, HandCoins, ReceiptText, Repeat2, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
const choices = [
  {
    path: "expense",
    icon: ReceiptText,
    title: "Add expense",
    text: "Groceries, dinner, rent and more",
    color: "bg-[var(--brand-soft)] text-[var(--brand)]",
  },
  {
    path: "bill",
    icon: ScanLine,
    title: "Scan utility bill",
    text: "Upload a bill and review the split",
    color: "bg-[var(--violet-soft)] text-[var(--violet)]",
  },
  {
    path: "recurring",
    icon: Repeat2,
    title: "Recurring expense",
    text: "Create a monthly shared cost",
    color: "bg-[var(--sky-soft)] text-[var(--sky)]",
  },
  {
    path: "settlement",
    icon: HandCoins,
    title: "Record payment",
    text: "Settle money between roommates",
    color: "bg-[var(--peach-soft)] text-[var(--peach)]",
  },
];
export default async function AddPage({ params }: { params: Promise<{ householdId: string }> }) {
  const { householdId } = await params;
  return (
    <>
      <PageHeader title="Add" />
      <div className="grid gap-3 sm:grid-cols-2">
        {choices.map(({ path, icon: Icon, title, text, color }) => (
          <Link
            key={path}
            href={`/h/${householdId}/add/${path}`}
            className="group flex min-h-[92px] items-center gap-4 rounded-2xl border border-[var(--line)] bg-white p-4 text-[var(--ink)] no-underline shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#cbd5e1] hover:shadow-md sm:min-h-32 sm:items-start sm:p-5"
          >
            <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${color}`}>
              <Icon className="size-5" />
            </span>
            <span className="flex-1">
              <strong className="text-base font-black sm:text-lg">{title}</strong>
              <small className="mt-1 block text-sm leading-5 text-[var(--muted)]">{text}</small>
            </span>
            <ArrowRight className="size-5 text-[var(--muted)] transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </>
  );
}
