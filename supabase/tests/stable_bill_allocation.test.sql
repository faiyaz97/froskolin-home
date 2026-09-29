begin;

create extension if not exists pgtap with schema extensions;
select plan(4);
select set_config('app.suppress_audit', 'true', true);

insert into auth.users (id, email) values
  ('20000000-0000-4000-8000-000000000001', 'allocation-owner@internal.invalid'),
  ('20000000-0000-4000-8000-000000000002', 'allocation-member@internal.invalid');
insert into public.households (
  id, name, default_currency, locale, timezone, access_code_digest,
  house_code, join_pin_digest, created_by, landlord_enabled
) values (
  '20000000-0000-4000-8000-000000000010', 'Allocation test', 'EUR', 'en-GB', 'UTC',
  'allocation-digest', 'FROSKO-9920', repeat('5', 64),
  '20000000-0000-4000-8000-000000000001', true
);
insert into public.household_members (id, household_id, user_id, display_name, role) values
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000001', 'Owner', 'owner'),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 'Member', 'member');
insert into public.expenses (
  id, household_id, title, total_cents, currency, payer_member_id,
  paid_by_landlord, expense_date, kind, split_method, split_config,
  created_by, updated_by, created_at
) values
  ('20000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000010', 'Older bill', 2000, 'EUR', null, true, current_date, 'manual', 'equal', '{}', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-09-28T10:00:00Z'),
  ('20000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000010', 'Newer bill', 2000, 'EUR', null, true, current_date, 'manual', 'equal', '{}', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '2026-09-28T11:00:00Z');
insert into public.expense_shares (
  expense_id, household_id, member_id, share_cents, allocation_order
) values
  ('20000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', 1000, 0),
  ('20000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000012', 1000, 1),
  ('20000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011', 1000, 0),
  ('20000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000012', 1000, 1);

grant select on public.landlord_payments to service_role;
set local role service_role;
select set_config('request.jwt.claims', '{"sub":"20000000-0000-4000-8000-000000000001","role":"service_role"}', true);
select is(public.record_landlord_balance_payment(
  '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000011',
  1000, 'EUR', current_date, 'Owner payment', true, '20000000-0000-4000-8000-000000000001'
), 1, 'owner payment records one own share');
select is((select expense_id from public.landlord_payments where household_id = '20000000-0000-4000-8000-000000000010' and paid_by_member_id = '20000000-0000-4000-8000-000000000011' and voided_at is null),
  '20000000-0000-4000-8000-000000000019'::uuid, 'own payment uses the newer bill despite UUID order');
select is(public.record_landlord_balance_payment(
  '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000012',
  3000, 'EUR', current_date, 'Member payment', true, '20000000-0000-4000-8000-000000000002'
), 3, 'member payment records two own shares and one cover');
select is((select expense_id from public.landlord_payments where household_id = '20000000-0000-4000-8000-000000000010' and paid_by_member_id = '20000000-0000-4000-8000-000000000012' and member_id = '20000000-0000-4000-8000-000000000011' and voided_at is null),
  '20000000-0000-4000-8000-000000000020'::uuid, 'member covers the owner on the older bill');

select * from finish();
rollback;
