alter table public.expenses
  add column note text
  constraint expenses_note_length check (note is null or char_length(note) <= 500);

drop function public.create_expense_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, public.expense_kind,
  public.split_method, jsonb, jsonb, uuid, uuid, date
);

drop function public.replace_expense_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, public.split_method,
  jsonb, jsonb, uuid
);

create function public.create_expense_with_landlord_support(
  p_household_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
  p_paid_by_landlord boolean,
  p_expense_date date,
  p_kind public.expense_kind,
  p_split_method public.split_method,
  p_split_config jsonb,
  p_shares jsonb,
  p_actor_user_id uuid,
  p_note text default null,
  p_recurring_rule_id uuid default null,
  p_occurrence_date date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  expense_uuid uuid;
  temporary_payer uuid;
  payer_label text;
  final_snapshot jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  select m.id into temporary_payer from public.household_members m
  where m.household_id = p_household_id and m.user_id = p_actor_user_id and m.removed_at is null;
  if p_paid_by_landlord and not exists (
    select 1 from public.households h where h.id = p_household_id and h.landlord_enabled
  ) then
    raise exception 'landlord is not enabled for this household' using errcode = '23514';
  end if;

  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  perform set_config('app.suppress_audit', 'true', true);
  expense_uuid := public.create_expense_with_shares(
    p_household_id, p_title, p_total_cents, p_currency,
    case when p_paid_by_landlord then temporary_payer else p_payer_member_id end,
    p_expense_date, p_kind, p_split_method, p_split_config, p_shares,
    p_actor_user_id, p_recurring_rule_id, p_occurrence_date
  );
  update public.expenses set
    payer_member_id = case when p_paid_by_landlord then null else p_payer_member_id end,
    paid_by_landlord = p_paid_by_landlord,
    note = nullif(btrim(p_note), '')
  where id = expense_uuid;
  if p_paid_by_landlord then
    payer_label := 'Landlord';
  else
    select m.display_name into payer_label from public.household_members m
    where m.id = p_payer_member_id and m.household_id = p_household_id;
  end if;
  perform set_config('app.suppress_audit', 'false', true);
  select private.safe_audit_snapshot(to_jsonb(e), 'expense') into final_snapshot
  from public.expenses e where e.id = expense_uuid;
  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id, new_values, summary
  ) values (
    p_household_id, p_actor_user_id, 'created', 'expense', expense_uuid, final_snapshot,
    format('added %s %s %s, paid by %s.', p_title,
      trim(to_char(p_total_cents / 100.0, 'FM999999990.00')), p_currency,
      coalesce(payer_label, 'a former member'))
  );
  return expense_uuid;
end;
$$;

create function public.replace_expense_with_landlord_support(
  p_expense_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
  p_paid_by_landlord boolean,
  p_expense_date date,
  p_split_method public.split_method,
  p_split_config jsonb,
  p_shares jsonb,
  p_actor_user_id uuid,
  p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  target_household_id uuid;
  temporary_payer uuid;
  payer_label text;
  previous_snapshot jsonb;
  final_snapshot jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select e.household_id, private.safe_audit_snapshot(to_jsonb(e), 'expense')
    into target_household_id, previous_snapshot
  from public.expenses e where e.id = p_expense_id and e.voided_at is null;
  if target_household_id is null or not private.is_active_household_user(target_household_id, p_actor_user_id) then
    raise exception 'expense is unavailable' using errcode = '42501';
  end if;
  select m.id into temporary_payer from public.household_members m
  where m.household_id = target_household_id and m.user_id = p_actor_user_id and m.removed_at is null;
  if p_paid_by_landlord and not exists (
    select 1 from public.households h where h.id = target_household_id and h.landlord_enabled
  ) then
    raise exception 'landlord is not enabled for this household' using errcode = '23514';
  end if;

  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  perform set_config('app.suppress_audit', 'true', true);
  perform public.replace_expense_with_shares(
    p_expense_id, p_title, p_total_cents, p_currency,
    case when p_paid_by_landlord then temporary_payer else p_payer_member_id end,
    p_expense_date, p_split_method, p_split_config, p_shares, p_actor_user_id
  );
  update public.expenses set
    payer_member_id = case when p_paid_by_landlord then null else p_payer_member_id end,
    paid_by_landlord = p_paid_by_landlord,
    note = nullif(btrim(p_note), '')
  where id = p_expense_id;
  perform set_config('app.suppress_audit', 'false', true);
  if p_paid_by_landlord then payer_label := 'Landlord';
  else
    select m.display_name into payer_label from public.household_members m
    where m.id = p_payer_member_id and m.household_id = target_household_id;
  end if;
  select private.safe_audit_snapshot(to_jsonb(e), 'expense') into final_snapshot
  from public.expenses e where e.id = p_expense_id;
  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id,
    previous_values, new_values, summary
  ) values (
    target_household_id, p_actor_user_id, 'updated', 'expense', p_expense_id,
    previous_snapshot, final_snapshot,
    format('updated %s, paid by %s.', p_title, coalesce(payer_label, 'a former member'))
  );
end;
$$;

revoke all on function public.create_expense_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, public.expense_kind,
  public.split_method, jsonb, jsonb, uuid, text, uuid, date
) from public, anon, authenticated;
revoke all on function public.replace_expense_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, public.split_method,
  jsonb, jsonb, uuid, text
) from public, anon, authenticated;

grant execute on function public.create_expense_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, public.expense_kind,
  public.split_method, jsonb, jsonb, uuid, text, uuid, date
) to service_role;
grant execute on function public.replace_expense_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, public.split_method,
  jsonb, jsonb, uuid, text
) to service_role;
