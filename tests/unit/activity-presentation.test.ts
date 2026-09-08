import { describe, expect, it } from "vitest";

import { activityChanges, activityHeadline, type ActivityEvent } from "@/lib/activity/presentation";

const members = [
  { id: "member-one", userId: "user-one", name: "Andrea" },
  { id: "member-two", userId: "user-two", name: "Luca" },
];

function event(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: "event-one",
    action_type: "updated",
    entity_type: "expense",
    entity_id: "expense-one",
    summary: "updated Groceries",
    occurred_at: "2026-09-08T12:00:00Z",
    actor_user_id: "user-one",
    previous_values: null,
    new_values: null,
    ...overrides,
  };
}

describe("activity presentation", () => {
  it("shows only changed expense values and resolves member ids to names", () => {
    const changes = activityChanges(
      event({
        previous_values: {
          title: "Groceries",
          total_cents: 1000,
          currency: "EUR",
          payer_member_id: "member-one",
          paid_by_landlord: false,
          split_method: "equal",
          split_config: {
            participants: [{ memberId: "member-one" }, { memberId: "member-two" }],
            shares: [
              { member_id: "member-one", share_cents: 500 },
              { member_id: "member-two", share_cents: 500 },
            ],
          },
        },
        new_values: {
          title: "Groceries",
          total_cents: 1200,
          currency: "EUR",
          payer_member_id: "member-one",
          paid_by_landlord: false,
          split_method: "equal",
          split_config: {
            participants: [{ memberId: "member-one" }, { memberId: "member-two" }],
            shares: [
              { member_id: "member-one", share_cents: 600 },
              { member_id: "member-two", share_cents: 600 },
            ],
          },
        },
      }),
      members,
      "en-GB",
    );

    expect(changes.map((change) => change.label)).toEqual(["Amount", "Shares"]);
    expect(changes[1]?.after).toContain("Andrea");
    expect(changes[1]?.after).toContain("Luca");
    expect(JSON.stringify(changes)).not.toContain("member-one");
  });

  it("uses a member name in away-date activity", () => {
    expect(
      activityHeadline(
        event({
          action_type: "created",
          entity_type: "absence_period",
          new_values: { member_id: "member-two" },
        }),
        members,
      ),
    ).toBe("Added away dates for Luca");
  });
});
