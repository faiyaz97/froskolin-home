-- Push delivery resolves involved member ids to their authenticated users.
-- Existing service-role grants cover the other queried membership columns.
grant select (id) on public.household_members to service_role;
