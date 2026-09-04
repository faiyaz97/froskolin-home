alter table public.households
  add column landlord_enabled boolean not null default false;

alter table public.expenses
  alter column payer_member_id drop not null,
  add column paid_by_landlord boolean not null default false,
  add constraint expenses_exactly_one_payer check (
    (paid_by_landlord and payer_member_id is null)
    or (not paid_by_landlord and payer_member_id is not null)
  );

alter table public.recurring_expense_rules
  alter column payer_member_id drop not null,
  add column paid_by_landlord boolean not null default false,
  add constraint recurring_rules_exactly_one_payer check (
    (paid_by_landlord and payer_member_id is null)
    or (not paid_by_landlord and payer_member_id is not null)
  );

create table public.landlord_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  expense_id uuid not null,
  member_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  payment_date date not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  void_reason text,
  check (voided_at is null or void_reason is not null),
  foreign key (expense_id, household_id)
    references public.expenses(id, household_id) on delete restrict,
  foreign key (member_id, household_id)
    references public.household_members(id, household_id) on delete restrict
);

create index landlord_payments_member_idx
  on public.landlord_payments (household_id, member_id, payment_date desc)
  where voided_at is null;
create index landlord_payments_expense_idx
  on public.landlord_payments (expense_id, member_id, created_at)
  where voided_at is null;

create or replace function private.validate_landlord_payer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare landlord_is_enabled boolean;
begin
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

create trigger expenses_validate_landlord_payer
before insert or update of payer_member_id, paid_by_landlord, recurring_rule_id
on public.expenses for each row execute function private.validate_landlord_payer();

create trigger recurring_rules_validate_landlord_payer
before insert or update of payer_member_id, paid_by_landlord
on public.recurring_expense_rules for each row execute function private.validate_landlord_payer();

create or replace function private.guard_landlord_disable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.landlord_enabled and not new.landlord_enabled and exists (
    select 1 from public.recurring_expense_rules r
    where r.household_id = new.id and r.paid_by_landlord
      and r.active and r.archived_at is null
  ) then
    raise exception 'change or archive landlord-paid recurring expenses before disabling the landlord'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger households_guard_landlord_disable
before update of landlord_enabled on public.households
for each row execute function private.guard_landlord_disable();

create or replace view public.household_balances with (security_invoker = true) as
with ledger_entries as (
  select e.household_id, e.payer_member_id as member_id, e.currency, e.total_cents as delta_cents
  from public.expenses e
  where e.voided_at is null and not e.paid_by_landlord
  union all
  select e.household_id, s.member_id, e.currency, -s.share_cents
  from public.expense_shares s
  join public.expenses e on e.id = s.expense_id
  where e.voided_at is null and not e.paid_by_landlord
  union all
  select s.household_id, s.paying_member_id, s.currency, s.amount_cents
  from public.settlements s where s.voided_at is null
  union all
  select s.household_id, s.receiving_member_id, s.currency, -s.amount_cents
  from public.settlements s where s.voided_at is null
)
select household_id, member_id, currency, sum(delta_cents)::bigint as net_cents
from ledger_entries
group by household_id, member_id, currency;

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
  if p_paid_by_landlord then
    update public.expenses set payer_member_id = null, paid_by_landlord = true
    where id = expense_uuid;
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
  p_actor_user_id uuid
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
    paid_by_landlord = p_paid_by_landlord
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

create function public.create_utility_bill_with_landlord_support(
  p_household_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
  p_paid_by_landlord boolean,
  p_expense_date date,
  p_split_config jsonb,
  p_shares jsonb,
  p_utility_type public.utility_type,
  p_supplier text,
  p_issue_date date,
  p_service_start_date date,
  p_service_end_date date,
  p_fixed_cents bigint,
  p_variable_cents bigint,
  p_consumption_amount numeric default null,
  p_consumption_unit text default null,
  p_bill_document_id uuid default null,
  p_classification_note text default null,
  p_variable_split_mode public.variable_split_mode default 'occupancy',
  p_actor_user_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  expense_uuid uuid;
  temporary_payer uuid;
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
  expense_uuid := public.create_utility_bill_with_shares(
    p_household_id, p_title, p_total_cents, p_currency,
    case when p_paid_by_landlord then temporary_payer else p_payer_member_id end,
    p_expense_date, p_split_config, p_shares, p_utility_type, p_supplier,
    p_issue_date, p_service_start_date, p_service_end_date, p_fixed_cents,
    p_variable_cents, p_consumption_amount, p_consumption_unit,
    p_bill_document_id, p_classification_note, p_variable_split_mode, p_actor_user_id
  );
  if p_paid_by_landlord then
    update public.expenses set payer_member_id = null, paid_by_landlord = true
    where id = expense_uuid;
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
      case when p_paid_by_landlord then 'Landlord' else 'a household member' end)
  );
  return expense_uuid;
end;
$$;

