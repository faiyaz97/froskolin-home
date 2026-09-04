"use client";

import {
  Archive,
  KeyRound,
  Pause,
  Pencil,
  Play,
  RefreshCcw,
  Save,
  ShieldCheck,
  X,
  UserMinus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  archiveRecurringExpenseRuleAction,
  generateDueRecurringExpensesAction,
  removeMemberAction,
  resetMemberPinAction,
  setRecurringExpenseRuleActiveAction,
  updateHouseholdAccessAction,
  updateHouseholdAction,
} from "@/lib/actions";
import { updateRememberedHouseCode } from "@/lib/device-memory";
import { formatMoney } from "@/lib/format";
import { Button, ButtonLink } from "../ui/button";
import { Field, Input } from "../ui/field";
import { SectionTitle, StatusNote } from "../ui/page";
import { SelectInput } from "../ui/select-input";
import { MemberAvatar, type AvatarColor } from "./member-avatar";

type Props = {
  householdId: string;
  home: {
    name: string;
    defaultCurrency: string;
    locale: string;
    timezone: string;
    houseCode: string;
    joinPin: string | null;
    joiningEnabled: boolean;
    landlordEnabled: boolean;
  };
  currentUserId: string;
  isOwner: boolean;
  members: Array<{
    id: string;
    userId: string;
    name: string;
    role: "owner" | "member";
    removed: boolean;
    avatarColor: AvatarColor | null;
  }>;
  rules: Array<{
    id: string;
    title: string;
    amountCents: number;
    currency: string;
    nextDueDate: string;
    active: boolean;
  }>;
};

