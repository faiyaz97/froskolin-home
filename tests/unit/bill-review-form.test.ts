// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BillConfirmation } from "@/components/bills/bill-confirmation";
import { calculateBillTotals } from "@/lib/domain/bill-analysis";
import { gasSummaryReference, rawBill } from "../fixtures/bill-analysis";
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
      expect(
        screen.getByText(
          "We filled the details we could verify. Enter the fixed and usage amounts from your bill.",
        ),
      ).toBeTruthy();
      expect((screen.getByLabelText("Fixed fees") as HTMLInputElement).value).toBe("");
      expect((screen.getByLabelText("Usage costs") as HTMLInputElement).value).toBe("");
      fireEvent.submit(document.querySelector("form")!);
      expect(confirm).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("omits members outside the service period from a new bill", async () => {
    confirm.mockResolvedValue({ ok: true, data: { expenseId: "expense" } });
    render(
      React.createElement(BillConfirmation, {
        householdId: "group",
        defaultCurrency: "EUR",
        locale: "en-GB",
        initial: calculateBillTotals(rawBill()),
        members: [
          { id: "eligible", name: "Eligible", inDate: "2026-01-01", outDate: null },
          { id: "joined-later", name: "Joined later", inDate: "2026-06-01", outDate: null },
          { id: "left-earlier", name: "Left earlier", inDate: "2025-01-01", outDate: "2026-02-28" },
        ],
        absences: [],
        currentMemberId: "eligible",
        landlordEnabled: false,
      }),
    );

    await waitFor(() => {
      expect(screen.getAllByText("Eligible").length).toBeGreaterThan(0);
      expect(screen.queryByText("Joined later")).toBeNull();
      expect(screen.queryByText("Left earlier")).toBeNull();
    });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: [{ memberId: "eligible", order: 0 }],
        }),
      ),
    );
  });

  it("keeps an existing participant with no service-period overlap", async () => {
    update.mockResolvedValue({ ok: true, data: undefined });
    render(
      React.createElement(BillConfirmation, {
        householdId: "group",
        defaultCurrency: "EUR",
        locale: "en-GB",
        members: [
          { id: "eligible", name: "Eligible", inDate: "2026-01-01", outDate: null },
          { id: "left-earlier", name: "Left earlier", inDate: "2025-01-01", outDate: "2026-02-28" },
        ],
        absences: [],
        currentMemberId: "eligible",
        landlordEnabled: false,
        existing: {
          expenseId: "expense",
          title: "Gas",
          utilityType: "gas",
          supplier: null,
          issueDate: null,
          serviceStart: "2026-03-01",
          serviceEnd: "2026-05-31",
          totalCents: 10000,
          fixedCents: 4000,
          variableCents: 6000,
          currency: "EUR",
          payerMemberId: "eligible",
          participantIds: ["eligible", "left-earlier"],
          consumptionAmount: null,
          consumptionUnit: null,
          classificationNote: null,
        },
      }),
    );

    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: [
            { memberId: "eligible", order: 0 },
            { memberId: "left-earlier", order: 1 },
          ],
        }),
      ),
    );
  });

  it("requires an eligible member for a new bill", () => {
    render(
      React.createElement(BillConfirmation, {
        householdId: "group",
        defaultCurrency: "EUR",
        locale: "en-GB",
        initial: calculateBillTotals(rawBill()),
        members: [
          { id: "joined-later", name: "Joined later", inDate: "2026-06-01", outDate: null },
        ],
        absences: [],
        currentMemberId: "joined-later",
        landlordEnabled: false,
      }),
    );

    fireEvent.submit(document.querySelector("form")!);
    expect(
      screen.getByText("No group members were in the group during this service period."),
    ).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });
});
