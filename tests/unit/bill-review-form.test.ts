// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillConfirmation } from "@/components/bills/bill-confirmation";
import { calculateBillTotals } from "@/lib/domain/bill-analysis";
import { gasSummaryReference } from "../fixtures/bill-analysis";
const { confirm, update } = vi.hoisted(() => ({ confirm: vi.fn(), update: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/actions", () => ({
  confirmUtilityBillAction: confirm,
  updateUtilityBillAction: update,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("review-required bill form", () => {
  it.each([false, true])(
    "leaves unresolved buckets blank and cannot save, including edit mode %s",
    (editing) => {
      render(
        React.createElement(BillConfirmation, {
          householdId: "group",
          defaultCurrency: "EUR",
          locale: "en-GB",
          initial: calculateBillTotals(gasSummaryReference),
          members: [{ id: "member", name: "User" }],
          absences: [],
          currentMemberId: "member",
          landlordEnabled: false,
          existing: editing
            ? {
                expenseId: "expense",
                title: "Old bill",
                utilityType: "gas",
                supplier: null,
                issueDate: null,
                serviceStart: "2026-03-01",
                serviceEnd: "2026-05-31",
                totalCents: 10000,
                fixedCents: 4000,
                variableCents: 6000,
                currency: "EUR",
                payerMemberId: "member",
                participantIds: ["member"],
                consumptionAmount: null,
                consumptionUnit: null,
                classificationNote: null,
              }
            : undefined,
        }),
      );
      expect(screen.getByText("Autofill couldn’t complete. Please try again.")).toBeTruthy();
      expect((screen.getByLabelText("Fixed fees") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Usage costs") as HTMLInputElement).value).toBe("");
      fireEvent.submit(document.querySelector("form")!);
      expect(confirm).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );
});
