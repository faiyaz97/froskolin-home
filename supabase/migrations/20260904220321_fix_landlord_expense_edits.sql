create or replace function private.validate_landlord_payer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare landlord_is_enabled boolean;
begin
  -- The existing share-replacement RPC sets the member payer before the
  -- landlord-aware wrapper applies the final external-payer state. Keep both
  -- statements valid under the exactly-one-payer constraint.
  if tg_table_name = 'expenses' and tg_op = 'UPDATE' then
    if old.paid_by_landlord and new.paid_by_landlord and new.payer_member_id is not null then
      new.paid_by_landlord := false;
    end if;
  end if;

  if tg_table_name = 'expenses' and new.kind = 'recurring' and new.recurring_rule_id is not null then
    select r.paid_by_landlord into new.paid_by_landlord
    from public.recurring_expense_rules r
    where r.id = new.recurring_rule_id and r.household_id = new.household_id;
  end if;

  if new.paid_by_landlord then
    select h.landlord_enabled into landlord_is_enabled
    from public.households h where h.id = new.household_id;
    if not coalesce(landlord_is_enabled, false) then
      raise exception 'landlord is not enabled for this household' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
