import { ArrowLeft, ArrowRight, HandCoins, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MobilePageTitle } from "@/components/household/app-shell";
import {
  MemberAvatar,
  resolveAvatarColor,
  type AvatarColor,
} from "@/components/household/member-avatar";
import { iconActionClass } from "@/components/ui/icon-action";
import { ConfirmationButton } from "@/components/ui/confirmation-button";
import { PageHeader, StatusNote } from "@/components/ui/page";
import { voidSettlementAction } from "@/lib/actions";
import { requireHouseholdMembership } from "@/lib/auth";
import { formatMoney } from "@/lib/format";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ householdId: string; settlementId: string }>;
}) {
  const { householdId, settlementId } = await params;
  const { supabase } = await requireHouseholdMembership(householdId);
  const [settlementResult, homeResult, membersResult] = await Promise.all([
    supabase
      .from("settlements")
      .select("*")
      .eq("household_id", householdId)
      .eq("id", settlementId)
      .maybeSingle(),
    supabase.from("households").select("locale").eq("id", householdId).single(),
    supabase
      .from("household_members")
      .select("id, display_name, avatar_color")
      .eq("household_id", householdId),
  ]);
  if (settlementResult.error || homeResult.error || membersResult.error) {
    throw settlementResult.error ?? homeResult.error ?? membersResult.error;
  }
  const settlement = settlementResult.data;
  if (!settlement) notFound();

  const members = new Map(
    (membersResult.data ?? []).map((member) => [
      member.id,
      {
        name: member.display_name,
        avatarColor: member.avatar_color as AvatarColor | null,
      },
    ]),
  );
  const payer = members.get(settlement.paying_member_id) ?? {
    name: "Former member",
    avatarColor: null,
  };
  const receiver = members.get(settlement.receiving_member_id) ?? {
    name: "Former member",
    avatarColor: null,
  };
  const locale = homeResult.data.locale;
  const note = settlement.note?.trim();

  const voidSettlement = async () => {
    "use server";
    const result = await voidSettlementAction({
      householdId,
      settlementId,
      reason: "Voided from the payment detail page.",
    });
    if (result.ok) redirect(`/h/${householdId}/balances`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <MobilePageTitle title="Payment" />
      <Link
        href={`/h/${householdId}`}
        className="mb-5 hidden min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[var(--muted)] no-underline hover:bg-white hover:text-[var(--ink)] md:inline-flex"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Home
      </Link>

      <PageHeader title="Payment" compact />

      <article className="overflow-hidden rounded-[24px] bg-white shadow-[var(--shadow-sm)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)]">
              <HandCoins className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 className="text-lg leading-tight font-black tracking-[-0.025em]">Payment</h2>
              <p className="mt-1 text-xs font-semibold text-[var(--muted)]">
                {formatDate(settlement.settlement_date, locale)}
              </p>
            </div>
            <strong className="shrink-0 pt-1 text-xl font-black tracking-[-0.025em] tabular-nums sm:text-2xl">
              {formatMoney(Number(settlement.amount_cents), settlement.currency, locale)}
            </strong>
          </div>

          <div className="my-5 h-px bg-[var(--soft-line)]" />

          <div className="grid grid-cols-[minmax(0,1fr)_2.25rem_minmax(0,1fr)] items-center gap-1.5 sm:gap-3">
            <div
              className="flex min-w-0 items-center gap-2.5 rounded-2xl px-3 py-2.5"
              style={{
                background: `color-mix(in srgb, ${resolveAvatarColor(payer.name, payer.avatarColor)} 38%, white)`,
              }}
            >
              <MemberAvatar
                name={payer.name}
                color={payer.avatarColor}
                className="size-10 border-0 shadow-none"
              />
              <span className="min-w-0 truncate text-sm font-extrabold">{payer.name}</span>
            </div>
            <ArrowRight className="mx-auto size-5 text-[var(--muted)]" aria-hidden="true" />
            <div
              className="flex min-w-0 items-center gap-2.5 rounded-2xl px-3 py-2.5"
              style={{
                background: `color-mix(in srgb, ${resolveAvatarColor(receiver.name, receiver.avatarColor)} 38%, white)`,
              }}
            >
              <MemberAvatar
                name={receiver.name}
                color={receiver.avatarColor}
                className="size-10 border-0 shadow-none"
              />
              <span className="min-w-0 truncate text-sm font-extrabold">{receiver.name}</span>
            </div>
          </div>

          {note && (
            <p className="mt-4 border-t border-[var(--soft-line)] pt-4 text-sm leading-5 whitespace-pre-wrap text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">Notes:</strong> {note}
            </p>
          )}
        </div>
      </article>

      {settlement.voided_at && (
        <div className="mt-5">
          <StatusNote tone="warning" title="This payment was voided">
            It remains in Activity but no longer affects balances.
          </StatusNote>
        </div>
      )}

      {!settlement.voided_at && (
        <div className="mt-4 mb-6 flex items-center justify-end gap-2 px-1">
          <ConfirmationButton
            triggerLabel="Void payment"
            title="Void this payment?"
            description="This will remove it from balances. It will remain visible in Activity."
            confirmLabel="Void"
            pendingLabel="Voiding…"
            onConfirmAction={voidSettlement}
            triggerClassName={iconActionClass({ tone: "negative", className: "size-12" })}
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </ConfirmationButton>
          <Link
            href={`/h/${householdId}/settlements/${settlementId}/edit`}
            aria-label="Edit payment"
            title="Edit payment"
            className={iconActionClass({ tone: "brand", className: "size-12" })}
          >
            <Pencil className="size-5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
