begin;

create extension if not exists pgtap with schema extensions;
select plan(40);

select set_config('app.suppress_audit', 'true', true);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-00000000a001', 'a@internal.invalid'),
  ('00000000-0000-4000-8000-00000000a002', 'b@internal.invalid'),
  ('00000000-0000-4000-8000-00000000a003', 'c@internal.invalid'),
  ('00000000-0000-4000-8000-00000000a004', 'removed@internal.invalid'),
  ('00000000-0000-4000-8000-00000000a005', 'joining@internal.invalid');

insert into public.households (
  id, name, default_currency, locale, timezone, access_code_digest, house_code, join_pin_digest, created_by
) values
  ('00000000-0000-4000-8000-00000000b001', 'First home', 'EUR', 'en-GB', 'UTC', 'digest-one', 'FROSKO-8101', repeat('1', 64), '00000000-0000-4000-8000-00000000a001'),
  ('00000000-0000-4000-8000-00000000b002', 'Other home', 'EUR', 'en-GB', 'UTC', 'digest-two', 'FROSKO-8102', repeat('2', 64), '00000000-0000-4000-8000-00000000a003');

insert into public.household_members (id, household_id, user_id, display_name, role, removed_at)
values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001', 'Andrea', 'owner', null),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a002', 'Luca', 'member', null),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a003', 'Marco', 'owner', null),
  ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a004', 'Former member', 'member', now());

insert into public.bill_documents (
  id, household_id, uploader_user_id, storage_path, detected_mime, byte_count, page_count, status
) values (
  '00000000-0000-4000-8000-00000000d002',
  '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000b001/test-bill',
  'application/pdf', 100, 1, 'ready'
);

insert into public.expenses (
  id, household_id, title, total_cents, currency, payer_member_id, expense_date,
  kind, split_method, split_config, created_by, updated_by
) values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000b001', 'First expense', 100, 'EUR', '00000000-0000-4000-8000-00000000c001', current_date, 'manual', 'equal', '{}', '00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000a001'),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000b002', 'Hidden expense', 100, 'EUR', '00000000-0000-4000-8000-00000000c003', current_date, 'manual', 'equal', '{}', '00000000-0000-4000-8000-00000000a003', '00000000-0000-4000-8000-00000000a003');

insert into public.expense_shares (expense_id, household_id, member_id, share_cents, allocation_order)
values
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000c001', 100, 0),
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000c003', 100, 0);

insert into public.recurring_expense_rules (
  id, household_id, title, amount_cents, currency, payer_member_id, split_method,
  split_config, anchor_date, next_due_date, created_by, updated_by
) values (
  '00000000-0000-4000-8000-00000000d001',
  '00000000-0000-4000-8000-00000000b001',
  'Internet', 100, 'EUR', '00000000-0000-4000-8000-00000000c001', 'equal',
  '{"method":"equal","participants":[{"memberId":"00000000-0000-4000-8000-00000000c001","order":0},{"memberId":"00000000-0000-4000-8000-00000000c002","order":1}]}'::jsonb,
  '2030-01-31', '2030-01-31',
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a001'
);

select set_config('app.suppress_audit', 'false', true);

insert into public.audit_events (
  id, household_id, actor_user_id, action_type, entity_type, entity_id, summary
) values (
  '00000000-0000-4000-8000-00000000f001',
  '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000a001',
  'updated', 'expense', '00000000-0000-4000-8000-00000000e001',
  'Andrea updated an expense.'
);

insert into public.notifications (
  recipient_user_id, household_id, actor_user_id, audit_event_id,
  event_type, message, related_entity_type, related_entity_id
) values (
  '00000000-0000-4000-8000-00000000a004',
  '00000000-0000-4000-8000-00000000b001',
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000f001',
  'updated', 'Historical notification', 'expense',
  '00000000-0000-4000-8000-00000000e001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}',
  true
);

