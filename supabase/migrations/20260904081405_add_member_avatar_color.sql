alter table public.household_members
  add column avatar_color text
  check (avatar_color is null or avatar_color in ('teal', 'violet', 'orange', 'blue', 'rose', 'indigo'));

-- Roommates may update only their own personal presentation fields. Column
-- grants prevent this policy from being used to alter roles or membership.
revoke update on public.household_members from authenticated;
grant update (display_name, avatar_color, removed_at, removed_by)
  on public.household_members to authenticated;

create policy members_update_self_profile
  on public.household_members
  for update
  to authenticated
  using (user_id = (select auth.uid()) and removed_at is null)
  with check (user_id = (select auth.uid()) and removed_at is null);
