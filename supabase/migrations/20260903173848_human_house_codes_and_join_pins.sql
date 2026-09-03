-- Human-readable household identity and a separate credential for joining.
-- The legacy access digest remains populated for compatibility, but is no
-- longer used to identify or authenticate a household.

alter table public.households
  add column house_code text,
  add column join_pin_digest text;

select set_config('app.suppress_audit', 'true', true);

with numbered as (
  select id, row_number() over (order by created_at, id) as position
  from public.households
)
update public.households as household
set house_code = 'FROSKO-' || lpad((999 + numbered.position)::text, 4, '0')
from numbered
where household.id = numbered.id;

-- Existing four-digit accounts can still authenticate once, then the app
-- requires them to replace that PIN with a six-digit personal PIN.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"must_change_pin":true}'::jsonb;

select set_config('app.suppress_audit', 'false', true);

alter table public.households
  alter column house_code set not null,
  add constraint households_house_code_format
    check (house_code ~ '^FROSKO-[0-9]{4}$'),
  add constraint households_join_pin_digest_format
    check (join_pin_digest is null or join_pin_digest ~ '^[0-9a-f]{64}$');

create unique index households_house_code_unique_idx on public.households (house_code);

-- Join PIN digests and the deprecated access digest must never be returned to
-- a browser, even for an authenticated household member.
revoke select, update on public.households from authenticated;
grant select (
  id, name, default_currency, locale, timezone, house_code, joining_enabled,
  archived_at, created_by, created_at, updated_at
) on public.households to authenticated;
grant update (
  name, default_currency, locale, timezone, house_code, access_code_digest,
  join_pin_digest, joining_enabled
) on public.households to authenticated;
grant select (house_code, join_pin_digest) on public.households to service_role;

create or replace function private.safe_audit_snapshot(row_data jsonb, entity text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if entity = 'household' then
    return row_data - array['access_code_digest', 'join_pin_digest', 'updated_at', 'created_at'];
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
      when entity = 'household' and tg_op = 'UPDATE' and (to_jsonb(new)->>'house_code') is distinct from (to_jsonb(old)->>'house_code') then 'The owner changed the House Code.'
      when entity = 'household' and tg_op = 'UPDATE' and (to_jsonb(new)->>'join_pin_digest') is distinct from (to_jsonb(old)->>'join_pin_digest') then 'The owner changed the House Join PIN.'
      when entity = 'household' then format('The owner %s household settings.', action)
      else format('A household member %s a %s.', action, replace(entity, '_', ' '))
    end);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop function public.create_household_with_owner(text, char, text, text, text, text);

create function public.create_household_with_owner(
  p_name text,
  p_default_currency char(3),
  p_locale text,
  p_timezone text,
  p_access_code_digest text,
  p_house_code text,
  p_join_pin_digest text,
  p_display_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare household_uuid uuid := extensions.gen_random_uuid();
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (select 1 from public.household_members where user_id = (select auth.uid()) and removed_at is null) then
    raise exception 'a user may only have one active household' using errcode = '23505';
  end if;
  insert into public.households (
    id, name, default_currency, locale, timezone, access_code_digest,
    house_code, join_pin_digest, created_by
  ) values (
    household_uuid, p_name, p_default_currency, p_locale, p_timezone,
    p_access_code_digest, p_house_code, p_join_pin_digest, (select auth.uid())
  );
  insert into public.household_members (household_id, user_id, display_name, role)
  values (household_uuid, (select auth.uid()), p_display_name, 'owner');
  return household_uuid;
end;
$$;

revoke all on function public.create_household_with_owner(text, char, text, text, text, text, text, text) from public;
grant execute on function public.create_household_with_owner(text, char, text, text, text, text, text, text) to authenticated;
