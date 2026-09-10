"use client";

import {
  Archive,
  Banknote,
  Building2,
  ChevronRight,
  KeyRound,
  Pause,
  Pencil,
  Play,
  RefreshCcw,
  UserMinus,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
import { cn } from "../ui/cn";
import { ConfirmationButton } from "../ui/confirmation-button";
import { Dialog } from "../ui/dialog";
import { Field, Input } from "../ui/field";
import { iconActionClass } from "../ui/icon-action";
import { StatusNote } from "../ui/page";
import { MemberAvatar, type AvatarColor } from "./member-avatar";

type Currency = "EUR" | "GBP" | "USD";

type Props = {
  householdId: string;
  home: {
    name: string;
    defaultCurrency: string;
    formatLocale: string;
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
    frequency: string;
    active: boolean;
  }>;
};

const currencies: Currency[] = ["EUR", "GBP", "USD"];

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
  const [name, setName] = useState(home.name);
  const [defaultCurrency, setDefaultCurrency] = useState(home.defaultCurrency as Currency);
  const [joiningEnabled, setJoiningEnabled] = useState(home.joiningEnabled);
  const [landlordEnabled, setLandlordEnabled] = useState(home.landlordEnabled);
  const [houseCode, setHouseCode] = useState(home.houseCode);
  const [joinPin, setJoinPin] = useState(home.joinPin ?? "");
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [currencyDialogOpen, setCurrencyDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftHouseCode, setDraftHouseCode] = useState(houseCode);
  const [draftJoinPin, setDraftJoinPin] = useState(joinPin);
  const [draftCurrency, setDraftCurrency] = useState(defaultCurrency);
  const [temporaryPin, setTemporaryPin] = useState("");
  const currentMemberName = members.find((member) => member.userId === currentUserId)?.name ?? "";
  const activeMembers = members.filter((member) => !member.removed);
  const messageIsSuccess = [
    "saved.",
    "generated.",
    "up to date.",
    "paused.",
    "resumed.",
    "archived.",
    "removed.",
    "changed.",
  ].some((ending) => message.endsWith(ending));

  function saveGroup(
    next: Partial<{
      name: string;
      defaultCurrency: Currency;
      joiningEnabled: boolean;
      landlordEnabled: boolean;
    }>,
    onSuccess?: () => void,
  ) {
    setMessage("");
    startTransition(async () => {
      const result = await updateHouseholdAction({
        householdId,
        name: next.name ?? name,
        defaultCurrency: next.defaultCurrency ?? defaultCurrency,
        joiningEnabled: next.joiningEnabled ?? joiningEnabled,
        landlordEnabled: next.landlordEnabled ?? landlordEnabled,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      if (next.name !== undefined) setName(next.name);
      if (next.defaultCurrency !== undefined) setDefaultCurrency(next.defaultCurrency);
      if (next.joiningEnabled !== undefined) setJoiningEnabled(next.joiningEnabled);
      if (next.landlordEnabled !== undefined) setLandlordEnabled(next.landlordEnabled);
      setMessage("Group settings saved.");
      onSuccess?.();
      router.refresh();
    });
  }

  function saveAccess() {
    setMessage("");
    startTransition(async () => {
      const result = await updateHouseholdAccessAction({
        householdId,
        houseCode: draftHouseCode,
        joinPin: draftJoinPin,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setHouseCode(result.data.houseCode);
      setJoinPin(result.data.joinPin);
      updateRememberedHouseCode(result.data.houseCode, currentMemberName);
      setAccessDialogOpen(false);
      setMessage("Group access saved.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="relative -mx-3 -mt-3 overflow-hidden rounded-b-[28px] bg-[linear-gradient(135deg,var(--pastel-sky),var(--pastel-mint))] px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-5 shadow-[var(--shadow-sm)] md:mx-0 md:mt-0 md:rounded-[28px] md:p-7">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-white/75 text-[var(--brand)] shadow-[var(--shadow-sm)] sm:size-20">
            <UsersRound className="size-8 sm:size-9" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-[0.14em] text-[var(--brand-strong)] uppercase">
              Your group
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                {name}
              </h1>
              {isOwner && (
                <button
                  type="button"
                  aria-label="Edit group name"
                  className={iconActionClass({ tone: "brand", className: "size-7" })}
                  disabled={pending}
                  onClick={() => {
                    setDraftName(name);
                    setMessage("");
                    setNameDialogOpen(true);
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-2 rounded-2xl bg-white/65 text-left">
          <span className="min-w-0 px-4 py-3.5">
            <span className="block text-[10px] font-black tracking-[0.12em] text-[var(--muted)] uppercase">
              Group code
            </span>
            <span className="mt-0.5 block cursor-text truncate text-sm font-black tracking-[0.06em] select-text">
              {houseCode}
            </span>
          </span>
          <span className="relative min-w-0 px-4 py-3.5 before:absolute before:inset-y-3 before:left-0 before:w-px before:bg-[var(--line)]">
            <span className="flex items-center justify-between gap-2">
              <span>
                <span className="block text-[10px] font-black tracking-[0.12em] text-[var(--muted)] uppercase">
                  Group PIN
                </span>
                <span className="mt-0.5 block cursor-text text-sm font-black tracking-[0.2em] select-text">
                  {isOwner ? joinPin || "Not set" : "••••••"}
                </span>
              </span>
              {isOwner && (
                <button
                  type="button"
                  aria-label="Edit group access"
                  disabled={pending}
                  onClick={() => {
                    setDraftHouseCode(houseCode);
                    setDraftJoinPin(joinPin);
                    setMessage("");
                    setAccessDialogOpen(true);
                  }}
                  className={iconActionClass({ tone: "brand", className: "size-10" })}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </span>
          </span>
        </div>
      </header>

      {message && <StatusNote tone={messageIsSuccess ? "success" : "error"} title={message} />}

      <section aria-labelledby="group-preferences-title">
        <h2
          id="group-preferences-title"
          className="mb-2 px-1 text-xs font-black tracking-[0.12em] text-[var(--muted)] uppercase"
        >
          Group preferences
        </h2>
        <div className="overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)]">
          <button
            type="button"
            className="group flex min-h-16 w-full items-center gap-3 px-4 text-left text-sm font-extrabold transition-colors hover:bg-[var(--row-hover)] focus-visible:bg-[var(--row-hover)] focus-visible:outline-none disabled:cursor-default disabled:opacity-70"
            disabled={!isOwner || pending}
            onClick={() => {
              setDraftCurrency(defaultCurrency);
              setMessage("");
              setCurrencyDialogOpen(true);
            }}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--pastel-mint)] text-[var(--brand)]">
              <Banknote className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">Default currency</span>
            <span className="text-[var(--muted)]">{defaultCurrency}</span>
            {isOwner && (
              <ChevronRight
                className="size-5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            )}
          </button>
          <div className="mx-4 h-px bg-[var(--soft-line)]" aria-hidden="true" />
          <button
            type="button"
            role="switch"
            aria-checked={joiningEnabled}
            className="group flex min-h-16 w-full items-center gap-3 px-4 text-left text-sm font-extrabold transition-colors hover:bg-[var(--row-hover)] focus-visible:bg-[var(--row-hover)] focus-visible:outline-none disabled:cursor-default disabled:opacity-70"
            disabled={!isOwner || pending}
            onClick={() => saveGroup({ joiningEnabled: !joiningEnabled })}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--sky-soft)] text-[var(--sky)]">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">Allow people to join</span>
            <Switch checked={joiningEnabled} />
          </button>
          <div className="mx-4 h-px bg-[var(--soft-line)]" aria-hidden="true" />
          <button
            type="button"
            role="switch"
            aria-checked={landlordEnabled}
            className="group flex min-h-16 w-full items-center gap-3 px-4 text-left text-sm font-extrabold transition-colors hover:bg-[var(--row-hover)] focus-visible:bg-[var(--row-hover)] focus-visible:outline-none disabled:cursor-default disabled:opacity-70"
            disabled={!isOwner || pending}
            onClick={() => saveGroup({ landlordEnabled: !landlordEnabled })}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--pastel-peach)] text-[var(--peach)]">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">Landlord mode</span>
            <Switch checked={landlordEnabled} />
          </button>
        </div>
      </section>

      <section aria-labelledby="group-members-title">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2
            id="group-members-title"
            className="text-xs font-black tracking-[0.12em] text-[var(--muted)] uppercase"
          >
            Members
          </h2>
          <span className="text-xs font-bold text-[var(--muted)]">
            {activeMembers.length} active
          </span>
        </div>
        <div className="overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)]">
          {members.map((member, index) => (
            <div key={member.id}>
              {index > 0 && <div className="mx-4 h-px bg-[var(--soft-line)]" aria-hidden="true" />}
              <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
                <MemberAvatar name={member.name} color={member.avatarColor} />
                <p className="min-w-0 flex-1 text-sm">
                  <strong className="block truncate">{member.name}</strong>
                  <span className="text-xs text-[var(--muted)] capitalize">
                    {member.removed ? "Removed" : member.role}
                    {member.userId === currentUserId ? " · you" : ""}
                  </span>
                </p>
                {isOwner && !member.removed && member.userId !== currentUserId && (
                  <div className="flex items-center gap-1">
                    <ConfirmationButton
                      triggerLabel={`Reset PIN for ${member.name}`}
                      title={`Reset ${member.name}'s PIN?`}
                      description="Their current PIN will stop working and a new temporary PIN will be generated."
                      confirmLabel="Reset PIN"
                      pendingLabel="Resetting…"
                      disabled={pending}
                      triggerClassName={iconActionClass({
                        tone: "brand",
                        className: "size-10",
                      })}
                      onConfirmAction={async () => {
                        const result = await resetMemberPinAction(householdId, member.id);
                        if (result.ok) {
                          setTemporaryPin(`${member.name}: ${result.data.temporaryPin}`);
                          setMessage(result.message ?? "");
                        } else setMessage(result.error);
                      }}
                    >
                      <KeyRound className="size-4" aria-hidden="true" />
                    </ConfirmationButton>
                    <ConfirmationButton
                      triggerLabel={`Remove ${member.name}`}
                      title={`Remove ${member.name}?`}
                      description="They will lose access to this group. Their existing transactions will remain."
                      confirmLabel="Remove"
                      pendingLabel="Removing…"
                      disabled={pending}
                      triggerClassName={iconActionClass({
                        tone: "negative",
                        className: "size-10",
                      })}
                      onConfirmAction={async () => {
                        const result = await removeMemberAction({
                          householdId,
                          memberId: member.id,
                        });
                        setMessage(result.ok ? `${member.name} was removed.` : result.error);
                        if (result.ok) router.refresh();
                      }}
                    >
                      <UserMinus className="size-4" aria-hidden="true" />
                    </ConfirmationButton>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {temporaryPin && (
          <div className="mt-3 rounded-2xl bg-[var(--pastel-peach)] px-4 py-3 text-sm font-bold text-[var(--ink)]">
            Temporary PIN · <code className="font-black tracking-wider">{temporaryPin}</code>
          </div>
        )}
      </section>

      <section aria-labelledby="recurring-title">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <h2
            id="recurring-title"
            className="text-xs font-black tracking-[0.12em] text-[var(--muted)] uppercase"
          >
            Recurring expenses
          </h2>
          <Button
            type="button"
            tone="quiet"
            className="min-h-9 px-2.5 py-1.5"
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
            <RefreshCcw className="size-4" aria-hidden="true" /> Run now
          </Button>
        </div>
        <div className="overflow-hidden rounded-[22px] bg-white/85 shadow-[var(--shadow-sm)]">
          {!rules.length && (
            <p className="px-4 py-5 text-sm font-semibold text-[var(--muted)]">
              No recurring expenses
            </p>
          )}
          {rules.map((rule, index) => (
            <div key={rule.id}>
              {index > 0 && <div className="mx-4 h-px bg-[var(--soft-line)]" aria-hidden="true" />}
              <div className="flex flex-wrap items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--violet-soft)] text-[var(--violet)]">
                  <RefreshCcw className="size-5" aria-hidden="true" />
                </span>
                <p className="min-w-40 flex-1 text-sm">
                  <strong className="block truncate">
                    {rule.title} · {formatMoney(rule.amountCents, rule.currency, home.formatLocale)}
                  </strong>
                  <span className="text-xs text-[var(--muted)] capitalize">
                    {rule.frequency} · {rule.active ? rule.nextDueDate : "Paused"}
                  </span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={iconActionClass({ tone: "brand", className: "size-10" })}
                    aria-label={rule.active ? `Pause ${rule.title}` : `Resume ${rule.title}`}
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
                    {rule.active ? (
                      <Pause className="size-4" aria-hidden="true" />
                    ) : (
                      <Play className="size-4" aria-hidden="true" />
                    )}
                  </button>
                  <ButtonLink
                    href={`/h/${householdId}/settings/recurring/${rule.id}/edit`}
                    tone="quiet"
                    className="min-h-10 px-3 py-2"
                  >
                    <Pencil className="size-4" aria-hidden="true" /> Edit
                  </ButtonLink>
                  <ConfirmationButton
                    triggerLabel={`Archive ${rule.title}`}
                    title={`Archive ${rule.title}?`}
                    description="Future occurrences will stop. Existing expenses will remain."
                    confirmLabel="Archive"
                    pendingLabel="Archiving…"
                    disabled={pending}
                    triggerClassName={iconActionClass({
                      tone: "negative",
                      className: "size-10",
                    })}
                    onConfirmAction={async () => {
                      const result = await archiveRecurringExpenseRuleAction({
                        householdId,
                        ruleId: rule.id,
                      });
                      setMessage(result.ok ? `${rule.title} archived.` : result.error);
                      if (result.ok) router.refresh();
                    }}
                  >
                    <Archive className="size-4" aria-hidden="true" />
                  </ConfirmationButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {nameDialogOpen && (
        <Dialog
          title="Group name"
          onClose={() => !pending && setNameDialogOpen(false)}
          onDone={() => saveGroup({ name: draftName.trim() }, () => setNameDialogOpen(false))}
          doneDisabled={pending || !draftName.trim() || draftName.trim() === name}
        >
          <div className="grid gap-4 px-2 pt-2 pb-3">
            {message && !message.endsWith("saved.") && <StatusNote tone="error" title={message} />}
            <Field label="Group name">
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                maxLength={80}
                autoFocus
                disabled={pending}
              />
            </Field>
          </div>
        </Dialog>
      )}

      {accessDialogOpen && (
        <Dialog
          title="Group access"
          onClose={() => !pending && setAccessDialogOpen(false)}
          onDone={saveAccess}
          doneDisabled={
            pending ||
            !/^[A-Z0-9](?:[A-Z0-9-]{4,22})[A-Z0-9]$/.test(draftHouseCode.trim().toUpperCase()) ||
            !/^\d{6}$/.test(draftJoinPin) ||
            (draftHouseCode.trim().toUpperCase() === houseCode && draftJoinPin === joinPin)
          }
        >
          <div className="grid gap-4 px-2 pt-2 pb-3">
            {message && !message.endsWith("saved.") && <StatusNote tone="error" title={message} />}
            <Field label="Group code">
              <Input
                value={draftHouseCode}
                onChange={(event) => setDraftHouseCode(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoComplete="off"
                minLength={6}
                maxLength={24}
                disabled={pending}
              />
            </Field>
            <Field label="Group PIN">
              <Input
                value={draftJoinPin}
                onChange={(event) =>
                  setDraftJoinPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                disabled={pending}
              />
            </Field>
          </div>
        </Dialog>
      )}

      {currencyDialogOpen && (
        <Dialog
          title="Default currency"
          onClose={() => !pending && setCurrencyDialogOpen(false)}
          onDone={() =>
            saveGroup({ defaultCurrency: draftCurrency }, () => setCurrencyDialogOpen(false))
          }
          doneDisabled={pending || draftCurrency === defaultCurrency}
        >
          <div className="grid grid-cols-3 gap-2 px-2 pt-2 pb-3">
            {currencies.map((currency) => {
              const selected = currency === draftCurrency;
              return (
                <button
                  key={currency}
                  type="button"
                  className={cn(
                    "min-h-16 rounded-2xl text-sm font-black transition focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:outline-none",
                    selected
                      ? "bg-[var(--pastel-mint)] text-[var(--brand-strong)]"
                      : "bg-[var(--canvas)] text-[var(--ink-soft)] hover:bg-[var(--brand-soft)]",
                  )}
                  aria-pressed={selected}
                  onClick={() => setDraftCurrency(currency)}
                >
                  {currency}
                </button>
              );
            })}
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-[var(--brand)]" : "bg-[#cbd5e1]",
      )}
      aria-hidden="true"
    >
      <span
        className={cn(
          "absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </span>
  );
}
