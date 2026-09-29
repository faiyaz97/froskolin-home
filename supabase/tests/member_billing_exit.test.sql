begin;
create extension if not exists pgtap with schema extensions;
select plan(15);
select set_config('app.suppress_audit', 'true', true);

insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-000000000001', 'billing-owner@internal.invalid'),
  ('90000000-0000-4000-8000-000000000002', 'billing-a@internal.invalid'),
  ('90000000-0000-4000-8000-000000000003', 'billing-b@internal.invalid'),
  ('90000000-0000-4000-8000-000000000004', 'billing-combined-owner@internal.invalid'),
  ('90000000-0000-4000-8000-000000000005', 'billing-combined-a@internal.invalid');
insert into public.households (
  id, name, default_currency, locale, timezone, access_code_digest,
  house_code, join_pin_digest, created_by, landlord_enabled
) values (
  '90000000-0000-4000-8000-000000000010', 'Billing test', 'EUR', 'en-GB', 'UTC',
  'billing-digest', 'FROSKO-9010', repeat('5', 64),
  '90000000-0000-4000-8000-000000000001', false
), (
  '90000000-0000-4000-8000-000000000020', 'Combined exit', 'EUR', 'en-GB', 'UTC',
  'billing-digest-two', 'FROSKO-9020', repeat('6', 64),
  '90000000-0000-4000-8000-000000000004', true
);
insert into public.household_members (id, household_id, user_id, display_name, role) values
  ('90000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000001', 'Owner', 'owner'),
  ('90000000-0000-4000-8000-000000000012', '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000002', 'A', 'member'),
  ('90000000-0000-4000-8000-000000000013', '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000003', 'B', 'member'),
  ('90000000-0000-4000-8000-000000000021', '90000000-0000-4000-8000-000000000020', '90000000-0000-4000-8000-000000000004', 'Owner', 'owner'),
  ('90000000-0000-4000-8000-000000000022', '90000000-0000-4000-8000-000000000020', '90000000-0000-4000-8000-000000000005', 'A', 'member');
select is((select in_date from public.household_members where id = '90000000-0000-4000-8000-000000000012'), current_date, 'joining initializes the group-local In date');
select ok(not has_column_privilege('authenticated', 'public.household_members', 'in_date', 'UPDATE'), 'billing dates cannot be updated directly');
select ok(not has_column_privilege('authenticated', 'public.household_members', 'removed_at', 'UPDATE'), 'membership cannot be removed directly');
select ok(not has_function_privilege('authenticated', 'public.apply_member_billing_dates(uuid,uuid,date,date,date,date,jsonb,boolean,uuid)', 'EXECUTE'), 'date and exit RPC is service only');

-- Test-only role grants for assertions and fixtures; rollback removes them.
grant all on public.households, public.household_members, public.expenses,
  public.expense_shares, public.landlord_payments, public.settlements,
  public.audit_events to service_role;

