import { CheckCircle2, Clock3 } from "lucide-react";

import { MemberAvatar, type AvatarColor } from "@/components/household/member-avatar";
import { QuickBillPaymentButton } from "@/components/expenses/quick-bill-payment-button";
import type { BillMemberContribution } from "@/lib/domain/bill-member-contributions";
import { formatMoney } from "@/lib/format";

type MemberProfile = { name: string; avatarColor: AvatarColor | null };

export function BillMemberStatus({
  rows,
  memberProfiles,
  presenceDaysByMemberId,
  shareBreakdownByMemberId,
  locale,
  householdId,
  expenseId,
  currentMemberId,
}: {
  rows: BillMemberContribution[];
  memberProfiles: Map<string, MemberProfile>;
  presenceDaysByMemberId?: ReadonlyMap<string, number>;
  shareBreakdownByMemberId?: ReadonlyMap<string, { fixedCents: number; usageCents: number }>;
  locale: string;
  householdId?: string;
  expenseId?: string;
  currentMemberId?: string;
}) {
  return (
    <div className="mt-2">
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,.95fr)_minmax(0,1fr)_minmax(0,.9fr)] items-end gap-x-1.5 border-b border-[var(--soft-line)] px-1 pt-2 pb-2 text-right text-[8px] leading-3 font-bold text-[var(--muted)] uppercase max-[350px]:text-[7px] sm:text-[9px]">
        <span aria-hidden="true" />
        <span className="whitespace-nowrap">Original share</span>
        <span className="whitespace-nowrap">To landlord</span>
        <span>Status</span>
      </div>
      <div className="grid auto-rows-fr divide-y divide-[var(--soft-line)]">
        {rows.map((row) => {
          const profile = memberProfiles.get(row.memberId);
          const name = profile?.name ?? "Former member";
          const daysAtHome = presenceDaysByMemberId?.get(row.memberId);
          const shareBreakdown = shareBreakdownByMemberId?.get(row.memberId);
          const coveredBy = row.coveredBy.map(
            (item) =>
              `${memberProfiles.get(item.memberId)?.name ?? "A member"} ${item.recorded ? "paid" : "pays"} ${formatMoney(item.amountCents, row.currency, locale)} for you`,
          );
          const included = new Map<string, number>();
          for (const item of row.includes)
            included.set(item.memberId, (included.get(item.memberId) ?? 0) + item.amountCents);
          const includes = included.size
            ? `Includes ${[...included]
                .map(
                  ([memberId, amountCents]) =>
                    `${formatMoney(amountCents, row.currency, locale)} for ${memberProfiles.get(memberId)?.name ?? "a member"}`,
                )
                .join(" and ")}`
            : null;
          const details = [
            ...coveredBy,
            includes,
            !row.paid && row.paidToLandlordCents > 0
              ? `${formatMoney(row.paidToLandlordCents, row.currency, locale)} already paid`
              : null,
          ].filter(Boolean);
          const canQuickPay =
            householdId &&
            expenseId &&
            row.memberId === currentMemberId &&
            row.plannedToLandlordCents > 0;
          return (
            <div
              key={row.memberId}
              className="relative grid grid-cols-[minmax(0,1.5fr)_minmax(0,.95fr)_minmax(0,1fr)_minmax(0,.9fr)] content-center items-center gap-x-1.5 gap-y-1 px-1 py-3"
            >
              <MemberAvatar
                name={name}
                color={profile?.avatarColor}
                className="absolute top-1/2 left-1 size-9 -translate-y-1/2 border-0 shadow-none max-[350px]:size-7 sm:size-10"
              />
              <div className="col-start-1 row-start-1 min-w-0 pl-11 max-[350px]:pl-8 sm:pl-12">
                <strong className="block truncate text-xs leading-4 sm:text-sm">{name}</strong>
                {daysAtHome !== undefined && (
                  <span className="block text-[10px] leading-3 whitespace-nowrap text-[var(--muted)] max-[350px]:text-[9px]">
                    {daysAtHome} {daysAtHome === 1 ? "day" : "days"} at home
                  </span>
                )}
              </div>
              <span className="col-start-2 row-span-2 row-start-1 min-w-0 self-center text-right text-xs font-semibold text-[var(--ink-soft)] tabular-nums">
                <span className="block">
                  {formatMoney(row.originalShareCents, row.currency, locale)}
                </span>
                {shareBreakdown && (
                  <span
                    className="block text-[9px] leading-3 font-normal [overflow-wrap:anywhere] text-[var(--muted)]"
                    aria-label={`Fixed ${formatMoney(shareBreakdown.fixedCents, row.currency, locale)} plus usage ${formatMoney(shareBreakdown.usageCents, row.currency, locale)}`}
                  >
                    {formatMoney(shareBreakdown.fixedCents, row.currency, locale)} +{" "}
                    {formatMoney(shareBreakdown.usageCents, row.currency, locale)}
                  </span>
                )}
              </span>
              <strong
                className={`col-start-3 row-span-2 row-start-1 min-w-0 self-center text-right text-sm font-black tabular-nums sm:text-base ${row.paid ? "text-[var(--positive)]" : "text-[var(--peach)]"}`}
              >
                {formatMoney(row.toLandlordCents, row.currency, locale)}
              </strong>
              <div className="col-start-4 row-span-2 row-start-1 flex justify-end self-center">
                {canQuickPay ? (
                  <QuickBillPaymentButton
                    householdId={householdId}
                    expenseId={expenseId}
                    amountCents={row.plannedToLandlordCents}
                    currency={row.currency}
                    locale={locale}
                  />
                ) : (
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-black ${row.paid ? "bg-[var(--positive-soft)] text-[var(--positive)]" : "bg-[var(--peach-soft)] text-[var(--peach)]"}`}
                  >
                    {row.paid ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      <Clock3 className="size-3.5" />
                    )}
                    {row.paid ? "Paid" : "Due"}
                  </span>
                )}
              </div>
              <p
                className={`col-span-full col-start-1 row-start-2 min-h-[28px] pl-11 text-[11px] leading-[14px] [overflow-wrap:anywhere] text-[var(--muted)] max-[350px]:pl-8 sm:min-h-[14px] sm:pl-12 ${details.length > 0 ? "pt-5 sm:pt-2" : ""}`}
              >
                {details.join(" · ")}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
