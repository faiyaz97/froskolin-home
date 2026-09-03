import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const forms = [
  "src/components/public/auth-form.tsx",
  "src/components/household/settings-panel.tsx",
  "src/components/expenses/expense-form.tsx",
  "src/components/expenses/settlement-form.tsx",
  "src/components/expenses/recurring-form.tsx",
  "src/components/bills/bill-confirmation.tsx",
].map((path) => ({ path, source: readFileSync(join(process.cwd(), path), "utf8") }));

describe("shared form-control contract", () => {
  it("does not use native dropdowns or browser date inputs in application forms", () => {
    for (const form of forms) {
      expect(form.source, form.path).not.toMatch(/<select\b/);
      expect(form.source, form.path).not.toMatch(/type=["']date["']/);
    }
  });

  it("does not bypass the shared input components with legacy style constants", () => {
    for (const form of forms) {
      expect(form.source, form.path).not.toContain("inputClass");
      expect(form.source, form.path).not.toContain("textareaClass");
    }
  });
});
