-- AI Receptionist: multi-tenant schema.
-- Every business (organization) gets one AI agent, one phone line from a
-- shared pool, a call log, bookings and a plan. All tenant data is isolated
-- with row level security; the voice webhook and billing webhook write with
-- the service role.

create type public.plan_id as enum ('trial', 'starter', 'pro', 'business');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled'
);
create type public.agent_status as enum (
  'draft', 'provisioning', 'live', 'paused', 'error'
);
create type public.call_outcome as enum (
  'booked', 'message_taken', 'callback_requested', 'transferred', 'unresolved'
);

-- ---------------------------------------------------------------- tenants

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  plan public.plan_id not null default 'trial',
  subscription_status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  billing_customer_ref text,
  billing_subscription_ref text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- MVP: one organization per user. Lifting this later is a data change only.
create unique index memberships_one_org_per_user on public.memberships (user_id);

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid()
  );
$$;

revoke execute on function public.is_org_member from public, anon;
grant execute on function public.is_org_member to authenticated, service_role;

-- ----------------------------------------------------------------- agents

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  status public.agent_status not null default 'draft',
  status_detail text,

  -- Business profile (customer editable)
  business_name text not null,
  industry text,
  timezone text not null default 'Africa/Johannesburg',
  business_hours text,
  services text,
  faqs jsonb not null default '[]'::jsonb,
  booking_instructions text,
  transfer_number text,
  notify_email text,
  language text not null default 'en',
  record_calls boolean not null default true,

  -- Provisioning state (service role only, see trigger below).
  -- The webhook secret is derived from WEBHOOK_MASTER_KEY, not stored.
  vapi_assistant_id text,
  vapi_phone_number_id text,
  phone_number text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Customers may edit the business profile. They must not be able to change
-- provisioning state, status or the webhook secret from the browser.
create or replace function public.agents_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), 'service_role') = 'service_role' then
    new.updated_at := now();
    return new;
  end if;

  if new.org_id is distinct from old.org_id
     or new.status is distinct from old.status
     or new.status_detail is distinct from old.status_detail
     or new.vapi_assistant_id is distinct from old.vapi_assistant_id
     or new.vapi_phone_number_id is distinct from old.vapi_phone_number_id
     or new.phone_number is distinct from old.phone_number then
    raise exception 'agent provisioning fields are read-only';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger agents_protect_columns
  before update on public.agents
  for each row execute function public.agents_protect_columns();

-- Pre-purchased phone numbers (imported into Vapi) handed out to agents.
create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  e164 text not null unique,
  vapi_phone_number_id text not null unique,
  agent_id uuid unique references public.agents (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ calls

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  attendee_name text,
  attendee_email text,
  attendee_phone text,
  notes text,
  calendar_event_id text,
  created_at timestamptz not null default now()
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  provider_call_id text not null unique,
  caller_number text,
  caller_name text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  transcript text,
  summary text,
  outcome public.call_outcome,
  ended_reason text,
  recording_url text,
  booking_id uuid references public.bookings (id),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index calls_org_started_idx on public.calls (org_id, started_at desc nulls last);
create index bookings_org_idx on public.bookings (org_id, starts_at);

-- --------------------------------------------------------------------- RLS

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.agents enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.bookings enable row level security;
alter table public.calls enable row level security;

create policy "members read their organization"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

create policy "members read own memberships"
  on public.memberships for select to authenticated
  using (user_id = auth.uid());

create policy "members read their agent"
  on public.agents for select to authenticated
  using (public.is_org_member(org_id));

create policy "members edit their agent profile"
  on public.agents for update to authenticated
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "members read their bookings"
  on public.bookings for select to authenticated
  using (public.is_org_member(org_id));

create policy "members read their calls"
  on public.calls for select to authenticated
  using (public.is_org_member(org_id));

-- phone_numbers: no policies, so only the service role can touch the pool.

-- --------------------------------------------------------------- onboarding

-- Creates the organization, the owner membership and a draft agent in one
-- transaction. Callable by any signed-in user who does not have one yet.
create or replace function public.create_organization(
  p_name text,
  p_business_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.memberships where user_id = v_user) then
    raise exception 'user already belongs to an organization';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org, v_user, 'owner');

  insert into public.agents (org_id, business_name)
  values (v_org, trim(p_business_name));

  return v_org;
end;
$$;

revoke execute on function public.create_organization from public, anon;
grant execute on function public.create_organization to authenticated;

-- ----------------------------------------------------------- phone numbers

