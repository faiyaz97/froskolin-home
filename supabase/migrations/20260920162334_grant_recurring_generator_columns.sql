-- The recurring generator selects these fields to create the occurrence and
-- notify the payer. Keep the service role grant limited to the columns it reads.
grant select (currency, payer_member_id)
  on public.recurring_expense_rules to service_role;
