-- Keep the join credential one-way hashed for authentication while storing a
-- separately encrypted owner-visible copy. The encryption key stays in the
-- Next.js server environment and is never stored in PostgreSQL.

alter table public.households
  drop constraint households_house_code_format,
  add constraint households_house_code_format
    check (house_code ~ '^[A-Z0-9][A-Z0-9-]{4,22}[A-Z0-9]$');

create table private.household_join_pin_secrets (
  household_id uuid primary key references public.households(id) on delete cascade,
  encrypted_pin text not null check (length(encrypted_pin) between 20 and 512),
  updated_at timestamptz not null default now()
);

revoke all on private.household_join_pin_secrets from public, anon, authenticated;

create function private.get_household_join_pin_secret(p_household_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not (select private.is_household_owner(p_household_id)) then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  return (
    select encrypted_pin
    from private.household_join_pin_secrets
    where household_id = p_household_id
  );
end;
$$;

create function private.update_household_access(
  p_household_id uuid,
  p_house_code text,
  p_access_code_digest text,
  p_join_pin_digest text,
  p_encrypted_join_pin text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not (select private.is_household_owner(p_household_id)) then
    raise exception 'owner access required' using errcode = '42501';
  end if;
  update public.households
  set house_code = p_house_code,
      access_code_digest = p_access_code_digest,
      join_pin_digest = p_join_pin_digest
  where id = p_household_id and archived_at is null;
  if not found then raise exception 'household not found' using errcode = 'P0002'; end if;

  insert into private.household_join_pin_secrets (household_id, encrypted_pin)
  values (p_household_id, p_encrypted_join_pin)
  on conflict (household_id) do update
  set encrypted_pin = excluded.encrypted_pin, updated_at = now();
end;
$$;

create function public.get_household_join_pin_secret(p_household_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select private.get_household_join_pin_secret(p_household_id);
$$;

create function public.update_household_access(
  p_household_id uuid,
  p_house_code text,
  p_access_code_digest text,
  p_join_pin_digest text,
  p_encrypted_join_pin text
) returns void language sql security invoker set search_path = '' as $$
  select private.update_household_access(
    p_household_id,
    p_house_code,
    p_access_code_digest,
    p_join_pin_digest,
    p_encrypted_join_pin
  );
$$;

drop function public.create_household_with_owner(text, char, text, text, text, text, text, text);

create function public.create_household_with_owner(
  p_name text,
  p_default_currency char(3),
  p_locale text,
  p_timezone text,
  p_access_code_digest text,
  p_house_code text,
  p_join_pin_digest text,
  p_encrypted_join_pin text,
  p_display_name text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare household_uuid uuid := extensions.gen_random_uuid();
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if exists (
    select 1 from public.household_members
    where user_id = (select auth.uid()) and removed_at is null
  ) then raise exception 'a user may only have one active household' using errcode = '23505'; end if;

  insert into public.households (
    id, name, default_currency, locale, timezone, access_code_digest,
    house_code, join_pin_digest, created_by
  ) values (
    household_uuid, p_name, p_default_currency, p_locale, p_timezone,
    p_access_code_digest, p_house_code, p_join_pin_digest, (select auth.uid())
  );
  insert into private.household_join_pin_secrets (household_id, encrypted_pin)
  values (household_uuid, p_encrypted_join_pin);
  insert into public.household_members (household_id, user_id, display_name, role)
  values (household_uuid, (select auth.uid()), p_display_name, 'owner');
  return household_uuid;
end;
$$;

revoke all on function private.get_household_join_pin_secret(uuid) from public, anon, authenticated;
revoke all on function private.update_household_access(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function private.get_household_join_pin_secret(uuid) to authenticated;
grant execute on function private.update_household_access(uuid, text, text, text, text) to authenticated;

revoke all on function public.get_household_join_pin_secret(uuid) from public, anon, authenticated;
revoke all on function public.update_household_access(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_household_with_owner(text, char, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_household_join_pin_secret(uuid) to authenticated;
grant execute on function public.update_household_access(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_household_with_owner(text, char, text, text, text, text, text, text, text) to authenticated;
