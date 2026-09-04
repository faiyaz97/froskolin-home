create function public.reopen_landlord_bill(
  p_household_id uuid,
  p_expense_id uuid,
  p_actor_user_id uuid
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  actor_member_id uuid;
  bill_title text;
  voided_count integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if not private.is_active_household_user(p_household_id, p_actor_user_id) then
    raise exception 'not a household member' using errcode = '42501';
  end if;

  select m.id into actor_member_id
  from public.household_members m
  where m.household_id = p_household_id
    and m.user_id = p_actor_user_id
    and m.removed_at is null;

  select e.title into bill_title
  from public.expenses e
  join public.expense_shares s
    on s.expense_id = e.id
    and s.household_id = e.household_id
    and s.member_id = actor_member_id
  where e.id = p_expense_id
    and e.household_id = p_household_id
    and e.paid_by_landlord
    and e.voided_at is null;

  if bill_title is null then
    raise exception 'landlord-paid expense is unavailable' using errcode = '42501';
  end if;

  update public.landlord_payments
  set voided_at = now(),
      voided_by = p_actor_user_id,
      void_reason = 'Paid status reverted by member'
  where household_id = p_household_id
    and expense_id = p_expense_id
    and member_id = actor_member_id
    and voided_at is null;
  get diagnostics voided_count = row_count;

  if voided_count = 0 then
    raise exception 'this bill is not marked as paid' using errcode = '23514';
  end if;

  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id,
    previous_values, new_values, summary
  ) values (
    p_household_id, p_actor_user_id, 'reopened', 'landlord_payment', p_expense_id,
    jsonb_build_object('paid', true, 'voided_payment_count', voided_count),
    jsonb_build_object('paid', false),
    format('reopened %s for payment.', bill_title)
  );

  return voided_count;
end;
$$;

revoke all on function public.reopen_landlord_bill(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.reopen_landlord_bill(uuid, uuid, uuid)
to service_role;
