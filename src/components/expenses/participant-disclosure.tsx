"use client";

import { Check, ChevronRight, Users } from "lucide-react";
import { useState } from "react";

import { cn } from "../ui/cn";

type Participant = { id: string; name: string };

export function ParticipantDisclosure({
  members,
  selected,
  onSelectedChange,
  disabled,
}: {
  members: Participant[];
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedNames = members
    .filter((member) => selected.has(member.id))
    .map((member) => member.name);
  const summary =
    selected.size === members.length
      ? "Everyone"
      : selectedNames.length
        ? selectedNames.join(", ")
        : "Nobody";

  function toggleMember(memberId: string) {
    const next = new Set(selected);
    if (next.has(memberId)) next.delete(memberId);
    else next.add(memberId);
    onSelectedChange(next);
  }

  return (
    <div className="border-y border-[var(--soft-line)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-2 py-2 text-left disabled:opacity-50"
      >
        <Users className="size-4 shrink-0 text-[var(--violet)]" aria-hidden="true" />
        <span className="shrink-0 text-xs font-bold text-[var(--muted)]">Split with</span>
        <strong className="min-w-0 truncate text-sm text-[var(--brand-strong)]">{summary}</strong>
        <ChevronRight
          className={cn(
            "size-4 shrink-0 text-[var(--muted)] transition-transform",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-1.5 pb-3" aria-label="People to split with">
          {members.map((member) => {
            const checked = selected.has(member.id);
            return (
              <button
                key={member.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => toggleMember(member.id)}
                className={cn(
                  "flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 text-left text-sm transition-colors disabled:opacity-50",
                  checked
                    ? "bg-[var(--pastel-mint)] text-[var(--brand-strong)]"
                    : "bg-[var(--soft-line)] text-[var(--muted)]",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{member.name}</span>
                <span
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-md border",
                    checked
                      ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                      : "border-[var(--control-line)] text-transparent",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