create function public.replace_utility_bill_with_landlord_support(
  p_expense_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
  p_paid_by_landlord boolean,
  p_expense_date date,
  p_split_config jsonb,
  p_shares jsonb,
  p_utility_type public.utility_type,
  p_supplier text,
  p_issue_date date,
  p_service_start_date date,
  p_service_end_date date,
  p_fixed_cents bigint,
  p_variable_cents bigint,
  p_consumption_amount numeric default null,
  p_consumption_unit text default null,
  p_classification_note text default null,
  p_variable_split_mode public.variable_split_mode default 'occupancy',
  p_actor_user_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  target_household_id uuid;
  temporary_payer uuid;
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
    raise exception 'utility bill is unavailable' using errcode = '42501';
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
  perform public.replace_utility_bill_with_shares(
    p_expense_id, p_title, p_total_cents, p_currency,
    case when p_paid_by_landlord then temporary_payer else p_payer_member_id end,
    p_expense_date, p_split_config, p_shares, p_utility_type, p_supplier,
    p_issue_date, p_service_start_date, p_service_end_date, p_fixed_cents,
    p_variable_cents, p_consumption_amount, p_consumption_unit,
    p_classification_note, p_variable_split_mode, p_actor_user_id
  );
  update public.expenses set
    payer_member_id = case when p_paid_by_landlord then null else p_payer_member_id end,
    paid_by_landlord = p_paid_by_landlord
  where id = p_expense_id;
  perform set_config('app.suppress_audit', 'false', true);
  select private.safe_audit_snapshot(to_jsonb(e), 'expense') into final_snapshot
  from public.expenses e where e.id = p_expense_id;
  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id,
    previous_values, new_values, summary
  ) values (
    target_household_id, p_actor_user_id, 'updated', 'expense', p_expense_id,
    previous_snapshot, final_snapshot,
    format('updated %s, paid by %s.', p_title,
      case when p_paid_by_landlord then 'Landlord' else 'a household member' end)
  );
end;
$$;

create function public.record_landlord_payment(
  p_household_id uuid,
  p_expense_id uuid,
  p_amount_cents bigint,
  p_payment_date date,
  p_mark_as_paid boolean,
  p_actor_user_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  payment_uuid uuid := extensions.gen_random_uuid();
  actor_member_id uuid;
  bill_title text;
  bill_currency char(3);
  original_share bigint;
  already_paid bigint;
  remaining bigint;
  amount_to_record bigint;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  select m.id into actor_member_id from public.household_members m
  where m.household_id = p_household_id and m.user_id = p_actor_user_id and m.removed_at is null;

  select e.title, e.currency, s.share_cents
    into bill_title, bill_currency, original_share
  from public.expenses e
  join public.expense_shares s on s.expense_id = e.id and s.household_id = e.household_id
  where e.id = p_expense_id and e.household_id = p_household_id
    and e.paid_by_landlord and e.voided_at is null and s.member_id = actor_member_id
  for update of e;
  if original_share is null then
    raise exception 'landlord-paid expense is unavailable' using errcode = '42501';
  end if;

  select coalesce(sum(lp.amount_cents), 0) into already_paid
  from public.landlord_payments lp
  where lp.expense_id = p_expense_id and lp.member_id = actor_member_id and lp.voided_at is null;
  remaining := greatest(original_share - already_paid, 0);
  amount_to_record := case when p_mark_as_paid then remaining else p_amount_cents end;
  if amount_to_record is null or amount_to_record <= 0 or amount_to_record > remaining then
    raise exception 'payment must be positive and no more than the remaining balance'
      using errcode = '23514';
  end if;

  insert into public.landlord_payments (
    id, household_id, expense_id, member_id, amount_cents, payment_date, created_by
  ) values (
    payment_uuid, p_household_id, p_expense_id, actor_member_id,
    amount_to_record, p_payment_date, p_actor_user_id
  );
  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id, new_values, summary
  ) values (
    p_household_id, p_actor_user_id,
    case when p_mark_as_paid then 'marked_paid' else 'created' end,
    'landlord_payment', payment_uuid,
    jsonb_build_object(
      'expense_id', p_expense_id, 'member_id', actor_member_id,
      'amount_cents', amount_to_record, 'currency', bill_currency,
      'payment_date', p_payment_date, 'title', bill_title,
      'marked_paid', p_mark_as_paid
    ),
    case when p_mark_as_paid
      then format('marked %s as paid.', bill_title)
      else format('paid Landlord %s %s for %s.',
        trim(to_char(amount_to_record / 100.0, 'FM999999990.00')),
        bill_currency, bill_title)
    end
  );
  return payment_uuid;
end;
$$;

alter table public.landlord_payments enable row level security;
create policy landlord_payments_read_member on public.landlord_payments
for select to authenticated
using ((select private.is_active_household_member(household_id)));

grant select (landlord_enabled), update (landlord_enabled) on public.households to authenticated;
grant select on public.landlord_payments to authenticated;
revoke all on function public.create_expense_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, public.expense_kind, public.split_method, jsonb, jsonb, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.replace_expense_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, public.split_method, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.create_utility_bill_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, uuid, text, public.variable_split_mode, uuid) from public, anon, authenticated;
revoke all on function public.replace_utility_bill_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, text, public.variable_split_mode, uuid) from public, anon, authenticated;
revoke all on function public.record_landlord_payment(uuid, uuid, bigint, date, boolean, uuid) from public, anon, authenticated;
grant execute on function public.create_expense_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, public.expense_kind, public.split_method, jsonb, jsonb, uuid, uuid, date) to service_role;
grant execute on function public.replace_expense_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, public.split_method, jsonb, jsonb, uuid) to service_role;
grant execute on function public.create_utility_bill_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, uuid, text, public.variable_split_mode, uuid) to service_role;
grant execute on function public.replace_utility_bill_with_landlord_support(uuid, text, bigint, char, uuid, boolean, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, text, public.variable_split_mode, uuid) to service_role;
grant execute on function public.record_landlord_payment(uuid, uuid, bigint, date, boolean, uuid) to service_role;
