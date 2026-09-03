-- Froskolin Home: small, household-scoped financial ledger.
-- Financial rows are soft-voided rather than deleted. Money is always integer cents.

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create type public.member_role as enum ('owner', 'member');
create type public.expense_kind as enum ('manual', 'utility', 'recurring');
create type public.split_method as enum ('equal', 'exact', 'percentage', 'utility');
create type public.document_status as enum ('uploaded', 'extracting', 'ready', 'failed', 'confirmed');
create type public.utility_type as enum ('electricity', 'gas', 'water', 'internet', 'other');
create type public.variable_split_mode as enum ('occupancy', 'equal_zero_presence_fallback');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'en-GB' check (locale ~ '^[A-Za-z]{2,3}([-_][A-Za-z]{2,4})?$'),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Authentication aliases are intentionally inaccessible to PostgREST.
create table private.auth_aliases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_alias text not null unique,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  default_currency char(3) not null default 'EUR' check (default_currency ~ '^[A-Z]{3}$'),
  locale text not null default 'en-GB',
  timezone text not null default 'UTC',
  access_code_digest text not null,
  joining_enabled boolean not null default true,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, created_by)
);
create unique index households_access_code_digest_idx on public.households (access_code_digest);

create table public.household_members (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  display_name_normalized text generated always as (lower(btrim(display_name))) stored,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create unique index household_members_one_active_household_per_user
  on public.household_members (user_id) where removed_at is null;
create unique index household_members_active_display_name_unique
  on public.household_members (household_id, display_name_normalized) where removed_at is null;
create unique index household_members_one_active_owner
  on public.household_members (household_id) where role = 'owner' and removed_at is null;
create index household_members_household_active_idx on public.household_members (household_id, joined_at) where removed_at is null;

create table public.absence_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  member_id uuid not null,
  start_date date not null,
  end_date date not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  check (start_date <= end_date),
  foreign key (member_id, household_id) references public.household_members(id, household_id) on delete restrict
);
alter table public.absence_periods add constraint absence_periods_no_active_overlap
  exclude using gist (member_id with =, daterange(start_date, end_date, '[]') with &&)
  where (voided_at is null);
create index absence_periods_household_member_dates_idx on public.absence_periods (household_id, member_id, start_date) where voided_at is null;

create table public.recurring_expense_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  payer_member_id uuid not null,
  split_method public.split_method not null check (split_method <> 'utility'),
  split_config jsonb not null check (jsonb_typeof(split_config) = 'object'),
  anchor_date date not null,
  end_date date,
  next_due_date date not null,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= anchor_date),
  foreign key (payer_member_id, household_id) references public.household_members(id, household_id) on delete restrict,
  unique (id, household_id)
);
create index recurring_rules_due_idx on public.recurring_expense_rules (next_due_date, household_id) where active and archived_at is null;
create index recurring_rules_household_idx on public.recurring_expense_rules (household_id, created_at);

