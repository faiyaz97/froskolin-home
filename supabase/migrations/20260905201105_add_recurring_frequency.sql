-- Existing rules remain monthly; no expenses or balances are rewritten.
alter table public.recurring_expense_rules
  add column frequency text not null default 'monthly'
  constraint recurring_rules_frequency_check check (frequency in ('weekly', 'monthly', 'yearly'));

-- The generator already has narrow column-level read grants.
grant select (frequency) on public.recurring_expense_rules to service_role;
