-- Bill writes and member date edits share the same group lock. A bill computed
-- from an old date snapshot must retry rather than committing stale shares.
create function private.verify_utility_billing_dates() returns trigger
language plpgsql security definer set search_path = '' as $$
declare date_row jsonb;
actual_in date;
actual_out date;
begin
  if new.split_config->>'method' is distinct from 'utility' or
     new.split_config->'billingDates' is null then
    return new;
  end if;
  if jsonb_typeof(new.split_config->'billingDates') <> 'array' then
    raise exception 'invalid utility billing dates' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.household_id::text, 0));
  for date_row in select value from jsonb_array_elements(new.split_config->'billingDates') loop
    select m.in_date, m.out_date into actual_in, actual_out
    from public.household_members m
    where m.id = (date_row->>'memberId')::uuid and m.household_id = new.household_id;
    if actual_in is null or actual_in is distinct from (date_row->>'inDate')::date or
       actual_out is distinct from (date_row->>'outDate')::date then
      raise exception 'member billing dates changed; reload and try again' using errcode = '40001';
    end if;
  end loop;
  return new;
end;
$$;

create trigger expenses_verify_utility_billing_dates
before insert or update on public.expenses
for each row execute function private.verify_utility_billing_dates();
