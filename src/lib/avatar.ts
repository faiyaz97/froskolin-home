export const avatarIds = ["teal", "violet", "orange", "blue", "rose", "indigo"] as const;

export type AvatarColor = (typeof avatarIds)[number];

export const avatars: Record<AvatarColor, { name: string; background: string; image: string }> = {
  orange: {
    name: "Calico",
    background: "#FDB590",
    image: "/assets/avatars/calico.webp",
  },
  rose: {
    name: "Mint patch",
    background: "#FD988F",
    image: "/assets/avatars/mint-patch.webp",
  },
  blue: {
    name: "Ginger",
    background: "#94D3FD",
    image: "/assets/avatars/ginger.webp",
  },
  indigo: {
    name: "Grey",
    background: "#FEF097",
    image: "/assets/avatars/grey.webp",
  },
  teal: {
    name: "Midnight",
    background: "#ABF5CB",
    image: "/assets/avatars/midnight.webp",
  },
  violet: {
    name: "Siamese",
    background: "#D5BFFD",
    image: "/assets/avatars/siamese.webp",
  },
};

export const avatarColors = Object.fromEntries(
  avatarIds.map((id) => [id, avatars[id].background]),
) as Record<AvatarColor, string>;

export function resolveAvatarId(name: string, avatar?: AvatarColor | null): AvatarColor {
  if (avatar && avatarIds.includes(avatar)) return avatar;
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return avatarIds[hash % avatarIds.length];
}

export function availableAvatarIds(selected: Iterable<string | null>): AvatarColor[] {
  const used = new Set(selected);
  const available = avatarIds.filter((id) => !used.has(id));
  return available.length ? available : [...avatarIds];
}
