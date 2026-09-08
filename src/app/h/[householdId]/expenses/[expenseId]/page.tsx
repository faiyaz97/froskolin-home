import {
  ArrowLeft,
  FileText,
  House,
  Paperclip,
  Pencil,
  ReceiptText,
  Repeat2,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { UtilityTypeIcon } from "@/components/bills/bill-meta-controls";
import { MobilePageTitle } from "@/components/household/app-shell";
import { MemberAvatar, type AvatarColor } from "@/components/household/member-avatar";
import { PageHeader } from "@/components/ui/page";
import { voidExpenseAction } from "@/lib/actions";
import { formatMoney, timestampToDateOnly } from "@/lib/format";
import {
  getExpenseAttachment,
  getExpenseDetail,
  getHousehold,
  getHouseholdMembers,
  getRecurringExpenseSchedule,
} from "@/lib/queries";

type ShareRow = {
  member_id: string;
  share_cents: number | string;
  fixed_share_cents: number | string | null;
  variable_share_cents: number | string | null;
  presence_days: number | null;
  allocation_order: number;
};
type UtilityType = "electricity" | "gas" | "water" | "internet" | "other";
type UtilityRow = {
  utility_type: UtilityType;
  service_start_date: string;
  service_end_date: string;
  fixed_cents: number | string;
  variable_cents: number | string;
  variable_split_mode: string;
  bill_document_id: string | null;
  classification_note: string | null;
};

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function splitMethodLabel(method: string) {
  if (method === "exact") return "By amounts";
  if (method === "percentage") return "By percentages";
  return "Equally";
}

export default async function ExpenseDetail({
  params,
}: {
  params: Promise<{ householdId: string; expenseId: string }>;
}) {
  const { householdId, expenseId } = await params;
  const [group, members, rawExpense] = await Promise.all([
    getHousehold(householdId),
    getHouseholdMembers(householdId),
    getExpenseDetail(householdId, expenseId),
  ]);
  if (!rawExpense) notFound();

  const expense = rawExpense as typeof rawExpense & {
    note: string | null;
    expense_shares: ShareRow[];
    utility_bills: UtilityRow | UtilityRow[] | null;
  };
  const utility = Array.isArray(expense.utility_bills)
    ? expense.utility_bills[0]
    : expense.utility_bills;
  const locale = group?.locale ?? "en-GB";
  const timezone = group?.timezone ?? "UTC";
  const memberProfiles = new Map(
    members.map((member) => [
      member.id,
      {
        name: String(member.display_name),
        avatarColor: (member.avatar_color as AvatarColor | null) ?? null,
      },
    ]),
  );
  const payerMember = expense.paid_by_landlord
    ? undefined
    : memberProfiles.get(String(expense.payer_member_id));
  const payerName = expense.paid_by_landlord ? "Landlord" : (payerMember?.name ?? "Former member");
  const shares = [...(expense.expense_shares ?? [])].sort(
    (a, b) => a.allocation_order - b.allocation_order,
  );
  const displayDate = utility
    ? timestampToDateOnly(expense.created_at, timezone)
    : expense.expense_date;
  const notes = utility?.classification_note?.trim() || expense.note?.trim();
  const [attachment, recurringSchedule] = await Promise.all([
    utility ? Promise.resolve(null) : getExpenseAttachment(householdId, expenseId),
    expense.recurring_rule_id
      ? getRecurringExpenseSchedule(householdId, expense.recurring_rule_id)
      : Promise.resolve(null),
  ]);
  const nextRecurringDate =
    recurringSchedule?.active &&
    !recurringSchedule.archived_at &&
    (!recurringSchedule.end_date || recurringSchedule.next_due_date <= recurringSchedule.end_date)
      ? recurringSchedule.next_due_date
      : null;
  const editHref = expense.recurring_rule_id
    ? `/h/${householdId}/settings/recurring/${expense.recurring_rule_id}/edit`
    : `/h/${householdId}/expenses/${expenseId}/edit`;

  const voidExpense = async () => {
    "use server";
    const result = await voidExpenseAction({
      householdId,
      expenseId,
      reason: "Voided from the expense detail page.",
    });
    if (result.ok) redirect(`/h/${householdId}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <MobilePageTitle title={utility ? "Utility bill" : "Expense"} />
      <Link
        href={`/h/${householdId}`}
        className="mb-5 hidden min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[var(--muted)] no-underline hover:bg-white hover:text-[var(--ink)] md:inline-flex"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Home
      </Link>

      <PageHeader title={utility ? "Utility bill" : "Expense"} compact />

      <article className="overflow-hidden rounded-[24px] bg-white shadow-[var(--shadow-sm)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            {utility ? (
              <UtilityTypeIcon
                value={utility.utility_type}
                className="size-12 self-center [&>svg]:size-5"
              />
            ) : (
              <span
                className={
                  expense.kind === "recurring"
                    ? "grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--violet-soft)] text-[var(--violet)]"
                    : "grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"
                }
              >
                {expense.kind === "recurring" ? (
                  <Repeat2 className="size-5" aria-hidden="true" />
                ) : (
                  <ReceiptText className="size-5" strokeWidth={2.2} aria-hidden="true" />
                )}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {expense.voided_at && (
                  <span className="rounded-full bg-[var(--negative-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--negative)] uppercase">
                    Voided
                  </span>
                )}
              </div>
              <h2 className="mt-1 text-xl leading-tight font-black tracking-[-0.03em] sm:text-2xl">
                {expense.title}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {utility
                  ? `${formatDate(utility.service_start_date, locale)} – ${formatDate(utility.service_end_date, locale)}`
                  : formatDate(displayDate, locale)}
              </p>
              {nextRecurringDate && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--violet)]">
                  <Repeat2 className="size-3.5" aria-hidden="true" />
                  Next expense on {formatDate(nextRecurringDate, locale)}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <strong className="block text-xl font-black tracking-[-0.035em] tabular-nums sm:text-3xl">
                {formatMoney(Number(expense.total_cents), expense.currency, locale)}
              </strong>
              {utility && (
                <span className="mt-1 block text-[10px] leading-4 font-bold text-[var(--muted)] tabular-nums sm:text-xs">
                  Fixed {formatMoney(Number(utility.fixed_cents), expense.currency, locale)}
                  <span className="px-1">·</span>
                  Usage {formatMoney(Number(utility.variable_cents), expense.currency, locale)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--soft-line)] pt-3">
            <div className="relative flex min-h-11 items-center gap-2">
              <span className="relative z-10">
                {expense.paid_by_landlord ? (
                  <span className="grid size-9 place-items-center rounded-full bg-[var(--peach-soft)] text-[var(--peach)]">
                    <House className="size-4" aria-hidden="true" />
                  </span>
                ) : payerMember ? (
                  <MemberAvatar
                    name={payerMember.name}
                    color={payerMember.avatarColor}
                    className="size-9 border-0 shadow-none"
                  />
                ) : (
                  <span className="grid size-9 place-items-center rounded-full bg-[var(--soft-line)] text-[var(--muted)]">
                    <UserRound className="size-4" aria-hidden="true" />
                  </span>
                )}
              </span>
              <strong className="truncate text-sm">{payerName}</strong>
              <span className="text-xs text-[var(--muted)]">paid</span>
              <span className="ml-auto shrink-0 text-xs font-bold text-[var(--muted)]">
                {shares.length} {shares.length === 1 ? "person" : "people"}
                {!utility && (
                  <>
                    <span className="px-1.5">·</span>
                    {splitMethodLabel(expense.split_method).toLowerCase()}
                  </>
                )}
              </span>
              {shares.length > 0 && (
                <span
                  className="absolute top-[calc(50%+18px)] bottom-[-12px] left-[17px] w-0.5 bg-[var(--pastel-mint-line)]"
                  aria-hidden="true"
                />
              )}
            </div>

            <ul className="relative">
              {shares.map((share, index) => {
                const member = memberProfiles.get(share.member_id);
                const memberName = member?.name ?? "Former member";
                const connectorColor = "var(--pastel-mint-line)";
                return (
                  <li key={share.member_id} className="relative flex min-h-14 items-center pl-11">
                    {index < shares.length - 1 && (
                      <span
                        className="absolute top-0 bottom-0 left-[17px] w-0.5 bg-[var(--pastel-mint-line)]"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className="absolute top-0 left-[17px] h-1/2 w-5 rounded-bl-lg border-b-2 border-l-2"
                      style={{ borderColor: connectorColor }}
                      aria-hidden="true"
                    />
                    <span
                      className="absolute top-1/2 left-[35px] size-2 -translate-y-1/2 rounded-full"
                      style={{ background: connectorColor }}
                      aria-hidden="true"
                    />
                    <div
                      className={`flex min-w-0 flex-1 items-center gap-3 py-2 ${index < shares.length - 1 ? "border-b border-[var(--soft-line)]" : ""}`}
                    >
                      {member ? (
                        <MemberAvatar
                          name={member.name}
                          color={member.avatarColor}
                          className="size-9 border-0 shadow-none"
                        />
                      ) : (
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--soft-line)] text-[var(--muted)]">
                          <UserRound className="size-4" aria-hidden="true" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{memberName}</strong>
                        {utility && (
                          <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                            {share.presence_days ?? 0} days at home
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <strong className="block text-sm tabular-nums">
                          {formatMoney(Number(share.share_cents), expense.currency, locale)}
                        </strong>
                        {utility && (
                          <span className="mt-0.5 block text-[10px] text-[var(--muted)] tabular-nums">
                            {formatMoney(
                              Number(share.fixed_share_cents ?? 0),
                              expense.currency,
                              locale,
                            )}
                            {" + "}
                            {formatMoney(
                              Number(share.variable_share_cents ?? 0),
                              expense.currency,
                              locale,
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </article>

      {notes && (
        <section className="mt-5 overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)]">
          <div className="px-4 py-4">
            <p className="text-[10px] font-black tracking-[0.12em] text-[var(--muted)] uppercase">
              Notes
            </p>
            <p className="mt-1 text-sm leading-5 whitespace-pre-wrap text-[var(--ink-soft)]">
              {notes}
            </p>
          </div>
        </section>
      )}

      <div className="mt-4 mb-6 flex items-center justify-between px-1">
        <div>
          {(utility?.bill_document_id || attachment) && (
            <a
              href={
                utility?.bill_document_id
                  ? `/api/bills/${utility.bill_document_id}/view?householdId=${householdId}`
                  : `/api/expenses/${expenseId}/attachment?householdId=${householdId}`
              }
              target="_blank"
              rel="noreferrer"
              aria-label={
                utility
                  ? "View bill document"
                  : `View attachment: ${attachment!.original_file_name}`
              }
              title={utility ? "View bill document" : attachment!.original_file_name}
              className="grid size-12 place-items-center rounded-xl bg-[var(--pastel-lavender)] text-[var(--violet)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--violet-soft)]"
            >
              {utility ? (
                <FileText className="size-5" aria-hidden="true" />
              ) : (
                <Paperclip className="size-5" aria-hidden="true" />
              )}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <form action={voidExpense}>
            <button
              type="submit"
              disabled={Boolean(expense.voided_at)}
              aria-label={utility ? "Void bill" : "Void expense"}
              title={utility ? "Void bill" : "Void expense"}
              className="grid size-12 place-items-center rounded-xl bg-[var(--negative-soft)] text-[var(--negative)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[#fecaca] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Trash2 className="size-5" aria-hidden="true" />
            </button>
          </form>
          {!expense.voided_at && (
            <Link
              href={editHref}
              aria-label={
                expense.recurring_rule_id
                  ? "Edit recurring expense"
                  : utility
                    ? "Edit bill"
                    : "Edit expense"
              }
              title={
                expense.recurring_rule_id
                  ? "Edit recurring expense"
                  : utility
                    ? "Edit bill"
                    : "Edit expense"
              }
              className="grid size-12 place-items-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--brand-soft)]"
            >
              <Pencil className="size-5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