insert into public.expenses (
  id, household_id, title, total_cents, currency, payer_member_id, expense_date,
  kind, split_method, split_config, created_by, updated_by
) values
  ('90000000-0000-4000-8000-000000000030', '90000000-0000-4000-8000-000000000010', 'Owner covered A', 100, 'EUR', '90000000-0000-4000-8000-000000000011', current_date, 'manual', 'equal', '{}', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001'),
  ('90000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000010', 'A covered B', 100, 'EUR', '90000000-0000-4000-8000-000000000012', current_date, 'manual', 'equal', '{}', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001');
insert into public.expense_shares (expense_id, household_id, member_id, share_cents, allocation_order) values
  ('90000000-0000-4000-8000-000000000030', '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000012', 100, 0),
  ('90000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000013', 100, 0);

set local role service_role;
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","role":"service_role"}', true);
select lives_ok($$
  select public.apply_member_billing_dates(
    '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000012',
    current_date - 10, null, current_date, null, '[]', false,
    '90000000-0000-4000-8000-000000000001')
$$, 'admin can correct In date');
select is((select in_date from public.household_members where id = '90000000-0000-4000-8000-000000000012'), current_date - 10, 'corrected In date is stored');
update public.households set balance_strategy = 'default' where id = '90000000-0000-4000-8000-000000000010';
select throws_ok($$
  select public.apply_member_billing_dates(
    '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000012',
    current_date - 10, current_date, current_date - 10, null, '[]', true,
    '90000000-0000-4000-8000-000000000001')
$$, '23514', 'member must settle direct debts before removal', 'Standard blocks offsetting direct debts');
update public.households set balance_strategy = 'simplified' where id = '90000000-0000-4000-8000-000000000010';
select lives_ok($$
  select public.apply_member_billing_dates(
    '90000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000012',
    current_date - 10, current_date, current_date - 10, null, '[]', true,
    '90000000-0000-4000-8000-000000000001')
$$, 'Simplified allows a zero-net departure');
select ok((select removed_at is not null from public.household_members where id = '90000000-0000-4000-8000-000000000012'), 'departed member is removed but history remains');

insert into public.expenses (
  id, household_id, title, total_cents, currency, payer_member_id, paid_by_landlord,
  expense_date, kind, split_method, split_config, created_by, updated_by
) values
  ('90000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000020', 'A covered Owner', 100, 'EUR', '90000000-0000-4000-8000-000000000022', false, current_date, 'manual', 'equal', '{}', '90000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000004'),
  ('90000000-0000-4000-8000-000000000033', '90000000-0000-4000-8000-000000000020', 'Landlord bill', 100, 'EUR', null, true, current_date, 'manual', 'equal', '{}', '90000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000004'),
  ('90000000-0000-4000-8000-000000000034', '90000000-0000-4000-8000-000000000020', 'Owner landlord bill', 100, 'EUR', null, true, current_date, 'manual', 'equal', '{}', '90000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000004');
insert into public.expense_shares (expense_id, household_id, member_id, share_cents, allocation_order) values
  ('90000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000020', '90000000-0000-4000-8000-000000000021', 100, 0),
  ('90000000-0000-4000-8000-000000000033', '90000000-0000-4000-8000-000000000020', '90000000-0000-4000-8000-000000000022', 100, 0),
  ('90000000-0000-4000-8000-000000000034', '90000000-0000-4000-8000-000000000020', '90000000-0000-4000-8000-000000000021', 100, 0);
select lives_ok($$
  select public.apply_member_billing_dates(
    '90000000-0000-4000-8000-000000000020', '90000000-0000-4000-8000-000000000022',
    current_date, current_date, current_date, null, '[]', true,
    '90000000-0000-4000-8000-000000000004')
$$, 'Combined permits an offsetting group credit and landlord debt');
update public.households set balance_strategy = 'default' where id = '90000000-0000-4000-8000-000000000020';
select is(public.record_landlord_balance_payment(
  '90000000-0000-4000-8000-000000000020', '90000000-0000-4000-8000-000000000021',
  100, 'EUR', current_date, 'Routed after departure', true,
  '90000000-0000-4000-8000-000000000004'
), 1, 'remaining member can pay former member bill after mode change');
select is((select count(*) from public.landlord_payments where household_id = '90000000-0000-4000-8000-000000000020' and member_id = '90000000-0000-4000-8000-000000000022' and linked_settlement_id is not null), 1::bigint, 'former member bill payment links offsetting settlement');
select is((select count(*) from public.landlord_payments where expense_id = '90000000-0000-4000-8000-000000000034'), 0::bigint, 'routed payment leaves payer own bill untouched until former member bill is covered');
select throws_ok($check$
  insert into public.expenses (
    id, household_id, title, total_cents, currency, payer_member_id, expense_date,
    kind, split_method, split_config, created_by, updated_by
  ) values (
    '90000000-0000-4000-8000-000000000035', '90000000-0000-4000-8000-000000000020',
    'Stale bill', 100, 'EUR', '90000000-0000-4000-8000-000000000021', current_date,
    'manual', 'equal', jsonb_build_object('method', 'utility', 'billingDates',
      jsonb_build_array(jsonb_build_object('memberId', '90000000-0000-4000-8000-000000000021',
        'inDate', current_date - 1, 'outDate', null))),
    '90000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000004'
  )
$check$, '40001', 'member billing dates changed; reload and try again',
  'utility bill write rejects a stale date snapshot');
select throws_ok($check$
do $body$ begin
insert into public.expenses (
  id, household_id, title, total_cents, currency, payer_member_id, expense_date,
  kind, split_method, split_config, created_by, updated_by
) values (
  '90000000-0000-4000-8000-000000000036', '90000000-0000-4000-8000-000000000010',
  'Invalid former member share', 100, 'EUR', '90000000-0000-4000-8000-000000000011', current_date,
  'manual', 'equal', '{}', '90000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001'
);
insert into public.expense_shares (expense_id, household_id, member_id, share_cents, allocation_order)
values ('90000000-0000-4000-8000-000000000036', '90000000-0000-4000-8000-000000000010',
  '90000000-0000-4000-8000-000000000012', 100, 0);
set constraints all immediate;
end $body$;
$check$, '23514',
  'departed member balance would change; restore membership first',
  'historical edits cannot create an unpayable former-member balance');
select * from finish();
rollback;
