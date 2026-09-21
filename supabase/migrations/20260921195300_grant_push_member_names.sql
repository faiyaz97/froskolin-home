-- Push copy identifies the payer and settlement parties by display name.
grant select (display_name) on public.household_members to service_role;
