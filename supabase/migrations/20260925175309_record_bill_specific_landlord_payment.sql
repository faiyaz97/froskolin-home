-- One physical payment toward exactly one bill. The caller supplies the live
-- projected beneficiary allocations; all rows and linked settlements are atomic.
create function public.record_bill_landlord_payment(
  p_household_id uuid,
  p_expense_id uuid,
  p_paying_member_id uuid,
  p_allocations jsonb,
  p_currency char(3),
  p_payment_date date,
  p_actor_user_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor_member_id uuid;
  bill_title text;
  bill_currency char(3);
  payer_share bigint;
  payer_share_paid bigint;
  share_total bigint;
  already_paid bigint;
  total_paid bigint := 0;
  allocation record;
  seen_members uuid[] := '{}';
  payment_uuid uuid;
  settlement_uuid uuid;
  group_uuid uuid := extensions.gen_random_uuid();
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  select m.id into actor_member_id from public.household_members m
  where m.household_id = p_household_id and m.user_id = p_actor_user_id
    and m.removed_at is null;
  if actor_member_id is distinct from p_paying_member_id then
    raise exception 'payer must be the current member' using errcode = '42501';
  end if;
  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array'
    or jsonb_array_length(p_allocations) = 0 or p_payment_date is null then
    raise exception 'invalid bill payment' using errcode = '23514';
  end if;

  -- The group-first lock order matches the other financial RPCs.
  perform 1 from public.households h where h.id = p_household_id for update;
  select e.title, e.currency into bill_title, bill_currency from public.expenses e
  where e.id = p_expense_id and e.household_id = p_household_id
    and e.paid_by_landlord and e.voided_at is null for update;
  if bill_title is null or bill_currency is distinct from p_currency then
    raise exception 'landlord bill is unavailable' using errcode = '23514';
  end if;

  select s.share_cents into payer_share from public.expense_shares s
  where s.expense_id = p_expense_id and s.household_id = p_household_id
    and s.member_id = p_paying_member_id;
  if payer_share is not null and payer_share > 0 then
    select coalesce(sum(lp.amount_cents), 0) into payer_share_paid
    from public.landlord_payments lp
    where lp.expense_id = p_expense_id and lp.member_id = p_paying_member_id
      and lp.voided_at is null;
    if payer_share_paid >= payer_share then
      raise exception 'paid bill contribution is locked until payment is voided'
        using errcode = '23514';
    end if;
  end if;

  for allocation in
    select * from jsonb_to_recordset(p_allocations)
      as item(member_id uuid, amount_cents bigint)
  loop
    if allocation.member_id is null or allocation.amount_cents is null
      or allocation.amount_cents <= 0 or allocation.member_id = any(seen_members) then
      raise exception 'invalid bill allocation' using errcode = '23514';
    end if;
    seen_members := array_append(seen_members, allocation.member_id);
    select s.share_cents into share_total from public.expense_shares s
    where s.expense_id = p_expense_id and s.household_id = p_household_id
      and s.member_id = allocation.member_id;
    if share_total is null then
      raise exception 'bill share is unavailable' using errcode = '23514';
    end if;
    select coalesce(sum(lp.amount_cents), 0) into already_paid
    from public.landlord_payments lp
    where lp.expense_id = p_expense_id and lp.member_id = allocation.member_id
      and lp.voided_at is null;
    if allocation.amount_cents > share_total - already_paid then
      raise exception 'bill share balance changed' using errcode = '40001';
    end if;
    settlement_uuid := null;
    if allocation.member_id <> p_paying_member_id then
      settlement_uuid := public.record_settlement(
        p_household_id, p_paying_member_id, allocation.member_id,
        allocation.amount_cents, p_currency, p_payment_date,
        'Bill payment to Landlord', p_actor_user_id
      );
    end if;
    payment_uuid := extensions.gen_random_uuid();
    insert into public.landlord_payments (
      id, household_id, expense_id, member_id, amount_cents, payment_date,
      created_by, paid_by_member_id, linked_settlement_id, all_payment_id
    ) values (
      payment_uuid, p_household_id, p_expense_id, allocation.member_id,
      allocation.amount_cents, p_payment_date, p_actor_user_id,
      p_paying_member_id, settlement_uuid, group_uuid
    );
    insert into public.audit_events (
      household_id, actor_user_id, action_type, entity_type, entity_id,
      new_values, summary
    ) values (
      p_household_id, p_actor_user_id, 'created', 'landlord_payment', payment_uuid,
      jsonb_build_object(
        'expense_id', p_expense_id, 'member_id', allocation.member_id,
        'paid_by_member_id', p_paying_member_id,
        'amount_cents', allocation.amount_cents, 'currency', p_currency,
        'payment_date', p_payment_date, 'title', bill_title,
        'linked_settlement_id', settlement_uuid, 'all_payment_id', group_uuid
      ),
      format('paid Landlord %s %s for %s.',
        trim(to_char(allocation.amount_cents / 100.0, 'FM999999990.00')),
        p_currency, bill_title)
    );
    total_paid := total_paid + allocation.amount_cents;
  end loop;
  if total_paid <= 0 then
    raise exception 'invalid bill payment' using errcode = '23514';
  end if;
  return group_uuid;
end;
$$;

revoke all on function public.record_bill_landlord_payment(uuid, uuid, uuid, jsonb, char, date, uuid)
from public, anon, authenticated;
grant execute on function public.record_bill_landlord_payment(uuid, uuid, uuid, jsonb, char, date, uuid)
to service_role;
