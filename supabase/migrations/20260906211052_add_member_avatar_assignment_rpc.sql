create or replace function private.add_household_member_with_avatar(
  p_household_id uuid,
  p_user_id uuid,
  p_display_name text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_avatar text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;

  -- Serialize joins for one household so an unused avatar cannot be handed
  -- to two new members at the same time.
  perform 1
  from public.households
  where id = p_household_id and archived_at is null
  for update;
  if not found then
    raise exception 'household is unavailable' using errcode = '23503';
  end if;

  select candidate
  into chosen_avatar
  from unnest(array['teal', 'violet', 'orange', 'blue', 'rose', 'indigo']) as candidate
  where not exists (
    select 1
    from public.household_members member
    where member.household_id = p_household_id
      and member.removed_at is null
      and member.avatar_color = candidate
  )
  order by random()
  limit 1;

  if chosen_avatar is null then
    select candidate
    into chosen_avatar
    from unnest(array['teal', 'violet', 'orange', 'blue', 'rose', 'indigo']) as candidate
    order by random()
    limit 1;
  end if;

  insert into public.household_members (
    household_id,
    user_id,
    display_name,
    role,
    avatar_color
  ) values (
    p_household_id,
    p_user_id,
    p_display_name,
    'member',
    chosen_avatar
  );

  return chosen_avatar;
end;
$$;

create or replace function public.service_add_household_member_with_avatar(
  p_household_id uuid,
  p_user_id uuid,
  p_display_name text
) returns text
language sql
security invoker
set search_path = ''
as $$
  select private.add_household_member_with_avatar(
    p_household_id,
    p_user_id,
    p_display_name
  );
$$;

revoke all on function public.service_add_household_member_with_avatar(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.service_add_household_member_with_avatar(uuid, uuid, text)
  to service_role;
