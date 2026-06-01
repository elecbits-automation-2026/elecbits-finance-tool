-- ============================================================================
-- Elecbits Finance Tool — initial schema
-- Run this in the Supabase SQL Editor (or `supabase db push`).
--
-- Design: one table per entity. Each row keeps a few promoted, indexable
-- scalar columns for querying/reporting plus a `data jsonb` column holding the
-- full application object (lineItems, history, etc.) exactly as the React code
-- produces it. This is relational (real tables, PKs, FKs, RLS) without forcing
-- a rewrite of the form/page code that builds those nested objects.
--
-- Trust model: this is an internal tool. Any *authenticated* employee can read
-- and write the shared finance tables; role/department gating is enforced in
-- the app (see src/lib/access.ts). RLS here just blocks anonymous access.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, holds org identity used throughout the app.
-- `legacy_id` (U01..) preserves all existing references in seed data and POs
-- (requesterId, selectedApprovers, approvedBy, scope matching).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  auth_id     uuid primary key references auth.users (id) on delete cascade,
  legacy_id   text unique,
  email       text unique not null,
  name        text not null,
  dept        text,
  designation text,
  role        text not null default 'Employee',
  scope       text,
  status      text not null default 'active',  -- active | pending | disabled
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- requests: unified workflow items (kind = Payment | Budget | PO request).
-- ----------------------------------------------------------------------------
create table if not exists public.requests (
  id            text primary key,
  kind          text,
  type          text,
  requester_id  text,
  dept          text,
  status        text,
  current_stage text,
  amount_inr    numeric,
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists requests_status_idx on public.requests (status);
create index if not exists requests_requester_idx on public.requests (requester_id);
create index if not exists requests_dept_idx on public.requests (dept);

-- ----------------------------------------------------------------------------
-- budgets: approved budget allocations (project + monthly).
-- ----------------------------------------------------------------------------
create table if not exists public.budgets (
  id            text primary key,
  type          text,
  dept          text,
  status        text,
  current_stage text,
  amount_inr    numeric,
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists budgets_dept_idx on public.budgets (dept);
create index if not exists budgets_type_idx on public.budgets (type);

-- ----------------------------------------------------------------------------
-- pos: approved/issued purchase orders.
-- ----------------------------------------------------------------------------
create table if not exists public.pos (
  id            text primary key,
  po_number     text,
  requester_id  text,
  dept          text,
  status        text,
  current_stage text,
  amount_inr    numeric,
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists pos_status_idx on public.pos (status);
create index if not exists pos_dept_idx on public.pos (dept);

-- ----------------------------------------------------------------------------
-- notifications: per-user inbox items.
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id           text primary key,
  to_user_id   text,
  read         boolean not null default false,
  request_id   text,
  data         jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (to_user_id);

-- ----------------------------------------------------------------------------
-- pending_signups: self-service signups awaiting admin role assignment.
-- ----------------------------------------------------------------------------
create table if not exists public.pending_signups (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  name           text,
  dept           text,
  requested_role text,
  status         text not null default 'pending',  -- pending | approved | rejected
  data           jsonb,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- app_meta: small key/value store for singletons (e.g. po_counter).
-- ----------------------------------------------------------------------------
create table if not exists public.app_meta (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.requests        enable row level security;
alter table public.budgets         enable row level security;
alter table public.pos             enable row level security;
alter table public.notifications   enable row level security;
alter table public.pending_signups enable row level security;
alter table public.app_meta        enable row level security;

-- Any authenticated user can read/write the shared finance tables.
do $$
declare t text;
begin
  foreach t in array array['requests','budgets','pos','notifications','app_meta']
  loop
    execute format($f$
      create policy %1$I_auth_all on public.%1$I
        for all to authenticated using (true) with check (true);
    $f$, t);
  end loop;
end $$;

-- profiles: every authenticated user may read all profiles (the app needs the
-- full org directory for approver routing); a user may update only their own.
create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self on public.profiles
  for update to authenticated using (auth.uid() = auth_id) with check (auth.uid() = auth_id);

-- pending_signups: a freshly-signed-up (authenticated) user may create their
-- request; authenticated users may read/update (admin approves in-app).
create policy pending_insert on public.pending_signups
  for insert to authenticated with check (true);
create policy pending_read on public.pending_signups
  for select to authenticated using (true);
create policy pending_update on public.pending_signups
  for update to authenticated using (true) with check (true);
