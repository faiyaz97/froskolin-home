import { z } from "zod";

import { houseCodeSchema, joinPinSchema } from "./validation/household";

const groupInvitationSchema = z.object({
  code: houseCodeSchema,
  pin: joinPinSchema,
});

export type GroupInvitation = z.infer<typeof groupInvitationSchema>;

/** Build a shareable join URL without including a member's personal PIN. */
export function createGroupInvitationUrl({
  origin,
  houseCode,
  joinPin,
}: {
  origin: string;
  houseCode: string;
  joinPin: string;
}): string {
  const invitation = groupInvitationSchema.parse({ code: houseCode, pin: joinPin });
  const url = new URL("/join", origin);
  url.hash = new URLSearchParams({ code: invitation.code, pin: invitation.pin }).toString();
  return url.toString();
}

/** Read and validate invitation values from a URL fragment. */
export function parseGroupInvitationHash(hash: string): GroupInvitation | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const parsed = groupInvitationSchema.safeParse({
    code: params.get("code") ?? "",
    pin: params.get("pin") ?? "",
  });
  return parsed.success ? parsed.data : null;
}
