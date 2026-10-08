-- Run after the migration. Every check raises an exception on failure, so
-- `psql -v ON_ERROR_STOP=1 -f` exits non-zero if any rule is broken.

create or replace function pg_temp.act_as(p_user uuid, p_role text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  perform set_config('request.jwt.claim.role', p_role, false);
  execute format('set role %I', p_role);
end $$;

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Run a statement and require it to fail, with an optional message fragment.
create or replace function pg_temp.must_fail(p_sql text, p_fragment text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_fragment is null or sqlerrm ilike '%' || p_fragment || '%' then
      raise notice 'ok - % (%)', p_msg, sqlerrm;
      return;
    end if;
    raise exception 'FAILED: % raised the wrong error: %', p_msg, sqlerrm;
  end;
  raise exception 'FAILED: % should have failed but succeeded', p_msg;
end $$;

reset role;
insert into auth.users (id) values
  ('aaaaaaaa-0000-4000-8000-000000000001'),
  ('bbbbbbbb-0000-4000-8000-000000000002'),
  ('cccccccc-0000-4000-8000-000000000003');

-- ---------------------------------------------------------- onboarding
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated');
select public.create_organization('Alpha Dental', 'Alpha Dental');
select pg_temp.must_fail(
  $$select public.create_organization('Second', 'Second')$$,
  'already belongs', 'a user cannot create a second organization');

select pg_temp.act_as('bbbbbbbb-0000-4000-8000-000000000002', 'authenticated');
select public.create_organization('Beta Plumbing', 'Beta Plumbing');

select pg_temp.act_as(null, 'anon');
select pg_temp.must_fail(
  $$select public.create_organization('Anon', 'Anon')$$, null,
  'anonymous callers cannot create organizations');

-- ----------------------------------------------- service-role call writes
select pg_temp.act_as(null, 'service_role');
create temp table ids as
  select
    (select id from public.organizations where name = 'Alpha Dental') as org_a,
    (select id from public.organizations where name = 'Beta Plumbing') as org_b,
    (select a.id from public.agents a join public.organizations o on o.id = a.org_id where o.name = 'Alpha Dental') as agent_a,
    (select a.id from public.agents a join public.organizations o on o.id = a.org_id where o.name = 'Beta Plumbing') as agent_b;
grant select on ids to authenticated, anon;

select public.persist_call(
  (select org_a from ids), (select agent_a from ids), 'call-1',
  '+27820000001', 'Thabo', now() - interval '1 hour', now() - interval '1 hour' + interval '61 seconds', 61,
  'transcript A', 'summary A', 'booked', 'customer-ended-call', null, '{}'::jsonb,
  'Check-up', now() + interval '2 days', null, 'Thabo', null, '+27820000001', 'mornings', null, true);

-- Same call delivered again (webhook retry): must not duplicate anything.
select public.persist_call(
  (select org_a from ids), (select agent_a from ids), 'call-1',
  '+27820000001', 'Thabo', now() - interval '1 hour', now() - interval '1 hour' + interval '61 seconds', 61,
  'transcript A v2', 'summary A', 'booked', 'customer-ended-call', null, '{}'::jsonb,
  'Check-up (updated)', now() + interval '2 days', null, 'Thabo', null, '+27820000001', 'mornings', null, true);

select pg_temp.check((select count(*) from public.calls where provider_call_id = 'call-1') = 1, 'redelivered call is stored once');
select pg_temp.check((select count(*) from public.bookings where org_id = (select org_a from ids)) = 1, 'redelivered call does not duplicate its booking');
select pg_temp.check((select transcript from public.calls where provider_call_id = 'call-1') = 'transcript A v2', 'redelivery updates the stored call');

select pg_temp.must_fail(
  $$select public.persist_call((select org_b from ids), (select agent_b from ids), 'call-1', null, null, null, null, null, null, null, 'unresolved', null, null, '{}'::jsonb, null, null, null, null, null, null, null, null, false)$$,
  'different organization', 'a provider call id cannot move between tenants');

-- A second call for Alpha (30s -> 1 minute) and one for Beta.
select public.persist_call(
  (select org_a from ids), (select agent_a from ids), 'call-2', '+27820000002', null,
  now() - interval '30 minutes', now(), 30, 't', 's', 'message_taken', null, null, '{}'::jsonb,
  null, null, null, null, null, null, null, null, false);
select public.persist_call(
  (select org_b from ids), (select agent_b from ids), 'call-3', '+27820000003', 'Lerato',
  now() - interval '10 minutes', now(), 125, 'beta secret transcript', 's', 'callback_requested', null, null, '{}'::jsonb,
  null, null, null, null, null, null, null, null, false);

-- -------------------------------------------------------- tenant isolation
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated');
select pg_temp.check((select count(*) from public.calls) = 2, 'tenant A sees only its own 2 calls');
select pg_temp.check((select count(*) from public.calls where org_id = (select org_b from ids)) = 0, 'tenant A cannot see tenant B calls');
select pg_temp.check((select count(*) from public.bookings) = 1, 'tenant A sees only its own bookings');
select pg_temp.check((select count(*) from public.organizations) = 1, 'tenant A sees only its own organization');
select pg_temp.check((select count(*) from public.agents) = 1, 'tenant A sees only its own agent');
select pg_temp.check((select count(*) from public.memberships) = 1, 'tenant A sees only its own membership');
select pg_temp.check(public.org_minutes_used((select org_a from ids), now() - interval '1 day') = 3, 'usage rounds each call up: 61s -> 2 min, 30s -> 1 min = 3');
select pg_temp.check(public.org_minutes_used((select org_b from ids), now() - interval '1 day') = 0, 'usage for another tenant reads as 0 under RLS');

-- ------------------------------------------- customers cannot tamper
-- (still acting as tenant A)
update public.agents set business_name = 'Alpha Dental Studio', business_hours = 'Mon-Fri 8-5';
select pg_temp.check((select business_name from public.agents) = 'Alpha Dental Studio', 'tenant can edit its own business profile');

select pg_temp.must_fail($$update public.agents set status = 'live'$$, 'read-only', 'tenant cannot mark its own agent live');
select pg_temp.must_fail($$update public.agents set vapi_assistant_id = 'hijack'$$, 'read-only', 'tenant cannot set provisioning ids');
select pg_temp.must_fail($$update public.agents set phone_number = '+27100000000'$$, 'read-only', 'tenant cannot assign itself a phone number');
select pg_temp.must_fail($$update public.agents set org_id = (select org_b from ids)$$, null, 'tenant cannot move its agent to another organization');

-- Cannot touch another tenant's rows: UPDATE matches 0 rows, nothing changes.
update public.agents set business_name = 'pwned' where id = (select agent_b from ids);
update public.organizations set plan = 'business' where id = (select org_b from ids);
update public.organizations set plan = 'business';           -- own org: allowed by policy? must NOT be
reset role;
select pg_temp.check((select business_name from public.agents where id = (select agent_b from ids)) = 'Beta Plumbing', 'tenant cannot edit another tenant agent');
select pg_temp.check((select plan from public.organizations where id = (select org_b from ids)) = 'trial', 'tenant cannot change another tenant plan');
select pg_temp.check((select plan from public.organizations where id = (select org_a from ids)) = 'trial', 'tenant cannot upgrade its own plan for free');

select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated');
delete from public.calls;
delete from public.bookings;
delete from public.organizations;
reset role;
select pg_temp.check((select count(*) from public.calls) = 3, 'tenant cannot delete calls (RLS leaves all 3 rows)');
select pg_temp.check((select count(*) from public.organizations) = 2, 'tenant cannot delete organizations');

-- ---------------------------------------------- function privileges
select pg_temp.act_as('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated');
select pg_temp.must_fail($$select public.claim_phone_number((select agent_a from ids))$$, 'permission denied', 'tenants cannot call claim_phone_number');
select pg_temp.must_fail($$select public.persist_call((select org_a from ids), null, 'x', null, null, null, null, null, null, null, 'unresolved', null, null, '{}'::jsonb, null, null, null, null, null, null, null, null, false)$$, 'permission denied', 'tenants cannot call persist_call directly');
select pg_temp.check((select count(*) from public.phone_numbers) = 0, 'tenants see no phone numbers (no policy)');

-- --------------------------------------------------- phone number pool
select pg_temp.act_as(null, 'service_role');
insert into public.phone_numbers (e164, vapi_phone_number_id) values ('+27105550101', 'num-1'), ('+27105550102', 'num-2');

create temp table claims (who text, e164 text);
grant all on claims to service_role;
insert into claims select 'A', e164 from public.claim_phone_number((select agent_a from ids));
insert into claims select 'A again', e164 from public.claim_phone_number((select agent_a from ids));
insert into claims select 'B', e164 from public.claim_phone_number((select agent_b from ids));

select pg_temp.check((select e164 from claims where who = 'A') = (select e164 from claims where who = 'A again'), 'claiming twice returns the same number (idempotent)');
select pg_temp.check((select e164 from claims where who = 'A') <> (select e164 from claims where who = 'B'), 'two agents never share a number');

-- A third agent finds the pool empty.
reset role;
insert into auth.users (id) values ('dddddddd-0000-4000-8000-000000000004');
select pg_temp.act_as('dddddddd-0000-4000-8000-000000000004', 'authenticated');
select public.create_organization('Gamma Salon', 'Gamma Salon');
select pg_temp.act_as(null, 'service_role');
select pg_temp.must_fail(
  $$select * from public.claim_phone_number((select a.id from public.agents a join public.organizations o on o.id = a.org_id where o.name = 'Gamma Salon'))$$,
  'no free phone numbers', 'an empty pool raises a clear error');

reset role;
select 'ALL TENANT ISOLATION CHECKS PASSED' as result;
