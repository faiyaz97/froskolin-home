import Link from "next/link";
import {
  Droplets,
  Flame,
  HandCoins,
  House,
  ReceiptText,
  Repeat2,
  ShoppingBasket,
  Utensils,
  Wifi,
  Zap,
} from "lucide-react";

import { formatMoney, timestampToDateOnly } from "@/lib/format";

type Expense = {
  id: string;
  title: string;
  total_cents: number;
  currency: string;
  payer_member_id: string | null;
  paid_by_landlord: boolean;
  expense_date: string;
  created_at: string;
  kind: "manual" | "utility" | "recurring";
  split_method: "equal" | "exact" | "percentage" | "utility";
  recurring_rule_id: string | null;
  expense_shares: { member_id: string; share_cents: number }[];
  utility_bills:
    | { utility_type: "electricity" | "gas" | "water" | "internet" | "other" }
    | { utility_type: "electricity" | "gas" | "water" | "internet" | "other" }[]
    | null;
};

type Settlement = {
  id: string;
  paying_member_id: string;
  receiving_member_id: string;
  amount_cents: number;
  currency: string;
  settlement_date: string;
  created_at: string;
};

const categories = [
  {
    words: /wifi|internet|broadband/i,
    icon: Wifi,
    color: "bg-[var(--sky-soft)] text-[var(--sky)]",
  },
  {
    words: /electric|power|energy|gas|water|utility/i,
    icon: Zap,
    color: "bg-[var(--peach-soft)] text-[var(--peach)]",
  },
  {
    words: /food|dinner|lunch|restaurant|pizza|meal/i,
    icon: Utensils,
    color: "bg-[var(--violet-soft)] text-[var(--violet)]",
  },
  {
    words: /grocery|groceries|market|supermarket/i,
    icon: ShoppingBasket,
    color: "bg-[var(--positive-soft)] text-[var(--positive)]",
  },
  { words: /rent|house|home/i, icon: House, color: "bg-[#fce7f3] text-[#be185d]" },
];

