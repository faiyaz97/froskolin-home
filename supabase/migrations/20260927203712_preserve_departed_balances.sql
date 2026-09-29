-- Departed members cannot act on new suggestions. Ledger writes must preserve
-- the zero combined position that was required when they left.
create function private.assert_departed_balances_still_zero() returns trigger
language plpgsql security definer set search_path = '' as $$
declare group_id uuid;
begin
  group_id := coalesce(new.household_id, old.household_id);
  if not exists (select 1 from public.household_members m
    where m.household_id = group_id and m.removed_at is not null) then
    return null;
  end if;
  if exists (
    with group_balances as (
      select b.member_id, b.currency, b.net_cents
      from public.household_balances b
      join public.household_members m on m.id = b.member_id
      where b.household_id = group_id and m.removed_at is not null
    ), landlord_balances as (
      select s.member_id, e.currency,
        sum(s.share_cents - coalesce((select sum(lp.amount_cents)
          from public.landlord_payments lp where lp.expense_id = e.id
            and lp.member_id = s.member_id and lp.voided_at is null), 0))::bigint as due_cents
      from public.expenses e join public.expense_shares s on s.expense_id = e.id
      join public.household_members m on m.id = s.member_id
      where e.household_id = group_id and e.voided_at is null and e.paid_by_landlord
        and m.removed_at is not null
      group by s.member_id, e.currency
    )
    select 1 from group_balances g full join landlord_balances l
      using (member_id, currency)
    where coalesce(g.net_cents, 0) - coalesce(l.due_cents, 0) <> 0
  ) then
    raise exception 'departed member balance would change; restore membership first'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger expenses_preserve_departed_balances
after insert or update or delete on public.expenses
deferrable initially deferred for each row
execute function private.assert_departed_balances_still_zero();
create constraint trigger shares_preserve_departed_balances
after insert or update or delete on public.expense_shares
deferrable initially deferred for each row
execute function private.assert_departed_balances_still_zero();
create constraint trigger settlements_preserve_departed_balances
after insert or update or delete on public.settlements
deferrable initially deferred for each row
execute function private.assert_departed_balances_still_zero();
create constraint trigger landlord_payments_preserve_departed_balances
after insert or update or delete on public.landlord_payments
deferrable initially deferred for each row
execute function private.assert_departed_balances_still_zero();
