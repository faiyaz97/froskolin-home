alter table public.households
  add column balance_strategy text not null default 'default'
  constraint households_balance_strategy_check
  check (balance_strategy in ('default', 'simplified', 'super_simplified'));

create function private.normalize_balance_strategy() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not new.landlord_enabled and new.balance_strategy = 'super_simplified' then
    new.balance_strategy := 'simplified';
  end if;
  return new;
end;
$$;

create trigger households_normalize_balance_strategy
before update of landlord_enabled, balance_strategy on public.households
for each row execute function private.normalize_balance_strategy();

alter table public.households add constraint households_super_simplified_requires_landlord
  check (balance_strategy <> 'super_simplified' or landlord_enabled);

grant select (balance_strategy), update (balance_strategy)
on public.households to authenticated;

-- Strategy is only a projection preference, so changing it does not append a
-- ledger/history event. The RPC updates that single column after checking admin.
create function public.set_balance_strategy(
  p_household_id uuid,
  p_strategy text,
  p_actor_user_id uuid
) returns text language plpgsql security definer set search_path = '' as $$
declare
  landlord_is_enabled boolean;
  selected_strategy text;
  previous_suppress text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id and m.user_id = p_actor_user_id
      and m.role = 'owner' and m.removed_at is null
  ) then
    raise exception 'admin required' using errcode = '42501';
  end if;
  if p_strategy is null or p_strategy not in ('default', 'simplified', 'super_simplified') then
    raise exception 'invalid balance strategy' using errcode = '23514';
  end if;
  select h.landlord_enabled into landlord_is_enabled
  from public.households h where h.id = p_household_id for update;
  if p_strategy = 'super_simplified' and not landlord_is_enabled then
    raise exception 'Landlord mode is required' using errcode = '23514';
  end if;
  previous_suppress := current_setting('app.suppress_audit', true);
  perform set_config('app.suppress_audit', 'true', true);
  update public.households set balance_strategy = p_strategy
  where id = p_household_id returning balance_strategy into selected_strategy;
  perform set_config('app.suppress_audit', coalesce(previous_suppress, 'false'), true);
  return selected_strategy;
end;
$$;

revoke all on function public.set_balance_strategy(uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.set_balance_strategy(uuid, text, uuid) to service_role;

-- An All payment can satisfy another member's landlord share. The linked member
-- settlement records who supplied that money, while the landlord payment reduces
-- the bill owner's outstanding share. Both rows are written in one transaction.
alter table public.settlements add constraint settlements_id_household_unique
  unique (id, household_id);
alter table public.landlord_payments
  add column paid_by_member_id uuid,
  add column linked_settlement_id uuid,
  add column all_payment_id uuid,
  add column note text,
  add constraint landlord_payments_actual_payer_fk
    foreign key (paid_by_member_id, household_id)
    references public.household_members(id, household_id) on delete restrict,
  add constraint landlord_payments_linked_settlement_fk
    foreign key (linked_settlement_id, household_id)
    references public.settlements(id, household_id) on delete restrict;

create unique index landlord_payments_linked_settlement_idx
  on public.landlord_payments (linked_settlement_id)
  where linked_settlement_id is not null;
create index landlord_payments_all_payment_idx
  on public.landlord_payments (all_payment_id)
  where all_payment_id is not null;

grant select (paid_by_member_id, linked_settlement_id, all_payment_id, note)
on public.landlord_payments to authenticated;

create function private.protect_linked_all_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) = 'service_role'
     and current_setting('app.allow_linked_all_void', true) = '1' then
    return new;
  end if;
  if tg_table_name = 'settlements' then
    -- The existing household-currency cascade updates linked settlements too.
    -- It changes only the currency; the linked payment amount/parties stay intact.
    if old.currency is distinct from new.currency
       and (to_jsonb(old) - 'currency') = (to_jsonb(new) - 'currency')
       and new.currency = (
         select h.default_currency from public.households h where h.id = old.household_id
       ) then
      return new;
    end if;
    if exists (
      select 1 from public.landlord_payments lp
      where lp.linked_settlement_id = old.id and lp.voided_at is null
    ) then
      raise exception 'linked All payments must be changed together' using errcode = '23514';
    end if;
  elsif tg_table_name = 'landlord_payments' then
    if old.all_payment_id is not null and exists (
       select 1 from public.landlord_payments lp
       join public.settlements s on s.id = lp.linked_settlement_id
       where lp.all_payment_id = old.all_payment_id
         and lp.voided_at is null and s.voided_at is null
    ) then
      raise exception 'linked All payments must be changed together' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger settlements_protect_linked_all_payment
before update on public.settlements
for each row execute function private.protect_linked_all_payment();
create trigger landlord_payments_protect_linked_all_payment
before update on public.landlord_payments
for each row execute function private.protect_linked_all_payment();

