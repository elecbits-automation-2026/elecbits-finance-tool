-- ============================================================================
-- Elecbits Finance Tool — consolidated database schema
-- ----------------------------------------------------------------------------
-- This is a single-file, idempotent merge of migrations 0001–0008, intended for
-- bootstrapping a fresh Supabase project in one paste. Run it in the Supabase
-- SQL Editor (or `supabase db push`). It is equivalent to applying, in order:
--   0001_init.sql               core tables + RLS
--   0002_profiles_self_insert   signup self-insert policy
--   0003_profiles_admin_update  is_admin() + admin update policy
--   0004_roles_and_admin        roles catalog + 'Admin' role in is_admin()
--   0005_admin_access_and_deactivate  admin "deactivate & view" + admin_access
--   0006_user_reactivation      user-driven re-activation handshake
--   0007_admin_only_user_management   is_admin() narrowed to 'Admin' only
--   0008_admin_permanent_delete       admin permanent user+data deletion (no DDL)
--
-- The migration files remain the source of truth for history; keep this file in
-- sync when you add a migration. The dedicated admin auth user and the 21
-- employee accounts are created separately by `npm run seed` (scripts/seed.ts),
-- which needs the service-role key to create auth users (not possible from SQL).
--
-- Design: one table per entity. Each row keeps a few promoted, indexable scalar
-- columns plus a `data jsonb` column holding the full application object exactly
-- as the React code builds it. Trust model: internal tool — any AUTHENTICATED
-- employee can read/write the shared finance tables; role/dept gating is done in
-- the app (src/lib/access.ts). RLS blocks anonymous access and protects profiles.
-- ============================================================================

-- ============================================================================
-- TABLES
-- ============================================================================

-- profiles: 1:1 with auth.users, holds org identity used throughout the app.
-- legacy_id (U01..) preserves all existing references in seed data and POs
-- (requesterId, selectedApprovers, approvedBy, scope matching).
create table if not exists public.profiles (
  auth_id     uuid primary key references auth.users (id) on delete cascade,
  legacy_id   text unique,
  email       text unique not null,
  name        text not null,
  dept        text,
  designation text,
  role        text not null default 'Employee',
  scope       text,
  status      text not null default 'active',  -- active | pending | disabled | deactivated | reactivating
  created_at  timestamptz not null default now()
);

-- requests: unified workflow items (kind = Payment | Budget | PO request).
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
create index if not exists requests_status_idx    on public.requests (status);
create index if not exists requests_requester_idx on public.requests (requester_id);
create index if not exists requests_dept_idx       on public.requests (dept);

-- budgets: approved budget allocations (project + monthly).
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

-- pos: approved/issued purchase orders.
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
create index if not exists pos_dept_idx   on public.pos (dept);