create table public.expenses (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  total_cents bigint not null check (total_cents > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  payer_member_id uuid not null,
  expense_date date not null,
  kind public.expense_kind not null default 'manual',
  split_method public.split_method not null,
  split_config jsonb not null default '{}'::jsonb check (jsonb_typeof(split_config) = 'object'),
  recurring_rule_id uuid,
  occurrence_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  void_reason text,
  check ((kind = 'recurring') = (recurring_rule_id is not null and occurrence_date is not null)),
  check (voided_at is null or void_reason is not null),
  foreign key (payer_member_id, household_id) references public.household_members(id, household_id) on delete restrict,
  foreign key (recurring_rule_id, household_id) references public.recurring_expense_rules(id, household_id) on delete restrict,
  unique (id, household_id),
  unique (recurring_rule_id, occurrence_date)
);
create index expenses_household_date_idx on public.expenses (household_id, expense_date desc, created_at desc) where voided_at is null;
create index expenses_payer_idx on public.expenses (payer_member_id, expense_date desc) where voided_at is null;
create index expenses_rule_idx on public.expenses (recurring_rule_id, occurrence_date) where recurring_rule_id is not null;

create table public.expense_shares (
  expense_id uuid not null,
  household_id uuid not null,
  member_id uuid not null,
  share_cents bigint not null check (share_cents >= 0),
  fixed_share_cents bigint check (fixed_share_cents is null or fixed_share_cents >= 0),
  variable_share_cents bigint check (variable_share_cents is null or variable_share_cents >= 0),
  presence_days integer check (presence_days is null or presence_days >= 0),
  allocation_order smallint not null check (allocation_order >= 0),
  created_at timestamptz not null default now(),
  primary key (expense_id, member_id),
  unique (expense_id, allocation_order),
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete restrict,
  foreign key (member_id, household_id) references public.household_members(id, household_id) on delete restrict,
  check (fixed_share_cents is null or variable_share_cents is null or fixed_share_cents + variable_share_cents = share_cents)
);
create index expense_shares_member_idx on public.expense_shares (member_id, household_id);
create index expense_shares_household_expense_idx on public.expense_shares (household_id, expense_id);

create table public.bill_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  uploader_user_id uuid not null references auth.users(id) on delete restrict,
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[^/]+$'),
  detected_mime text not null check (detected_mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  byte_count integer not null check (byte_count > 0 and byte_count <= 4194304),
  page_count smallint check (page_count is null or page_count between 1 and 10),
  status public.document_status not null default 'uploaded',
  gemini_consent_at timestamptz,
  extraction jsonb check (extraction is null or jsonb_typeof(extraction) = 'object'),
  confidence jsonb check (confidence is null or jsonb_typeof(confidence) = 'object'),
  evidence jsonb check (evidence is null or jsonb_typeof(evidence) = 'object'),
  provider text,
  model text,
  extraction_schema_version text,
  sanitized_error text,
  object_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);
create index bill_documents_household_created_idx on public.bill_documents (household_id, created_at desc);
create index bill_documents_uploader_idx on public.bill_documents (uploader_user_id);

create table public.utility_bills (
  expense_id uuid primary key,
  household_id uuid not null,
  utility_type public.utility_type not null,
  supplier text,
  issue_date date,
  service_start_date date not null,
  service_end_date date not null,
  total_cents bigint not null check (total_cents > 0),
  fixed_cents bigint not null check (fixed_cents >= 0),
  variable_cents bigint not null check (variable_cents >= 0),
  consumption_amount numeric,
  consumption_unit text,
  bill_document_id uuid references public.bill_documents(id) on delete restrict,
  classification_note text,
  variable_split_mode public.variable_split_mode not null default 'occupancy',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (service_start_date <= service_end_date),
  check (fixed_cents + variable_cents = total_cents),
  foreign key (expense_id, household_id) references public.expenses(id, household_id) on delete restrict,
  foreign key (bill_document_id, household_id) references public.bill_documents(id, household_id) on delete restrict
);
create index utility_bills_document_idx on public.utility_bills (bill_document_id) where bill_document_id is not null;
create unique index utility_bills_one_expense_per_document_idx on public.utility_bills (bill_document_id) where bill_document_id is not null;
create index utility_bills_service_period_idx on public.utility_bills (household_id, service_start_date, service_end_date);

create table public.settlements (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  paying_member_id uuid not null,
  receiving_member_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  settlement_date date not null,
  note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete restrict,
  void_reason text,
  check (paying_member_id <> receiving_member_id),
  check (voided_at is null or void_reason is not null),
  foreign key (paying_member_id, household_id) references public.household_members(id, household_id) on delete restrict,
  foreign key (receiving_member_id, household_id) references public.household_members(id, household_id) on delete restrict
);
create index settlements_household_currency_date_idx on public.settlements (household_id, currency, settlement_date desc) where voided_at is null;
create index settlements_paying_member_idx on public.settlements (paying_member_id, settlement_date desc) where voided_at is null;
create index settlements_receiving_member_idx on public.settlements (receiving_member_id, settlement_date desc) where voided_at is null;

-- Balances are always derived from the ledger and remain separated by currency.
create view public.household_balances with (security_invoker = true) as
with ledger_entries as (
  select e.household_id, e.payer_member_id as member_id, e.currency, e.total_cents as delta_cents
  from public.expenses e where e.voided_at is null
  union all
  select e.household_id, s.member_id, e.currency, -s.share_cents
  from public.expense_shares s
  join public.expenses e on e.id = s.expense_id
  where e.voided_at is null
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

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  action_type text not null check (char_length(action_type) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid not null,
  occurred_at timestamptz not null default now(),
  previous_values jsonb,
  new_values jsonb,
  summary text not null check (char_length(summary) between 1 and 300),
  batch_id uuid
);
create index audit_events_household_page_idx on public.audit_events (household_id, occurred_at desc, id desc);
create index audit_events_entity_idx on public.audit_events (entity_type, entity_id, occurred_at desc);

create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  audit_event_id uuid not null references public.audit_events(id) on delete restrict,
  event_type text not null,
  message text not null check (char_length(message) between 1 and 300),
  related_entity_type text not null,
  related_entity_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_user_id, audit_event_id)
);
create index notifications_recipient_unread_idx on public.notifications (recipient_user_id, created_at desc) where read_at is null;
create index notifications_recipient_created_idx on public.notifications (recipient_user_id, created_at desc);

-- Keep write timestamps database-owned so all clients behave consistently.
create or replace function private.touch_updated_at()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.is_active_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
  );
$$;

create or replace function private.is_active_household_user(target_household_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = target_user_id
      and m.removed_at is null
  );
$$;

create or replace function private.is_household_owner(target_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = target_household_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
      and m.removed_at is null
  );
$$;

create or replace function private.is_own_active_member(target_household_id uuid, target_member_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members m
    where m.id = target_member_id and m.household_id = target_household_id
      and m.user_id = (select auth.uid()) and m.removed_at is null
  );
$$;

