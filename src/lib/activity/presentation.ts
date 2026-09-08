import { formatMoney } from "@/lib/format";

export type ActivityEvent = {
  id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  occurred_at: string;
  actor_user_id: string | null;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
};

export type ActivityMember = {
  id: string;
  userId: string | null;
  name: string;
};

export type ActivityChange = {
  label: string;
  before?: string;
  after?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sameValue(before: unknown, after: unknown) {
  return JSON.stringify(before) === JSON.stringify(after);
}

function memberName(value: unknown, members: ActivityMember[]) {
  const id = text(value);
  if (!id) return "Not set";
  return (
    members.find((member) => member.id === id || member.userId === id)?.name ?? "Former member"
  );
}

function dateOnly(value: unknown, locale: string) {
  const date = text(value);
  if (!date) return "Not set";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function money(value: unknown, locale: string) {
  const amount = record(value);
  const cents = number(amount.cents);
  const currency = text(amount.currency);
  if (cents === undefined) return "Not set";
  if (!currency) return (cents / 100).toFixed(2);
  try {
    return formatMoney(cents, currency, locale);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function moneyValue(snapshot: Record<string, unknown>, key: string) {
  const cents = snapshot[key];
  if (cents === undefined) return undefined;
  return { cents, currency: snapshot.currency };
}

function splitConfig(snapshot: Record<string, unknown>) {
  return record(snapshot.split_config);
}

function participants(snapshot: Record<string, unknown>) {
  const values = splitConfig(snapshot).participants;
  if (!Array.isArray(values)) return undefined;
  return values.map((value) => record(value).memberId ?? record(value).member_id);
}

function shares(snapshot: Record<string, unknown>) {
  const values = splitConfig(snapshot).shares;
  if (!Array.isArray(values)) return undefined;
  return values.map((value) => {
    const share = record(value);
    return {
      memberId: share.member_id ?? share.memberId,
      cents: share.share_cents ?? share.amountCents,
      currency: snapshot.currency,
    };
  });
}

function formatParticipants(value: unknown, members: ActivityMember[]) {
  if (!Array.isArray(value) || !value.length) return "Nobody";
  return value.map((id) => memberName(id, members)).join(", ");
}

function formatShares(value: unknown, members: ActivityMember[], locale: string) {
  if (!Array.isArray(value) || !value.length) return "Not set";
  return value
    .map((item) => {
      const share = record(item);
      return `${memberName(share.memberId, members)} ${money(
        { cents: share.cents, currency: share.currency },
        locale,
      )}`;
    })
    .join(" · ");
}

function payer(snapshot: Record<string, unknown>) {
  if (snapshot.paid_by_landlord === true) return "landlord";
  return snapshot.payer_member_id;
}

function formatPayer(value: unknown, members: ActivityMember[]) {
  return value === "landlord" ? "Landlord" : memberName(value, members);
}

function splitMethod(value: unknown) {
  const method = text(value);
  if (method === "equal") return "Equally";
  if (method === "exact") return "By amounts";
  if (method === "percentage") return "By percentages";
  if (method === "utility") return "By fixed fees and usage";
  return method ?? "Not set";
}

function readableStatus(value: unknown) {
  if (value === true) return "Enabled";
  if (value === false) return "Disabled";
  if (value === null || value === undefined || value === "") return "Not set";
  return String(value).replaceAll("_", " ");
}

function targetSnapshot(event: ActivityEvent) {
  return event.new_values ?? event.previous_values ?? {};
}

export function activityActor(event: ActivityEvent, members: ActivityMember[]) {
  if (!event.actor_user_id) return "Froskolin";
  return memberName(event.actor_user_id, members);
}

export function activityHeadline(event: ActivityEvent, members: ActivityMember[]) {
  const snapshot = targetSnapshot(event);
  const title = text(snapshot.title);
  const targetMember = text(snapshot.display_name) ?? memberName(snapshot.member_id, members);
  const verb =
    event.action_type === "created"
      ? "Added"
      : event.action_type === "updated"
        ? "Updated"
        : event.action_type === "voided"
          ? "Voided"
          : event.action_type === "reopened"
            ? "Reopened"
            : event.action_type === "marked_paid"
              ? "Marked as paid"
              : event.action_type.replaceAll("_", " ");

  if (event.entity_type === "expense") return `${verb} ${title ?? "an expense"}`;
  if (event.entity_type === "settlement") return `${verb} a payment`;
  if (event.entity_type === "absence_period")
    return `${verb} away dates for ${targetMember === "Not set" ? "a member" : targetMember}`;
  if (event.entity_type === "household_member")
    return `${verb} ${targetMember === "Not set" ? "a member" : targetMember}`;
  if (event.entity_type === "recurring_rule") return `${verb} ${title ?? "a recurring expense"}`;
  if (event.entity_type === "landlord_payment")
    return event.action_type === "reopened"
      ? `Reopened ${title ?? "a bill"}`
      : event.action_type === "marked_paid"
        ? `Marked ${title ?? "a bill"} as paid`
        : `Recorded a payment${title ? ` for ${title}` : ""}`;
  if (event.entity_type === "bill_document")
    return event.action_type === "created" ? "Uploaded a bill document" : `${verb} a bill document`;
  if (event.entity_type === "household") return `${verb} group settings`;

  const fallback = event.summary
    .replaceAll(/household/gi, "group")
    .replace(/^A group member\s+/i, "")
    .replace(/\.$/, "");
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

export function activityAmount(event: ActivityEvent, locale: string) {
  const snapshot = targetSnapshot(event);
  const value = moneyValue(snapshot, "total_cents") ?? moneyValue(snapshot, "amount_cents");
  return value ? money(value, locale) : undefined;
}

export function activityEntityLabel(entityType: string) {
  const labels: Record<string, string> = {
    absence_period: "Away dates",
    bill_document: "Bill document",
    expense: "Expense",
    household: "Group",
    household_member: "Member",
    landlord_payment: "Bill payment",
    recurring_rule: "Recurring expense",
    settlement: "Payment",
  };
  return labels[entityType] ?? entityType.replaceAll("_", " ");
}

export function activityChanges(
  event: ActivityEvent,
  members: ActivityMember[],
  locale: string,
): ActivityChange[] {
  const before = event.previous_values ?? {};
  const after = event.new_values ?? {};
  const changes: ActivityChange[] = [];

  function add(
    label: string,
    beforeValue: unknown,
    afterValue: unknown,
    format: (value: unknown) => string = readableStatus,
  ) {
    if (sameValue(beforeValue, afterValue)) return;
    if (beforeValue === undefined && afterValue === undefined) return;
    changes.push({
      label,
      before: beforeValue === undefined ? undefined : format(beforeValue),
      after: afterValue === undefined ? undefined : format(afterValue),
    });
  }

  if (event.entity_type === "expense") {
    add("Description", before.title, after.title);
    add("Amount", moneyValue(before, "total_cents"), moneyValue(after, "total_cents"), (value) =>
      money(value, locale),
    );
    add("Paid by", payer(before), payer(after), (value) => formatPayer(value, members));
    add("Date", before.expense_date, after.expense_date, (value) => dateOnly(value, locale));
    add("Split", before.split_method, after.split_method, splitMethod);
    add("Shared with", participants(before), participants(after), (value) =>
      formatParticipants(value, members),
    );
    add("Shares", shares(before), shares(after), (value) => formatShares(value, members, locale));
    add(
      "Fixed fees",
      moneyValue({ ...before, fixed: splitConfig(before).fixedCents }, "fixed"),
      moneyValue({ ...after, fixed: splitConfig(after).fixedCents }, "fixed"),
      (value) => money(value, locale),
    );
    add(
      "Usage costs",
      moneyValue({ ...before, usage: splitConfig(before).variableCents }, "usage"),
      moneyValue({ ...after, usage: splitConfig(after).variableCents }, "usage"),
      (value) => money(value, locale),
    );
    add("Notes", before.note, after.note);
    add("Status", before.voided_at ? "Voided" : "Active", after.voided_at ? "Voided" : "Active");
    add("Reason", before.void_reason, after.void_reason);
  } else if (event.entity_type === "settlement") {
    add("From", before.paying_member_id, after.paying_member_id, (value) =>
      memberName(value, members),
    );
    add("To", before.receiving_member_id, after.receiving_member_id, (value) =>
      memberName(value, members),
    );
    add("Amount", moneyValue(before, "amount_cents"), moneyValue(after, "amount_cents"), (value) =>
      money(value, locale),
    );
    add("Date", before.settlement_date, after.settlement_date, (value) => dateOnly(value, locale));
    add("Notes", before.note, after.note);
    add("Status", before.voided_at ? "Voided" : "Active", after.voided_at ? "Voided" : "Active");
    add("Reason", before.void_reason, after.void_reason);
  } else if (event.entity_type === "absence_period") {
    add("Member", before.member_id, after.member_id, (value) => memberName(value, members));
    add("Starts", before.start_date, after.start_date, (value) => dateOnly(value, locale));
    add("Ends", before.end_date, after.end_date, (value) => dateOnly(value, locale));
    add("Status", before.voided_at ? "Removed" : "Active", after.voided_at ? "Removed" : "Active");
  } else if (event.entity_type === "household_member") {
    add("Name", before.display_name, after.display_name);
    if (!sameValue(before.avatar_color, after.avatar_color))
      changes.push({ label: "Avatar", after: "Changed" });
    add("Role", before.role, after.role);
    add(
      "Status",
      before.removed_at ? "Removed" : "Active",
      after.removed_at ? "Removed" : "Active",
    );
  } else if (event.entity_type === "household") {
    add("Group name", before.name, after.name);
    add("Currency", before.default_currency, after.default_currency);
    add("Landlord mode", before.landlord_enabled, after.landlord_enabled);
    add("Joining", before.joining_enabled, after.joining_enabled);
    add("Group code", before.house_code, after.house_code);
  } else if (event.entity_type === "recurring_rule") {
    add("Description", before.title, after.title);
    add("Amount", moneyValue(before, "amount_cents"), moneyValue(after, "amount_cents"), (value) =>
      money(value, locale),
    );
    add("Paid by", before.payer_member_id, after.payer_member_id, (value) =>
      memberName(value, members),
    );
    add("Repeats", before.frequency, after.frequency);
    add("Starts", before.anchor_date, after.anchor_date, (value) => dateOnly(value, locale));
    add("Ends", before.end_date, after.end_date, (value) => dateOnly(value, locale));
    add("Status", before.active, after.active);
  } else if (event.entity_type === "landlord_payment") {
    add("Member", before.member_id, after.member_id, (value) => memberName(value, members));
    add("Amount", moneyValue(before, "amount_cents"), moneyValue(after, "amount_cents"), (value) =>
      money(value, locale),
    );
    add("Date", before.payment_date, after.payment_date, (value) => dateOnly(value, locale));
    add("Status", before.paid, after.paid);
  } else if (event.entity_type === "bill_document") {
    add("Status", before.status, after.status);
    add(
      "File type",
      before.detected_mime,
      after.detected_mime,
      (value) => text(value)?.replace("application/", "").toUpperCase() ?? "Not set",
    );
  }

  return changes.filter((change) => change.before !== change.after);
}