export function SettingsPanel({
  householdId,
  home,
  currentUserId,
  isOwner,
  members,
  rules,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [houseCode, setHouseCode] = useState(home.houseCode);
  const [joinPin, setJoinPin] = useState(home.joinPin ?? "");
  const [editingAccess, setEditingAccess] = useState(false);
  const [temporaryPin, setTemporaryPin] = useState("");
  const currentMemberName = members.find((member) => member.userId === currentUserId)?.name ?? "";

  function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateHouseholdAccessAction({
        householdId,
        houseCode: String(data.get("houseCode") ?? ""),
        joinPin: String(data.get("joinPin") ?? ""),
      });
      if (result.ok) {
        setHouseCode(result.data.houseCode);
        setJoinPin(result.data.joinPin);
        setEditingAccess(false);
        updateRememberedHouseCode(result.data.houseCode, currentMemberName);
        setMessage("Household access saved.");
        router.refresh();
      } else {
        setMessage(result.error);
      }
    });
  }

  function saveHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateHouseholdAction({
        householdId,
        name: String(data.get("name") ?? ""),
        defaultCurrency: String(data.get("defaultCurrency") ?? "EUR"),
        locale: String(data.get("locale") ?? "en-GB"),
        timezone: String(data.get("timezone") ?? "UTC"),
        joiningEnabled: data.get("joiningEnabled") === "on",
        landlordEnabled: data.get("landlordEnabled") === "on",
      });
      setMessage(result.ok ? "Household settings saved." : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className={isOwner ? "grid gap-10 lg:grid-cols-[1fr_19rem]" : undefined}>
      <div className="space-y-10">
        {message && (
          <StatusNote
            tone={
              message.endsWith("saved.") ||
              message.endsWith("changed.") ||
              message.endsWith("generated.") ||
              message.endsWith("up to date.")
                ? "success"
                : "error"
            }
            title={message}
          >
            The audit trail records owner changes.
          </StatusNote>
        )}
        <section>
          <SectionTitle>Home details</SectionTitle>
          <form
            className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5"
            onSubmit={saveHome}
          >
            <Field label="Household name">
              <Input name="name" defaultValue={home.name} disabled={!isOwner || pending} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default currency">
                <SelectInput
                  name="defaultCurrency"
                  defaultValue={home.defaultCurrency}
                  ariaLabel="Default currency"
                  disabled={!isOwner || pending}
                  options={[
                    { value: "EUR", label: "EUR" },
                    { value: "GBP", label: "GBP" },
                    { value: "USD", label: "USD" },
                  ]}
                />
              </Field>
              <Field label="Timezone">
                <Input
                  name="timezone"
                  defaultValue={home.timezone}
                  disabled={!isOwner || pending}
                />
              </Field>
            </div>
            <Field label="Locale">
              <Input name="locale" defaultValue={home.locale} disabled={!isOwner || pending} />
            </Field>
            <label className="flex items-center gap-3 text-sm font-bold">
              <input
                name="joiningEnabled"
                type="checkbox"
                defaultChecked={home.joiningEnabled}
                disabled={!isOwner || pending}
                className="size-4 accent-[var(--brand)]"
              />{" "}
              Allow new roommates to join
            </label>
            <label className="flex items-center gap-3 text-sm font-bold">
              <input
                name="landlordEnabled"
                type="checkbox"
                defaultChecked={home.landlordEnabled}
                disabled={!isOwner || pending}
                className="size-4 accent-[var(--brand)]"
              />
              Enable landlord
            </label>
            {isOwner && (
              <Button type="submit" className="justify-self-end" disabled={pending}>
                Save details
              </Button>
            )}
          </form>
        </section>
        <section>
          <SectionTitle aside={`${members.filter((member) => !member.removed).length} active`}>
            Roommates
          </SectionTitle>
          <div className="overflow-hidden border-y border-[var(--line)] bg-white sm:rounded-2xl sm:border">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 border-b border-[var(--soft-line)] px-4 py-4 last:border-0"
              >
                <MemberAvatar name={member.name} color={member.avatarColor} />
                <p className="flex-1 text-sm">
                  <strong>{member.name}</strong>
                  <span className="block text-[var(--muted)] capitalize">
                    {member.removed ? "Removed" : member.role}
                    {member.userId === currentUserId ? " · you" : ""}
                  </span>
                </p>
                {isOwner && !member.removed && member.userId !== currentUserId && (
                  <>
                    <Button
                      type="button"
                      tone="quiet"
                      className="px-3"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await resetMemberPinAction(householdId, member.id);
                          if (result.ok) {
                            setTemporaryPin(`${member.name}: ${result.data.temporaryPin}`);
                            if (result.message) setMessage(result.message);
                          } else setMessage(result.error);
                        })
                      }
                    >
                      <KeyRound className="size-4" /> Reset PIN
                    </Button>
                    <Button
                      type="button"
                      tone="quiet"
                      className="px-3 text-[var(--negative)]"
                      aria-label={`Remove ${member.name}`}
                      disabled={pending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${member.name}? Their balances must be zero in every currency.`,
                          )
                        )
                          return;
                        startTransition(async () => {
                          const result = await removeMemberAction({
                            householdId,
                            memberId: member.id,
                          });
                          setMessage(result.ok ? `${member.name} was removed.` : result.error);
                          if (result.ok) router.refresh();
                        });
                      }}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
          {temporaryPin && (
            <StatusNote tone="warning" title="Temporary PIN — show it once">
              <code className="font-extrabold tracking-wider">{temporaryPin}</code>. The roommate
              must replace it after signing in.
            </StatusNote>
          )}
          <StatusNote title="Removing a roommate is intentionally careful">
            They must have a zero balance in every currency and be removed from active recurring
            rules first. Their historical records remain.
          </StatusNote>
        </section>
        <section>
          <SectionTitle
            aside={
              <Button
                type="button"
                tone="quiet"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await generateDueRecurringExpensesAction(householdId);
                    setMessage(
                      result.ok
                        ? result.data === 0
                          ? "Recurring expenses are up to date."
                          : `${result.data} due recurring expense${result.data === 1 ? "" : "s"} generated.`
                        : result.error,
                    );
                    if (result.ok) router.refresh();
                  })
                }
              >
                <RefreshCcw className="size-4" /> Generate due
              </Button>
            }
          >
            Recurring expenses
          </SectionTitle>
          <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)]">
            {!rules.length && (
              <p className="p-5 text-sm text-[var(--muted)]">No recurring rules yet.</p>
            )}
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center gap-3 border-b border-[var(--soft-line)] p-4 last:border-0"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--brand-soft)]">
                  <RefreshCcw className="size-5 text-[var(--brand)]" />
                </span>
                <p className="min-w-48 flex-1 text-sm">
                  <strong>
                    {rule.title} · {formatMoney(rule.amountCents, rule.currency, home.locale)}
                  </strong>
                  <span className="block text-[var(--muted)]">
                    {rule.active ? `Next ${rule.nextDueDate}` : "Paused"}
                  </span>
                </p>
                <Button
                  type="button"
                  tone="quiet"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await setRecurringExpenseRuleActiveAction({
                        householdId,
                        ruleId: rule.id,
                        active: !rule.active,
                      });
                      setMessage(
                        result.ok
                          ? `${rule.title} ${rule.active ? "paused" : "resumed"}.`
                          : result.error,
                      );
                      if (result.ok) router.refresh();
                    })
                  }
                >
                  {rule.active ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {rule.active ? "Pause" : "Resume"}
                </Button>
                <ButtonLink
                  href={`/h/${householdId}/settings/recurring/${rule.id}/edit`}
                  tone="quiet"
                >
                  <Pencil className="size-4" /> Edit
                </ButtonLink>
                <Button
                  type="button"
                  tone="quiet"
                  className="text-[var(--negative)]"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Archive ${rule.title}? Generated expenses remain.`))
                      return;
                    startTransition(async () => {
                      const result = await archiveRecurringExpenseRuleAction({
                        householdId,
                        ruleId: rule.id,
                      });
                      setMessage(result.ok ? `${rule.title} archived.` : result.error);
                      if (result.ok) router.refresh();
                    });
                  }}
                >
                  <Archive className="size-4" /> Archive
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
      {isOwner && (
        <aside>
          <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-[var(--peach)] uppercase">
                <ShieldCheck className="size-4" /> Household access
              </p>
              {!editingAccess && (
                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-full text-[var(--ink-soft)] transition hover:bg-[var(--soft-line)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  aria-label="Edit household access"
                  onClick={() => setEditingAccess(true)}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {editingAccess ? (
              <form className="mt-5 grid gap-4" onSubmit={saveAccess}>
                <Field label="House Code">
                  <Input
                    name="houseCode"
                    defaultValue={houseCode}
                    autoCapitalize="characters"
                    autoComplete="off"
                    minLength={6}
                    maxLength={24}
                    required
                    disabled={pending}
                  />
                </Field>
                <Field label="House Join PIN">
                  <Input
                    name="joinPin"
                    defaultValue={joinPin}
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    disabled={pending}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    tone="quiet"
                    disabled={pending}
                    onClick={() => setEditingAccess(false)}
                  >
                    <X className="size-4" /> Cancel
                  </Button>
                  <Button type="submit" tone="secondary" disabled={pending}>
                    <Save className="size-4" /> Save
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="mt-5 grid gap-4">
                <div>
                  <dt className="text-xs font-bold text-[var(--muted)]">House Code</dt>
                  <dd className="mt-1 font-extrabold tracking-[0.06em]">{houseCode}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold text-[var(--muted)]">House Join PIN</dt>
                  <dd className="mt-1 font-extrabold tracking-[0.2em]">
                    {joinPin || "Not available — set a new PIN"}
                  </dd>
                </div>
              </dl>
            )}
          </section>
        </aside>
      )}
    </div>
  );
}
