-- A group's default currency is the canonical currency for its complete ledger.
-- Existing amounts keep their integer-cent values when an admin changes the
-- currency; only the currency code changes.

select set_config('app.suppress_audit', 'true', true);

update public.expenses as expense
set currency = household.default_currency
from public.households as household
where household.id = expense.household_id
  and expense.currency is distinct from household.default_currency;

update public.settlements as settlement
set currency = household.default_currency
from public.households as household
where household.id = settlement.household_id
  and settlement.currency is distinct from household.default_currency;

update public.recurring_expense_rules as rule
set currency = household.default_currency
from public.households as household
where household.id = rule.household_id
  and rule.currency is distinct from household.default_currency;

select set_config('app.suppress_audit', 'false', true);

create or replace function private.apply_household_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_currency char(3);
begin
  -- The share lock serializes financial writes with a concurrent group
  -- currency change, so neither transaction can leave a stale currency behind.
  select household.default_currency
    into strict group_currency
  from public.households as household
  where household.id = new.household_id
  for share;

  new.currency := group_currency;
  return new;
end;
$$;

revoke all on function private.apply_household_currency() from public, anon, authenticated;

drop trigger if exists expenses_apply_household_currency on public.expenses;
create trigger expenses_apply_household_currency
before insert or update of household_id, currency on public.expenses
for each row execute function private.apply_household_currency();

drop trigger if exists settlements_apply_household_currency on public.settlements;
create trigger settlements_apply_household_currency
before insert or update of household_id, currency on public.settlements
for each row execute function private.apply_household_currency();

drop trigger if exists recurring_rules_apply_household_currency on public.recurring_expense_rules;
create trigger recurring_rules_apply_household_currency
before insert or update of household_id, currency on public.recurring_expense_rules
for each row execute function private.apply_household_currency();

create or replace function private.cascade_household_currency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_audit_setting text := current_setting('app.suppress_audit', true);
begin
  if new.default_currency is not distinct from old.default_currency then
    return new;
  end if;

  -- The household update is the single meaningful audit event. Rewriting each
  -- dependent row is an implementation detail and must not flood Activity.
  perform set_config('app.suppress_audit', 'true', true);

  update public.expenses
  set currency = new.default_currency
  where household_id = new.id
    and currency is distinct from new.default_currency;

  update public.settlements
  set currency = new.default_currency
  where household_id = new.id
    and currency is distinct from new.default_currency;

  update public.recurring_expense_rules
  set currency = new.default_currency
  where household_id = new.id
    and currency is distinct from new.default_currency;

  perform set_config('app.suppress_audit', coalesce(previous_audit_setting, ''), true);
  return new;
end;
$$;

revoke all on function private.cascade_household_currency() from public, anon, authenticated;

drop trigger if exists households_cascade_currency on public.households;
create trigger households_cascade_currency
after update of default_currency on public.households
for each row execute function private.cascade_household_currency();