select is((select count(*) from public.households), 1::bigint, 'members see their household');
select ok(
  has_column_privilege('authenticated', 'public.households', 'house_code', 'SELECT'),
  'members can read their House Code'
);
select ok(
  not has_column_privilege('authenticated', 'public.households', 'join_pin_digest', 'SELECT'),
  'members cannot read the Join PIN digest'
);
select is(
  (select count(*) from public.households where id = '00000000-0000-4000-8000-00000000b002'),
  0::bigint,
  'members cannot see another household'
);
select is((select count(*) from public.expenses), 1::bigint, 'members see their expense rows');
select is(
  (select count(*) from public.expenses where id = '00000000-0000-4000-8000-00000000e002'),
  0::bigint,
  'members cannot see another household expense'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'),
  'audit entries cannot be updated by members'
);
select ok(
  not has_table_privilege('authenticated', 'public.landlord_payments', 'INSERT'),
  'landlord payments cannot be inserted directly by members'
);
select is(
  (select count(*) from information_schema.routine_privileges where grantee = 'authenticated' and routine_name = 'create_expense_with_shares'),
  0::bigint,
  'authenticated clients cannot commit caller-supplied expense shares directly'
);
select lives_ok(
  $test$
  update public.households
  set house_code = 'FROSKO-8201', access_code_digest = 'replacement-digest'
  where id = '00000000-0000-4000-8000-00000000b001'
  $test$,
  'the owner can change the House Code'
);
select lives_ok(
  $test$
  update public.households
  set join_pin_digest = repeat('a', 64)
  where id = '00000000-0000-4000-8000-00000000b001'
  $test$,
  'the owner can change the House Join PIN digest'
);

