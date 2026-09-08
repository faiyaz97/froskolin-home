create view public.household_pair_balances
with (security_invoker = true)
as
with pair_deltas as (
  select
    e.household_id,
    e.currency,
    least(es.member_id, e.payer_member_id) as member_a_id,
    greatest(es.member_id, e.payer_member_id) as member_b_id,
    case
      when es.member_id < e.payer_member_id then es.share_cents
      else -es.share_cents
    end as signed_cents
  from public.expenses e
  join public.expense_shares es on es.expense_id = e.id
  where e.voided_at is null
    and not e.paid_by_landlord
    and e.payer_member_id is not null
    and es.member_id <> e.payer_member_id

  union all

  select
    s.household_id,
    s.currency,
    least(s.paying_member_id, s.receiving_member_id) as member_a_id,
    greatest(s.paying_member_id, s.receiving_member_id) as member_b_id,
    case
      when s.paying_member_id < s.receiving_member_id then -s.amount_cents
      else s.amount_cents
    end as signed_cents
  from public.settlements s
  where s.voided_at is null
),
pair_totals as (
  select
    household_id,
    currency,
    member_a_id,
    member_b_id,
    sum(signed_cents)::bigint as signed_cents
  from pair_deltas
  group by household_id, currency, member_a_id, member_b_id
)
select
  household_id,
  currency,
  case when signed_cents > 0 then member_a_id else member_b_id end as paying_member_id,
  case when signed_cents > 0 then member_b_id else member_a_id end as receiving_member_id,
  abs(signed_cents)::bigint as amount_cents
from pair_totals
where signed_cents <> 0;

comment on view public.household_pair_balances is
  'RLS-backed direct member debts after applying settlements, before debt simplification.';

revoke all on public.household_pair_balances from anon;
grant select on public.household_pair_balances to authenticated;
