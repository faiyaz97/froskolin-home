-- Billing dates are date-only; joined_at remains the immutable account-join timestamp.
alter table public.household_members add column in_date date;
alter table public.household_members add column out_date date;

do $$
begin
  perform set_config('app.suppress_audit', 'true', true);
  update public.household_members m
  set in_date = (m.joined_at at time zone h.timezone)::date
  from public.households h
  where h.id = m.household_id;
  perform set_config('app.suppress_audit', 'false', true);
end;
$$;

alter table public.household_members alter column in_date set not null;
alter table public.household_members add constraint household_members_billing_dates_order
  check (out_date is null or out_date >= in_date);

create function private.set_member_in_date() returns trigger
language plpgsql security definer set search_path = '' as $$
declare group_timezone text;
begin
  select h.timezone into group_timezone from public.households h where h.id = new.household_id;
  if group_timezone is null then raise exception 'group is unavailable' using errcode = '23503'; end if;
  new.in_date := (now() at time zone group_timezone)::date;
  return new;
end;
$$;

create trigger household_members_default_in_date before insert on public.household_members
for each row execute function private.set_member_in_date();

-- Billing dates and removal are written only through checked, atomic service RPCs.
revoke update on public.household_members from authenticated;
grant update (display_name, avatar_color) on public.household_members to authenticated;

create or replace function private.assert_member_removal_allowed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare strategy text;
landlord_is_enabled boolean;
begin
  if new.household_id is distinct from old.household_id or new.user_id is distinct from old.user_id then
    raise exception 'membership identity cannot be changed' using errcode = '23514';
  end if;
  if old.removed_at is null and new.removed_at is not null then
    select h.balance_strategy, h.landlord_enabled into strategy, landlord_is_enabled
    from public.households h where h.id = old.household_id;
    if strategy = 'super_simplified' and landlord_is_enabled then
      if exists (
        with group_balances as (
          select b.currency, b.net_cents from public.household_balances b
          where b.household_id = old.household_id and b.member_id = old.id
        ), landlord_balances as (
          select e.currency,
            sum(s.share_cents - coalesce((
              select sum(lp.amount_cents) from public.landlord_payments lp
              where lp.expense_id = e.id and lp.member_id = old.id and lp.voided_at is null
            ), 0))::bigint as due_cents
          from public.expenses e join public.expense_shares s on s.expense_id = e.id
          where e.household_id = old.household_id and e.voided_at is null
            and e.paid_by_landlord and s.member_id = old.id
          group by e.currency
        )
        select 1 from group_balances g full join landlord_balances l using (currency)
        where coalesce(g.net_cents, 0) - coalesce(l.due_cents, 0) <> 0
      ) then
        raise exception 'member must settle combined balance before removal' using errcode = '23514';
      end if;
    else
      if exists (
        select 1 from public.expenses e join public.expense_shares s on s.expense_id = e.id
        where e.household_id = old.household_id and e.voided_at is null
          and e.paid_by_landlord and s.member_id = old.id
          and s.share_cents > coalesce((
            select sum(lp.amount_cents) from public.landlord_payments lp
            where lp.expense_id = e.id and lp.member_id = old.id and lp.voided_at is null
          ), 0)
      ) then
        raise exception 'member must settle landlord balance before removal' using errcode = '23514';
      end if;
      if strategy = 'default' then
        if exists (
          select 1 from public.household_pair_balances p
          where p.household_id = old.household_id
            and (p.paying_member_id = old.id or p.receiving_member_id = old.id)
        ) then
          raise exception 'member must settle direct debts before removal' using errcode = '23514';
        end if;
      elsif exists (
        select 1 from public.household_balances b
        where b.household_id = old.household_id and b.member_id = old.id and b.net_cents <> 0
      ) then
        raise exception 'member must settle group balance before removal' using errcode = '23514';
      end if;
    end if;
    if exists (
      select 1 from public.recurring_expense_rules r
      where r.household_id = old.household_id and r.active and r.archived_at is null
        and (r.payer_member_id = old.id or r.split_config::text like '%' || old.id::text || '%')
    ) then
      raise exception 'member is still part of an active recurring rule' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger household_members_guard_landlord_removal on public.household_members;