-- Atomically hands one free number to an agent (idempotent per agent).
create or replace function public.claim_phone_number(p_agent_id uuid)
returns table (e164 text, vapi_phone_number_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.phone_numbers;
begin
  select * into v_row from public.phone_numbers where agent_id = p_agent_id;
  if found then
    return query select v_row.e164, v_row.vapi_phone_number_id;
    return;
  end if;

  select * into v_row
  from public.phone_numbers
  where agent_id is null
  order by created_at
  for update skip locked
  limit 1;

  if not found then
    raise exception 'no free phone numbers in the pool';
  end if;

  update public.phone_numbers set agent_id = p_agent_id where id = v_row.id;
  return query select v_row.e164, v_row.vapi_phone_number_id;
end;
$$;

revoke execute on function public.claim_phone_number from public, anon, authenticated;
grant execute on function public.claim_phone_number to service_role;

-- ---------------------------------------------------------------- call log

-- Atomic upsert for a call and its optional booking. A retried or concurrent
-- webhook for the same provider_call_id cannot orphan a booking.
create or replace function public.persist_call(
  p_org_id uuid,
  p_agent_id uuid,
  p_provider_call_id text,
  p_caller_number text,
  p_caller_name text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_duration_seconds integer,
  p_transcript text,
  p_summary text,
  p_outcome public.call_outcome,
  p_ended_reason text,
  p_recording_url text,
  p_raw_payload jsonb,
  p_booking_title text,
  p_booking_starts_at timestamptz,
  p_booking_ends_at timestamptz,
  p_booking_attendee_name text,
  p_booking_attendee_email text,
  p_booking_attendee_phone text,
  p_booking_notes text,
  p_booking_calendar_event_id text,
  p_has_booking boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_call_id uuid;
  v_existing_org uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_provider_call_id));

  select booking_id, org_id into v_booking_id, v_existing_org
  from public.calls
  where provider_call_id = p_provider_call_id;

  -- A provider call id must never move between tenants.
  if v_existing_org is not null and v_existing_org <> p_org_id then
    raise exception 'call belongs to a different organization';
  end if;

  if p_has_booking then
    if v_booking_id is not null then
      update public.bookings set
        title = p_booking_title,
        starts_at = p_booking_starts_at,
        ends_at = p_booking_ends_at,
        attendee_name = p_booking_attendee_name,
        attendee_email = p_booking_attendee_email,
        attendee_phone = p_booking_attendee_phone,
        notes = p_booking_notes,
        calendar_event_id = p_booking_calendar_event_id
      where id = v_booking_id;
    else
      insert into public.bookings (
        org_id, agent_id, title, starts_at, ends_at, attendee_name,
        attendee_email, attendee_phone, notes, calendar_event_id
      ) values (
        p_org_id, p_agent_id, p_booking_title, p_booking_starts_at,
        p_booking_ends_at, p_booking_attendee_name, p_booking_attendee_email,
        p_booking_attendee_phone, p_booking_notes, p_booking_calendar_event_id
      )
      returning id into v_booking_id;
    end if;
  end if;

  insert into public.calls (
    org_id, agent_id, provider_call_id, caller_number, caller_name,
    started_at, ended_at, duration_seconds, transcript, summary, outcome,
    ended_reason, recording_url, booking_id, raw_payload
  ) values (
    p_org_id, p_agent_id, p_provider_call_id, p_caller_number, p_caller_name,
    p_started_at, p_ended_at, p_duration_seconds, p_transcript, p_summary,
    p_outcome, p_ended_reason, p_recording_url, v_booking_id, p_raw_payload
  )
  on conflict (provider_call_id) do update set
    caller_number = excluded.caller_number,
    caller_name = excluded.caller_name,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    duration_seconds = excluded.duration_seconds,
    transcript = excluded.transcript,
    summary = excluded.summary,
    outcome = excluded.outcome,
    ended_reason = excluded.ended_reason,
    recording_url = excluded.recording_url,
    booking_id = excluded.booking_id,
    raw_payload = excluded.raw_payload
  returning id into v_call_id;

  return v_call_id;
end;
$$;

revoke execute on function public.persist_call from public, anon, authenticated;
grant execute on function public.persist_call to service_role;

-- ------------------------------------------------------------------- usage

-- Minutes are billed per call, rounded up to the next whole minute.
-- RLS applies (security invoker), so a member only ever sums their own org.
create or replace function public.org_minutes_used(
  p_org uuid,
  p_since timestamptz default date_trunc('month', now())
)
returns integer
language sql
stable
as $$
  select coalesce(sum(ceil(coalesce(duration_seconds, 0) / 60.0)), 0)::integer
  from public.calls
  where org_id = p_org
    and started_at >= p_since;
$$;

grant execute on function public.org_minutes_used to authenticated, service_role;
