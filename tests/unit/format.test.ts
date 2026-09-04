import { describe, expect, it } from "vitest";

import { formatUtilityBillTitle, timestampToDateOnly } from "@/lib/format";

describe("timestampToDateOnly", () => {
  it("uses the household timezone when deriving the added date", () => {
    const timestamp = "2026-09-04T22:30:00.000Z";

    expect(timestampToDateOnly(timestamp, "Europe/Rome")).toBe("2026-09-05");
    expect(timestampToDateOnly(timestamp, "America/New_York")).toBe("2026-09-04");
  });
});

describe("formatUtilityBillTitle", () => {
  it("builds a concise title from utility type and service months", () => {
    expect(formatUtilityBillTitle("gas", "2026-03-01", "2026-06-30", "en-GB")).toBe(
      "Gas Mar 26 - Jun 26",
    );
  });

  it("uses a simple fallback until both service dates are known", () => {
    expect(formatUtilityBillTitle("water", "", "", "en-GB")).toBe("Water bill");
  });
});
