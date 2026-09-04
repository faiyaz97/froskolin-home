import { cn } from "../ui/cn";

export const avatarColors = {
  teal: "#0f766e",
  violet: "#7c3aed",
  orange: "#ea580c",
  blue: "#0369a1",
  rose: "#be123c",
  indigo: "#4f46e5",
} as const;

export type AvatarColor = keyof typeof avatarColors;

const avatarColorValues = Object.values(avatarColors);

export function resolveAvatarColor(name: string, color?: AvatarColor | null) {
  if (color) return avatarColors[color];
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return avatarColorValues[hash % avatarColorValues.length];
}

export function MemberAvatar({
  name,
  color,
  className,
}: {
  name: string;
  color?: AvatarColor | null;
  className?: string;
}) {
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
      style={{ background: resolveAvatarColor(name, color) }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}
