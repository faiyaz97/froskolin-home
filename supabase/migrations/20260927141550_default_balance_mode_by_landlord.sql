alter table public.households
  alter column balance_strategy set default 'simplified';

-- Apply the new defaults to future groups and Landlord mode changes only.
-- An explicitly selected Standard mode remains Standard when Landlord mode changes.
create or replace function private.normalize_balance_strategy() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.landlord_enabled and new.balance_strategy = 'simplified' then
      new.balance_strategy := 'super_simplified';
    end if;
  elsif new.landlord_enabled and not old.landlord_enabled
    and new.balance_strategy = 'simplified' then
    new.balance_strategy := 'super_simplified';
  elsif not new.landlord_enabled and new.balance_strategy = 'super_simplified' then
    new.balance_strategy := 'simplified';
  end if;
  return new;
end;
$$;

create trigger households_default_balance_strategy
before insert on public.households
for each row execute function private.normalize_balance_strategy();
