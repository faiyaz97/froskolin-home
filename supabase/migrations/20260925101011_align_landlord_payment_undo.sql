-- Keep the atomic implementation private. The public entry point now checks
-- who may reverse the physical transfer before using that implementation.
alter function public.void_landlord_payment_group(uuid, uuid, text, uuid)
  set schema private;
alter function private.void_landlord_payment_group(uuid, uuid, text, uuid)
  rename to void_landlord_payment_group_impl;
revoke all on function private.void_landlord_payment_group_impl(uuid, uuid, text, uuid)
  from public, anon, authenticated, service_role;

create function public.void_landlord_payment_group(
  p_household_id uuid,
  p_payment_id uuid,
  p_reason text,
  p_actor_user_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor_member_id uuid;
  actor_role public.member_role;
  actual_payer_id uuid;
  recorder_user_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  -- Serialize with all payment creation, undo, and admin-role changes.
  perform 1 from public.households h where h.id = p_household_id for update;
  select m.id, m.role into actor_member_id, actor_role
  from public.household_members m
  where m.household_id = p_household_id and m.user_id = p_actor_user_id
    and m.removed_at is null;
  if actor_member_id is null then
    raise exception 'not a group member' using errcode = '42501';
  end if;
  select lp.paid_by_member_id, lp.created_by into actual_payer_id, recorder_user_id
  from public.landlord_payments lp
  where lp.id = p_payment_id and lp.household_id = p_household_id
    and lp.voided_at is null;
  if not found then
    raise exception 'payment is unavailable' using errcode = '42501';
  end if;
  if actor_role <> 'owner'
    and not (
      (actual_payer_id is not null and actual_payer_id = actor_member_id)
      or (actual_payer_id is null and recorder_user_id = p_actor_user_id)
    ) then
    raise exception 'only the payer or an admin may reverse this payment'
      using errcode = '42501';
  end if;
  perform private.void_landlord_payment_group_impl(
    p_household_id, p_payment_id, p_reason, p_actor_user_id
  );
end;
$$;

revoke all on function public.void_landlord_payment_group(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.void_landlord_payment_group(uuid, uuid, text, uuid)
  to service_role;

-- The settlement-detail undo reaches the same locked, authorized entry point.
-- Do not lock a settlement before the group row: bill-detail undo acquires
-- the group lock first and would otherwise deadlock a concurrent request.
create or replace function public.void_linked_all_payment(
  p_household_id uuid,
  p_settlement_id uuid,
  p_reason text,
  p_actor_user_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  payment_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select lp.id into payment_id from public.landlord_payments lp
  where lp.household_id = p_household_id
    and lp.linked_settlement_id = p_settlement_id
    and lp.voided_at is null;
  if payment_id is null then
    raise exception 'linked payment is unavailable' using errcode = '42501';
  end if;
  perform public.void_landlord_payment_group(
    p_household_id, payment_id, p_reason, p_actor_user_id
  );
end;
$$;
