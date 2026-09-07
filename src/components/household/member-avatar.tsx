import Image from "next/image";

import { avatarColors, avatars, resolveAvatarId, type AvatarColor } from "@/lib/avatar";
import { cn } from "../ui/cn";

export { avatarColors, avatars, type AvatarColor } from "@/lib/avatar";

export function resolveAvatarColor(name: string, color?: AvatarColor | null) {
  return avatarColors[resolveAvatarId(name, color)];
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
  const avatarId = resolveAvatarId(name, color);
  const avatar = avatars[avatarId];

  return (
    <span
      data-avatar={avatarId}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white shadow-sm",
        className,
      )}
      style={{ background: avatar.background }}
      aria-hidden="true"
    >
      <Image src={avatar.image} alt="" fill sizes="96px" className="object-cover" />
    </span>
  );
}
