"use client";

import { Droplets, Flame, ReceiptText, Wifi, Zap } from "lucide-react";
import { useState } from "react";

import { MemberAvatar, type AvatarColor } from "../household/member-avatar";
import { cn } from "../ui/cn";
import { DateInput } from "../ui/date-input";
import { Dialog } from "../ui/dialog";
import { ChoiceRow, InlineValue, participantSummary } from "../expenses/expense-sharing-controls";

type Member = { id: string; name: string; avatarColor?: AvatarColor | null };
export type UtilityType = "electricity" | "gas" | "water" | "internet" | "other";

const utilityTypes = [
  { value: "electricity", label: "Electricity", icon: Zap, tone: "bg-[#fef3c7] text-[#d97706]" },
  { value: "gas", label: "Gas", icon: Flame, tone: "bg-[var(--peach-soft)] text-[var(--peach)]" },
  {
    value: "water",
    label: "Water",
    icon: Droplets,
    tone: "bg-[var(--sky-soft)] text-[var(--sky)]",
  },
  {
    value: "internet",
    label: "Internet",
    icon: Wifi,
    tone: "bg-[var(--violet-soft)] text-[var(--violet)]",
  },
  {
    value: "other",
    label: "Other utility",
    icon: ReceiptText,
    tone: "bg-[var(--brand-soft)] text-[var(--brand)]",
  },
] as const;