create function public.apply_member_billing_dates(
  p_household_id uuid,
  p_member_id uuid,
  p_in_date date,
  p_out_date date,
  p_expected_in_date date,
  p_expected_out_date date,
  p_utility_updates jsonb,
  p_remove boolean,
  p_actor_user_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid;
actor_role public.member_role;
target_role public.member_role;
previous_in_date date;
previous_out_date date;
exit_day date;
update_row jsonb;
share_row jsonb;
expense_row public.expenses%rowtype;
previous_shares jsonb;
next_shares jsonb;
previous_snapshot jsonb;
shares_sum bigint;
snapshot_dates jsonb;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if p_utility_updates is null or jsonb_typeof(p_utility_updates) <> 'array' then
    raise exception 'invalid utility updates' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text, 0));
  select m.id, m.role into actor_id, actor_role from public.household_members m
  where m.household_id = p_household_id and m.user_id = p_actor_user_id and m.removed_at is null;
  if actor_id is null then raise exception 'active member required' using errcode = '42501'; end if;
  select m.role, m.in_date, m.out_date into target_role, previous_in_date, previous_out_date
  from public.household_members m
  where m.id = p_member_id and m.household_id = p_household_id and m.removed_at is null for update;
  if target_role is null then raise exception 'member is unavailable' using errcode = '42501'; end if;
  if (not p_remove and actor_role <> 'owner') or
     (p_remove and actor_id <> p_member_id and actor_role <> 'owner') or
     (p_remove and actor_id <> p_member_id and target_role = 'owner') then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if previous_in_date is distinct from p_expected_in_date or
     previous_out_date is distinct from p_expected_out_date then
    raise exception 'member dates changed; reload and try again' using errcode = '40001';
  end if;
  if p_in_date is null or (p_out_date is not null and p_out_date < p_in_date) then
    raise exception 'invalid billing dates' using errcode = '23514';
  end if;
  if p_remove then
    select (now() at time zone h.timezone)::date into exit_day
    from public.households h where h.id = p_household_id for update;
    if p_in_date > exit_day then raise exception 'in date is after exit day' using errcode = '23514'; end if;
    if p_out_date is distinct from (case
      when previous_out_date is null or previous_out_date > exit_day then exit_day
      else previous_out_date end) then
      raise exception 'exit date changed; reload and try again' using errcode = '40001';
    end if;
  end if;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  update public.household_members set in_date = p_in_date, out_date = p_out_date
  where id = p_member_id and household_id = p_household_id;

  if (
    select coalesce(jsonb_agg(u.expense_id order by u.expense_id), '[]'::jsonb)
    from public.utility_bills u
    join public.expenses e on e.id = u.expense_id and e.voided_at is null
    join public.expense_shares s on s.expense_id = u.expense_id and s.member_id = p_member_id
    where u.household_id = p_household_id
      and (daterange(u.service_start_date, u.service_end_date, '[]') *
           daterange(previous_in_date, previous_out_date, '[]')) is distinct from
          (daterange(u.service_start_date, u.service_end_date, '[]') *
           daterange(p_in_date, p_out_date, '[]'))
  ) is distinct from (
    select coalesce(jsonb_agg((value->>'expense_id')::uuid order by (value->>'expense_id')::uuid), '[]'::jsonb)
    from jsonb_array_elements(p_utility_updates)
  ) then
    raise exception 'utility bills changed; reload and try again' using errcode = '40001';
  end if;

  for update_row in select value from jsonb_array_elements(p_utility_updates) loop
    select e.* into expense_row from public.expenses e
    join public.utility_bills u on u.expense_id = e.id
    where e.id = (update_row->>'expense_id')::uuid and e.household_id = p_household_id
      and e.voided_at is null for update;
    if expense_row.id is null then raise exception 'utility bill changed; reload and try again' using errcode = '40001'; end if;
    if exists (select 1 from public.utility_bills u where u.expense_id = expense_row.id
      and (u.service_start_date is distinct from (update_row->>'expected_service_start')::date
        or u.service_end_date is distinct from (update_row->>'expected_service_end')::date
        or u.total_cents is distinct from (update_row->>'expected_total_cents')::bigint
        or u.fixed_cents is distinct from (update_row->>'expected_fixed_cents')::bigint
        or u.variable_cents is distinct from (update_row->>'expected_variable_cents')::bigint)) then
      raise exception 'utility bill changed; reload and try again' using errcode = '40001';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'member_id', s.member_id, 'share_cents', s.share_cents,
      'fixed_share_cents', s.fixed_share_cents, 'variable_share_cents', s.variable_share_cents,
      'presence_days', s.presence_days, 'allocation_order', s.allocation_order
    ) order by s.allocation_order), '[]'::jsonb) into previous_shares
    from public.expense_shares s where s.expense_id = expense_row.id;
    if previous_shares is distinct from update_row->'expected_shares' then
      raise exception 'utility shares changed; reload and try again' using errcode = '40001';
    end if;
    next_shares := update_row->'shares';
    if jsonb_typeof(next_shares) <> 'array' then raise exception 'invalid utility shares' using errcode = '22023'; end if;
    select coalesce(sum((value->>'share_cents')::bigint), 0) into shares_sum
    from jsonb_array_elements(next_shares);
    if shares_sum <> expense_row.total_cents then
      raise exception 'utility shares must total expense' using errcode = '23514';
    end if;
    if previous_shares is distinct from next_shares then
      if exists (select 1 from public.landlord_payments lp
        where lp.expense_id = expense_row.id and lp.voided_at is null) then
        raise exception 'reverse landlord payments before changing bill shares' using errcode = '23514';
      end if;
      previous_snapshot := private.safe_audit_snapshot(to_jsonb(expense_row), 'expense');
      previous_snapshot := jsonb_set(previous_snapshot, '{split_config}',
        coalesce(previous_snapshot->'split_config', '{}'::jsonb) ||
        jsonb_build_object('shares', previous_shares), true);
      delete from public.expense_shares where expense_id = expense_row.id;
      for share_row in select value from jsonb_array_elements(next_shares) loop
        insert into public.expense_shares (
          expense_id, household_id, member_id, share_cents,
          fixed_share_cents, variable_share_cents, presence_days, allocation_order
        ) values (
          expense_row.id, p_household_id, (share_row->>'member_id')::uuid,
          (share_row->>'share_cents')::bigint, (share_row->>'fixed_share_cents')::bigint,
          (share_row->>'variable_share_cents')::bigint, (share_row->>'presence_days')::integer,
          (share_row->>'allocation_order')::smallint
        );
      end loop;
      perform set_config('app.suppress_audit', 'true', true);
      update public.utility_bills set
        variable_split_mode = (update_row->>'variable_split_mode')::public.variable_split_mode,
        updated_at = now()
      where expense_id = expense_row.id;
      perform set_config('app.suppress_audit', 'false', true);
      insert into public.audit_events (
        household_id, actor_user_id, action_type, entity_type, entity_id,
        previous_values, new_values, summary
      ) values (
        p_household_id, p_actor_user_id, 'updated', 'expense', expense_row.id,
        previous_snapshot,
        jsonb_set(previous_snapshot, '{split_config}',
          coalesce(previous_snapshot->'split_config', '{}'::jsonb) ||
          jsonb_build_object('shares', next_shares), true),
        format('Updated %s shares after member billing dates changed.', expense_row.title)
      );
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'memberId', s.member_id, 'inDate', m.in_date, 'outDate', m.out_date
    ) order by s.allocation_order), '[]'::jsonb) into snapshot_dates
    from public.expense_shares s join public.household_members m on m.id = s.member_id
    where s.expense_id = expense_row.id;
    perform set_config('app.suppress_audit', 'true', true);
    update public.expenses set split_config = jsonb_set(
      split_config, '{billingDates}', snapshot_dates, true
    ) where id = expense_row.id;
    perform set_config('app.suppress_audit', 'false', true);
  end loop;
  if p_remove then
    update public.household_members set removed_at = now(), removed_by = p_actor_user_id
    where id = p_member_id and household_id = p_household_id;
  end if;
end;
$$;

revoke all on function public.apply_member_billing_dates(
  uuid, uuid, date, date, date, date, jsonb, boolean, uuid
) from public, anon, authenticated;
grant execute on function public.apply_member_billing_dates(
  uuid, uuid, date, date, date, date, jsonb, boolean, uuid
) to service_role;
