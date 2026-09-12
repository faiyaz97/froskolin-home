-- Demotion shares the group lock used by promotion. Concurrent role changes
-- must recheck authorization and the remaining admin count after acquiring it.
create function private.demote_group_admin(p_household_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_household_owner(p_household_id) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if coalesce(auth.jwt()->'app_metadata'->>'must_change_pin', 'false') = 'true' then
    raise exception 'change your PIN first' using errcode = '42501';
  end if;
  perform 1 from public.households where id = p_household_id for update;
  if not private.is_household_owner(p_household_id) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  perform 1 from public.household_members
    where id = p_member_id and household_id = p_household_id and removed_at is null
    for update;
  if not found then
    raise exception 'active group member not found' using errcode = '22023';
  end if;
  if not exists (select 1 from public.household_members
    where id = p_member_id and role = 'owner') then
    return;
  end if;
  if not exists (select 1 from public.household_members
    where household_id = p_household_id and role = 'owner'
      and removed_at is null and id <> p_member_id) then
    raise exception 'group requires at least one admin' using errcode = '23514';
  end if;
  update public.household_members set role = 'member'
    where id = p_member_id and household_id = p_household_id;
end;
$$;

create function public.demote_group_admin(p_household_id uuid, p_member_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.demote_group_admin(p_household_id, p_member_id);
$$;

revoke all on function private.demote_group_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function public.demote_group_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function private.demote_group_admin(uuid, uuid) to authenticated;
grant execute on function public.demote_group_admin(uuid, uuid) to authenticated;
