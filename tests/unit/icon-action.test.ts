import { describe, expect, it } from "vitest";

import { iconActionClass } from "@/components/ui/icon-action";

describe("icon action styling", () => {
  it("uses a transparent circular resting state and semantic hover color", () => {
    const className = iconActionClass({ tone: "negative" });

    expect(className).toContain("rounded-full");
    expect(className).toContain("bg-transparent");
    expect(className).toContain("text-[var(--negative)]");
    expect(className).toContain("hover:bg-[var(--negative-soft)]");
  });

  it("keeps content-present fill lighter than its hover fill", () => {
    const className = iconActionClass({ tone: "violet", active: true });

    expect(className).toContain("bg-[var(--pastel-lavender)]");
    expect(className).toContain("hover:bg-[var(--violet-soft)]");
  });

  it("uses teal-derived fills for brand actions instead of the mint surface palette", () => {
    const className = iconActionClass({ tone: "brand", active: true });

    expect(className).toContain("bg-[var(--brand-icon-soft)]");
    expect(className).toContain("hover:bg-[var(--brand-icon-hover)]");
    expect(className).not.toContain("pastel-mint");
  });
});
