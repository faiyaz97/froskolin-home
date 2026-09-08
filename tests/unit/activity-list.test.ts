// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditList } from "@/components/activity/audit-list";
import { ActivityTypeIcon } from "@/components/activity/activity-type-icon";
import type { ActivityEvent } from "@/lib/activity/presentation";

const query = vi.hoisted(() => {
  const result = {
    data: [] as ActivityEvent[],
    error: null,
  };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockImplementation(() => Promise.resolve(result));
  const billBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
  };
  billBuilder.select.mockReturnValue(billBuilder);
  billBuilder.eq.mockReturnValue(billBuilder);
  billBuilder.in.mockResolvedValue({ data: [], error: null });
  return { builder, billBuilder, result };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => (table === "utility_bills" ? query.billBuilder : query.builder),
  }),
}));

afterEach(() => {
  cleanup();
  query.result.data = [];
  vi.clearAllMocks();
});

function activity(id: number): ActivityEvent {
  return {
    id: `event-${id}`,
    action_type: "created",
    entity_type: "expense",
    entity_id: `expense-${id}`,
    summary: `Added expense ${id}`,
    occurred_at: `2026-09-${String(20 - id).padStart(2, "0")}T12:00:00Z`,
    actor_user_id: "user-one",
    previous_values: null,
    new_values: { title: `Expense ${id}`, total_cents: id * 100, currency: "EUR" },
  };
}

describe("activity list pagination", () => {
  it("loads the next ten records only after the member asks for them", async () => {
    const initialEvents = Array.from({ length: 10 }, (_, index) => activity(index + 1));
    query.result.data = [activity(11)];
    render(
      React.createElement(AuditList, {
        householdId: "house-one",
        initialEvents,
        initialUtilityTypes: {},
        members: [{ id: "member-one", userId: "user-one", name: "Andrea", avatarColor: null }],
        locale: "en-GB",
        timezone: "UTC",
        initialHasMore: true,
      }),
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Click to load more" }));

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(11));
    expect(query.builder.lt).toHaveBeenCalledWith("occurred_at", initialEvents[9]?.occurred_at);
    expect(screen.queryByRole("button", { name: "Click to load more" })).toBeNull();
  });

  it("uses the canonical utility icon for bill activity", () => {
    const { container } = render(
      React.createElement(ActivityTypeIcon, {
        entityType: "expense",
        utilityType: "gas",
      }),
    );

    expect(container.querySelector('[data-utility-type="gas"]')).not.toBeNull();
    expect(container.querySelector(".lucide-flame")).not.toBeNull();
  });
});
