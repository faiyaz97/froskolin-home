begin;
create extension if not exists pgtap with schema extensions;
select plan(24);
select set_config('app.suppress_audit', 'true', true);
insert into auth.users (id, email) values
 ('10000000-0000-4000-8000-000000000001','admin@test.invalid'),
 ('10000000-0000-4000-8000-000000000002','member@test.invalid'),
 ('10000000-0000-4000-8000-000000000003','other@test.invalid'),
 ('10000000-0000-4000-8000-000000000004','third@test.invalid');
insert into public.households (id,name,default_currency,locale,timezone,access_code_digest,house_code,join_pin_digest,created_by) values
 ('20000000-0000-4000-8000-000000000001','Admin test','EUR','en-GB','UTC','admin-test-one','FROSKO-9801',repeat('1',64),'10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','Other test','EUR','en-GB','UTC','admin-test-two','FROSKO-9802',repeat('2',64),'10000000-0000-4000-8000-000000000003');
insert into public.household_members (id,household_id,user_id,display_name,role) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Admin','owner'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Member','member'),
 ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003','Other','owner'),
 ('30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','Third','member');
select set_config('app.suppress_audit', 'false', true);
select ok(not has_function_privilege('anon','public.promote_group_member(uuid,uuid)','execute'),'Anonymous users cannot promote');
select ok(not has_column_privilege('authenticated','public.household_members','role','update'),'Direct role writes are forbidden');
select ok(not (select prosecdef from pg_proc where oid='public.promote_group_member(uuid,uuid)'::regprocedure),'Public entry point is invoker');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')$$,'42501','admin access required','Member cannot self-promote');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')$$,'42501','admin access required','Another group admin has no access');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"must_change_pin":true}}',true);
select throws_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')$$,'42501','change your PIN first','Pending PIN change blocks promotion');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003')$$,'22023','active group member not found','Cross-group target rejected');
select throws_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000099')$$,'22023','active group member not found','Missing target rejected');
select lives_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')$$,'Admin can promote');
select is((select count(*)::integer from public.household_members where household_id='20000000-0000-4000-8000-000000000001' and role='owner'),2,'Both admins remain');
select lives_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')$$,'Repeated promotion is idempotent');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select ok(private.is_household_owner('20000000-0000-4000-8000-000000000001'),'Promoted admin has admin permissions');
select lives_ok($$select public.promote_group_member('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004')$$,'Promoted admin can promote others');
select is((select count(*)::integer from public.household_members where household_id='20000000-0000-4000-8000-000000000001' and role='owner'),3,'Multiple admins supported');
select throws_ok($$select public.demote_group_admin('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003')$$,'22023','active group member not found','Demotion cannot cross groups');
select lives_ok($$select public.demote_group_admin('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001')$$,'Admin can demote another admin');
select is((select role::text from public.household_members where id='30000000-0000-4000-8000-000000000001'),'member','Demoted admin remains a member');
select lives_ok($$select public.demote_group_admin('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002')$$,'Admin can step down while another remains');
select throws_ok($$select public.demote_group_admin('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004')$$,'42501','admin access required','Demoted admin immediately loses role-management access');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select public.demote_group_admin('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000004')$$,'23514','group requires at least one admin','Last admin cannot step down');
select is((select count(*)::integer from public.household_members where household_id='20000000-0000-4000-8000-000000000001' and role='owner'),1,'At least one admin remains');
reset role;
select ok(not has_function_privilege('anon','public.demote_group_admin(uuid,uuid)','execute'),'Anonymous demotion is forbidden');
select is((select count(*)::integer from public.audit_events where entity_id='30000000-0000-4000-8000-000000000002' and previous_values->>'role'='member' and new_values->>'role'='owner'),1,'Promotion is audited once, including the role change');
select ok(exists(select 1 from pg_trigger where tgname='household_members_owner_required' and tgdeferrable),'At least one admin invariant remains deferred');
select * from finish();
rollback;