-- notifications: per-user inbox items.
create table if not exists public.notifications (
  id           text primary key,
  to_user_id   text,
  read         boolean not null default false,
  request_id   text,
  data         jsonb not null,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (to_user_id);

-- pending_signups: self-service signups awaiting admin role assignment.
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

-- app_meta: small key/value store for singletons (e.g. po_counter).
create table if not exists public.app_meta (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- roles: the 7 assignable role-groups. `key` must match the role strings the
-- app checks in src/lib/access.ts; the catalog gives the admin UI labels.
create table if not exists public.roles (
  id     int  primary key,        -- group number 1..7
  key    text unique not null,    -- system role value stored in profiles.role
  label  text not null,           -- display name shown in the admin dropdown
  titles text,                    -- reference: example titles within this group
  rank   int  not null            -- sort order in the UI
);

insert into public.roles (id, key, label, titles, rank) values
  (0, 'EmployeeReadOnly', 'Employee (Read-only)', 'Read-only, Viewer',          0),
  (1, 'Employee',     'Employee',        'Emp, Junior, Intern, Executive',        1),
  (2, 'DeptApprover', 'Department Head', 'Manager, Dept Head, Reporting Manager', 2),
  (3, 'Accountant',   'Accountant',      'Accountant',                            3),
  (4, 'FinanceHead',  'Finance Head',    'Finance Head',                          4),
  (5, 'VP',           'Vice President',  'VP',                                    5),
  (6, 'CEO',          'CEO',             'CEO',                                   6),
  (7, 'SuperManager', 'Special Access',  'Special',                              7)
on conflict (id) do update
  set key = excluded.key, label = excluded.label, titles = excluded.titles, rank = excluded.rank;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- is_admin(): true if the caller is the dedicated administrator. Account
-- management (assign roles, deactivate/reactivate, read access passwords) is
-- reserved for the 'Admin' role ONLY — SuperManager ("Special Access") and CEO
-- are finance-workflow roles and intentionally have no account-admin powers.
-- Reads the caller's own role from profiles in a SECURITY DEFINER function so it
-- bypasses RLS (reading profiles inside a profiles policy would recurse).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_id = auth.uid()
      and role = 'Admin'
  );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.requests        enable row level security;
alter table public.budgets         enable row level security;
alter table public.pos             enable row level security;
alter table public.notifications   enable row level security;
alter table public.pending_signups enable row level security;
alter table public.app_meta        enable row level security;
alter table public.roles           enable row level security;

-- Shared finance tables: any authenticated user can read/write.
-- (Wrapped to be re-runnable: drop-if-exists before create.)
do $$
declare t text;
begin
  foreach t in array array['requests','budgets','pos','notifications','app_meta']
  loop
    execute format('drop policy if exists %1$I_auth_all on public.%1$I;', t);
    execute format($f$
      create policy %1$I_auth_all on public.%1$I
        for all to authenticated using (true) with check (true);
    $f$, t);
  end loop;
end $$;

-- profiles:
--   read   — every authenticated user may read all profiles (approver routing)
--   self   — a user may insert/update only their own row
--   admin  — admins (is_admin()) may update any profile
drop policy if exists profiles_read          on public.profiles;
drop policy if exists profiles_update_self   on public.profiles;
drop policy if exists profiles_insert_self   on public.profiles;
drop policy if exists profiles_update_admin  on public.profiles;

create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_update_self on public.profiles
  for update to authenticated using (auth.uid() = auth_id) with check (auth.uid() = auth_id);
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (auth.uid() = auth_id);
create policy profiles_update_admin on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- pending_signups: a freshly-signed-up user may create their request;
-- authenticated users may read/update (admin approves in-app).
drop policy if exists pending_insert on public.pending_signups;
drop policy if exists pending_read   on public.pending_signups;
drop policy if exists pending_update on public.pending_signups;

create policy pending_insert on public.pending_signups
  for insert to authenticated with check (true);
create policy pending_read on public.pending_signups
  for select to authenticated using (true);
create policy pending_update on public.pending_signups
  for update to authenticated using (true) with check (true);

-- roles: reference data — any authenticated user may read it.
drop policy if exists roles_read on public.roles;
create policy roles_read on public.roles
  for select to authenticated using (true);

-- ============================================================================
-- 0005: admin "deactivate & view"
-- ----------------------------------------------------------------------------
-- The admin can deactivate an employee; the `admin-deactivate` edge function
-- resets that user's password, sets profiles.status='deactivated', and stores
-- the new password here for the admin to sign in AS the user and review their
-- activity. profiles.status gains a 'deactivated' value (text column — no
-- constraint change needed). See supabase/functions/admin-deactivate/index.ts.
-- ============================================================================

-- admin_access: per-user access password, admin-readable only. Separate table
-- (not a profiles column) so the app's `select *` on profiles never leaks it.
create table if not exists public.admin_access (
  auth_id    uuid primary key references public.profiles (auth_id) on delete cascade,
  password   text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_access enable row level security;

drop policy if exists admin_access_admin on public.admin_access;
create policy admin_access_admin on public.admin_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- login_status(email): account status for an email so the login page can tell a
-- deactivated account from a wrong password after a failed sign-in. SECURITY
-- DEFINER (reads profiles pre-auth); callable by anon.
create or replace function public.login_status(p_email text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select status from public.profiles
  where email = lower(trim(p_email))
  limit 1;
$$;

grant execute on function public.login_status(text) to anon, authenticated;

-- ============================================================================
-- 0006: user-driven re-activation
-- ----------------------------------------------------------------------------
-- Re-activating a deactivated account is a three-step handshake, so the user
-- chooses their own password and the admin still has the final say:
--   1. admin "re-opens" the account      → profiles.status = 'reactivating'
--   2. user sets a NEW password (login    → request-reactivation edge function
--      page → "Reactivate account")          sets the password, status='pending',
--                                             and deletes the admin_access row
--   3. admin approves the now-'pending'   → profiles.status = 'active'
--      account in the Admin Console
-- No DDL: 'reactivating' is just another value of the free-text status column,
-- and login_status() already surfaces it to the pre-auth login page. See
-- supabase/functions/request-reactivation/index.ts.
-- ============================================================================

-- ============================================================================
-- NEXT STEP: run `npm run seed` to create the admin + 21 employee accounts and
-- load demo budgets/POs. (Requires SUPABASE_SERVICE_ROLE_KEY in .env.local.)
-- Remember: turn OFF email confirmation (Auth → Providers → Email) so
-- self-service signup can write its own profile row under profiles_insert_self.
-- ============================================================================