-- A bill with recorded payments cannot disappear or have its share math
-- replaced while those payments remain active. Reverse payments first.
create function private.protect_paid_landlord_bill() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'expenses' then
    if old.paid_by_landlord and (
      old.voided_at is distinct from new.voided_at
      or old.paid_by_landlord is distinct from new.paid_by_landlord
      or old.total_cents is distinct from new.total_cents
    ) and exists (
      select 1 from public.landlord_payments lp
      where lp.expense_id = old.id and lp.voided_at is null
    ) then
      raise exception 'reverse landlord payments before changing this bill'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'expense_shares' then
    if exists (
      select 1 from public.landlord_payments lp
      where lp.expense_id = old.expense_id and lp.voided_at is null
    ) then
      raise exception 'reverse landlord payments before changing bill shares'
        using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger expenses_protect_paid_landlord_bill
before update of voided_at, paid_by_landlord, total_cents on public.expenses
for each row execute function private.protect_paid_landlord_bill();
create trigger expense_shares_protect_paid_landlord_bill
before update or delete on public.expense_shares
for each row execute function private.protect_paid_landlord_bill();

create function private.guard_landlord_member_removal() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.removed_at is null and new.removed_at is not null and exists (
    select 1
    from public.expense_shares s
    join public.expenses e on e.id = s.expense_id
    where s.member_id = old.id and s.household_id = old.household_id
      and e.paid_by_landlord and e.voided_at is null
      and s.share_cents > coalesce((
        select sum(lp.amount_cents) from public.landlord_payments lp
        where lp.expense_id = s.expense_id and lp.member_id = old.id
          and lp.voided_at is null
      ), 0)
  ) then
    raise exception 'member must settle landlord balance before removal'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger household_members_guard_landlord_removal
before update of removed_at on public.household_members
for each row execute function private.guard_landlord_member_removal();

create function public.record_landlord_balance_payment(
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
  if p_allocate_others and (strategy <> 'super_simplified' or not landlord_is_enabled) then
    raise exception 'All balance strategy is unavailable' using errcode = '23514';
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
    order by case when s.member_id = p_paying_member_id then 0 else 1 end,
      e.expense_date, e.id, s.member_id
  loop
    exit when amount_left = 0;
    perform 1 from public.expenses e where e.id = bill.expense_id for update;
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

create function public.void_linked_all_payment(
  p_household_id uuid,
  p_settlement_id uuid,
  p_reason text,
  p_actor_user_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  linked_count integer;
  all_payment_uuid uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'a reason is required' using errcode = '23514';
  end if;
  perform 1 from public.settlements s
  where s.id = p_settlement_id and s.household_id = p_household_id
    and s.voided_at is null for update;
  if not found then
    raise exception 'payment is unavailable' using errcode = '42501';
  end if;
  select lp.all_payment_id into all_payment_uuid from public.landlord_payments lp
  where lp.linked_settlement_id = p_settlement_id
    and lp.household_id = p_household_id and lp.voided_at is null
  for update;
  if all_payment_uuid is null then
    raise exception 'linked payment is unavailable' using errcode = '23514';
  end if;
  select count(*) into linked_count from public.landlord_payments lp
  where lp.all_payment_id = all_payment_uuid
    and lp.household_id = p_household_id and lp.voided_at is null;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  perform set_config('app.allow_linked_all_void', '1', true);
  update public.landlord_payments
  set voided_at = now(), voided_by = p_actor_user_id, void_reason = p_reason
  where all_payment_id = all_payment_uuid
    and household_id = p_household_id and voided_at is null;
  update public.settlements
  set voided_at = now(), voided_by = p_actor_user_id,
      void_reason = p_reason, updated_by = p_actor_user_id
  where id in (
    select lp.linked_settlement_id from public.landlord_payments lp
    where lp.all_payment_id = all_payment_uuid
      and lp.household_id = p_household_id
      and lp.linked_settlement_id is not null
  ) and household_id = p_household_id
    and voided_at is null;
  perform set_config('app.allow_linked_all_void', '0', true);
  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id,
    previous_values, new_values, summary
  ) values (
    p_household_id, p_actor_user_id, 'reopened', 'landlord_payment', p_settlement_id,
    jsonb_build_object('paid', true, 'voided_payment_count', linked_count),
    jsonb_build_object('paid', false),
    'reversed an All balance payment to Landlord.'
  );
end;
$$;

revoke all on function public.record_landlord_balance_payment(uuid, uuid, bigint, char, date, text, boolean, uuid)
from public, anon, authenticated;
grant execute on function public.record_landlord_balance_payment(uuid, uuid, bigint, char, date, text, boolean, uuid)
to service_role;
revoke all on function public.void_linked_all_payment(uuid, uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.void_linked_all_payment(uuid, uuid, text, uuid)
to service_role;
