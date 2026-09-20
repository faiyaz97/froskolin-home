import { z } from "zod";

/** Restrict outbound requests to known browser push services (SSRF boundary). */
export function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash)
      return false;
    return (
      url.hostname === "fcm.googleapis.com" ||
      url.hostname === "updates.push.services.mozilla.com" ||
      url.hostname.endsWith(".push.apple.com") ||
      url.hostname.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
export const pushEndpointSchema = z.string().max(2048).refine(isPushEndpoint);
export const pushSubscriptionSchema = z
  .object({
    endpoint: pushEndpointSchema,
    keys: z
      .object({
        p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/),
        auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
      })
      .strict(),
  })
  .strict();
