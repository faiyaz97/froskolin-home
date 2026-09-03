import { cn } from "../ui/cn";

const avatarColors = ["#0f766e", "#7c3aed", "#ea580c", "#0369a1", "#be123c", "#4f46e5"];

function avatarColor(name: string) {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return avatarColors[hash % avatarColors.length];
}

export function MemberAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border-2 border-white text-xs font-black text-white shadow-sm",
        className,
      )}
      style={{ background: avatarColor(name) }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}
