-- Reverse one actual landlord transfer and every bill-share allocation it created.
-- Older, ungrouped landlord payments remain individually reversible.
create function public.void_landlord_payment_group(
  p_household_id uuid,
  p_payment_id uuid,
  p_reason text,
  p_actor_user_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  payment_group_id uuid;
  payment_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then
    raise exception 'not a group member' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'a reason is required' using errcode = '23514';
  end if;

  -- Match the write-side lock order: group, then its payment rows.
  perform 1 from public.households h where h.id = p_household_id for update;
  select lp.all_payment_id into payment_group_id
  from public.landlord_payments lp
  where lp.id = p_payment_id and lp.household_id = p_household_id
    and lp.voided_at is null
  for update;
  if not found then
    raise exception 'payment is unavailable' using errcode = '42501';
  end if;
  perform 1 from public.landlord_payments lp
  where lp.household_id = p_household_id and lp.voided_at is null
    and (case when payment_group_id is null
      then lp.id = p_payment_id else lp.all_payment_id = payment_group_id end)
  order by lp.id for update;

  select count(*) into payment_count from public.landlord_payments lp
  where lp.household_id = p_household_id and lp.voided_at is null
    and (case when payment_group_id is null
      then lp.id = p_payment_id else lp.all_payment_id = payment_group_id end);

  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  perform set_config('app.allow_linked_all_void', '1', true);
  update public.settlements s
  set voided_at = now(), voided_by = p_actor_user_id,
      void_reason = p_reason, updated_by = p_actor_user_id
  where s.household_id = p_household_id and s.voided_at is null
    and s.id in (
      select lp.linked_settlement_id from public.landlord_payments lp
      where lp.household_id = p_household_id and lp.voided_at is null
        and lp.linked_settlement_id is not null
        and (case when payment_group_id is null
          then lp.id = p_payment_id else lp.all_payment_id = payment_group_id end)
    );
  update public.landlord_payments lp
  set voided_at = now(), voided_by = p_actor_user_id, void_reason = p_reason
  where lp.household_id = p_household_id and lp.voided_at is null
    and (case when payment_group_id is null
      then lp.id = p_payment_id else lp.all_payment_id = payment_group_id end);
  perform set_config('app.allow_linked_all_void', '0', true);

  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id,
    previous_values, new_values, summary
  ) values (
    p_household_id, p_actor_user_id, 'reopened', 'landlord_payment', p_payment_id,
    jsonb_build_object('paid', true, 'voided_payment_count', payment_count),
    jsonb_build_object('paid', false),
    'reversed a Landlord payment and its bill allocations.'
  );
end;
$$;

revoke all on function public.void_landlord_payment_group(uuid, uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.void_landlord_payment_group(uuid, uuid, text, uuid)
to service_role;
