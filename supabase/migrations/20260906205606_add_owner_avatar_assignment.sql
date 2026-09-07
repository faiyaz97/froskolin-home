do $$
declare
  household_row record;
  member_row record;
  chosen_avatar text;
  used_avatars text[];
  avatar_options constant text[] := array['teal', 'violet', 'orange', 'blue', 'rose', 'indigo'];
begin
  for household_row in
    select distinct household_id
    from public.household_members
    where removed_at is null
  loop
    select coalesce(array_agg(avatar_color) filter (where avatar_color is not null), array[]::text[])
    into used_avatars
    from public.household_members
    where household_id = household_row.household_id and removed_at is null;

    for member_row in
      select id
      from public.household_members
      where household_id = household_row.household_id
        and removed_at is null
        and avatar_color is null
      order by joined_at, id
    loop
      select option
      into chosen_avatar
      from unnest(avatar_options) with ordinality as available(option, position)
      where not (option = any(used_avatars))
      order by position
      limit 1;

      if chosen_avatar is null then
        chosen_avatar := avatar_options[1 + floor(random() * array_length(avatar_options, 1))::integer];
      end if;

      update public.household_members
      set avatar_color = chosen_avatar
      where id = member_row.id;
      used_avatars := array_append(used_avatars, chosen_avatar);
    end loop;
  end loop;
end;
$$;

drop function public.create_household_with_owner(text, char, text, text, text, text, text, text, text);

create function public.create_household_with_owner(
  p_name text,
  p_default_currency char(3),
  p_locale text,
  p_timezone text,
  p_access_code_digest text,
  p_house_code text,
  p_join_pin_digest text,
  p_encrypted_join_pin text,
  p_display_name text,
  p_avatar_color text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare household_uuid uuid := extensions.gen_random_uuid();
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_avatar_color not in ('teal', 'violet', 'orange', 'blue', 'rose', 'indigo') then
    raise exception 'invalid avatar' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.household_members
    where user_id = (select auth.uid()) and removed_at is null
  ) then
    raise exception 'a user may only have one active household' using errcode = '23505';
  end if;

  insert into public.households (
    id, name, default_currency, locale, timezone, access_code_digest,
    house_code, join_pin_digest, created_by
  ) values (
    household_uuid, p_name, p_default_currency, p_locale, p_timezone,
    p_access_code_digest, p_house_code, p_join_pin_digest, (select auth.uid())
  );
  insert into private.household_join_pin_secrets (household_id, encrypted_pin)
  values (household_uuid, p_encrypted_join_pin);
  insert into public.household_members (
    household_id, user_id, display_name, role, avatar_color
  ) values (
    household_uuid, (select auth.uid()), p_display_name, 'owner', p_avatar_color
  );
  return household_uuid;
end;
$$;

revoke all on function public.create_household_with_owner(
  text, char, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_household_with_owner(
  text, char, text, text, text, text, text, text, text, text
) to authenticated;
