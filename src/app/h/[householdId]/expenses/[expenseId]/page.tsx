import {
  ArrowLeft,
  FileText,
  HandCoins,
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
import { BillMemberStatus } from "@/components/expenses/bill-member-status";
import { UndoLandlordPaymentButton } from "@/components/expenses/undo-landlord-payment-button";
import { MobilePageTitle } from "@/components/household/app-shell";
import { ConfirmationButton } from "@/components/ui/confirmation-button";
import {
  MemberAvatar,
  resolveAvatarColor,
  type AvatarColor,
} from "@/components/household/member-avatar";
import { iconActionClass } from "@/components/ui/icon-action";
import { PageHeader } from "@/components/ui/page";
import { voidExpenseAction } from "@/lib/actions";
import { requireHouseholdMembership } from "@/lib/auth";
import { calculateConstrainedAllBalances } from "@/lib/domain/constrained-all-balances";
import { routeDepartedSuggestions } from "@/lib/domain/balance-exit";
import { projectBillPaymentPlan, type PlannedBillShare } from "@/lib/domain/bill-payment-plan";
import { calculateBillMemberContributions } from "@/lib/domain/bill-member-contributions";
import { formatMoney, timestampToDateOnly } from "@/lib/format";
import {
  getExpenseAttachment,
  getExpenseDetail,
  getBalances,
  getAllLandlordShareBalances,
  getHousehold,
  getHouseholdMembers,
  getLandlordBillPaymentGroups,
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

function formatDay(value: string, locale: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return {
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date),
    day: new Intl.DateTimeFormat(locale, { day: "2-digit", timeZone: "UTC" }).format(date),
  };
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
  const [{ membership, user }, group, members, rawExpense] = await Promise.all([
    requireHouseholdMembership(householdId),
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
  const [attachment, recurringSchedule, landlordPaymentGroups, allLandlordShares, groupBalances] =
    await Promise.all([
      utility ? Promise.resolve(null) : getExpenseAttachment(householdId, expenseId),
      expense.recurring_rule_id
        ? getRecurringExpenseSchedule(householdId, expense.recurring_rule_id)
        : Promise.resolve(null),
      expense.paid_by_landlord && !expense.voided_at
        ? getLandlordBillPaymentGroups(householdId, expenseId)
        : Promise.resolve([]),
      expense.paid_by_landlord && !expense.voided_at
        ? getAllLandlordShareBalances(householdId)
        : Promise.resolve([]),
      expense.paid_by_landlord &&
      !expense.voided_at &&
      group?.balance_strategy === "super_simplified"
        ? getBalances(householdId)
        : Promise.resolve([]),
    ]);
  let plannedBillShares: PlannedBillShare[] = [];
  if (expense.paid_by_landlord && !expense.voided_at) {
    if (group?.balance_strategy === "super_simplified" && group.landlord_enabled) {
      const projection = calculateConstrainedAllBalances(
        groupBalances.map((row) => ({
          memberId: row.member_id,
          currency: row.currency,
          amountCents: Number(row.net_cents),
        })),
        allLandlordShares,
      );
      const departedIds = new Set(
        members.filter((member) => member.removed_at).map((member) => member.id),
      );
      plannedBillShares = projectBillPaymentPlan(
        allLandlordShares,
        routeDepartedSuggestions(projection.suggestions, departedIds),
        departedIds,
      ).filter((row) => row.expenseId === expenseId);
    } else {
      plannedBillShares = allLandlordShares
        .filter((row) => row.expenseId === expenseId)
        .map((row) => ({
          ...row,
          currentDueCents: row.remainingCents,
          coveredByOthersCents: 0,
          plannedPayers: row.remainingCents
            ? [{ memberId: row.memberId, amountCents: row.remainingCents }]
            : [],
        }));
    }
  }
  plannedBillShares.sort(
    (a, b) =>
      shares.findIndex((share) => share.member_id === a.memberId) -
      shares.findIndex((share) => share.member_id === b.memberId),
  );
  const billContributions = calculateBillMemberContributions(
    plannedBillShares,
    landlordPaymentGroups.flatMap((payment) =>
      payment.breakdown
        .filter((part) => part.expenseId === expenseId)
        .map((part) => ({
          memberId: part.memberId,
          paidByMemberId: payment.paidByMemberId,
          amountCents: part.amountCents,
        })),
    ),
  ).sort((a, b) => {
    const order = (memberId: string) => {
      const index = shares.findIndex((share) => share.member_id === memberId);
      return index < 0 ? shares.length : index;
    };
    return order(a.memberId) - order(b.memberId);
  });
  const hasRecordedLandlordPayments = expense.paid_by_landlord && landlordPaymentGroups.length > 0;
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
          <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-x-4">
            {utility ? (
              <UtilityTypeIcon value={utility.utility_type} className="size-12 [&>svg]:size-5" />
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
              <h2 className="mt-1 max-w-full text-xl leading-tight font-black tracking-[-0.03em] [overflow-wrap:anywhere] break-words sm:text-2xl">
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

            <div className="hidden shrink-0 text-right sm:block">
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

          <div className="mt-3 border-t border-[var(--soft-line)] pt-3 sm:mt-5">
            <div className="flex items-center justify-end gap-3 text-right sm:hidden">
              {utility && (
                <p className="text-xs leading-4 font-semibold text-[var(--muted)] tabular-nums">
                  Fixed {formatMoney(Number(utility.fixed_cents), expense.currency, locale)}
                  <span className="px-1">·</span>
                  Usage {formatMoney(Number(utility.variable_cents), expense.currency, locale)}
                </p>
              )}
              <strong className="shrink-0 text-xl font-black tracking-[-0.035em] tabular-nums">
                {formatMoney(Number(expense.total_cents), expense.currency, locale)}
              </strong>
            </div>

            {!expense.paid_by_landlord && (
              <div className="relative flex min-h-11 items-center gap-2">
                <span className="relative z-10">
                  {payerMember ? (
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
            )}

            {expense.paid_by_landlord && !expense.voided_at ? (
              <BillMemberStatus
                rows={billContributions}
                memberProfiles={memberProfiles}
                presenceDaysByMemberId={
                  utility
                    ? new Map(shares.map((share) => [share.member_id, share.presence_days ?? 0]))
                    : undefined
                }
                shareBreakdownByMemberId={
                  utility
                    ? new Map(
                        shares
                          .filter(
                            (share) =>
                              share.fixed_share_cents !== null &&
                              share.variable_share_cents !== null,
                          )
                          .map((share) => [
                            share.member_id,
                            {
                              fixedCents: Number(share.fixed_share_cents),
                              usageCents: Number(share.variable_share_cents),
                            },
                          ]),
                      )
                    : undefined
                }
                locale={locale}
                householdId={householdId}
                expenseId={expenseId}
                currentMemberId={group?.landlord_enabled ? membership.id : undefined}
              />
            ) : (
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
                        className="absolute top-0 left-[17px] h-1/2 w-[27px] rounded-bl-lg border-b-2 border-l-2"
                        style={{ borderColor: connectorColor }}
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
                          <span className="block text-[10px] font-semibold text-[var(--muted)]">
                            Share
                          </span>
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
            )}
            {!expense.paid_by_landlord && utility && (
              <p className="mt-3 border-t border-[var(--soft-line)] pt-3 text-xs leading-5 text-[var(--muted)]">
                Payments between members settle your Group balance, not a specific bill share.
              </p>
            )}
            {notes && (
              <p className="mt-3 border-t border-[var(--soft-line)] pt-3 text-sm leading-5 whitespace-pre-wrap text-[var(--ink-soft)]">
                <strong className="text-[var(--ink)]">Notes:</strong> {notes}
              </p>
            )}
          </div>
        </div>
      </article>

      {expense.paid_by_landlord && !expense.voided_at && (
        <section className="mt-6" aria-labelledby="bill-payment-history-title">
          <h2 id="bill-payment-history-title" className="mb-2 px-1 text-sm font-black">
            Payment history
          </h2>
          {landlordPaymentGroups.length ? (
            <div className="overflow-hidden rounded-[22px] bg-white shadow-[var(--shadow-sm)]">
              {landlordPaymentGroups.map((payment) => {
                const payerName = payment.paidByMemberId
                  ? (memberProfiles.get(payment.paidByMemberId)?.name ?? "A member")
                  : null;
                const coversOtherBills = payment.breakdown.some(
                  (part) => part.expenseId !== expenseId,
                );
                const day = formatDay(payment.paymentDate, locale);
                return (
                  <div
                    key={payment.id}
                    className="flex min-h-[68px] items-center gap-2 border-b border-[var(--soft-line)] px-3 py-2.5 last:border-0 sm:gap-3 sm:px-4"
                  >
                    <time className="w-8 shrink-0 text-center text-[10px] leading-4 font-bold text-[var(--muted)] uppercase">
                      {day.month}
                      <span className="block text-base leading-4 font-black text-[var(--ink-soft)]">
                        {day.day}
                      </span>
                    </time>
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-[var(--ink)]"
                      style={{
                        background: payerName
                          ? resolveAvatarColor(
                              payerName,
                              memberProfiles.get(payment.paidByMemberId!)?.avatarColor,
                            )
                          : "var(--soft-line)",
                      }}
                    >
                      <HandCoins className="size-4.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs sm:text-sm">
                      <strong>{payerName ?? "Recorded payment"}</strong>{" "}
                      <span className="text-[10px] font-normal text-[var(--muted)]">
                        paid to Landlord
                      </span>
                    </span>
                    <strong className="shrink-0 text-xs tabular-nums sm:text-sm">
                      {formatMoney(payment.onThisBillCents, expense.currency, locale)}
                    </strong>
                    {(membership.role === "owner" ||
                      payment.paidByMemberId === membership.id ||
                      (!payment.paidByMemberId && payment.createdByUserId === user.id)) && (
                      <UndoLandlordPaymentButton
                        householdId={householdId}
                        paymentId={payment.paymentId}
                        totalCents={payment.totalCents}
                        currency={expense.currency}
                        locale={locale}
                        coversOtherBills={coversOtherBills}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-[22px] bg-white px-4 py-4 text-sm text-[var(--muted)] shadow-[var(--shadow-sm)]">
              No payments recorded for this bill yet.
            </p>
          )}
        </section>
      )}

      {hasRecordedLandlordPayments && !expense.voided_at && (
        <p className="mt-4 px-1 text-xs leading-5 text-[var(--muted)]">
          Undo all payments in Payment history before editing or voiding this bill. Ask the payer or
          an admin to undo any payment you can’t reverse.
        </p>
      )}
      <div className="mt-4 mb-6 flex items-center justify-between px-1">
        <div>
          {(utility?.bill_document_id || attachment) && (
            <Link
              href={`/h/${householdId}/expenses/${expenseId}/attachment`}
              aria-label={
                utility
                  ? "View bill document"
                  : `View attachment: ${attachment!.original_file_name}`
              }
              title={utility ? "View bill document" : attachment!.original_file_name}
              className={iconActionClass({ tone: "violet", active: true, className: "size-12" })}
            >
              {utility ? (
                <FileText className="size-5" aria-hidden="true" />
              ) : (
                <Paperclip className="size-5" aria-hidden="true" />
              )}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ConfirmationButton
            triggerLabel={utility ? "Void bill" : "Void expense"}
            triggerTitle={
              hasRecordedLandlordPayments ? "Undo all payments before voiding" : undefined
            }
            title={utility ? "Void this bill?" : "Void this expense?"}
            description="This will remove it from balances. It will remain visible in Activity."
            confirmLabel="Void"
            pendingLabel="Voiding…"
            disabled={Boolean(expense.voided_at) || hasRecordedLandlordPayments}
            onConfirmAction={voidExpense}
            triggerClassName={iconActionClass({ tone: "negative", className: "size-12" })}
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </ConfirmationButton>
          {!expense.voided_at && !hasRecordedLandlordPayments && (
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
              className={iconActionClass({ tone: "brand", className: "size-12" })}
            >
              <Pencil className="size-5" aria-hidden="true" />
            </Link>
          )}
          {!expense.voided_at && hasRecordedLandlordPayments && (
            <button
              type="button"
              disabled
              aria-label={
                utility ? "Edit bill after undoing payments" : "Edit expense after undoing payments"
              }
              title="Undo all payments before editing"
              className={iconActionClass({ tone: "brand", className: "size-12" })}
            >
              <Pencil className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