export function UtilityTypeIcon({ value, className }: { value: UtilityType; className?: string }) {
  const appearance = utilityTypes.find((item) => item.value === value) ?? utilityTypes.at(-1)!;
  const Icon = appearance.icon;
  return (
    <span
      data-utility-type={value}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl",
        appearance.tone,
        className,
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}

export function BillMetaControls({
  utilityType,
  onUtilityTypeChange,
  payer,
  onPayerChange,
  serviceStart,
  serviceEnd,
  onServicePeriodChange,
  servicePeriodError,
  selected,
  onSelectedChange,
  members,
  currentMemberId,
  landlordEnabled,
  locale,
  disabled,
}: {
  utilityType: UtilityType;
  onUtilityTypeChange: (value: UtilityType) => void;
  payer: string;
  onPayerChange: (value: string) => void;
  serviceStart: string;
  serviceEnd: string;
  onServicePeriodChange: (start: string, end: string) => void;
  servicePeriodError?: string;
  selected: Set<string>;
  onSelectedChange: (value: Set<string>) => void;
  members: Member[];
  currentMemberId: string;
  landlordEnabled: boolean;
  locale: string;
  disabled?: boolean;
}) {
  const [dialog, setDialog] = useState<"type" | "period" | "payer" | "participants" | null>(null);
  const [draftType, setDraftType] = useState(utilityType);
  const [draftPayer, setDraftPayer] = useState(payer);
  const [draftSelected, setDraftSelected] = useState(selected);
  const [draftStart, setDraftStart] = useState(serviceStart);
  const [draftEnd, setDraftEnd] = useState(serviceEnd);
  const typeLabel = utilityTypes.find((item) => item.value === utilityType)?.label ?? "Utility";
  const periodLabel =
    serviceStart && serviceEnd
      ? `${formatMonthYear(serviceStart, locale)} – ${formatMonthYear(serviceEnd, locale)}`
      : "Choose service period";
  const payerName =
    payer === currentMemberId
      ? "You"
      : payer === "landlord"
        ? "Landlord"
        : (members.find((member) => member.id === payer)?.name ?? "Someone");

  return (
    <>
      <div className="py-3 text-center text-sm leading-8 text-[var(--ink-soft)]">
        <span className="inline-block max-w-full">
          <InlineValue
            label="Utility type"
            disabled={disabled}
            onClick={() => {
              setDraftType(utilityType);
              setDialog("type");
            }}
          >
            {typeLabel}
          </InlineValue>{" "}
          bill between{" "}
          <InlineValue
            label="Service period"
            disabled={disabled}
            invalid={Boolean(servicePeriodError)}
            onClick={() => {
              setDraftStart(serviceStart);
              setDraftEnd(serviceEnd);
              setDialog("period");
            }}
          >
            {periodLabel}
          </InlineValue>
        </span>{" "}
        <span className="inline-block max-w-full">
          paid by{" "}
          <InlineValue
            label="Paid by"
            disabled={disabled}
            onClick={() => {
              setDraftPayer(payer);
              setDialog("payer");
            }}
          >
            {payerName}
          </InlineValue>
        </span>{" "}
        <span className="inline-flex max-w-full items-center gap-1 align-middle">
          split with{" "}
          <InlineValue
            label="Split with"
            disabled={disabled}
            onClick={() => {
              setDraftSelected(new Set(selected));
              setDialog("participants");
            }}
          >
            {participantSummary(members, selected)}
          </InlineValue>
        </span>
      </div>
      {dialog === "type" && (
        <Dialog
          title="Utility type"
          onClose={() => setDialog(null)}
          onDone={() => {
            onUtilityTypeChange(draftType);
            setDialog(null);
          }}
        >
          <div role="radiogroup" aria-label="Utility type" className="grid gap-1">
            {utilityTypes.map((item) => {
              return (
                <ChoiceRow
                  key={item.value}
                  selected={draftType === item.value}
                  onClick={() => setDraftType(item.value)}
                >
                  <span className="flex items-center gap-3">
                    <UtilityTypeIcon value={item.value} className="size-9 [&>svg]:size-4" />
                    <span className="font-semibold">{item.label}</span>
                  </span>
                </ChoiceRow>
              );
            })}
          </div>
        </Dialog>
      )}

      {dialog === "payer" && (
        <Dialog
          title="Paid by"
          onClose={() => setDialog(null)}
          onDone={() => {
            onPayerChange(draftPayer);
            setDialog(null);
          }}
        >
          <div role="radiogroup" aria-label="Paid by" className="grid gap-1">
            {[
              ...members,
              ...(landlordEnabled || payer === "landlord"
                ? [{ id: "landlord", name: "Landlord" }]
                : []),
            ].map((member) => (
              <ChoiceRow
                key={member.id}
                selected={draftPayer === member.id}
                onClick={() => setDraftPayer(member.id)}
              >
                <span className="flex items-center gap-3">
                  <MemberAvatar
                    name={member.name}
                    color={member.avatarColor}
                    className="size-9 border-0 shadow-none"
                  />
                  <span className="font-semibold">{member.name}</span>
                </span>
              </ChoiceRow>
            ))}
          </div>
        </Dialog>
      )}

      {dialog === "period" && (
        <Dialog
          title="Service period"
          onClose={() => setDialog(null)}
          doneDisabled={!draftStart || !draftEnd || draftEnd < draftStart}
          onDone={() => {
            onServicePeriodChange(draftStart, draftEnd);
            setDialog(null);
          }}
        >
          <div className="grid gap-3 px-1 py-2">
            <label className="grid gap-1.5 text-xs font-bold text-[var(--ink-soft)]">
              <span>Starts</span>
              <DateInput
                ariaLabel="Service start date"
                value={draftStart}
                onValueChange={(value) => {
                  setDraftStart(value);
                  if (draftEnd && draftEnd < value) setDraftEnd(value);
                }}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-[var(--ink-soft)]">
              <span>Ends</span>
              <DateInput
                ariaLabel="Service end date"
                value={draftEnd}
                onValueChange={setDraftEnd}
              />
            </label>
          </div>
        </Dialog>
      )}

      {dialog === "participants" && (
        <Dialog
          title="Split with"
          onClose={() => setDialog(null)}
          doneDisabled={!draftSelected.size}
          onDone={() => {
            onSelectedChange(draftSelected);
            setDialog(null);
          }}
        >
          <div role="group" aria-label="People" className="grid gap-1">
            {members.map((member) => (
              <ChoiceRow
                key={member.id}
                multiple
                selected={draftSelected.has(member.id)}
                onClick={() =>
                  setDraftSelected((current) => {
                    const next = new Set(current);
                    if (next.has(member.id)) next.delete(member.id);
                    else next.add(member.id);
                    return next;
                  })
                }
              >
                <span className="flex items-center gap-3">
                  <MemberAvatar
                    name={member.name}
                    color={member.avatarColor}
                    className="size-9 border-0 shadow-none"
                  />
                  <span className="font-semibold">{member.name}</span>
                </span>
              </ChoiceRow>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}

function formatMonthYear(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