create or replace function private.storage_household_id(path text)
returns uuid language sql immutable security definer set search_path = '' as $$
  select case
    when split_part(path, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then split_part(path, '/', 1)::uuid
    else null
  end;
$$;

create or replace function private.validate_expense_share_total()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  target_expense_id uuid;
  target_total bigint;
  shares_total bigint;
begin
  target_expense_id := coalesce(
    nullif(to_jsonb(new)->>'expense_id', '')::uuid,
    nullif(to_jsonb(old)->>'expense_id', '')::uuid,
    nullif(to_jsonb(new)->>'id', '')::uuid,
    nullif(to_jsonb(old)->>'id', '')::uuid
  );
  select total_cents into target_total from public.expenses where id = target_expense_id;
  if target_total is null then
    return null;
  end if;
  select coalesce(sum(share_cents), 0) into shares_total
  from public.expense_shares where expense_id = target_expense_id;
  if shares_total <> target_total then
    raise exception 'expense shares must total exactly the expense total' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expenses_share_total_after_expense
after insert or update of total_cents on public.expenses
deferrable initially deferred for each row execute function private.validate_expense_share_total();
create constraint trigger expenses_share_total_after_share
after insert or update of share_cents or delete on public.expense_shares
deferrable initially deferred for each row execute function private.validate_expense_share_total();

-- Generic audit snapshots deliberately omit secrets, storage paths and raw bill data.
create or replace function private.safe_audit_snapshot(row_data jsonb, entity text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if entity = 'household' then
    return row_data - array['access_code_digest', 'updated_at', 'created_at'];
  elsif entity = 'bill_document' then
    return jsonb_build_object('id', row_data->'id', 'status', row_data->'status',
      'detected_mime', row_data->'detected_mime', 'byte_count', row_data->'byte_count');
  elsif entity = 'expense' then
    return row_data - array['updated_at', 'created_at', 'created_by', 'updated_by', 'voided_by'];
  elsif entity = 'settlement' then
    return row_data - array['updated_at', 'created_at', 'created_by', 'updated_by', 'voided_by'];
  elsif entity = 'absence_period' then
    return row_data - array['updated_at', 'created_at', 'created_by', 'updated_by', 'voided_by'];
  elsif entity = 'recurring_rule' then
    return row_data - array['updated_at', 'created_at', 'created_by', 'updated_by'];
  elsif entity = 'utility_bill' then
    return row_data - array['updated_at', 'created_at', 'bill_document_id'];
  elsif entity = 'household_member' then
    return row_data - array['updated_at', 'created_at', 'removed_by'];
  end if;
  return row_data - array['updated_at', 'created_at'];
end;
$$;

create or replace function private.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_data jsonb;
  old_data jsonb;
  h_id uuid;
  e_id uuid;
  action text;
  entity text := tg_argv[0];
begin
  if current_setting('app.suppress_audit', true) = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  new_data := case when tg_op = 'DELETE' then null else private.safe_audit_snapshot(to_jsonb(new), entity) end;
  old_data := case when tg_op = 'INSERT' then null else private.safe_audit_snapshot(to_jsonb(old), entity) end;
  h_id := case when entity = 'household'
    then coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid)
    else coalesce((to_jsonb(new)->>'household_id')::uuid, (to_jsonb(old)->>'household_id')::uuid)
  end;
  e_id := coalesce(
    nullif(to_jsonb(new)->>'id', '')::uuid,
    nullif(to_jsonb(old)->>'id', '')::uuid,
    nullif(to_jsonb(new)->>'expense_id', '')::uuid,
    nullif(to_jsonb(old)->>'expense_id', '')::uuid
  );
  action := case when tg_op = 'INSERT' then 'created' when coalesce((to_jsonb(new)->>'voided_at'), '') <> '' and coalesce((to_jsonb(old)->>'voided_at'), '') = '' then 'voided' else 'updated' end;
  insert into public.audit_events (household_id, actor_user_id, action_type, entity_type, entity_id, previous_values, new_values, summary)
  values (h_id, coalesce(nullif(current_setting('app.audit_actor', true), '')::uuid, (select auth.uid())), action, entity, e_id, old_data, new_data,
    case
      when entity = 'expense' then format('A household member %s %s.', action, coalesce(new_data->>'title', old_data->>'title', 'an expense'))
      when entity = 'absence_period' then format('A household member %s away dates.', action)
      when entity = 'settlement' then format('A household member %s a settlement.', action)
      when entity = 'recurring_rule' then format('A household member %s recurring expense %s.', action, coalesce(new_data->>'title', old_data->>'title', 'rule'))
      when entity = 'household' then format('The owner %s household settings.', action)
      else format('A household member %s a %s.', action, replace(entity, '_', ' '))
    end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.fan_out_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_user_id, household_id, actor_user_id, audit_event_id, event_type, message, related_entity_type, related_entity_id)
  select m.user_id, new.household_id, new.actor_user_id, new.id, new.action_type, new.summary, new.entity_type, new.entity_id
  from public.household_members m
  where m.household_id = new.household_id and m.removed_at is null
    and (new.actor_user_id is null or m.user_id <> new.actor_user_id);
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles for each row execute function private.touch_updated_at();

create or replace function private.create_profile_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger create_profile_after_auth_user
after insert on auth.users for each row execute function private.create_profile_for_auth_user();

create trigger households_touch_updated_at before update on public.households for each row execute function private.touch_updated_at();
create trigger household_members_touch_updated_at before update on public.household_members for each row execute function private.touch_updated_at();
create trigger absence_periods_touch_updated_at before update on public.absence_periods for each row execute function private.touch_updated_at();
create trigger recurring_rules_touch_updated_at before update on public.recurring_expense_rules for each row execute function private.touch_updated_at();
create trigger expenses_touch_updated_at before update on public.expenses for each row execute function private.touch_updated_at();
create trigger bill_documents_touch_updated_at before update on public.bill_documents for each row execute function private.touch_updated_at();
create trigger utility_bills_touch_updated_at before update on public.utility_bills for each row execute function private.touch_updated_at();
create trigger settlements_touch_updated_at before update on public.settlements for each row execute function private.touch_updated_at();

create trigger audit_absence_period after insert or update on public.absence_periods for each row execute function private.audit_row_change('absence_period');
create trigger audit_household after insert or update on public.households for each row execute function private.audit_row_change('household');
create trigger audit_expense after insert or update on public.expenses for each row execute function private.audit_row_change('expense');
create trigger audit_settlement after insert or update on public.settlements for each row execute function private.audit_row_change('settlement');
create trigger audit_recurring_rule after insert or update on public.recurring_expense_rules for each row execute function private.audit_row_change('recurring_rule');
create trigger audit_member after insert or update on public.household_members for each row execute function private.audit_row_change('household_member');
create trigger audit_bill_document after insert or update on public.bill_documents for each row execute function private.audit_row_change('bill_document');
create trigger audit_utility_bill after insert or update on public.utility_bills for each row execute function private.audit_row_change('utility_bill');
create trigger notifications_from_audit after insert on public.audit_events for each row execute function private.fan_out_notification();

-- At least one owner is enforced at commit time, allowing an atomic ownership transfer.
create or replace function private.assert_active_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare h uuid := coalesce(new.household_id, old.household_id);
begin
  if not exists (select 1 from public.household_members where household_id = h and role = 'owner' and removed_at is null) then
    raise exception 'an active household must have one owner' using errcode = '23514';
  end if;
  return null;
end;
$$;

create or replace function private.assert_member_removal_allowed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.household_id is distinct from old.household_id or new.user_id is distinct from old.user_id then
    raise exception 'membership identity cannot be changed' using errcode = '23514';
  end if;
  if old.removed_at is null and new.removed_at is not null then
    if exists (
      with currencies as (
        select currency from public.expenses where household_id = old.household_id and voided_at is null
        union select currency from public.settlements where household_id = old.household_id and voided_at is null
      ), balances as (
        select c.currency,
          coalesce((select sum(e.total_cents) from public.expenses e where e.household_id = old.household_id and e.payer_member_id = old.id and e.currency = c.currency and e.voided_at is null), 0)
          - coalesce((select sum(s.share_cents) from public.expense_shares s join public.expenses e on e.id = s.expense_id where s.member_id = old.id and e.currency = c.currency and e.voided_at is null), 0)
          + coalesce((select sum(s.amount_cents) from public.settlements s where s.household_id = old.household_id and s.paying_member_id = old.id and s.currency = c.currency and s.voided_at is null), 0)
          - coalesce((select sum(s.amount_cents) from public.settlements s where s.household_id = old.household_id and s.receiving_member_id = old.id and s.currency = c.currency and s.voided_at is null), 0) as cents
        from currencies c
      ) select 1 from balances where cents <> 0
    ) then
      raise exception 'member must settle every currency before removal' using errcode = '23514';
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
create trigger household_members_removal_guard before update of removed_at on public.household_members
for each row execute function private.assert_member_removal_allowed();
create constraint trigger household_members_owner_required
after insert or update of role, removed_at or delete on public.household_members
deferrable initially deferred for each row execute function private.assert_active_owner();

-- Atomic expense creation. RLS still evaluates all underlying writes as the caller.
create or replace function public.create_expense_with_shares(
  p_household_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
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
  expense_uuid uuid := extensions.gen_random_uuid();
  share_row jsonb;
  shares_sum bigint;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then raise exception 'not a household member' using errcode = '42501'; end if;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  if p_total_cents <= 0 or jsonb_typeof(p_shares) <> 'array' then raise exception 'invalid expense input' using errcode = '22023'; end if;
  select coalesce(sum((value->>'share_cents')::bigint), 0) into shares_sum from jsonb_array_elements(p_shares);
  if shares_sum <> p_total_cents then raise exception 'shares must total expense' using errcode = '23514'; end if;
  insert into public.expenses (id, household_id, title, total_cents, currency, payer_member_id, expense_date, kind, split_method, split_config, recurring_rule_id, occurrence_date, created_by, updated_by)
  values (expense_uuid, p_household_id, p_title, p_total_cents, p_currency, p_payer_member_id, p_expense_date, p_kind, p_split_method, jsonb_set(coalesce(p_split_config, '{}'::jsonb), '{shares}', p_shares, true), p_recurring_rule_id, p_occurrence_date, p_actor_user_id, p_actor_user_id);
  for share_row in select value from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, household_id, member_id, share_cents, fixed_share_cents, variable_share_cents, presence_days, allocation_order)
    values (expense_uuid, p_household_id, (share_row->>'member_id')::uuid, (share_row->>'share_cents')::bigint,
      nullif(share_row->>'fixed_share_cents', '')::bigint, nullif(share_row->>'variable_share_cents', '')::bigint,
      nullif(share_row->>'presence_days', '')::integer, (share_row->>'allocation_order')::smallint);
  end loop;
  return expense_uuid;
end;
$$;

-- First-household creation must create the owner membership in the same transaction.
create or replace function public.create_household_with_owner(
  p_name text,
  p_default_currency char(3),
  p_locale text,
  p_timezone text,
  p_access_code_digest text,
  p_display_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare household_uuid uuid := extensions.gen_random_uuid();
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid()) and removed_at is null) then
    raise exception 'a user may only have one active household' using errcode = '23505';
  end if;
  insert into public.households (id, name, default_currency, locale, timezone, access_code_digest, created_by)
  values (household_uuid, p_name, p_default_currency, p_locale, p_timezone, p_access_code_digest, (select auth.uid()));
  insert into public.household_members (household_id, user_id, display_name, role)
  values (household_uuid, (select auth.uid()), p_display_name, 'owner');
  return household_uuid;
