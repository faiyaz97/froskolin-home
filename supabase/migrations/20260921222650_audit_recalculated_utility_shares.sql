-- Record automatic share recalculations as expense changes with complete before/after
-- share snapshots. The utility row itself does not materially change, so suppress its
-- otherwise empty trigger-generated activity event.
create or replace function private.replace_absences_and_utility_shares(
  p_household_id uuid,
  p_member_id uuid,
  p_ranges jsonb,
  p_utility_updates jsonb,
  p_expected_absences jsonb,
  p_actor_user_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  range_row jsonb;
  update_row jsonb;
  share_row jsonb;
  target_expense_id uuid;
  shares_sum bigint;
  target_total bigint;
  stale_inputs boolean;
  expense_row public.expenses%rowtype;
  previous_shares jsonb;
  next_shares jsonb;
  previous_snapshot jsonb;
  next_snapshot jsonb;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id and m.user_id = p_actor_user_id and m.removed_at is null
      and (m.id = p_member_id or m.role = 'owner')
  ) then
    raise exception 'not permitted to change these absences' using errcode = '42501';
  end if;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  if jsonb_typeof(p_ranges) <> 'array' or jsonb_typeof(p_utility_updates) <> 'array' or jsonb_typeof(p_expected_absences) <> 'array' then
    raise exception 'ranges, utility updates and expected absences must be arrays' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text, 0));
  with relevant_members as (
    select distinct (shares.value->>'member_id')::uuid as member_id
    from jsonb_array_elements(p_utility_updates) as updates(value)
    cross join lateral jsonb_array_elements(updates.value->'shares') as shares(value)
    where (shares.value->>'member_id')::uuid <> p_member_id
  ), current_ranges as (
    select a.member_id, a.start_date, a.end_date
    from public.absence_periods a join relevant_members r on r.member_id = a.member_id
    where a.household_id = p_household_id and a.voided_at is null
  ), expected_ranges as (
    select (value->>'member_id')::uuid as member_id,
      (value->>'start_date')::date as start_date,
      (value->>'end_date')::date as end_date
    from jsonb_array_elements(p_expected_absences)
  )
  select exists (
    (select * from current_ranges except select * from expected_ranges)
    union all
    (select * from expected_ranges except select * from current_ranges)
  ) into stale_inputs;
  if stale_inputs then raise exception 'absence data changed; recalculate and retry' using errcode = '40001'; end if;

  update public.absence_periods set voided_at = now(), voided_by = p_actor_user_id, updated_by = p_actor_user_id
  where household_id = p_household_id and member_id = p_member_id and voided_at is null;
  for range_row in select value from jsonb_array_elements(p_ranges) loop
    insert into public.absence_periods (household_id, member_id, start_date, end_date, created_by, updated_by)
    values (p_household_id, p_member_id, (range_row->>'start_date')::date, (range_row->>'end_date')::date, p_actor_user_id, p_actor_user_id);
  end loop;

  for update_row in select value from jsonb_array_elements(p_utility_updates) loop
    target_expense_id := (update_row->>'expense_id')::uuid;
    select e.* into expense_row
    from public.expenses e join public.utility_bills u on u.expense_id = e.id
    where e.id = target_expense_id and e.household_id = p_household_id and e.voided_at is null;
    if expense_row.id is null then raise exception 'utility expense is unavailable' using errcode = '42501'; end if;
    target_total := expense_row.total_cents;
    select coalesce(sum((value->>'share_cents')::bigint), 0) into shares_sum
    from jsonb_array_elements(update_row->'shares');
    if shares_sum <> target_total then raise exception 'utility shares must total expense' using errcode = '23514'; end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'member_id', s.member_id,
          'share_cents', s.share_cents,
          'fixed_share_cents', s.fixed_share_cents,
          'variable_share_cents', s.variable_share_cents,
          'presence_days', s.presence_days,
          'allocation_order', s.allocation_order
        ) order by s.allocation_order
      ),
      '[]'::jsonb
    ) into previous_shares
    from public.expense_shares s
    where s.expense_id = target_expense_id;
    next_shares := update_row->'shares';
    previous_snapshot := private.safe_audit_snapshot(to_jsonb(expense_row), 'expense');
    previous_snapshot := jsonb_set(
      previous_snapshot,
      '{split_config}',
      coalesce(previous_snapshot->'split_config', '{}'::jsonb) || jsonb_build_object('shares', previous_shares),
      true
    );

    delete from public.expense_shares where expense_id = target_expense_id;
    for share_row in select value from jsonb_array_elements(next_shares) loop
      insert into public.expense_shares (expense_id, household_id, member_id, share_cents, fixed_share_cents, variable_share_cents, presence_days, allocation_order)
      values (target_expense_id, p_household_id, (share_row->>'member_id')::uuid, (share_row->>'share_cents')::bigint,
        nullif(share_row->>'fixed_share_cents', '')::bigint, nullif(share_row->>'variable_share_cents', '')::bigint,
        nullif(share_row->>'presence_days', '')::integer, (share_row->>'allocation_order')::smallint);
    end loop;

    perform set_config('app.suppress_audit', 'true', true);
    update public.utility_bills set updated_at = now(),
      variable_split_mode = coalesce(nullif(update_row->>'variable_split_mode', '')::public.variable_split_mode, variable_split_mode)
    where expense_id = target_expense_id;
    perform set_config('app.suppress_audit', 'false', true);

    if previous_shares is distinct from next_shares then
      next_snapshot := jsonb_set(
        previous_snapshot,
        '{split_config}',
        coalesce(previous_snapshot->'split_config', '{}'::jsonb) || jsonb_build_object('shares', next_shares),
        true
      );
      insert into public.audit_events (
        household_id, actor_user_id, action_type, entity_type, entity_id,
        previous_values, new_values, summary
      ) values (
        p_household_id, p_actor_user_id, 'updated', 'expense', target_expense_id,
        previous_snapshot, next_snapshot,
        format('Updated %s shares after away dates changed.', expense_row.title)
      );
    end if;
  end loop;
end;
$$;
