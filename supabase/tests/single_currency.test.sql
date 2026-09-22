begin;

create extension if not exists pgtap with schema extensions;
select plan(10);
select set_config('app.suppress_audit', 'true', true);

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'currency-owner@internal.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'currency-member@internal.invalid');

insert into public.households (
  id, name, default_currency, locale, timezone, access_code_digest, house_code,
  join_pin_digest, created_by
) values (
  '20000000-0000-4000-8000-000000000001', 'Currency group', 'EUR', 'en-GB', 'UTC',
  'currency-digest', 'FROSKO-9901', repeat('9', 64),
  '10000000-0000-4000-8000-000000000001'
);

insert into public.household_members (
  id, household_id, user_id, display_name, role
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Owner', 'owner'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'Member', 'member'
  );

insert into public.expenses (
  id, household_id, title, total_cents, currency, payer_member_id, expense_date,
  kind, split_method, split_config, created_by, updated_by
) values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Wrong currency expense', 1000, 'USD',
  '30000000-0000-4000-8000-000000000001', current_date,
  'manual', 'equal', '{}'::jsonb,
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
);

insert into public.settlements (
  id, household_id, paying_member_id, receiving_member_id, amount_cents,
  currency, settlement_date, created_by, updated_by
) values (
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  500, 'USD', current_date,
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
);

insert into public.recurring_expense_rules (
  id, household_id, title, amount_cents, currency, payer_member_id,
  split_method, split_config, anchor_date, next_due_date, created_by, updated_by
) values (
  '60000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Wrong currency recurring', 1000, 'USD',
  '30000000-0000-4000-8000-000000000001',
  'equal', '{}'::jsonb, current_date, current_date,
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
);

select is(
  (select currency::text from public.expenses where id = '40000000-0000-4000-8000-000000000001'),
  'EUR',
  'new expenses use the group currency'
);
select is(
  (select currency::text from public.settlements where id = '50000000-0000-4000-8000-000000000001'),
  'EUR',
  'new settlements use the group currency'
);
select is(
  (select currency::text from public.recurring_expense_rules where id = '60000000-0000-4000-8000-000000000001'),
  'EUR',
  'new recurring rules use the group currency'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $test$
  update public.households
  set default_currency = 'GBP'
  where id = '20000000-0000-4000-8000-000000000001'
  $test$,
  'an admin can change the group currency atomically'
);
reset role;

select is(
  (select default_currency::text from public.households where id = '20000000-0000-4000-8000-000000000001'),
  'GBP',
  'the group stores the new currency'
);
select is(
  (select currency::text from public.expenses where id = '40000000-0000-4000-8000-000000000001'),
  'GBP',
  'existing expenses change with the group currency'
);
select is(
  (select currency::text from public.settlements where id = '50000000-0000-4000-8000-000000000001'),
  'GBP',
  'existing settlements change with the group currency'
);
select is(
  (select currency::text from public.recurring_expense_rules where id = '60000000-0000-4000-8000-000000000001'),
  'GBP',
  'existing recurring rules change with the group currency'
);

update public.expenses
set currency = 'USD'
where id = '40000000-0000-4000-8000-000000000001';
select is(
  (select currency::text from public.expenses where id = '40000000-0000-4000-8000-000000000001'),
  'GBP',
  'direct financial-row updates cannot diverge from the group currency'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
update public.households
set default_currency = 'USD'
where id = '20000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select default_currency::text from public.households where id = '20000000-0000-4000-8000-000000000001'),
  'GBP',
  'ordinary members cannot change the group currency'
);

select * from finish();
rollback;
