drop function public.replace_utility_bill_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, jsonb, jsonb,
  public.utility_type, text, date, date, date, bigint, bigint,
  numeric, text, text, public.variable_split_mode, uuid
);

create function public.replace_utility_bill_with_landlord_support(
  p_expense_id uuid,
  p_title text,
  p_total_cents bigint,
  p_currency char(3),
  p_payer_member_id uuid,
  p_paid_by_landlord boolean,
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
) returns void language plpgsql security definer set search_path = '' as $$
declare
  target_household_id uuid;
  temporary_payer uuid;
  previous_document_id uuid;
  document_status public.document_status;
  previous_snapshot jsonb;
  final_snapshot jsonb;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  select e.household_id, u.bill_document_id,
    private.safe_audit_snapshot(to_jsonb(e), 'expense')
    into target_household_id, previous_document_id, previous_snapshot
  from public.expenses e
  join public.utility_bills u on u.expense_id = e.id
  where e.id = p_expense_id and e.voided_at is null;
  if target_household_id is null or not private.is_active_household_user(target_household_id, p_actor_user_id) then
    raise exception 'utility bill is unavailable' using errcode = '42501';
  end if;
  if p_bill_document_id is distinct from previous_document_id and p_bill_document_id is not null then
    select status into document_status from public.bill_documents
    where id = p_bill_document_id and household_id = target_household_id for update;
    if document_status is null then
      raise exception 'bill document is unavailable' using errcode = '23503';
    end if;
    if document_status = 'confirmed' then
      raise exception 'bill document is already confirmed' using errcode = '23505';
    end if;
  end if;
  select m.id into temporary_payer from public.household_members m
  where m.household_id = target_household_id and m.user_id = p_actor_user_id and m.removed_at is null;
  if p_paid_by_landlord and not exists (
    select 1 from public.households h where h.id = target_household_id and h.landlord_enabled
  ) then
    raise exception 'landlord is not enabled for this household' using errcode = '23514';
  end if;

  perform set_config('app.audit_actor', p_actor_user_id::text, true);
  perform set_config('app.suppress_audit', 'true', true);
  perform public.replace_utility_bill_with_shares(
    p_expense_id, p_title, p_total_cents, p_currency,
    case when p_paid_by_landlord then temporary_payer else p_payer_member_id end,
    p_expense_date, p_split_config, p_shares, p_utility_type, p_supplier,
    p_issue_date, p_service_start_date, p_service_end_date, p_fixed_cents,
    p_variable_cents, p_consumption_amount, p_consumption_unit,
    p_classification_note, p_variable_split_mode, p_actor_user_id
  );
  update public.expenses set
    payer_member_id = case when p_paid_by_landlord then null else p_payer_member_id end,
    paid_by_landlord = p_paid_by_landlord
  where id = p_expense_id;
  update public.utility_bills
    set bill_document_id = p_bill_document_id
    where expense_id = p_expense_id;
  if p_bill_document_id is distinct from previous_document_id and p_bill_document_id is not null then
    update public.bill_documents
      set status = 'confirmed', updated_at = now()
      where id = p_bill_document_id and household_id = target_household_id;
  end if;
  perform set_config('app.suppress_audit', 'false', true);
  select private.safe_audit_snapshot(to_jsonb(e), 'expense') into final_snapshot
  from public.expenses e where e.id = p_expense_id;
  insert into public.audit_events (
    household_id, actor_user_id, action_type, entity_type, entity_id,
    previous_values, new_values, summary
  ) values (
    target_household_id, p_actor_user_id, 'updated', 'expense', p_expense_id,
    previous_snapshot, final_snapshot,
    format('updated %s, paid by %s.', p_title,
      case when p_paid_by_landlord then 'Landlord' else 'a household member' end)
  );
end;
$$;

revoke all on function public.replace_utility_bill_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, jsonb, jsonb,
  public.utility_type, text, date, date, date, bigint, bigint,
  numeric, text, uuid, text, public.variable_split_mode, uuid
) from public, anon, authenticated;

grant execute on function public.replace_utility_bill_with_landlord_support(
  uuid, text, bigint, char, uuid, boolean, date, jsonb, jsonb,
  public.utility_type, text, date, date, date, bigint, bigint,
  numeric, text, uuid, text, public.variable_split_mode, uuid
) to service_role;