end;
$$;

create or replace function public.create_utility_bill_with_shares(
  p_household_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
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
declare expense_uuid uuid;
declare document_status public.document_status;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then raise exception 'not a household member' using errcode = '42501'; end if;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  if p_fixed_cents < 0 or p_variable_cents < 0 or p_fixed_cents + p_variable_cents <> p_total_cents then
    raise exception 'fixed and variable amounts must total the bill' using errcode = '23514';
  end if;
  if p_bill_document_id is not null then
    select status into document_status from public.bill_documents
    where id = p_bill_document_id and household_id = p_household_id for update;
    if document_status is null then raise exception 'bill document is unavailable' using errcode = '23503'; end if;
    if document_status = 'confirmed' then raise exception 'bill document is already confirmed' using errcode = '23505'; end if;
  end if;
  expense_uuid := public.create_expense_with_shares(
    p_household_id, p_title, p_total_cents, p_currency, p_payer_member_id, p_expense_date,
    'utility', 'utility', p_split_config, p_shares, p_actor_user_id, null, null
  );
  insert into public.utility_bills (
    expense_id, household_id, utility_type, supplier, issue_date, service_start_date,
    service_end_date, total_cents, fixed_cents, variable_cents, consumption_amount,
    consumption_unit, bill_document_id, classification_note, variable_split_mode
  ) values (
    expense_uuid, p_household_id, p_utility_type, p_supplier, p_issue_date, p_service_start_date,
    p_service_end_date, p_total_cents, p_fixed_cents, p_variable_cents,
    p_consumption_amount, p_consumption_unit, p_bill_document_id,
    p_classification_note, p_variable_split_mode
  );
  if p_bill_document_id is not null then
    update public.bill_documents
      set status = 'confirmed', updated_at = now()
      where id = p_bill_document_id and household_id = p_household_id;
  end if;
  return expense_uuid;
end;
$$;

-- Kept private because it bypasses RLS only after explicitly checking membership.
create or replace function private.replace_expense_with_shares(
  p_expense_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
  p_expense_date date,
  p_split_method public.split_method,
  p_split_config jsonb,
  p_shares jsonb,
  p_actor_user_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  target_household_id uuid;
  share_row jsonb;
  shares_sum bigint;
begin
  select household_id into target_household_id from public.expenses where id = p_expense_id and voided_at is null;
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if target_household_id is null or not private.is_active_household_user(target_household_id, p_actor_user_id) then
    raise exception 'expense is unavailable' using errcode = '42501';
  end if;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  if p_total_cents <= 0 or jsonb_typeof(p_shares) <> 'array' then raise exception 'invalid expense input' using errcode = '22023'; end if;
  select coalesce(sum((value->>'share_cents')::bigint), 0) into shares_sum from jsonb_array_elements(p_shares);
  if shares_sum <> p_total_cents then raise exception 'shares must total expense' using errcode = '23514'; end if;
  update public.expenses set title = p_title, total_cents = p_total_cents, currency = p_currency,
    payer_member_id = p_payer_member_id, expense_date = p_expense_date, split_method = p_split_method,
    split_config = jsonb_set(coalesce(p_split_config, '{}'::jsonb), '{shares}', p_shares, true), updated_by = p_actor_user_id
  where id = p_expense_id;
  delete from public.expense_shares where expense_id = p_expense_id;
  for share_row in select value from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (expense_id, household_id, member_id, share_cents, fixed_share_cents, variable_share_cents, presence_days, allocation_order)
    values (p_expense_id, target_household_id, (share_row->>'member_id')::uuid, (share_row->>'share_cents')::bigint,
      nullif(share_row->>'fixed_share_cents', '')::bigint, nullif(share_row->>'variable_share_cents', '')::bigint,
      nullif(share_row->>'presence_days', '')::integer, (share_row->>'allocation_order')::smallint);
  end loop;
end;
$$;

create or replace function public.replace_expense_with_shares(
  p_expense_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
  p_expense_date date,
  p_split_method public.split_method,
  p_split_config jsonb,
  p_shares jsonb,
  p_actor_user_id uuid
) returns void language sql security definer set search_path = '' as $$
  select private.replace_expense_with_shares(
    p_expense_id, p_title, p_total_cents, p_currency, p_payer_member_id, p_expense_date,
    p_split_method, p_split_config, p_shares, p_actor_user_id
  );
$$;

create or replace function private.replace_utility_bill_with_shares(
  p_expense_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
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
declare target_household_id uuid;
begin
  select u.household_id into target_household_id
  from public.utility_bills u
  join public.expenses e on e.id = u.expense_id
  where u.expense_id = p_expense_id and e.voided_at is null;
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if target_household_id is null or not private.is_active_household_user(target_household_id, p_actor_user_id) then
    raise exception 'utility bill is unavailable' using errcode = '42501';
  end if;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  if p_fixed_cents < 0 or p_variable_cents < 0 or p_fixed_cents + p_variable_cents <> p_total_cents then
    raise exception 'fixed and variable amounts must total the bill' using errcode = '23514';
  end if;

  perform private.replace_expense_with_shares(
    p_expense_id, p_title, p_total_cents, p_currency, p_payer_member_id,
    p_expense_date, 'utility', p_split_config, p_shares, p_actor_user_id
  );
  update public.utility_bills set
    utility_type = p_utility_type,
    supplier = p_supplier,
    issue_date = p_issue_date,
    service_start_date = p_service_start_date,
    service_end_date = p_service_end_date,
    total_cents = p_total_cents,
    fixed_cents = p_fixed_cents,
    variable_cents = p_variable_cents,
    consumption_amount = p_consumption_amount,
    consumption_unit = p_consumption_unit,
    classification_note = p_classification_note,
    variable_split_mode = p_variable_split_mode
  where expense_id = p_expense_id;
end;
$$;

create or replace function public.replace_utility_bill_with_shares(
  p_expense_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
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
) returns void language sql security definer set search_path = '' as $$
  select private.replace_utility_bill_with_shares(
    p_expense_id, p_title, p_total_cents, p_currency, p_payer_member_id,
    p_expense_date, p_split_config, p_shares, p_utility_type, p_supplier,
    p_issue_date, p_service_start_date, p_service_end_date, p_fixed_cents,
    p_variable_cents, p_consumption_amount, p_consumption_unit,
    p_classification_note, p_variable_split_mode, p_actor_user_id
  );
$$;

create or replace function public.record_settlement(
  p_household_id uuid,
  p_paying_member_id uuid,
  p_receiving_member_id uuid,
  p_amount_cents bigint,
  p_currency char(3),
  p_settlement_date date,
  p_note text default null,
  p_actor_user_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare settlement_uuid uuid := extensions.gen_random_uuid();
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then raise exception 'not a household member' using errcode = '42501'; end if;
  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  if p_amount_cents <= 0 or p_paying_member_id = p_receiving_member_id then raise exception 'invalid settlement' using errcode = '23514'; end if;
  insert into public.settlements (id, household_id, paying_member_id, receiving_member_id, amount_cents, currency, settlement_date, note, created_by, updated_by)
  values (settlement_uuid, p_household_id, p_paying_member_id, p_receiving_member_id, p_amount_cents, p_currency, p_settlement_date, p_note, p_actor_user_id, p_actor_user_id);
  return settlement_uuid;
end;
$$;

-- The caller supplies normalized ranges and freshly calculated, complete utility share sets.
-- This transaction is intentionally calculation-free: the TypeScript domain module owns occupancy math.
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
  -- Every absence edit for a household is serialized. The set comparison then
  -- rejects calculations based on another member's stale ranges.
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
    select e.total_cents into target_total
    from public.expenses e join public.utility_bills u on u.expense_id = e.id
    where e.id = target_expense_id and e.household_id = p_household_id and e.voided_at is null;
    if target_total is null then raise exception 'utility expense is unavailable' using errcode = '42501'; end if;
    select coalesce(sum((value->>'share_cents')::bigint), 0) into shares_sum
    from jsonb_array_elements(update_row->'shares');
    if shares_sum <> target_total then raise exception 'utility shares must total expense' using errcode = '23514'; end if;
    delete from public.expense_shares where expense_id = target_expense_id;
    for share_row in select value from jsonb_array_elements(update_row->'shares') loop
      insert into public.expense_shares (expense_id, household_id, member_id, share_cents, fixed_share_cents, variable_share_cents, presence_days, allocation_order)
      values (target_expense_id, p_household_id, (share_row->>'member_id')::uuid, (share_row->>'share_cents')::bigint,
        nullif(share_row->>'fixed_share_cents', '')::bigint, nullif(share_row->>'variable_share_cents', '')::bigint,
        nullif(share_row->>'presence_days', '')::integer, (share_row->>'allocation_order')::smallint);
    end loop;
    update public.utility_bills set updated_at = now(),
      variable_split_mode = coalesce(nullif(update_row->>'variable_split_mode', '')::public.variable_split_mode, variable_split_mode)
    where expense_id = target_expense_id;
  end loop;
end;
$$;

-- Server-only bridges for the internal-alias authentication flow. They never return a PIN.
create or replace function private.get_auth_alias_for_user(p_user_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  return (select email_alias from private.auth_aliases where user_id = p_user_id);
end;
$$;

create or replace function private.put_auth_alias(p_user_id uuid, p_email_alias text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  insert into private.auth_aliases (user_id, email_alias) values (p_user_id, p_email_alias)
  on conflict (user_id) do update set email_alias = excluded.email_alias;
end;
$$;

create or replace function public.service_get_auth_alias(p_user_id uuid)
returns text language sql security invoker set search_path = '' as $$
  select private.get_auth_alias_for_user(p_user_id);
$$;

create or replace function public.service_put_auth_alias(p_user_id uuid, p_email_alias text)
returns void language sql security invoker set search_path = '' as $$
  select private.put_auth_alias(p_user_id, p_email_alias);
$$;

create or replace function private.record_pin_reset_audit(p_household_id uuid, p_member_id uuid, p_actor_user_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare event_uuid uuid := extensions.gen_random_uuid();
begin
  if (select auth.role()) <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.household_members where id = p_member_id and household_id = p_household_id) then
    raise exception 'member is unavailable' using errcode = '23503';
  end if;
  if p_actor_user_id is not null and not exists (
    select 1 from public.household_members where household_id = p_household_id and user_id = p_actor_user_id and role = 'owner' and removed_at is null
  ) then raise exception 'only an owner may reset a PIN' using errcode = '42501'; end if;
  insert into public.audit_events (id, household_id, actor_user_id, action_type, entity_type, entity_id, new_values, summary)
  values (event_uuid, p_household_id, p_actor_user_id, 'pin_reset', 'household_member', p_member_id,
    jsonb_build_object('member_id', p_member_id), 'A household member reset a PIN.');
  return event_uuid;
end;
$$;

create or replace function public.service_record_pin_reset(p_household_id uuid, p_member_id uuid, p_actor_user_id uuid)
returns uuid language sql security invoker set search_path = '' as $$
  select private.record_pin_reset_audit(p_household_id, p_member_id, p_actor_user_id);
$$;

-- The cron calculates shares in the same TypeScript domain engine as manual
-- expenses, then this service-only RPC commits one generated occurrence.
create or replace function public.service_create_recurring_occurrence(
  p_rule_id uuid,
  p_occurrence_date date,
  p_shares jsonb,
  p_next_due_date date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target_rule public.recurring_expense_rules%rowtype;
  expense_uuid uuid := extensions.gen_random_uuid();
  share_row jsonb;
  shares_sum bigint;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  select * into target_rule
  from public.recurring_expense_rules
  where id = p_rule_id and active and archived_at is null
  for update;

  if target_rule.id is null or p_occurrence_date < target_rule.anchor_date
    or (target_rule.end_date is not null and p_occurrence_date > target_rule.end_date) then
    return null;
  end if;

  if jsonb_typeof(p_shares) <> 'array' then
    raise exception 'shares must be an array' using errcode = '22023';
  end if;
  select coalesce(sum((value->>'share_cents')::bigint), 0)
    into shares_sum from jsonb_array_elements(p_shares);
  if shares_sum <> target_rule.amount_cents then
    raise exception 'shares must total recurring amount' using errcode = '23514';
  end if;

  insert into public.expenses (
    id, household_id, title, total_cents, currency, payer_member_id,
    expense_date, kind, split_method, split_config, recurring_rule_id,
    occurrence_date, created_by, updated_by
  ) values (
    expense_uuid, target_rule.household_id, target_rule.title,
    target_rule.amount_cents, target_rule.currency, target_rule.payer_member_id,
    p_occurrence_date, 'recurring', target_rule.split_method,
    jsonb_set(target_rule.split_config, '{shares}', p_shares, true), target_rule.id, p_occurrence_date,
    target_rule.created_by, target_rule.updated_by
  ) on conflict (recurring_rule_id, occurrence_date) do nothing;

  if not found then
    update public.recurring_expense_rules
      set next_due_date = greatest(next_due_date, p_next_due_date), updated_at = now()
      where id = target_rule.id;
    return null;
  end if;

  for share_row in select value from jsonb_array_elements(p_shares) loop
    insert into public.expense_shares (
      expense_id, household_id, member_id, share_cents, allocation_order
    ) values (
      expense_uuid, target_rule.household_id,
      (share_row->>'member_id')::uuid,
      (share_row->>'share_cents')::bigint,
      (share_row->>'allocation_order')::smallint
    );
  end loop;

  update public.recurring_expense_rules
    set next_due_date = greatest(next_due_date, p_next_due_date), updated_at = now()
    where id = target_rule.id;
  return expense_uuid;
end;
$$;

create or replace function public.replace_absences_and_utility_shares(
  p_household_id uuid,
  p_member_id uuid,
  p_ranges jsonb,
  p_utility_updates jsonb,
  p_expected_absences jsonb,
  p_actor_user_id uuid
) returns void language sql security definer set search_path = '' as $$
  select private.replace_absences_and_utility_shares(p_household_id, p_member_id, p_ranges, p_utility_updates, p_expected_absences, p_actor_user_id);
$$;

-- Profiles are private to their user; household display names live in household_members.
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.absence_periods enable row level security;
alter table public.recurring_expense_rules enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;
alter table public.bill_documents enable row level security;
alter table public.utility_bills enable row level security;
alter table public.settlements enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;

create policy profiles_self on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy households_read_member on public.households for select to authenticated using ((select private.is_active_household_member(id)));
create policy households_create_self on public.households for insert to authenticated with check (created_by = (select auth.uid()));
create policy households_update_owner on public.households for update to authenticated using ((select private.is_household_owner(id))) with check ((select private.is_household_owner(id)));
create policy members_read_member on public.household_members for select to authenticated using ((select private.is_active_household_member(household_id)));
create policy members_insert_initial_owner on public.household_members for insert to authenticated with check (
  user_id = (select auth.uid())
  and role = 'owner'
  and exists (select 1 from public.households h where h.id = household_id and h.created_by = (select auth.uid()))
);
create policy members_update_owner on public.household_members for update to authenticated using ((select private.is_household_owner(household_id))) with check ((select private.is_household_owner(household_id)));

create policy absences_read_member on public.absence_periods for select to authenticated using ((select private.is_active_household_member(household_id)));
create policy absences_insert_self on public.absence_periods for insert to authenticated with check ((select private.is_own_active_member(household_id, member_id)));
create policy absences_update_self_or_owner on public.absence_periods for update to authenticated using ((select private.is_own_active_member(household_id, member_id)) or (select private.is_household_owner(household_id))) with check ((select private.is_own_active_member(household_id, member_id)) or (select private.is_household_owner(household_id)));

create policy recurring_rules_member_all on public.recurring_expense_rules for all to authenticated using ((select private.is_active_household_member(household_id))) with check ((select private.is_active_household_member(household_id)));
create policy expenses_member_all on public.expenses for all to authenticated using ((select private.is_active_household_member(household_id))) with check ((select private.is_active_household_member(household_id)));
create policy expense_shares_member_all on public.expense_shares for all to authenticated using ((select private.is_active_household_member(household_id))) with check ((select private.is_active_household_member(household_id)));
create policy bill_documents_member_all on public.bill_documents for all to authenticated using ((select private.is_active_household_member(household_id))) with check ((select private.is_active_household_member(household_id)));
create policy utility_bills_member_all on public.utility_bills for all to authenticated using ((select private.is_active_household_member(household_id))) with check ((select private.is_active_household_member(household_id)));
create policy settlements_member_all on public.settlements for all to authenticated using ((select private.is_active_household_member(household_id))) with check ((select private.is_active_household_member(household_id)));
create policy audit_events_read_member on public.audit_events for select to authenticated using ((select private.is_active_household_member(household_id)));
create policy notifications_recipient_read on public.notifications for select to authenticated using (recipient_user_id = (select auth.uid()) and (select private.is_active_household_member(household_id)));
create policy notifications_recipient_update on public.notifications for update to authenticated using (recipient_user_id = (select auth.uid()) and (select private.is_active_household_member(household_id))) with check (recipient_user_id = (select auth.uid()) and (select private.is_active_household_member(household_id)));

-- New tables are explicitly exposed, but RLS remains the household boundary.
grant select, update on public.profiles, public.households, public.household_members to authenticated;
grant select on public.absence_periods, public.expense_shares, public.utility_bills to authenticated;
grant select, update on public.expenses, public.settlements to authenticated;
grant select, insert, update on public.recurring_expense_rules, public.bill_documents to authenticated;
grant select on public.household_balances to authenticated;
grant select on public.audit_events to authenticated;
grant select, update (read_at) on public.notifications to authenticated;
revoke all on private.auth_aliases from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.get_auth_alias_for_user(uuid), private.put_auth_alias(uuid, text), private.record_pin_reset_audit(uuid, uuid, uuid) to service_role;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_active_household_member(uuid), private.is_household_owner(uuid), private.is_own_active_member(uuid, uuid), private.storage_household_id(text) to authenticated;
revoke all on all tables in schema public from anon;
revoke all on function public.create_expense_with_shares(uuid, text, bigint, char, uuid, date, public.expense_kind, public.split_method, jsonb, jsonb, uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.create_household_with_owner(text, char, text, text, text, text) from public;
revoke all on function public.create_utility_bill_with_shares(uuid, text, bigint, char, uuid, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, uuid, text, public.variable_split_mode, uuid) from public, anon, authenticated;
revoke all on function public.replace_expense_with_shares(uuid, text, bigint, char, uuid, date, public.split_method, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.replace_utility_bill_with_shares(uuid, text, bigint, char, uuid, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, text, public.variable_split_mode, uuid) from public, anon, authenticated;
revoke all on function public.record_settlement(uuid, uuid, uuid, bigint, char, date, text, uuid) from public, anon, authenticated;
revoke all on function public.replace_absences_and_utility_shares(uuid, uuid, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.service_get_auth_alias(uuid), public.service_put_auth_alias(uuid, text), public.service_record_pin_reset(uuid, uuid, uuid), public.service_create_recurring_occurrence(uuid, date, jsonb, date) from public, anon, authenticated;
grant execute on function public.create_expense_with_shares(uuid, text, bigint, char, uuid, date, public.expense_kind, public.split_method, jsonb, jsonb, uuid, uuid, date) to service_role;
grant execute on function public.create_household_with_owner(text, char, text, text, text, text) to authenticated;
grant execute on function public.create_utility_bill_with_shares(uuid, text, bigint, char, uuid, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, uuid, text, public.variable_split_mode, uuid) to service_role;
grant execute on function public.replace_expense_with_shares(uuid, text, bigint, char, uuid, date, public.split_method, jsonb, jsonb, uuid) to service_role;
grant execute on function public.replace_utility_bill_with_shares(uuid, text, bigint, char, uuid, date, jsonb, jsonb, public.utility_type, text, date, date, date, bigint, bigint, numeric, text, text, public.variable_split_mode, uuid) to service_role;
grant execute on function public.record_settlement(uuid, uuid, uuid, bigint, char, date, text, uuid) to service_role;
grant execute on function public.replace_absences_and_utility_shares(uuid, uuid, jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.service_get_auth_alias(uuid), public.service_put_auth_alias(uuid, text), public.service_record_pin_reset(uuid, uuid, uuid), public.service_create_recurring_occurrence(uuid, date, jsonb, date) to service_role;

-- Private bill objects use a household UUID as the first path segment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('froskolin-bills', 'froskolin-bills', false, 4194304, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy froskolin_bill_read on storage.objects for select to authenticated
using (bucket_id = 'froskolin-bills' and (select private.is_active_household_member(private.storage_household_id(name))));
create policy froskolin_bill_upload on storage.objects for insert to authenticated
with check (bucket_id = 'froskolin-bills' and owner_id = (select auth.uid())::text and (select private.is_active_household_member(private.storage_household_id(name))));
create policy froskolin_bill_update on storage.objects for update to authenticated
using (bucket_id = 'froskolin-bills' and (select private.is_active_household_member(private.storage_household_id(name))))
with check (bucket_id = 'froskolin-bills' and (select private.is_active_household_member(private.storage_household_id(name))));
create policy froskolin_bill_delete on storage.objects for delete to authenticated
using (bucket_id = 'froskolin-bills' and (select private.is_household_owner(private.storage_household_id(name))));

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