function formatMonth(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
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

function ExpenseIcon({ expense }: { expense: Expense }) {
  const utility = Array.isArray(expense.utility_bills)
    ? expense.utility_bills[0]
    : expense.utility_bills;
  const utilityAppearance = utility
    ? {
        electricity: { icon: Zap, color: "bg-[#fef3c7] text-[#d97706]" },
        gas: { icon: Flame, color: "bg-[var(--peach-soft)] text-[var(--peach)]" },
        water: { icon: Droplets, color: "bg-[var(--sky-soft)] text-[var(--sky)]" },
        internet: { icon: Wifi, color: "bg-[var(--violet-soft)] text-[var(--violet)]" },
        other: { icon: ReceiptText, color: "bg-[var(--brand-soft)] text-[var(--brand)]" },
      }[utility.utility_type]
    : null;
  const matched = categories.find((category) => category.words.test(expense.title));
  const Icon = expense.recurring_rule_id
    ? Repeat2
    : (utilityAppearance?.icon ?? matched?.icon ?? ReceiptText);
  const color = expense.recurring_rule_id
    ? "bg-[var(--violet-soft)] text-[var(--violet)]"
    : (utilityAppearance?.color ?? matched?.color ?? "bg-[var(--brand-soft)] text-[var(--brand)]");

  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${color}`}>
      <Icon className="size-5" strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

export function HouseholdLedger({
  householdId,
  currentMemberId,
  memberNames,
  expenses,
  settlements,
  locale,
  timezone,
}: {
  householdId: string;
  currentMemberId: string;
  memberNames: Record<string, string>;
  expenses: Expense[];
  settlements: Settlement[];
  locale: string;
  timezone: string;
}) {
  const rows = [
    ...expenses.map((expense) => ({
      kind: "expense" as const,
      date:
        expense.kind === "utility"
          ? timestampToDateOnly(expense.created_at, timezone)
          : expense.expense_date,
      createdAt: expense.created_at,
      value: expense,
    })),
    ...settlements.map((settlement) => ({
      kind: "settlement" as const,
      date: settlement.settlement_date,
      createdAt: settlement.created_at,
      value: settlement,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const groups = rows.reduce<Array<{ key: string; label: string; rows: typeof rows }>>(
    (result, row) => {
      const key = row.date.slice(0, 7);
      const current = result.at(-1);
      if (current?.key === key) current.rows.push(row);
      else result.push({ key, label: formatMonth(row.date, locale), rows: [row] });
      return result;
    },
    [],
  );

  return (
    <section aria-label="Expenses">
      {groups.length ? (
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <h3 className="mb-1.5 px-1 text-[11px] font-black tracking-[0.08em] text-[var(--muted)] uppercase">
                {group.label}
              </h3>
              <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[var(--shadow-sm)]">
                {group.rows.map((row) => {
                  const date = formatDay(row.date, locale);
                  if (row.kind === "settlement") {
                    const settlement = row.value;
                    return (
                      <Link
                        key={`settlement-${settlement.id}`}
                        href={`/h/${householdId}/settlements/${settlement.id}`}
                        className="flex min-h-[68px] items-center gap-3 border-b border-[var(--soft-line)] px-3 py-2.5 text-[var(--ink)] no-underline last:border-0 hover:bg-[var(--canvas)] sm:px-4"
                      >
                        <time className="w-8 shrink-0 text-center text-[10px] leading-4 font-bold text-[var(--muted)] uppercase">
                          {date.month}
                          <span className="block text-base leading-4 font-black text-[var(--ink-soft)]">
                            {date.day}
                          </span>
                        </time>
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--positive-soft)] text-[var(--positive)]">
                          <HandCoins className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold">Payment</p>
                          <p className="truncate text-xs text-[var(--muted)] sm:text-sm">
                            {memberNames[settlement.paying_member_id] ?? "Former roommate"} paid{" "}
                            {memberNames[settlement.receiving_member_id] ?? "Former roommate"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-[var(--positive)] tabular-nums">
                          {formatMoney(settlement.amount_cents, settlement.currency, locale)}
                        </p>
                      </Link>
                    );
                  }

                  const expense = row.value;
                  const ownShare =
                    expense.expense_shares.find((share) => share.member_id === currentMemberId)
                      ?.share_cents ?? 0;
                  const paidByCurrentMember =
                    !expense.paid_by_landlord && expense.payer_member_id === currentMemberId;
                  const lent = expense.total_cents - ownShare;
                  const result = expense.paid_by_landlord
                    ? ownShare > 0
                      ? {
                          label: "to landlord",
                          cents: ownShare,
                          className: "text-[var(--peach)]",
                        }
                      : null
                    : paidByCurrentMember
                      ? lent > 0
                        ? { label: "you lent", cents: lent, className: "text-[var(--positive)]" }
                        : { label: "your share", cents: ownShare, className: "text-[var(--muted)]" }
                      : ownShare > 0
                        ? {
                            label: "you owe",
                            cents: ownShare,
                            className: "text-[var(--negative)]",
                          }
                        : null;

                  return (
                    <Link
                      key={`expense-${expense.id}`}
                      href={`/h/${householdId}/expenses/${expense.id}`}
                      className="flex min-h-[68px] items-center gap-3 border-b border-[var(--soft-line)] px-3 py-2.5 text-[var(--ink)] no-underline last:border-0 hover:bg-[var(--canvas)] sm:px-4"
                    >
                      <time className="w-8 shrink-0 text-center text-[10px] leading-4 font-bold text-[var(--muted)] uppercase">
                        {date.month}
                        <span className="block text-base leading-4 font-black text-[var(--ink-soft)]">
                          {date.day}
                        </span>
                      </time>
                      <ExpenseIcon expense={expense} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold">{expense.title}</p>
                        <p className="truncate text-xs text-[var(--muted)] sm:text-sm">
                          {expense.paid_by_landlord
                            ? "Landlord"
                            : (memberNames[expense.payer_member_id ?? ""] ??
                              "Former roommate")}{" "}
                          paid {formatMoney(expense.total_cents, expense.currency, locale)}
                        </p>
                      </div>
                      {result && (
                        <div className={`shrink-0 text-right ${result.className}`}>
                          <p className="text-[10px] font-bold">{result.label}</p>
                          <p className="text-sm font-black tabular-nums">
                            {formatMoney(result.cents, expense.currency, locale)}
                          </p>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-4 rounded-2xl border border-dashed border-[var(--line)] bg-white px-4 py-5 sm:px-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)]">
            <ReceiptText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-black">No expenses yet</p>
            <p className="mt-0.5 text-sm text-[var(--muted)]">Add the first shared cost.</p>
          </div>
        </div>
      )}
    </section>
  );
}
