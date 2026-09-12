-- The compatibility role 'owner' represents a group admin. Keep the deferred
-- at-least-one-owner constraint, but allow multiple active admins.
drop index public.household_members_one_active_owner;

create function private.promote_group_member(p_household_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_household_owner(p_household_id) then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if coalesce(auth.jwt()->'app_metadata'->>'must_change_pin', 'false') = 'true' then
    raise exception 'change your PIN first' using errcode = '42501';
  end if;

  -- Serialize promotions within the group and recheck the caller under lock.
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
  update public.household_members set role = 'owner'
    where id = p_member_id and household_id = p_household_id and role = 'member';
end;
$$;

create function public.promote_group_member(p_household_id uuid, p_member_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.promote_group_member(p_household_id, p_member_id);
$$;

revoke all on function private.promote_group_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.promote_group_member(uuid, uuid) from public, anon, authenticated;
grant execute on function private.promote_group_member(uuid, uuid) to authenticated;
grant execute on function public.promote_group_member(uuid, uuid) to authenticated;
