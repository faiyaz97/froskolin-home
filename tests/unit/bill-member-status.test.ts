// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BillMemberStatus } from "@/components/expenses/bill-member-status";

afterEach(cleanup);

describe("bill member status", () => {
  it("shows the full paid contribution and only Paid or Due", () => {
    render(
      React.createElement(BillMemberStatus, {
        locale: "en-GB",
        memberProfiles: new Map([
          ["admin", { name: "Admin", avatarColor: null }],
          ["schiavo", { name: "Schiavo", avatarColor: null }],
        ]),
        presenceDaysByMemberId: new Map([
          ["admin", 91],
          ["schiavo", 1],
        ]),
        shareBreakdownByMemberId: new Map([
          ["admin", { fixedCents: 2000, usageCents: 3000 }],
          ["schiavo", { fixedCents: 2500, usageCents: 2500 }],
        ]),
        rows: [
          {
            memberId: "admin",
            currency: "GBP",
            originalShareCents: 5000,
            remainingShareCents: 0,
            paidToLandlordCents: 5000,
            plannedToLandlordCents: 0,
            toLandlordCents: 5000,
            paid: true,
            coveredBy: [],
            includes: [],
          },
          {
            memberId: "schiavo",
            currency: "GBP",
            originalShareCents: 5000,
            remainingShareCents: 5000,
            paidToLandlordCents: 0,
            plannedToLandlordCents: 5000,
            toLandlordCents: 5000,
            paid: false,
            coveredBy: [],
            includes: [],
          },
        ],
      }),
    );
    const admin = screen.getByText("Admin").closest(".grid")!;
    const schiavo = screen.getByText("Schiavo").closest(".grid")!;
    expect(within(admin as HTMLElement).getByText("Paid")).toBeTruthy();
    expect(within(schiavo as HTMLElement).getByText("Due")).toBeTruthy();
    expect(within(admin as HTMLElement).getByText("91 days at home")).toBeTruthy();
    expect(within(schiavo as HTMLElement).getByText("1 day at home")).toBeTruthy();
    expect(within(admin as HTMLElement).getAllByText("£50.00")).toHaveLength(2);
    expect(
      within(admin as HTMLElement).getByLabelText("Fixed £20.00 plus usage £30.00").textContent,
    ).toBe("£20.00 + £30.00");
    expect(screen.queryByText("Part paid")).toBeNull();
  });

  it("shows zero fixed or usage components and keeps large euro amounts readable", () => {
    render(
      React.createElement(BillMemberStatus, {
        locale: "en-IE",
        memberProfiles: new Map([
          ["fixed", { name: "Fixed", avatarColor: null }],
          ["usage", { name: "Usage", avatarColor: null }],
        ]),
        shareBreakdownByMemberId: new Map([
          ["fixed", { fixedCents: 12345678, usageCents: 0 }],
          ["usage", { fixedCents: 0, usageCents: 12345678 }],
        ]),
        rows: ["fixed", "usage"].map((memberId) => ({
          memberId,
          currency: "EUR",
          originalShareCents: 12345678,
          remainingShareCents: 12345678,
          paidToLandlordCents: 0,
          plannedToLandlordCents: 12345678,
          toLandlordCents: 12345678,
          paid: false,
          coveredBy: [],
          includes: [],
        })),
      }),
    );
    expect(screen.getByLabelText("Fixed €123,456.78 plus usage €0.00")).toBeTruthy();
    expect(screen.getByLabelText("Fixed €0.00 plus usage €123,456.78")).toBeTruthy();
  });

  it("does not invent a breakdown for an older bill without saved components", () => {
    render(
      React.createElement(BillMemberStatus, {
        locale: "en-GB",
        memberProfiles: new Map([["member", { name: "Member", avatarColor: null }]]),
        rows: [
          {
            memberId: "member",
            currency: "GBP",
            originalShareCents: 2500,
            remainingShareCents: 2500,
            paidToLandlordCents: 0,
            plannedToLandlordCents: 2500,
            toLandlordCents: 2500,
            paid: false,
            coveredBy: [],
            includes: [],
          },
        ],
      }),
    );
    expect(screen.getAllByText("£25.00")).toHaveLength(2);
    expect(screen.queryByLabelText(/Fixed .* plus usage/)).toBeNull();
  });
});
