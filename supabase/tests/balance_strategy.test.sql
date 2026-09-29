begin;

create extension if not exists pgtap with schema extensions;
select plan(40);
select set_config('app.suppress_audit', 'true', true);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'strategy-owner@internal.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'strategy-member@internal.invalid');
insert into public.households (
  id, name, default_currency, locale, timezone, access_code_digest,
  house_code, join_pin_digest, created_by, landlord_enabled
) values (
  '10000000-0000-4000-8000-000000000010', 'Strategy test', 'EUR', 'en-GB', 'UTC',
  'strategy-digest', 'FROSKO-9910', repeat('3', 64),
  '10000000-0000-4000-8000-000000000001', true
);
insert into public.household_members (
  id, household_id, user_id, display_name, role
) values
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'Owner', 'owner'),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000002', 'Member', 'member');
insert into public.expenses (
  id, household_id, title, total_cents, currency, payer_member_id,
  paid_by_landlord, expense_date, kind, split_method, split_config,
  created_by, updated_by
) values (
  '10000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000010', 'Landlord bill', 10000, 'EUR', null,
  true, current_date, 'manual', 'equal', '{}',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
);
insert into public.expense_shares (
  expense_id, household_id, member_id, share_cents, allocation_order
) values
  ('10000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011', 5000, 0),
  ('10000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000012', 5000, 1);

select is((select balance_strategy from public.households where id = '10000000-0000-4000-8000-000000000010'), 'super_simplified', 'new landlord groups start in Combined mode');
insert into public.households (
  id, name, locale, timezone, access_code_digest, house_code, join_pin_digest, created_by
) values (
  '10000000-0000-4000-8000-000000000013', 'Default mode test', 'en-GB', 'UTC',
  'default-mode-digest', 'FROSKO-9913', repeat('4', 64),
  '10000000-0000-4000-8000-000000000001'
);
select is((select default_currency from public.households where id = '10000000-0000-4000-8000-000000000013'), 'EUR', 'new groups default to EUR');
select is((select balance_strategy from public.households where id = '10000000-0000-4000-8000-000000000013'), 'simplified', 'new groups without Landlord mode start Simplified');
update public.households set landlord_enabled = true
where id = '10000000-0000-4000-8000-000000000013';
select is((select balance_strategy from public.households where id = '10000000-0000-4000-8000-000000000013'), 'super_simplified', 'enabling Landlord mode selects Combined');
update public.households set balance_strategy = 'default'
where id = '10000000-0000-4000-8000-000000000013';
update public.households set landlord_enabled = false
where id = '10000000-0000-4000-8000-000000000013';
update public.households set landlord_enabled = true
where id = '10000000-0000-4000-8000-000000000013';
select is((select balance_strategy from public.households where id = '10000000-0000-4000-8000-000000000013'), 'default', 'explicit Standard mode survives Landlord toggles');
select ok(not has_function_privilege('authenticated', 'public.record_landlord_balance_payment(uuid,uuid,bigint,character,date,text,boolean,uuid)', 'EXECUTE'), 'members cannot invoke the privileged landlord allocator');
select ok(not has_function_privilege('authenticated', 'public.void_linked_all_payment(uuid,uuid,text,uuid)', 'EXECUTE'), 'members cannot invoke the linked void RPC');
select ok(not has_function_privilege('authenticated', 'public.void_landlord_payment_group(uuid,uuid,text,uuid)', 'EXECUTE'), 'members cannot invoke the payment undo RPC');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
update public.households set balance_strategy = 'simplified'
where id = '10000000-0000-4000-8000-000000000010';
select is((select balance_strategy from public.households where id = '10000000-0000-4000-8000-000000000010'), 'super_simplified', 'non-admin cannot change balance strategy');
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.households set balance_strategy = 'super_simplified'
where id = '10000000-0000-4000-8000-000000000010';
select is((select balance_strategy from public.households where id = '10000000-0000-4000-8000-000000000010'), 'super_simplified', 'super simplified is available with landlord mode');
reset role;

