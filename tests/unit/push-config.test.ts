import { afterEach, expect, it, vi } from "vitest";
import { getPushConfig } from "@/lib/push/config";
afterEach(() => vi.unstubAllEnvs());
it.each(["mailto:contact@example.com", "https://example.com/contact"])(
  "accepts a valid contact %s",
  (subject) => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "A".repeat(87));
    vi.stubEnv("VAPID_PRIVATE_KEY", "B".repeat(43));
    vi.stubEnv("VAPID_SUBJECT", subject);
    expect(getPushConfig()?.subject).toBe(subject);
  },
);
it.each(["http://example.com", "mailto:", "invalid"])("rejects invalid contact %s", (subject) => {
  vi.stubEnv("VAPID_PUBLIC_KEY", "A".repeat(87));
  vi.stubEnv("VAPID_PRIVATE_KEY", "B".repeat(43));
  vi.stubEnv("VAPID_SUBJECT", subject);
  expect(getPushConfig()).toBeNull();
});
