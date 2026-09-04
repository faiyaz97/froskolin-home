drop policy members_update_owner on public.household_members;
drop policy members_update_self_profile on public.household_members;

create policy members_update_owner_or_self
  on public.household_members
  for update
  to authenticated
  using (
    (select private.is_household_owner(household_id))
    or (user_id = (select auth.uid()) and removed_at is null)
  )
  with check (
    (select private.is_household_owner(household_id))
    or (user_id = (select auth.uid()) and removed_at is null)
  );