-- Assertions below inspect RPC side effects as service_role; this grant is rolled
-- back with the test transaction and is not part of the application migration.
grant select on public.landlord_payments, public.settlements, public.audit_events to service_role;
set local role service_role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"service_role"}', true);
select set_config('app.suppress_audit', 'false', true);
select set_config('app.audit_count_before_strategy',
  (select count(*)::text from public.audit_events where entity_type = 'household'), true);
select is(public.set_balance_strategy(
  '10000000-0000-4000-8000-000000000010', 'simplified',
  '10000000-0000-4000-8000-000000000001'
), 'simplified', 'admin strategy RPC changes only the strategy');
select is((select count(*) from public.audit_events where entity_type = 'household'),
  current_setting('app.audit_count_before_strategy')::bigint,
  'strategy change does not create a history entry');
select public.set_balance_strategy(
  '10000000-0000-4000-8000-000000000010', 'super_simplified',
  '10000000-0000-4000-8000-000000000001'
);
select set_config('app.suppress_audit', 'true', true);
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$
  update public.household_members set removed_at = now()
  where id = '10000000-0000-4000-8000-000000000012'
$$, '42501', 'permission denied for table household_members', 'direct member removal is not permitted');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"service_role"}', true);

select is(public.record_landlord_balance_payment(
  '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011',
  2000, 'EUR', current_date, 'Own share', false, '10000000-0000-4000-8000-000000000001'
), 1, 'direct payment allocates to own bill share');
select is((select count(*) from public.landlord_payments where member_id = '10000000-0000-4000-8000-000000000011' and voided_at is null), 1::bigint, 'own landlord ledger reduced');
select is(public.record_landlord_balance_payment(
  '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011',
  8000, 'EUR', current_date, 'All payment', true, '10000000-0000-4000-8000-000000000001'
), 2, 'All payment completes own share and allocates another member share');
select is((select count(*) from public.landlord_payments where member_id = '10000000-0000-4000-8000-000000000012' and paid_by_member_id = '10000000-0000-4000-8000-000000000011' and linked_settlement_id is not null and voided_at is null), 1::bigint, 'actual payer and beneficiary are linked');
select is((select count(*) from public.settlements where paying_member_id = '10000000-0000-4000-8000-000000000011' and receiving_member_id = '10000000-0000-4000-8000-000000000012' and amount_cents = 5000 and voided_at is null), 1::bigint, 'member offset is recorded');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$
  update public.settlements set amount_cents = 1
  where id = (select linked_settlement_id from public.landlord_payments where linked_settlement_id is not null limit 1)
$$, '23514', 'linked All payments must be changed together', 'linked settlement cannot be edited alone');
select throws_ok($$
  update public.expenses set voided_at = now(), void_reason = 'Correction'
  where id = '10000000-0000-4000-8000-000000000020'
$$, '23514', 'reverse landlord payments before changing this bill', 'paid landlord bill cannot be voided');
reset role;
select throws_ok($$
  delete from public.expense_shares
  where expense_id = '10000000-0000-4000-8000-000000000020'
$$, '23514', 'reverse landlord payments before changing bill shares', 'paid landlord bill shares cannot be replaced');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$
  update public.households set default_currency = 'GBP'
  where id = '10000000-0000-4000-8000-000000000010'
$$, 'group currency can still be changed with a linked payment');
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"service_role"}', true);
select lives_ok($$
  select public.void_landlord_payment_group(
    '10000000-0000-4000-8000-000000000010',
    (select id from public.landlord_payments
      where household_id = '10000000-0000-4000-8000-000000000010'
        and linked_settlement_id is not null and voided_at is null limit 1),
    'Correction', '10000000-0000-4000-8000-000000000001'
  )
$$, 'linked payment reverses as one action');
select is((select count(*) from public.settlements
  where household_id = '10000000-0000-4000-8000-000000000010' and voided_at is null),
  0::bigint, 'linked member offset was reversed');
select is((select count(*) from public.landlord_payments
  where household_id = '10000000-0000-4000-8000-000000000010' and voided_at is null),
  1::bigint, 'linked landlord payment was reversed and direct payment retained');
select lives_ok($$
  select public.void_landlord_payment_group(
    '10000000-0000-4000-8000-000000000010',
    (select id from public.landlord_payments
      where household_id = '10000000-0000-4000-8000-000000000010' and voided_at is null limit 1),
    'Correction', '10000000-0000-4000-8000-000000000001'
  )
$$, 'direct landlord payment can be reversed on its own');
select is((select count(*) from public.landlord_payments
  where household_id = '10000000-0000-4000-8000-000000000010' and voided_at is null),
  0::bigint, 'direct landlord payment was reversed');
