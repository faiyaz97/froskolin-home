import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260901171417_froskolin_home_foundation.sql"),
  "utf8",
).toLowerCase();
const houseAccessMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260903173848_human_house_codes_and_join_pins.sql"),
  "utf8",
).toLowerCase();

describe("database security and automation contract", () => {
  it("enables RLS and scopes financial records to active household membership", () => {
    for (const table of [
      "households",
      "household_members",
      "absence_periods",
      "recurring_expense_rules",
      "expenses",
      "expense_shares",
      "bill_documents",
      "utility_bills",
      "settlements",
      "audit_events",
      "notifications",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("private.is_active_household_member(household_id)");
    expect(migration).toContain("revoke all on all tables in schema public from anon");
  });

  it("keeps audit events append-only for authenticated users", () => {
    expect(migration).toContain("grant select on public.audit_events to authenticated");
    expect(migration).not.toContain(
      "grant select, insert, update on public.audit_events to authenticated",
    );
    expect(migration).not.toMatch(/create policy audit_events_.*for (insert|update|delete)/);
  });

  it("fans one audit event out to every other active member", () => {
    expect(migration).toContain("new.actor_user_id is null or m.user_id <> new.actor_user_id");
    expect(migration).toContain("unique (recipient_user_id, audit_event_id)");
    expect(migration).not.toContain("audit_event_id uuid not null unique");
  });

  it("makes recurring generation idempotent at both RPC and constraint levels", () => {
    expect(migration).toContain("unique (recurring_rule_id, occurrence_date)");
    expect(migration).toContain("on conflict (recurring_rule_id, occurrence_date) do nothing");
    expect(migration).toContain("service_create_recurring_occurrence");
  });

  it("keeps Auth alias bridges service-role only", () => {
    expect(migration).toContain("service role required");
    expect(migration).toContain(
      "revoke all on function public.service_get_auth_alias(uuid), public.service_put_auth_alias(uuid, text)",
    );
    expect(migration).toContain("to service_role");
  });

  it("keeps household creation atomic and membership identity immutable", () => {
    expect(migration).toMatch(
      /create or replace function public\.create_household_with_owner[\s\S]*?security definer/,
    );
    expect(migration).toContain("membership identity cannot be changed");
    expect(migration).toContain("with check ((select private.is_household_owner(household_id)))");
  });

  it("limits notification edits and safely parses private storage paths", () => {
    expect(migration).toContain(
      "grant select, update (read_at) on public.notifications to authenticated",
    );
    expect(migration).toContain("when split_part(path, '/', 1) ~*");
    expect(migration).toContain("froskolin-bills");
  });

  it("updates a utility and all of its shares in one RPC", () => {
    expect(migration).toContain("replace_utility_bill_with_shares");
    expect(migration).toContain("perform private.replace_expense_with_shares");
  });

  it("keeps caller-supplied share commits behind the server authorization layer", () => {
    expect(migration).toMatch(
      /revoke all on function public\.create_expense_with_shares[\s\S]*?from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_expense_with_shares[\s\S]*?to service_role/,
    );
    expect(migration).toContain("'{shares}', p_shares");
  });

  it("consumes each uploaded document once and removes notification access with membership", () => {
    expect(migration).toContain("utility_bills_one_expense_per_document_idx");
    expect(migration).toContain("bill document is already confirmed");
    expect(migration).toContain(
      "recipient_user_id = (select auth.uid()) and (select private.is_active_household_member(household_id))",
    );
  });

  it("separates readable House Codes from private Join PIN digests", () => {
    expect(houseAccessMigration).toContain("create unique index households_house_code_unique_idx");
    expect(houseAccessMigration).toContain("check (house_code ~ '^frosko-[0-9]{4}$')");
    expect(houseAccessMigration).toContain("join_pin_digest");
    expect(houseAccessMigration).toContain("revoke select, update on public.households");
    expect(houseAccessMigration).not.toMatch(
      /grant select \([^)]*join_pin_digest[^)]*\) on public\.households to authenticated/,
    );
  });

  it("keeps access changes out of audit snapshots and records clear summaries", () => {
    expect(houseAccessMigration).toContain(
      "row_data - array['access_code_digest', 'join_pin_digest'",
    );
    expect(houseAccessMigration).toContain("the owner changed the house code.");
    expect(houseAccessMigration).toContain("the owner changed the house join pin.");
  });
});
