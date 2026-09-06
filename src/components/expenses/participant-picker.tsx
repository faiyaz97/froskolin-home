"use client";

import { Check, Users } from "lucide-react";

import { MemberAvatar } from "../household/member-avatar";
import { cn } from "../ui/cn";
import { formSectionClass } from "../ui/field";

type Participant = { id: string; name: string };

export function ParticipantPicker({
  members,
  selected,
  onSelectedChange,
  disabled,
  className,
}: {
  members: Participant[];
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cn(formSectionClass, className)} disabled={disabled}>
      <legend className="screen-reader-only">Split with</legend>
      <div className="mb-2.5 flex items-center gap-2">
        <Users className="size-4 text-[var(--violet)]" aria-hidden="true" />
        <h2 className="text-sm font-black">Split with</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {members.map((member) => {
          const checked = selected.has(member.id);
          return (
            <label
              key={member.id}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-2.5 transition-[border-color,background-color,box-shadow] focus-within:ring-2 focus-within:ring-[var(--control-ring)]",
                checked
                  ? "border-[var(--pastel-mint-line)] bg-[var(--pastel-mint)]"
                  : "border-[var(--control-line)] bg-white hover:border-[var(--control-line-hover)]",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                className="screen-reader-only"
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(member.id);
                  else next.delete(member.id);
                  onSelectedChange(next);
                }}
              />
              <MemberAvatar
                name={member.name}
                className="size-7 border-0 text-[10px] shadow-none"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{member.name}</span>
              <span
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-md border",
                  checked
                    ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                    : "border-[#cbd5e1] text-transparent",
                )}
                aria-hidden="true"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