select is(public.record_landlord_balance_payment(
  '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011',
  10000, 'GBP', current_date, 'Combined transfer', true,
  '10000000-0000-4000-8000-000000000001'
), 2, 'one transfer allocates to both member shares');
select is((select count(*) from public.landlord_payments
  where household_id = '10000000-0000-4000-8000-000000000010' and voided_at is null),
  2::bigint, 'both allocations are active before undo');
select throws_ok($$
  select public.void_landlord_payment_group(
    '10000000-0000-4000-8000-000000000010',
    (select id from public.landlord_payments
      where household_id = '10000000-0000-4000-8000-000000000010'
        and voided_at is null limit 1),
    'Not my payment', '10000000-0000-4000-8000-000000000002'
  )
$$, '42501', 'only the payer or an admin may reverse this payment',
  'another member cannot undo the transfer from bill history');
select throws_ok($$
  select public.void_linked_all_payment(
    '10000000-0000-4000-8000-000000000010',
    (select linked_settlement_id from public.landlord_payments
      where household_id = '10000000-0000-4000-8000-000000000010'
        and voided_at is null and linked_settlement_id is not null limit 1),
    'Not my payment', '10000000-0000-4000-8000-000000000002'
  )
$$, '42501', 'only the payer or an admin may reverse this payment',
  'another member cannot undo the transfer through settlement detail');
select lives_ok($$
  select public.void_landlord_payment_group(
    '10000000-0000-4000-8000-000000000010',
    (select id from public.landlord_payments
      where household_id = '10000000-0000-4000-8000-000000000010'
        and voided_at is null order by member_id limit 1),
    'Correction', '10000000-0000-4000-8000-000000000001'
  )
$$, 'undoing one allocation reverses the entire transfer');
select is((select count(*) from public.landlord_payments
  where household_id = '10000000-0000-4000-8000-000000000010' and voided_at is null),
  0::bigint, 'all allocations of the transfer were reversed');
select is(public.record_landlord_balance_payment(
  '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011',
  5000, 'GBP', current_date, 'Paid own share', false,
  '10000000-0000-4000-8000-000000000001'
), 1, 'member pays their entire original share');
select throws_ok($$
  select public.record_landlord_balance_payment(
    '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011',
    5000, 'GBP', current_date, 'Later adjustment', true,
    '10000000-0000-4000-8000-000000000001'
  )
$$, '40001', 'landlord balance changed; reload and try again',
  'later expenses cannot reopen a fully paid bill contribution');
select is((select count(*) from public.landlord_payments
  where household_id = '10000000-0000-4000-8000-000000000010' and voided_at is null),
  1::bigint, 'rejected cover adds no landlord or linked settlement records');
select lives_ok($$
  select public.void_landlord_payment_group(
    '10000000-0000-4000-8000-000000000010',
    (select id from public.landlord_payments
      where household_id = '10000000-0000-4000-8000-000000000010'
        and voided_at is null limit 1),
    'Correction', '10000000-0000-4000-8000-000000000001'
  )
$$, 'undo unlocks the paid bill contribution');
select is(public.record_landlord_balance_payment(
  '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000011',
  10000, 'GBP', current_date, 'Recalculated transfer', true,
  '10000000-0000-4000-8000-000000000001'
), 2, 'one new payment can cover both shares after undo');
select lives_ok($$
  select public.void_landlord_payment_group(
    '10000000-0000-4000-8000-000000000010',
    (select id from public.landlord_payments
      where household_id = '10000000-0000-4000-8000-000000000010'
        and voided_at is null limit 1),
    'Correction', '10000000-0000-4000-8000-000000000001'
  )
$$, 'recalculated transfer can be undone');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.households set landlord_enabled = false
where id = '10000000-0000-4000-8000-000000000010';
select is((select balance_strategy from public.households where id = '10000000-0000-4000-8000-000000000010'), 'simplified', 'disabling landlord falls back to simplified');

select * from finish();
rollback;
