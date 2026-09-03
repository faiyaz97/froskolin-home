-- The server resolves a household code before the new roommate has a session,
-- then creates that roommate's membership after Auth provisioning succeeds.
-- Keep these grants narrow: the browser never receives the service key.
grant select (id, joining_enabled, access_code_digest, archived_at, timezone)
  on public.households to service_role;

grant select (household_id, user_id, display_name_normalized, removed_at)
  on public.household_members to service_role;

grant insert (household_id, user_id, display_name, role)
  on public.household_members to service_role;

-- The daily recurring job reads due rules before calling the atomic generator.
grant select (
  id,
  household_id,
  amount_cents,
  split_config,
  anchor_date,
  end_date,
  next_due_date,
  active,
  archived_at
) on public.recurring_expense_rules to service_role;
