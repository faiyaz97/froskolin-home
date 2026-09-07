import { describe, expect, it } from "vitest";

import { availableAvatarIds, avatarColors, avatarIds, avatars } from "@/lib/avatar";

describe("member avatars", () => {
  it("uses the supplied artwork background colours", () => {
    expect(avatarColors).toEqual({
      teal: "#ABF5CB",
      violet: "#D5BFFD",
      orange: "#FDB590",
      blue: "#94D3FD",
      rose: "#FD988F",
      indigo: "#FEF097",
    });
    expect(Object.values(avatars).every((avatar) => avatar.image.endsWith(".webp"))).toBe(true);
  });

  it("offers only unused avatars until all six are taken", () => {
    expect(availableAvatarIds(["orange", "rose", "blue", null])).toEqual([
      "teal",
      "violet",
      "indigo",
    ]);
    expect(availableAvatarIds(avatarIds)).toEqual(avatarIds);
  });
});
