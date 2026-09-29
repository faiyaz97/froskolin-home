create or replace function public.record_landlord_balance_payment(
  p_household_id uuid,
  p_paying_member_id uuid,
  p_amount_cents bigint,
  p_currency char(3),
  p_payment_date date,
  p_note text,
  p_allocate_others boolean,
  p_actor_user_id uuid
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  actor_member_id uuid;
  strategy text;
  landlord_is_enabled boolean;
  bill record;
  current_share bigint;
  already_paid bigint;
  payer_share bigint;
  payer_share_paid bigint;
  amount_left bigint := p_amount_cents;
  to_pay bigint;
  settlement_uuid uuid;
  payment_uuid uuid;
  all_payment_uuid uuid := extensions.gen_random_uuid();
  rows_written integer := 0;
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
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'payment must be positive' using errcode = '23514';
  end if;
  select h.balance_strategy, h.landlord_enabled into strategy, landlord_is_enabled
  from public.households h where h.id = p_household_id for update;
  if p_allocate_others and (strategy <> 'super_simplified' or not landlord_is_enabled)
    and not exists (
      select 1 from public.expenses e
      join public.expense_shares s on s.expense_id = e.id
      join public.household_members m on m.id = s.member_id
      where e.household_id = p_household_id and e.paid_by_landlord and e.voided_at is null
        and e.currency = p_currency and m.removed_at is not null
        and s.share_cents > coalesce((
          select sum(lp.amount_cents) from public.landlord_payments lp
          where lp.expense_id = e.id and lp.member_id = s.member_id and lp.voided_at is null
        ), 0)
    ) then
    raise exception 'routed landlord payment is unavailable' using errcode = '23514';
  end if;

  for bill in
    select e.id as expense_id, e.title, e.currency, e.expense_date,
      s.member_id, s.share_cents
    from public.expenses e
    join public.expense_shares s on s.expense_id = e.id
      and s.household_id = e.household_id
    where e.household_id = p_household_id and e.paid_by_landlord
      and e.voided_at is null and e.currency = p_currency
      and (p_allocate_others or s.member_id = p_paying_member_id)
    order by case when p_allocate_others and exists (select 1 from public.household_members m
        where m.id = s.member_id and m.removed_at is not null) then 0
      when s.member_id = p_paying_member_id then 1 else 2 end,
      e.expense_date, e.id, s.member_id
  loop
    exit when amount_left = 0;
    perform 1 from public.expenses e where e.id = bill.expense_id for update;
    -- A completed contribution on this bill is immutable until its payment is voided.
    if bill.member_id <> p_paying_member_id then
      select s.share_cents into payer_share from public.expense_shares s
      where s.expense_id = bill.expense_id and s.household_id = p_household_id
        and s.member_id = p_paying_member_id;
      if payer_share is not null and payer_share > 0 then
        select coalesce(sum(lp.amount_cents), 0) into payer_share_paid
        from public.landlord_payments lp
        where lp.expense_id = bill.expense_id
          and lp.member_id = p_paying_member_id and lp.voided_at is null
          and lp.all_payment_id is distinct from all_payment_uuid;
        if payer_share_paid >= payer_share then continue; end if;
      end if;
    end if;
    select s.share_cents into current_share
    from public.expenses e join public.expense_shares s
      on s.expense_id = e.id and s.household_id = e.household_id
    where e.id = bill.expense_id and e.household_id = p_household_id
      and e.paid_by_landlord and e.voided_at is null
      and e.currency = p_currency and s.member_id = bill.member_id;
    if current_share is null then continue; end if;
    select coalesce(sum(lp.amount_cents), 0) into already_paid
    from public.landlord_payments lp
    where lp.expense_id = bill.expense_id and lp.member_id = bill.member_id
      and lp.voided_at is null;
    to_pay := least(amount_left, greatest(current_share - already_paid, 0));
    if to_pay = 0 then continue; end if;
    settlement_uuid := null;
    if bill.member_id <> p_paying_member_id then
      settlement_uuid := public.record_settlement(
        p_household_id, p_paying_member_id, bill.member_id,
        to_pay, p_currency, p_payment_date,
        coalesce(nullif(trim(p_note), ''), 'All balance payment to Landlord'),
        p_actor_user_id
      );
    end if;
    payment_uuid := extensions.gen_random_uuid();
    insert into public.landlord_payments (
      id, household_id, expense_id, member_id, amount_cents, payment_date,
      created_by, paid_by_member_id, linked_settlement_id, all_payment_id, note
    ) values (
      payment_uuid, p_household_id, bill.expense_id, bill.member_id, to_pay,
      p_payment_date, p_actor_user_id, p_paying_member_id, settlement_uuid,
      all_payment_uuid, nullif(trim(p_note), '')
    );
    insert into public.audit_events (
      household_id, actor_user_id, action_type, entity_type, entity_id,
      new_values, summary
    ) values (
      p_household_id, p_actor_user_id, 'created', 'landlord_payment', payment_uuid,
      jsonb_build_object(
        'expense_id', bill.expense_id, 'member_id', bill.member_id,
        'paid_by_member_id', p_paying_member_id, 'amount_cents', to_pay,
        'currency', p_currency, 'payment_date', p_payment_date,
        'title', bill.title, 'linked_settlement_id', settlement_uuid,
        'all_payment_id', all_payment_uuid
      ),
      format('paid Landlord %s %s for %s.',
        trim(to_char(to_pay / 100.0, 'FM999999990.00')), p_currency, bill.title)
    );
    amount_left := amount_left - to_pay;
    rows_written := rows_written + 1;
  end loop;
  if amount_left <> 0 then
    raise exception 'landlord balance changed; reload and try again' using errcode = '40001';
  end if;
  return rows_written;
end;
$$;