reset role;
select is(
  (select count(*) from public.audit_events where summary = 'The owner changed the House Code.'),
  1::bigint,
  'changing the House Code creates a clear audit event'
);
select is(
  (select count(*) from public.audit_events where summary = 'The owner changed the House Join PIN.'),
  1::bigint,
  'changing the Join PIN creates a clear audit event'
);
select is(
  (
    select count(*)
    from public.audit_events
    where coalesce(previous_values, '{}'::jsonb) ? 'join_pin_digest'
       or coalesce(new_values, '{}'::jsonb) ? 'join_pin_digest'
  ),
  0::bigint,
  'audit snapshots never contain a Join PIN digest'
);
select is(
  (select count(*) from public.notifications where audit_event_id = '00000000-0000-4000-8000-00000000f001' and recipient_user_id = '00000000-0000-4000-8000-00000000a001'),
  0::bigint,
  'the actor is excluded from notifications'
);
select is(
  (select count(*) from public.notifications where audit_event_id = '00000000-0000-4000-8000-00000000f001' and recipient_user_id = '00000000-0000-4000-8000-00000000a002'),
  1::bigint,
  'another active roommate receives one notification'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a004","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.notifications where household_id = '00000000-0000-4000-8000-00000000b001'),
  0::bigint,
  'a removed member cannot read historical household notifications'
);
reset role;

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  (select count(*) from public.households where house_code = 'FROSKO-8201'),
  1::bigint,
  'the server can resolve a House Code before sign-in'
);
select lives_ok(
  $test$
  insert into public.household_members (household_id, user_id, display_name, role)
  values (
    '00000000-0000-4000-8000-00000000b001',
    '00000000-0000-4000-8000-00000000a005',
    'Joining roommate',
    'member'
  )
  $test$,
  'the server can add an Auth-provisioned roommate to a household'
);
select is(
  (select count(*) from public.recurring_expense_rules where active and archived_at is null),
  1::bigint,
  'the recurring server job can read due rules'
);
select lives_ok(
  $test$
  select public.create_expense_with_shares(
    p_household_id => '00000000-0000-4000-8000-00000000b001',
    p_title => 'Server-authorized expense',
    p_total_cents => 100,
    p_currency => 'EUR',
    p_payer_member_id => '00000000-0000-4000-8000-00000000c001',
    p_expense_date => '2030-01-30',
    p_kind => 'manual',
    p_split_method => 'equal',
    p_split_config => '{"method":"equal","participants":[{"memberId":"00000000-0000-4000-8000-00000000c001","order":0},{"memberId":"00000000-0000-4000-8000-00000000c002","order":1}]}'::jsonb,
    p_shares => '[{"member_id":"00000000-0000-4000-8000-00000000c001","share_cents":50,"allocation_order":0},{"member_id":"00000000-0000-4000-8000-00000000c002","share_cents":50,"allocation_order":1}]'::jsonb,
    p_actor_user_id => '00000000-0000-4000-8000-00000000a001'
  )
  $test$,
  'the service-only expense commit accepts a verified actor and complete shares'
);
select lives_ok(
  $test$
  update public.households
  set landlord_enabled = true
  where id = '00000000-0000-4000-8000-00000000b001';

  create temporary table landlord_test_expense as
  select public.create_expense_with_landlord_support(
    p_household_id => '00000000-0000-4000-8000-00000000b001',
    p_title => 'Landlord gas',
    p_total_cents => 100,
    p_currency => 'EUR',
    p_payer_member_id => null,
    p_paid_by_landlord => true,
    p_expense_date => '2030-01-30',
    p_kind => 'manual',
    p_split_method => 'equal',
    p_split_config => '{"method":"equal","participants":[{"memberId":"00000000-0000-4000-8000-00000000c001","order":0},{"memberId":"00000000-0000-4000-8000-00000000c002","order":1}]}'::jsonb,
    p_shares => '[{"member_id":"00000000-0000-4000-8000-00000000c001","share_cents":50,"allocation_order":0},{"member_id":"00000000-0000-4000-8000-00000000c002","share_cents":50,"allocation_order":1}]'::jsonb,
    p_actor_user_id => '00000000-0000-4000-8000-00000000a001'
  ) as expense_id
  $test$,
  'the service can create an expense paid by the enabled Landlord'
);
select is(
  (
    select string_agg(member_id::text || ':' || net_cents::text, ',' order by member_id)
    from public.household_balances
    where household_id = '00000000-0000-4000-8000-00000000b001' and currency = 'EUR'
  ),
  '00000000-0000-4000-8000-00000000c001:50,00000000-0000-4000-8000-00000000c002:-50',
  'a Landlord-paid expense does not change roommate balances'
);
select lives_ok(
  $test$
  select public.record_landlord_payment(
    '00000000-0000-4000-8000-00000000b001',
    (select expense_id from landlord_test_expense),
    20,
    '2030-02-01',
    false,
    '00000000-0000-4000-8000-00000000a001'
  )
  $test$,
  'a member can record a partial Landlord payment through the service'
);
select is(
  (
    select s.share_cents - coalesce(sum(p.amount_cents), 0)
    from public.expense_shares s
    left join public.landlord_payments p
      on p.expense_id = s.expense_id and p.member_id = s.member_id and p.voided_at is null
    where s.expense_id = (select expense_id from landlord_test_expense)
      and s.member_id = '00000000-0000-4000-8000-00000000c001'
    group by s.share_cents
  ),
  30::bigint,
  'partial Landlord payments leave the correct derived remainder'
);
select lives_ok(
  $test$
  select public.record_landlord_payment(
    '00000000-0000-4000-8000-00000000b001',
    (select expense_id from landlord_test_expense),
    0,
    '2030-02-02',
    true,
    '00000000-0000-4000-8000-00000000a001'
  )
  $test$,
  'mark as paid records exactly the remaining Landlord amount'
);
select is(
  (
    select sum(amount_cents)
    from public.landlord_payments
    where expense_id = (select expense_id from landlord_test_expense)
      and member_id = '00000000-0000-4000-8000-00000000c001'
      and voided_at is null
  ),
  50::numeric,
  'Landlord payment records add up to the original member share'
);
select is(
  (
    select count(*)
    from public.audit_events
    where entity_type = 'landlord_payment'
      and actor_user_id = '00000000-0000-4000-8000-00000000a001'
  ),
  2::bigint,
  'partial and full Landlord payments each create an audit event'
);
select is(
  (
    select count(*)
    from public.notifications n
    join public.audit_events a on a.id = n.audit_event_id
    where a.entity_type = 'landlord_payment'
      and n.recipient_user_id = '00000000-0000-4000-8000-00000000a001'
  ),
  0::bigint,
  'the Landlord payment actor is not notified'
);
select is(
  (
    select count(*)
    from public.notifications n
    join public.audit_events a on a.id = n.audit_event_id
    where a.entity_type = 'landlord_payment'
      and n.recipient_user_id = '00000000-0000-4000-8000-00000000a002'
  ),
  2::bigint,
  'another active member is notified about each Landlord payment'
);
select lives_ok(
  $test$
  select public.reopen_landlord_bill(
    '00000000-0000-4000-8000-00000000b001',
    (select expense_id from landlord_test_expense),
    '00000000-0000-4000-8000-00000000a001'
  )
  $test$,
  'a member can revert a mistaken Landlord paid mark through the service'
);
select is(
  (
    select count(*)
    from public.landlord_payments
    where expense_id = (select expense_id from landlord_test_expense)
      and member_id = '00000000-0000-4000-8000-00000000c001'
      and voided_at is null
  ),
  0::bigint,
  'reverting the paid mark voids active payments without deleting them'
);
select is(
  (
    select count(*)
    from public.landlord_payments
    where expense_id = (select expense_id from landlord_test_expense)
      and member_id = '00000000-0000-4000-8000-00000000c001'
  ),
  2::bigint,
  'reverting keeps the original Landlord payment records as history'
);
select is(
  (
    select count(*)
    from public.audit_events
    where action_type = 'reopened'
      and entity_type = 'landlord_payment'
      and entity_id = (select expense_id from landlord_test_expense)
  ),
  1::bigint,
  'reverting the Landlord paid mark creates one audit event'
);
select lives_ok(
  $test$
  select public.create_utility_bill_with_shares(
    p_household_id => '00000000-0000-4000-8000-00000000b001',
    p_title => 'Gas bill',
    p_total_cents => 100,
    p_currency => 'EUR',
    p_payer_member_id => '00000000-0000-4000-8000-00000000c001',
    p_expense_date => '2030-01-30',
    p_split_config => '{"method":"utility","participants":[{"memberId":"00000000-0000-4000-8000-00000000c001","order":0},{"memberId":"00000000-0000-4000-8000-00000000c002","order":1}],"fixedCents":50,"variableCents":50}'::jsonb,
    p_shares => '[{"member_id":"00000000-0000-4000-8000-00000000c001","share_cents":50,"fixed_share_cents":25,"variable_share_cents":25,"presence_days":31,"allocation_order":0},{"member_id":"00000000-0000-4000-8000-00000000c002","share_cents":50,"fixed_share_cents":25,"variable_share_cents":25,"presence_days":31,"allocation_order":1}]'::jsonb,
    p_utility_type => 'gas',
    p_supplier => null,
    p_issue_date => '2030-01-30',
    p_service_start_date => '2030-01-01',
    p_service_end_date => '2030-01-31',
    p_fixed_cents => 50,
    p_variable_cents => 50,
    p_bill_document_id => '00000000-0000-4000-8000-00000000d002',
    p_variable_split_mode => 'occupancy',
    p_actor_user_id => '00000000-0000-4000-8000-00000000a001'
  )
  $test$,
  'a ready bill document can be confirmed once'
);
select throws_like(
  $test$
  select public.create_utility_bill_with_shares(
    p_household_id => '00000000-0000-4000-8000-00000000b001',
    p_title => 'Duplicate gas bill',
    p_total_cents => 100,
    p_currency => 'EUR',
    p_payer_member_id => '00000000-0000-4000-8000-00000000c001',
    p_expense_date => '2030-01-30',
    p_split_config => '{"method":"utility","participants":[{"memberId":"00000000-0000-4000-8000-00000000c001","order":0},{"memberId":"00000000-0000-4000-8000-00000000c002","order":1}],"fixedCents":50,"variableCents":50}'::jsonb,
    p_shares => '[{"member_id":"00000000-0000-4000-8000-00000000c001","share_cents":50,"fixed_share_cents":25,"variable_share_cents":25,"presence_days":31,"allocation_order":0},{"member_id":"00000000-0000-4000-8000-00000000c002","share_cents":50,"fixed_share_cents":25,"variable_share_cents":25,"presence_days":31,"allocation_order":1}]'::jsonb,
    p_utility_type => 'gas',
    p_supplier => null,
    p_issue_date => '2030-01-30',
    p_service_start_date => '2030-01-01',
    p_service_end_date => '2030-01-31',
    p_fixed_cents => 50,
    p_variable_cents => 50,
    p_bill_document_id => '00000000-0000-4000-8000-00000000d002',
    p_variable_split_mode => 'occupancy',
    p_actor_user_id => '00000000-0000-4000-8000-00000000a001'
  )
  $test$,
  '%already confirmed%',
  'the same bill document cannot create a second expense'
);
select lives_ok(
  $test$
  select public.service_create_recurring_occurrence(
    '00000000-0000-4000-8000-00000000d001',
    '2030-01-31',
    '[{"member_id":"00000000-0000-4000-8000-00000000c001","share_cents":50,"allocation_order":0},{"member_id":"00000000-0000-4000-8000-00000000c002","share_cents":50,"allocation_order":1}]'::jsonb,
    '2030-02-28'
  )
  $test$,
  'the first recurring generation succeeds'
);
select lives_ok(
  $test$
  select public.service_create_recurring_occurrence(
    '00000000-0000-4000-8000-00000000d001',
    '2030-01-31',
    '[{"member_id":"00000000-0000-4000-8000-00000000c001","share_cents":50,"allocation_order":0},{"member_id":"00000000-0000-4000-8000-00000000c002","share_cents":50,"allocation_order":1}]'::jsonb,
    '2030-02-28'
  )
  $test$,
  'replaying the same recurring occurrence succeeds'
);
reset role;
select is(
  (select count(*) from public.expenses where recurring_rule_id = '00000000-0000-4000-8000-00000000d001'),
  1::bigint,
  'recurring replay creates only one expense'
);
select is(
  (select next_due_date from public.recurring_expense_rules where id = '00000000-0000-4000-8000-00000000d001'),
  '2030-02-28'::date,
  'recurring replay advances the due date idempotently'
);
select * from finish();
rollback;
