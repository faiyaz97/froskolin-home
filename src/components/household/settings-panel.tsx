"use client";

import {
  Archive,
  KeyRound,
  LogOut,
  Pause,
  Pencil,
  Play,
  RefreshCcw,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  archiveRecurringExpenseRuleAction,
  changeHouseCodeAction,
  changeHouseJoinPinAction,
  generateDueRecurringExpensesAction,
  removeMemberAction,
  resetMemberPinAction,
  setRecurringExpenseRuleActiveAction,
  signOutAction,
  updateHouseholdAction,
} from "@/lib/actions";
import { forgetRememberedDevice, updateRememberedHouseCode } from "@/lib/device-memory";
import { formatMoney } from "@/lib/format";
import { Button, ButtonLink } from "../ui/button";
import { Field, Input } from "../ui/field";
import { SectionTitle, StatusNote } from "../ui/page";
import { SelectInput } from "../ui/select-input";
import { MemberAvatar } from "./member-avatar";

type Props = {
  householdId: string;
  home: {
    name: string;
    defaultCurrency: string;
    locale: string;
    timezone: string;
    houseCode: string;
    joiningEnabled: boolean;
  };
  currentUserId: string;
  isOwner: boolean;
  members: Array<{
    id: string;
    userId: string;
    name: string;
    role: "owner" | "member";
    removed: boolean;
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
  const [temporaryPin, setTemporaryPin] = useState("");
  const currentMemberName = members.find((member) => member.userId === currentUserId)?.name ?? "";

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
      });
      setMessage(result.ok ? "Household settings saved." : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_19rem]">
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
                <MemberAvatar name={member.name} />
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
      <aside>
        {isOwner && (
          <section className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <p className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-[var(--peach)] uppercase">
              <ShieldCheck className="size-4" /> Household access
            </p>
            <div className="mt-5">
              <p className="text-sm font-extrabold">House Code</p>
              <div className="mt-2 rounded-xl bg-[var(--canvas)] p-3 text-center">
                <code className="font-extrabold tracking-[0.08em]">{houseCode}</code>
              </div>
            </div>
            <Button
              type="button"
              tone="secondary"
              className="mt-3 w-full"
              disabled={pending}
              onClick={() => {
                if (
                  !window.confirm(
                    "Change the House Code? Roommates will need the new code when signing in on a new device.",
                  )
                )
                  return;
                startTransition(async () => {
                  const result = await changeHouseCodeAction({ householdId });
                  if (result.ok) {
                    setHouseCode(result.data.houseCode);
                    updateRememberedHouseCode(result.data.houseCode, currentMemberName);
                    setMessage("House Code changed.");
                    router.refresh();
                  } else setMessage(result.error);
                });
              }}
            >
              <RefreshCcw className="size-4" /> Change House Code
            </Button>

            <form
              className="mt-6 border-t border-[var(--soft-line)] pt-5"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const data = new FormData(form);
                const joinPin = String(data.get("joinPin") ?? "");
                const confirmation = String(data.get("joinPinConfirmation") ?? "");
                if (joinPin !== confirmation) {
                  setMessage("The Join PINs do not match.");
                  return;
                }
                startTransition(async () => {
                  const result = await changeHouseJoinPinAction({ householdId, joinPin });
                  setMessage(result.ok ? "House Join PIN changed." : result.error);
                  if (result.ok) form.reset();
                });
              }}
            >
              <p className="text-sm font-extrabold">House Join PIN</p>
              <div className="mt-3 grid gap-3">
                <Field label="New 6-digit Join PIN">
                  <Input
                    name="joinPin"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    disabled={pending}
                  />
                </Field>
                <Field label="Confirm Join PIN">
                  <Input
                    name="joinPinConfirmation"
                    inputMode="numeric"
                    autoComplete="new-password"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    disabled={pending}
                  />
                </Field>
              </div>
              <Button type="submit" tone="secondary" className="mt-3 w-full" disabled={pending}>
                <KeyRound className="size-4" /> Change Join PIN
              </Button>
            </form>
          </section>
        )}
        <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
          <h2 className="font-extrabold">Your PIN</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Change it if somebody may know it.
          </p>
          <ButtonLink href="/change-pin" tone="secondary" className="mt-3 w-full">
            <KeyRound className="size-4" /> Change PIN
          </ButtonLink>
          <Button
            type="button"
            tone="quiet"
            className="mt-2 w-full"
            onClick={() =>
              startTransition(async () => {
                await signOutAction();
              })
            }
          >
            <LogOut className="size-4" /> Sign out
          </Button>
          <Button
            type="button"
            tone="danger"
            className="mt-2 w-full"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Forget this household and member on this device?")) return;
              startTransition(async () => {
                forgetRememberedDevice();
                await signOutAction("/");
              });
            }}
          >
            Forget this device
          </Button>
        </section>
      </aside>
    </div>
  );
}
