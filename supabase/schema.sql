-- ============================================================================
-- Elecbits Finance Tool — consolidated database schema
-- ----------------------------------------------------------------------------
-- This is a single-file, idempotent merge of migrations 0001–0011, intended for
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
--   0009_read_only_employee_role      EmployeeReadOnly role (rank 0)
--   0010_profile_extra_depts          multi-department users (extra_depts)
--   0011_budget_workflow_rls          server-side budget workflow enforcement
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
-- EXCEPTION (0011): the `budgets` table is fully server-enforced — workflow
-- triggers + scoped policies mirror the app rules; see the 0011 section below.
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
  extra_depts text[] not null default '{}',     -- 0010: additional departments
  employee_code text,                           -- 0015: EB-XXXX-XXX, captured at signup
  must_reset_password boolean not null default false,  -- 0018: set on re-activation (password was reset)
  created_at  timestamptz not null default now()
);
alter table public.profiles
  add column if not exists extra_depts text[] not null default '{}';
alter table public.profiles
  add column if not exists employee_code text;
alter table public.profiles
  add column if not exists must_reset_password boolean not null default false;
create unique index if not exists profiles_employee_code_uniq
  on public.profiles (employee_code) where employee_code is not null;

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

-- suppliers: shared supplier master used to autofill PO supplier details.
-- Auto-populated when a PO is raised with a manually-entered supplier.
create table if not exists public.suppliers (
  id         text primary key,
  name       text not null,
  gstin      text,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_name_idx on public.suppliers (name);

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
alter table public.suppliers       enable row level security;
alter table public.notifications   enable row level security;
alter table public.pending_signups enable row level security;
alter table public.app_meta        enable row level security;
alter table public.roles           enable row level security;

-- Shared finance tables: any authenticated user can read/write.
-- (Wrapped to be re-runnable: drop-if-exists before create.)
do $$
declare t text;
begin
  foreach t in array array['requests','budgets','pos','suppliers','notifications','app_meta']
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

-- login_must_reset(email): true when the account is flagged to set a new password
-- (e.g. just re-activated after deactivation, which reset the password). Lets the
-- login page tell a re-activated user their old password is gone. Anon-callable.
create or replace function public.login_must_reset(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(must_reset_password, false) from public.profiles
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

-- ============================================================================
-- 0011: server-side budget workflow enforcement
-- ----------------------------------------------------------------------------
-- Mirrors src/lib/workflow.ts + src/lib/access.ts for the budgets table so an
-- API-level caller is bound by the same rules as the UI. Full commentary in
-- supabase/migrations/0011_budget_workflow_rls.sql (this is the same content).
-- NOTE: this intentionally REPLACES the permissive budgets_auth_all policy
-- created by the loop above.
-- ============================================================================

-- ---------------------------------------------------------------- helpers

-- The app identifies users by profiles.legacy_id when present (U01…), falling
-- back to auth_id text — must match profileToUser() in src/lib/auth.ts.
create or replace function public.app_user_id(p public.profiles)
returns text language sql immutable as $$
  select coalesce(p.legacy_id, p.auth_id::text);
$$;

-- Every department a user belongs to (primary + admin-granted extras).
-- Mirrors effectiveDepts() in src/lib/access.ts.
create or replace function public.user_depts(p public.profiles)
returns text[] language sql immutable as $$
  select case when p.dept is null or p.dept = '' then coalesce(p.extra_depts, '{}')
              else array[p.dept] || coalesce(p.extra_depts, '{}') end;
$$;

-- Stage -> display status for budgets. Mirrors getStageLabel(stage,"Budget").
create or replace function public.budget_stage_status(stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid' then 'Pending Delivery Head'
    when 'DeptApproval' then 'Pending Dept Head'
    when 'VP' then 'Pending VP'
    when 'CEO' then 'Pending CEO'
    when 'FinanceHead' then 'Pending Finance Head'
    when 'Active' then 'Active'
    when 'Rejected' then 'Rejected'
    when 'Cancelled' then 'Cancelled'
    else stage end;
$$;

-- Next stage for a budget on a NON-SuperManager approval. Mirrors the budget
-- branches of computeNextStage(): Finance reviews FIRST (right after the dept
-- head), then >=1L adds VP, >=5L adds VP then CEO.
create or replace function public.budget_next_stage(amount numeric, stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid' then 'DeptApproval'
    when 'DeptApproval' then 'FinanceHead'
    when 'FinanceHead' then case when amount >= 100000 then 'VP' else 'Active' end
    when 'VP' then case when amount >= 500000 then 'CEO' else 'Active' end
    when 'CEO' then 'Active'
    else stage end;
$$;

-- Eligible DEPT-stage approvers for a budget raised by (uid, role, scope) in
-- req_dept. Returns app user ids. Mirrors getEligibleDeptApprovers(); takes
-- req_dept separately because a multi-department head raises under a tab dept.
create or replace function public.budget_eligible_approvers(
  req_uid text, req_dept text, req_role text, req_scope text, is_project boolean
) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare ids text[];
begin
  if req_dept = 'Executive' then
    if req_role = 'CEO' then
      select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
        from public.profiles p where p.status = 'active' and p.role = 'CEO'
        and public.app_user_id(p) <> req_uid;
    elsif req_role = 'VP' then
      select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
        from public.profiles p where p.status = 'active' and p.role = 'CEO';
    else
      ids := '{}';
    end if;
  elsif req_dept = 'Finance' then
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'FinanceHead';
  else
    -- Every other department (incl. Management): its own DeptApprover(s).
    -- Pure role + department — no scopes or cross-department bridges.
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'DeptApprover'
      and req_dept = any(public.user_depts(p));
  end if;
  return ids;
end $$;

-- May this profile act (approve/reject) on this budget right now?
-- Mirrors canUserActOnRequest() for kind=Budget, including the self-approval
-- ban; dept matching uses ALL the user's departments (tab-independent).
create or replace function public.can_act_on_budget(p public.profiles, b jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  uid text := public.app_user_id(p);
  stage text := b->>'currentStage';
  sa text[];
begin
  if p.role = 'EmployeeReadOnly' then return false; end if;
  if b->>'type' in ('RDCap', 'RDCapRequest') then return false; end if;
  if b->>'status' in ('Paid','Rejected','Cancelled','Active','Approved','Closed') then return false; end if;
  if b->>'requesterId' = uid then return false; end if;   -- segregation of duties
  if p.role = 'SuperManager' then return true; end if;
  if stage = 'BoxBuildMid' then return p.role = 'BoxBuildMidApprover'; end if;
  if stage = 'DeptApproval' then
    sa := coalesce(array(select jsonb_array_elements_text(b->'selectedApprovers')), '{}');
    if not (uid = any(sa)) then return false; end if;
    -- A head is held strictly to their own departments (pure role + dept).
    if p.role in ('DeptApprover','BoxBuildMidApprover')
       and not ((b->>'dept') = any(public.user_depts(p))) then return false; end if;
    -- One approval per person at the consensus stage.
    if exists (select 1 from jsonb_array_elements(coalesce(b->'history','[]'::jsonb)) h
               where h->>'byId' = uid and h->>'action' like '%Approved%') then return false; end if;
    return true;
  end if;
  if stage = 'VP' then return p.role = 'VP'; end if;
  if stage = 'CEO' then return p.role = 'CEO'; end if;
  if stage = 'FinanceHead' then return p.role = 'FinanceHead'; end if;
  return false;
end $$;

-- ---------------------------------------------------------------- trigger

-- Client order value for a project = sum of its APPROVED/CLOSED client PIs
-- (PICreate rows in `pos`). Live source of truth for the 20% margin ceiling,
-- replacing the old manually-entered clientOrderValue. Mirrors
-- getProjectClientOrderValue() in src/lib/finance.ts. Defined before the guards
-- that call it so check_function_bodies is satisfied on a top-to-bottom run.
create or replace function public.project_client_order_value(project_id text)
returns numeric language sql stable security definer set search_path = public as $$
  -- A project's client-order value = sum of its APPROVED/CLOSED client PIs.
  select coalesce(sum((data->>'amountINR')::numeric), 0)
  from public.pos
  where data->>'type' = 'PICreate' and data->>'projectId' = project_id
    and (data->>'status' in ('Approved','Closed') or data->>'currentStage' = 'Approved');
$$;

create or replace function public.budgets_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  uid text;
  depts text[];
  d jsonb;
  o jsonb;
  amt numeric;
  req_dept text;
  is_proj boolean;
  sa text[];
  elig text[];
  needs_mid boolean;
  stage text;
  o_stage text;
  exp_stage text;
  exp_status text;
  o_hist jsonb;
  n_hist jsonb;
  last_entry jsonb;
  total int;
  cnt int;
  cur_month text := to_char(now(), 'YYYY-MM');
  alloc numeric;
  used numeric;
  parent jsonb;
  ext_total numeric;
  cov numeric;
begin
  -- Service role / SQL editor / seed scripts: no JWT user — not subject to
  -- workflow rules (these paths are already privileged).
  if auth.uid() is null then return coalesce(new, old); end if;

  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then raise exception 'budgets: no profile for caller'; end if;
  if p.role = 'Admin' then return coalesce(new, old); end if;  -- admin console repair
  if p.status <> 'active' then raise exception 'budgets: account is not active'; end if;

  uid := public.app_user_id(p);
  depts := public.user_depts(p);

  -- ------------------------------------------------------------- DELETE
  if tg_op = 'DELETE' then
    -- RLS already limits deletes to SuperManagers on R&D-cap config rows;
    -- this is defense in depth.
    if not (p.role = 'SuperManager' and old.type in ('RDCap','RDCapRequest')) then
      raise exception 'budgets: % may not be deleted', old.id;
    end if;
    return old;
  end if;

  d := new.data;

  -- Promoted columns must agree with the canonical object in `data` —
  -- the SELECT policy and indexes key off them.
  if new.id is distinct from d->>'id'
     or new.type is distinct from d->>'type'
     or new.dept is distinct from d->>'dept'
     or new.status is distinct from d->>'status'
     or new.current_stage is distinct from d->>'currentStage' then
    raise exception 'budgets: promoted columns do not match data for %', new.id;
  end if;

  -- ------------------------------------------------------------- INSERT
  if tg_op = 'INSERT' then
    if new.type = 'RDCap' then
      if p.role <> 'SuperManager' then
        raise exception 'budgets: only a SuperManager may allocate an R&D cap';
      end if;
      return new;
    end if;

    if new.type = 'RDCapRequest' then
      if d->>'requesterId' is distinct from uid or not coalesce((d->>'dept') = any(depts), false) then
        raise exception 'budgets: R&D allocation request must be raised by yourself for your own department';
      end if;
      return new;
    end if;

    if new.type not in ('Project','Monthly','Extension') then
      raise exception 'budgets: unknown budget type %', new.type;
    end if;

    -- ---- raise gates (mirror NewBudgetRequestForm.submit) ----
    amt := coalesce((d->>'amountINR')::numeric, 0);
    req_dept := d->>'dept';
    is_proj := new.type <> 'Monthly';

    if d->>'requesterId' is distinct from uid then
      raise exception 'budgets: requesterId must be the caller';
    end if;
    if req_dept is null or not (req_dept = any(depts)) then
      raise exception 'budgets: dept % is not one of your departments', req_dept;
    end if;
    if amt <= 0 then raise exception 'budgets: invalid amount'; end if;
    if (d->>'isProject') is distinct from (case when is_proj then 'true' else 'false' end) then
      raise exception 'budgets: isProject flag does not match budget type';
    end if;

    if new.type = 'Monthly' and p.role not in ('DeptApprover','BoxBuildMidApprover','FinanceHead') then
      raise exception 'budgets: only Department Heads may raise Monthly budgets';
    end if;
    -- Extensions may be raised by anyone who can raise project work (incl. employees);
    -- the parent-project checks below still restrict WHICH project can be extended.
    if new.type = 'Extension' and p.role not in ('Employee','DeptApprover','BoxBuildMidApprover','FinanceHead') then
      raise exception 'budgets: role % may not raise Extensions', p.role;
    end if;
    if new.type = 'Project' then
      if req_dept in ('HR','Finance','Product','Marketing') then
        raise exception 'budgets: % cannot raise Project budgets', req_dept;
      end if;
      if p.role not in ('Employee','DeptApprover','BoxBuildMidApprover') then
        raise exception 'budgets: role % cannot raise Project budgets', p.role;
      end if;
      if d->>'projectType' = 'RD' then
        if req_dept <> 'ODM' then
          raise exception 'budgets: only ODM may raise R&D budgets';
        end if;
        select (b.data->>'amountINR')::numeric into alloc from public.budgets b
          where b.type = 'RDCap' and b.dept = req_dept and b.data->>'month' = cur_month
            and (b.status = 'Active' or b.current_stage = 'Active') limit 1;
        if alloc is null then
          raise exception 'budgets: no R&D allocation for % in %', req_dept, cur_month;
        end if;
        select coalesce(sum((b.data->>'amountINR')::numeric), 0) into used from public.budgets b
          where b.data->>'type' = 'Project' and b.data->>'projectType' = 'RD' and b.dept = req_dept
            and (b.status = 'Active' or b.current_stage = 'Active')
            and left(coalesce(b.data->>'approvedDate', b.data->>'createdDate'), 7) = cur_month;
        if amt > greatest(0, alloc - used) then
          raise exception 'budgets: exceeds remaining R&D allocation (₹%)', greatest(0, alloc - used);
        end if;
      elsif d->>'projectType' = 'OneTime' then
        -- One-time budget: a one-off spend with no client order value and no
        -- 80% cap. Same dept/role gates as a Client project; the unique
        -- projectId guard below still applies (the client auto-generates one).
        null;
      else
        -- Client project: order value is DERIVED from the project's approved PIs,
        -- not the submitted field. Require >=1 approved PI and cap at 80%.
        cov := public.project_client_order_value(d->>'projectId');
        if cov <= 0 then
          raise exception 'budgets: project % has no approved PI — client order value is taken from approved PIs', d->>'projectId';
        end if;
        if amt > cov * 0.80 then
          raise exception 'budgets: exceeds 80%% of client order value (₹% from approved PIs)', cov;
        end if;
      end if;
      if exists (select 1 from public.budgets b
                 where b.data->>'type' = 'Project' and b.data->>'projectId' = d->>'projectId'
                   and b.status not in ('Rejected','Cancelled') and b.id <> new.id) then
        raise exception 'budgets: a budget already exists for project %', d->>'projectId';
      end if;
    end if;

    if new.type = 'Extension' then
      select b.data into parent from public.budgets b
        where b.data->>'projectId' = d->>'extensionFor' and b.data->>'type' = 'Project'
          and (b.status = 'Active' or b.current_stage = 'Active') limit 1;
      if parent is null then
        raise exception 'budgets: no active project % to extend', d->>'extensionFor';
      end if;
      if not coalesce((parent->>'dept') = any(depts), false) then
        raise exception 'budgets: cannot extend another department''s project';
      end if;
      if parent->>'projectType' = 'Client' then
        select coalesce(sum((b.data->>'amountINR')::numeric), 0) into ext_total from public.budgets b
          where b.data->>'type' = 'Extension' and b.data->>'extensionFor' = d->>'extensionFor'
            and (b.status = 'Active' or b.current_stage = 'Active');
        -- Live client-order value from approved PIs; fall back to the parent's
        -- stored value for legacy projects that predate PI-driven COV.
        cov := public.project_client_order_value(d->>'extensionFor');
        if cov <= 0 then cov := coalesce((parent->>'clientOrderValue')::numeric, 0); end if;
        -- Extensions may commit up to 100% of COV — dipping into the 20% margin is
        -- allowed (it costs margin stars, enforced client-side). Hard stop at 100%.
        if (parent->>'amountINR')::numeric + ext_total + amt > cov then
          raise exception 'budgets: extension would exceed 100%% of client order value (₹% from approved PIs)', cov;
        end if;
      end if;
    end if;

    -- ---- routing: approvers + initial stage ----
    sa := coalesce(array(select jsonb_array_elements_text(d->'selectedApprovers')), '{}');
    if uid = any(sa) then
      raise exception 'budgets: requester may not be their own approver';
    end if;
    elig := array_remove(public.budget_eligible_approvers(uid, req_dept, p.role, p.scope, is_proj), uid);
    if not (sa <@ elig and elig <@ sa) then
      raise exception 'budgets: selectedApprovers must be exactly the eligible department approvers';
    end if;

    needs_mid := coalesce(p.dept = 'Box Build' and p.role = 'Employee'
                 and (p.designation like '%Project Manager%' or p.designation like '%Vendor Manager%'), false);
    stage := d->>'currentStage';
    if needs_mid then
      if stage <> 'BoxBuildMid' then
        raise exception 'budgets: Box Build PM/VM budgets must start at BoxBuildMid';
      end if;
    elsif cardinality(sa) = 0 then
      -- Sole-head escalation: allowed only when the requester themselves is
      -- the sole eligible approver (a department head raising their own
      -- request). A department with NO configured approver at all may not
      -- raise budgets — mirrors the client's "no approver configured" gate.
      if not (uid = any(public.budget_eligible_approvers(uid, req_dept, p.role, p.scope, is_proj))) then
        raise exception 'budgets: no approver is configured for department %', req_dept;
      end if;
      -- The request starts at the next authority. A Finance Head can't be
      -- approved at the Finance stage (they ARE it, and can't self-approve), so
      -- their own budget escalates straight to VP (then CEO by amount).
      if p.role = 'FinanceHead' then
        if stage is distinct from 'VP' then
          raise exception 'budgets: a Finance Head''s own budget must start at VP';
        end if;
      elsif stage is distinct from public.budget_next_stage(amt, 'DeptApproval') then
        raise exception 'budgets: empty approver list requires escalated initial stage %',
          public.budget_next_stage(amt, 'DeptApproval');
      end if;
    elsif stage <> 'DeptApproval' then
      raise exception 'budgets: new budgets must start at DeptApproval';
    end if;
    if d->>'status' is distinct from public.budget_stage_status(stage) then
      raise exception 'budgets: status must be % for stage %', public.budget_stage_status(stage), stage;
    end if;

    n_hist := coalesce(d->'history', '[]'::jsonb);
    if jsonb_array_length(n_hist) <> 1 or n_hist->0->>'byId' is distinct from uid
       or n_hist->0->>'action' is distinct from 'Submitted' then
      raise exception 'budgets: new budget history must be a single Submitted entry by the requester';
    end if;
    return new;
  end if;

  -- ------------------------------------------------------------- UPDATE
  o := old.data;
  if d = o then return new; end if;   -- bulk-save no-op rows

  if old.type = 'RDCap' then
    if p.role <> 'SuperManager' then
      raise exception 'budgets: only a SuperManager may modify R&D cap allocations';
    end if;
    return new;
  end if;
  if old.type = 'RDCapRequest' then
    -- SuperManagers manage these; a requester may refresh their own request.
    if p.role <> 'SuperManager'
       and (o->>'requesterId' is distinct from uid or d->>'requesterId' is distinct from uid) then
      raise exception 'budgets: not your R&D allocation request';
    end if;
    return new;
  end if;

  o_stage := o->>'currentStage';
  stage := d->>'currentStage';
  amt := coalesce((o->>'amountINR')::numeric, 0);

  -- History: exactly one appended entry, attributed to the caller.
  o_hist := coalesce(o->'history', '[]'::jsonb);
  n_hist := coalesce(d->'history', '[]'::jsonb);
  if jsonb_array_length(n_hist) <> jsonb_array_length(o_hist) + 1
     or coalesce((select jsonb_agg(h.e) from (
          select e from jsonb_array_elements(n_hist) with ordinality t(e, i)
          where i <= jsonb_array_length(o_hist) order by i) h), '[]'::jsonb) <> o_hist then
    raise exception 'budgets: history may only be appended to';
  end if;
  last_entry := n_hist->-1;
  if last_entry->>'byId' is distinct from uid then
    raise exception 'budgets: history entry must be attributed to the caller';
  end if;

  -- Everything except the workflow fields is immutable in a transition.
  if (o - 'currentStage' - 'status' - 'history'
        - (case when stage = 'Active' then 'approvedBy' else 'currentStage' end)
        - (case when stage = 'Active' then 'approvedDate' else 'currentStage' end))
     <> (d - 'currentStage' - 'status' - 'history'
        - (case when stage = 'Active' then 'approvedBy' else 'currentStage' end)
        - (case when stage = 'Active' then 'approvedDate' else 'currentStage' end)) then
    raise exception 'budgets: only stage, status and history may change in a transition';
  end if;

  -- Requester cancel: own, still-pending request only.
  if stage = 'Cancelled' then
    if o->>'requesterId' is distinct from uid then
      raise exception 'budgets: only the requester may cancel';
    end if;
    if o->>'status' in ('Paid','Rejected','Cancelled','Active','Approved','Closed') then
      raise exception 'budgets: % can no longer be cancelled', old.id;
    end if;
    if d->>'status' is distinct from 'Cancelled' then
      raise exception 'budgets: cancelled budgets must have status Cancelled';
    end if;
    return new;
  end if;

  -- Approve / reject: caller must be an authorized actor for the CURRENT stage.
  if not public.can_act_on_budget(p, o) then
    raise exception 'budgets: you are not an eligible approver for % at stage %', old.id, o_stage;
  end if;

  if stage = 'Rejected' then
    if d->>'status' is distinct from 'Rejected' then
      raise exception 'budgets: rejected budgets must have status Rejected';
    end if;
    return new;
  end if;

  -- Return to requester for changes (an eligible approver bounces it back, not terminal).
  if stage = 'Returned' then
    if d->>'status' is distinct from 'Returned for Changes' then
      raise exception 'budgets: returned budgets must have status "Returned for Changes"';
    end if;
    return new;
  end if;

  -- Approval: the new stage must be exactly what the workflow dictates.
  if p.role = 'SuperManager' then
    exp_stage := 'Active';            -- special-access override (any stage)
    exp_status := 'Active';
  else
    sa := coalesce(array(select jsonb_array_elements_text(o->'selectedApprovers')), '{}');
    total := cardinality(sa);
    if o_stage = 'DeptApproval' and total > 1 then
      cnt := (select count(*) from jsonb_array_elements(o_hist) h
              where h->>'action' = 'Approved (Dept)') + 1;
      if last_entry->>'action' is distinct from 'Approved (Dept)' then
        raise exception 'budgets: dept-stage approvals must be recorded as Approved (Dept)';
      end if;
      if cnt < total then
        exp_stage := 'DeptApproval';
        exp_status := public.budget_stage_status('DeptApproval') || ' (' || cnt || '/' || total || ')';
      else
        exp_stage := public.budget_next_stage(amt, 'DeptApproval');
        exp_status := public.budget_stage_status(exp_stage);
      end if;
    else
      if coalesce(last_entry->>'action', '') not like 'Approved%' then
        raise exception 'budgets: approval history entry must record an approval';
      end if;
      exp_stage := public.budget_next_stage(amt, o_stage);
      exp_status := public.budget_stage_status(exp_stage);
    end if;
  end if;

  if stage is distinct from exp_stage or d->>'status' is distinct from exp_status then
    raise exception 'budgets: invalid transition % -> % (expected % / "%")', o_stage, stage, exp_stage, exp_status;
  end if;
  return new;
end $$;

drop trigger if exists budgets_guard_ins on public.budgets;
drop trigger if exists budgets_guard_upd on public.budgets;
drop trigger if exists budgets_guard_del on public.budgets;
create trigger budgets_guard_ins after insert on public.budgets
  for each row execute function public.budgets_guard();
create trigger budgets_guard_upd after update on public.budgets
  for each row execute function public.budgets_guard();
create trigger budgets_guard_del after delete on public.budgets
  for each row execute function public.budgets_guard();

-- ---------------------------------------------------------------- policies

-- May the caller read this budget row? Company-wide roles see all; everyone
-- else sees their own departments' rows and their own requests. Pure role +
-- department — no scope/bridge.
create or replace function public.can_select_budget(b_dept text, b_requester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_id = auth.uid()
      and ( p.role in ('CEO','VP','FinanceHead','Accountant','SuperManager','Admin')
         or b_requester = public.app_user_id(p)
         or b_dept = any(public.user_depts(p)) )
  );
$$;

drop policy if exists budgets_auth_all on public.budgets;
drop policy if exists budgets_select on public.budgets;
drop policy if exists budgets_insert on public.budgets;
drop policy if exists budgets_update on public.budgets;
drop policy if exists budgets_delete on public.budgets;

create policy budgets_select on public.budgets
  for select to authenticated
  using (public.can_select_budget(dept, data->>'requesterId'));

-- Fine-grained write rules are enforced by the budgets_guard trigger.
create policy budgets_insert on public.budgets
  for insert to authenticated with check (true);
create policy budgets_update on public.budgets
  for update to authenticated using (true) with check (true);

-- Deletes: only SuperManagers, only R&D-cap config rows. A policy (not an
-- error) so the app's bulk-save prune skips other rows silently.
create policy budgets_delete on public.budgets
  for delete to authenticated
  using (
    type in ('RDCap','RDCapRequest')
    and exists (select 1 from public.profiles p
                where p.auth_id = auth.uid() and p.role in ('SuperManager','Admin'))
  );

-- ---------------------------------------------------------------- pos (PO/PI)
-- Same dept-scoping as budgets: company-wide roles see everything, everyone else
-- sees their own departments' POs/PIs and their own. Writes stay permissive
-- (no guard trigger on pos); the client uses a diff-based save so a scoped user
-- never prunes rows they can't see.
create or replace function public.can_select_po(p_dept text, p_requester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_id = auth.uid()
      and ( p.role in ('CEO','VP','FinanceHead','Accountant','SuperManager','Admin')
         or p_requester = public.app_user_id(p)
         or p_dept = any(public.user_depts(p)) )
  );
$$;

drop policy if exists pos_auth_all on public.pos;
drop policy if exists pos_select on public.pos;
drop policy if exists pos_insert on public.pos;
drop policy if exists pos_update on public.pos;
drop policy if exists pos_delete on public.pos;

create policy pos_select on public.pos
  for select to authenticated
  using (public.can_select_po(dept, requester_id));
create policy pos_insert on public.pos for insert to authenticated with check (true);
create policy pos_update on public.pos for update to authenticated using (true) with check (true);
create policy pos_delete on public.pos for delete to authenticated using (true);

-- ---------------------------------------------------------------- requests (Payments)
-- Same dept-scoping as budgets/pos: company-wide roles see everything, everyone
-- else sees their own departments' payments and their own. Writes stay permissive
-- (client uses a diff-based save so a scoped user never prunes rows they can't see).
create or replace function public.can_select_request(p_dept text, p_requester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_id = auth.uid()
      and ( p.role in ('CEO','VP','FinanceHead','Accountant','SuperManager','Admin')
         or p_requester = public.app_user_id(p)
         or p_dept = any(public.user_depts(p)) )
  );
$$;

-- HR gets org-wide read of the HR-relevant expense categories only (the HR Expenses
-- tab) — people + office/admin ops — without exposing any other department's
-- commercial payments/POs/budgets. Category list mirrors HR_EXPENSE_NAMES in
-- src/constants.ts.
create or replace function public.caller_in_hr()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_id = auth.uid() and 'HR' = any(public.user_depts(p))
  );
$$;

drop policy if exists requests_auth_all on public.requests;
drop policy if exists requests_select on public.requests;
drop policy if exists requests_insert on public.requests;
drop policy if exists requests_update on public.requests;
drop policy if exists requests_delete on public.requests;

create policy requests_select on public.requests
  for select to authenticated
  using (
    public.can_select_request(dept, requester_id)
    or ( public.caller_in_hr()
         and (data->>'expenseTypeName') in
             ('Travel','Accommodation','Salary & Payroll','Employee Reimbursements',
              'Office Supplies','Marketing Events','Utilities & Office Expenses') )
  );
create policy requests_insert on public.requests for insert to authenticated with check (true);
create policy requests_update on public.requests for update to authenticated using (true) with check (true);
create policy requests_delete on public.requests for delete to authenticated using (true);

-- ------------------------------------------------ workflow-row guard (requests/pos)
-- Targeted integrity guard (NOT the full approval workflow). INSERT: requesterId
-- must be the caller and the row may not be born finalised. DELETE: only your own
-- non-finalised rows. UPDATE: not constrained here (per-stage authorization stays
-- client-enforced). Permissive RLS + this trigger mirrors the budgets pattern.
create or replace function public.workflow_row_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles; uid text; d jsonb;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then raise exception 'workflow: no profile for caller'; end if;
  if p.role = 'Admin' then return coalesce(new, old); end if;
  uid := public.app_user_id(p);

  if tg_op = 'DELETE' then
    d := old.data;
    if old.requester_id is distinct from uid then
      raise exception 'workflow: you may only delete your own rows';
    end if;
    if coalesce(d->>'status','') in ('Paid','Approved','Closed') then
      raise exception 'workflow: a finalised row may not be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    d := new.data;
    if new.requester_id is distinct from uid or (d->>'requesterId') is distinct from uid then
      raise exception 'workflow: requesterId must be the caller';
    end if;
    if coalesce(d->>'status','') in ('Paid','Approved','Closed')
       or coalesce(d->>'currentStage','') in ('Paid','Approved','Closed','Active') then
      raise exception 'workflow: a new row may not start in a finalised state';
    end if;
    return new;
  end if;

  return new;  -- UPDATE: not guarded here
end $$;

drop trigger if exists requests_guard_ins on public.requests;
drop trigger if exists requests_guard_del on public.requests;
create trigger requests_guard_ins after insert on public.requests for each row execute function public.workflow_row_guard();
create trigger requests_guard_del after delete on public.requests for each row execute function public.workflow_row_guard();

drop trigger if exists pos_guard_ins on public.pos;
drop trigger if exists pos_guard_del on public.pos;
create trigger pos_guard_ins after insert on public.pos for each row execute function public.workflow_row_guard();
create trigger pos_guard_del after delete on public.pos for each row execute function public.workflow_row_guard();

-- ------------------------------------------------ requests (payments) full workflow guard
-- Per-stage approval enforcement for payments (mirrors lib/workflow.ts +
-- lib/access.ts). Replaces workflow_row_guard on requests; pos keeps the lighter
-- guard above (its edit/cancel/close flows need separate handling).
create or replace function public.can_act_on_request(p public.profiles, r jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare uid text := public.app_user_id(p); stage text := r->>'currentStage'; sa text[];
begin
  if p.role = 'EmployeeReadOnly' then return false; end if;
  if r->>'status' in ('Paid','Rejected','Cancelled','Active','Approved','Closed') then return false; end if;
  if r->>'requesterId' = uid then return false; end if;
  if p.role = 'SuperManager' then return true; end if;
  if stage = 'BoxBuildMid' then return p.role = 'BoxBuildMidApprover'; end if;
  if stage = 'DeptApproval' then
    sa := coalesce(array(select jsonb_array_elements_text(r->'selectedApprovers')), '{}');
    if not (uid = any(sa)) then return false; end if;
    if p.role in ('DeptApprover','BoxBuildMidApprover') and not ((r->>'dept') = any(public.user_depts(p))) then return false; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(r->'history','[]'::jsonb)) h
               where h->>'byId' = uid and h->>'action' like '%Approved%') then return false; end if;
    return true;
  end if;
  if stage = 'VP' then return p.role = 'VP'; end if;
  if stage = 'CEO' then return p.role = 'CEO'; end if;
  if stage = 'FinanceHead' then return p.role = 'FinanceHead'; end if;
  if stage in ('Accountant','Processing') then return p.role = 'Accountant'; end if;
  return false;
end $$;

create or replace function public.payment_next_stage(amount numeric, stage text, is_sm boolean)
returns text language sql immutable as $$
  select case
    when is_sm and stage in ('BoxBuildMid','DeptApproval','VP','CEO','FinanceHead') then 'Accountant'
    when stage = 'BoxBuildMid'  then 'DeptApproval'
    when stage = 'DeptApproval' then 'FinanceHead'
    when stage = 'FinanceHead'  then case when amount >= 500000 then 'CEO' when amount >= 100000 then 'VP' else 'Accountant' end
    when stage = 'VP'           then 'Accountant'
    when stage = 'CEO'          then 'Accountant'
    when stage = 'Accountant'   then 'Paid'
    else stage end;
$$;

create or replace function public.payment_stage_status(stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid'  then 'Pending Delivery Head'
    when 'DeptApproval' then 'Pending Dept Approval'
    when 'VP'           then 'Pending VP'
    when 'CEO'          then 'Pending CEO'
    when 'FinanceHead'  then 'Pending Finance Head'
    when 'Accountant'   then 'Pending Accountant Processing'
    when 'Processing'   then 'Processing Payment'
    when 'Paid'         then 'Paid'
    when 'Rejected'     then 'Rejected'
    when 'Cancelled'    then 'Cancelled'
    else stage end;
$$;

create or replace function public.requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles; uid text; o jsonb; d jsonb;
  o_hist jsonb; n_hist jsonb; last_entry jsonb;
  o_stage text; n_stage text; amt numeric; exp_stage text; exp_status text; is_sm boolean;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then raise exception 'requests: no profile for caller'; end if;
  if p.role = 'Admin' then return coalesce(new, old); end if;
  uid := public.app_user_id(p);

  if tg_op = 'DELETE' then
    o := old.data;
    if old.requester_id is distinct from uid then raise exception 'requests: you may only delete your own rows'; end if;
    if coalesce(o->>'status','') in ('Paid','Rejected','Cancelled','Approved','Closed') then raise exception 'requests: a finalised row may not be deleted'; end if;
    return old;
  end if;

  d := new.data;
  if new.status is distinct from d->>'status'
     or new.current_stage is distinct from d->>'currentStage'
     or new.requester_id is distinct from d->>'requesterId' then
    raise exception 'requests: promoted columns must match data';
  end if;

  if tg_op = 'INSERT' then
    if new.requester_id is distinct from uid or (d->>'requesterId') is distinct from uid then raise exception 'requests: requesterId must be the caller'; end if;
    if coalesce(d->>'status','') in ('Paid','Approved','Closed') or coalesce(d->>'currentStage','') in ('Paid','Approved','Closed','Active') then raise exception 'requests: a new row may not start in a finalised state'; end if;
    return new;
  end if;

  o := old.data;
  if d = o then return new; end if;

  -- Post-travel report: the requester may attach a `postTravel` object (plus one
  -- history entry) to their OWN travel request, even after it is finalised (Paid).
  -- This is the only user-write allowed on a finalised row. Nothing else may change:
  -- money, stage, status, approvers and every other field stay identical.
  if (o->'travel') is not null
     and (o->>'requesterId') = uid
     and (o->'postTravel') is null
     and (d->'postTravel') is not null
     and (d->>'status') is not distinct from (o->>'status')
     and (d->>'currentStage') is not distinct from (o->>'currentStage')
     and (d - 'postTravel' - 'history') = (o - 'postTravel' - 'history') then
    o_hist := coalesce(o->'history','[]'::jsonb); n_hist := coalesce(d->'history','[]'::jsonb);
    if jsonb_array_length(n_hist) <> jsonb_array_length(o_hist) + 1 then
      raise exception 'requests: a post-travel report may append exactly one history entry';
    end if;
    if (n_hist->-1->>'byId') is distinct from uid then
      raise exception 'requests: post-travel history entry must be attributed to the caller';
    end if;
    return new;
  end if;

  if (o->>'amountINR') is distinct from (d->>'amountINR')
     or (o->>'requesterId') is distinct from (d->>'requesterId')
     or (o->>'dept') is distinct from (d->>'dept')
     or (o->>'projectId') is distinct from (d->>'projectId')
     or coalesce(o->'splits','[]'::jsonb) is distinct from coalesce(d->'splits','[]'::jsonb) then
    raise exception 'requests: amount/requester/dept/project/splits cannot change in a transition';
  end if;

  o_hist := coalesce(o->'history','[]'::jsonb); n_hist := coalesce(d->'history','[]'::jsonb);
  if jsonb_array_length(n_hist) <> jsonb_array_length(o_hist) + 1
     or coalesce((select jsonb_agg(h.e) from (
          select e from jsonb_array_elements(n_hist) with ordinality t(e, i)
          where i <= jsonb_array_length(o_hist) order by i) h), '[]'::jsonb) <> o_hist then
    raise exception 'requests: history may only be appended to';
  end if;
  last_entry := n_hist->-1;
  if last_entry->>'byId' is distinct from uid then raise exception 'requests: history entry must be attributed to the caller'; end if;

  o_stage := o->>'currentStage'; n_stage := d->>'currentStage'; amt := coalesce((o->>'amountINR')::numeric, 0);
  is_sm := p.role = 'SuperManager';

  if n_stage = 'Cancelled' or d->>'status' = 'Cancelled' then
    if o->>'requesterId' is distinct from uid then raise exception 'requests: only the requester may cancel'; end if;
    if coalesce(o->>'status','') in ('Paid','Rejected','Cancelled','Approved','Closed') then raise exception 'requests: this request can no longer be cancelled'; end if;
    if d->>'status' is distinct from 'Cancelled' then raise exception 'requests: cancelled requests must have status Cancelled'; end if;
    return new;
  end if;

  -- Payment reversal ("Undo Payment"): Paid -> Processing, Accountant-only. Checked
  -- before the eligibility gate because can_act_on_request blocks every action on a
  -- Paid row by design. The 24h window stays a client-side UX guard.
  if o_stage = 'Paid' and n_stage = 'Processing' then
    if p.role <> 'Accountant' then raise exception 'requests: only an Accountant may reverse a payment'; end if;
    if d->>'status' is distinct from 'Processing Payment' then raise exception 'requests: a reversed payment must return to "Processing Payment"'; end if;
    return new;
  end if;

  if not public.can_act_on_request(p, o) then
    raise exception 'requests: you are not an eligible approver at stage %', o_stage;
  end if;

  if n_stage = 'Rejected' or d->>'status' = 'Rejected' then
    if d->>'status' is distinct from 'Rejected' then raise exception 'requests: rejected requests must have status Rejected'; end if;
    return new;
  end if;

  -- Return to requester for changes (an eligible approver bounces it back, not terminal).
  if n_stage = 'Returned' or d->>'status' = 'Returned for Changes' then
    if d->>'status' is distinct from 'Returned for Changes' then raise exception 'requests: returned requests must have status "Returned for Changes"'; end if;
    return new;
  end if;

  -- Accountant processing is a TWO-STEP flow that a single next-stage can't express:
  --   Accountant --Start Processing--> Processing --Mark as Paid--> Paid
  -- A SuperManager may also pay directly from either stage. Handle these explicitly;
  -- all earlier stages fall through to the exact next-stage equality below.
  if o_stage = 'Accountant' then
    if n_stage = 'Processing' then
      if d->>'status' is distinct from 'Processing Payment' then raise exception 'requests: moving to Processing must set status "Processing Payment"'; end if;
      return new;
    elsif n_stage = 'Paid' then
      if not is_sm then raise exception 'requests: only a SuperManager may pay directly from the Accountant stage'; end if;
      if d->>'status' is distinct from 'Paid' then raise exception 'requests: a paid request must have status "Paid"'; end if;
      return new;
    else
      raise exception 'requests: invalid transition Accountant -> % (expected Processing or Paid)', n_stage;
    end if;
  end if;

  if o_stage = 'Processing' then
    if n_stage = 'Paid' and d->>'status' = 'Paid' then return new; end if;
    raise exception 'requests: invalid transition Processing -> % (expected Paid / "Paid")', n_stage;
  end if;

  exp_stage := public.payment_next_stage(amt, o_stage, is_sm);
  exp_status := public.payment_stage_status(exp_stage);
  if n_stage is distinct from exp_stage or d->>'status' is distinct from exp_status then
    raise exception 'requests: invalid transition % -> % (expected % / "%")', o_stage, n_stage, exp_stage, exp_status;
  end if;
  return new;
end $$;

drop trigger if exists requests_guard_ins on public.requests;
drop trigger if exists requests_guard_del on public.requests;
drop trigger if exists requests_guard_upd on public.requests;
create trigger requests_guard_ins after insert on public.requests for each row execute function public.requests_guard();
create trigger requests_guard_upd after update on public.requests for each row execute function public.requests_guard();
create trigger requests_guard_del after delete on public.requests for each row execute function public.requests_guard();

-- ------------------------------------------------------------------------
-- 0029: server-side HARD financial caps at creation time (point #1)
-- ------------------------------------------------------------------------
-- Client-only hard money caps moved into BEFORE INSERT guards so a crafted API
-- call cannot overspend a PO or a project budget. Soft/justified caps
-- (accommodation per-night, travel urgency, monthly-pool overshoot) stay
-- client-side and are intentionally NOT enforced here (the server must never be
-- stricter than the client). These BEFORE triggers run alongside the untouched
-- AFTER guards; firing pre-insert lets the helpers observe the exact pre-insert
-- state, matching getPOAvailable / getProjectSpend 1:1. Advisory xact locks on
-- the parent budget/PO serialize concurrent inserts. Same content as
-- supabase/migrations/0029_server_financial_caps.sql.

-- helpers (mirror src/lib/finance.ts, split-aware)
create or replace function public.po_committed(po_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    case
      when jsonb_typeof(r.data->'splits') = 'array' and jsonb_array_length(r.data->'splits') > 0
        then (select coalesce(sum((s->>'amountINR')::numeric), 0)
              from jsonb_array_elements(r.data->'splits') s
              where s->>'linkedPOId' = po_id)
      when r.data->>'linkedPOId' = po_id
        then coalesce((r.data->>'amountINR')::numeric, 0)
      else 0
    end), 0)
  from public.requests r
  where coalesce(r.data->>'status','') not in ('Rejected','Cancelled');
$$;

create or replace function public.po_available(po_id text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare po jsonb; amt numeric;
begin
  select data into po from public.pos where id = po_id;
  if po is null then return 0; end if;
  if coalesce(po->>'status','') = 'Cancelled' or coalesce(po->>'currentStage','') = 'Cancelled' then return 0; end if;
  amt := coalesce((po->>'amountINR')::numeric, 0);
  return greatest(0, amt - public.po_committed(po_id));
end $$;

create or replace function public.active_project_budget_amount(project_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((data->>'amountINR')::numeric, 0)
  from public.budgets
  where data->>'type' = 'Project' and data->>'projectId' = project_id
    and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active')
  limit 1;
$$;

create or replace function public.has_active_project_budget(project_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.budgets
    where data->>'type' = 'Project' and data->>'projectId' = project_id
      and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active'));
$$;

create or replace function public.project_spend(project_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    case
      when jsonb_typeof(r.data->'splits') = 'array' and jsonb_array_length(r.data->'splits') > 0
        then (select coalesce(sum((s->>'amountINR')::numeric), 0)
              from jsonb_array_elements(r.data->'splits') s
              where s->>'projectId' = project_id)
      when r.data->>'projectId' = project_id
        then coalesce((r.data->>'amountINR')::numeric, 0)
      else 0
    end), 0)
  from public.requests r
  where coalesce(r.data->>'status','') not in ('Rejected','Cancelled');
$$;

create or replace function public.project_po_committed(project_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum((data->>'amountINR')::numeric), 0)
  from public.pos
  where data->>'type' = 'POCreate' and data->>'projectId' = project_id
    and coalesce(data->>'status','') not in ('Rejected','Cancelled');
$$;

-- payment cap guard (BEFORE INSERT on requests)
create or replace function public.payment_caps_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  d jsonb := new.data;
  amt numeric := coalesce((d->>'amountINR')::numeric, 0);
  tol numeric := 0.5;
  s jsonb; s_amt numeric; s_proj text; s_po text;
  split_sum numeric;
  proj text; po_id text; po jsonb; avail numeric;
begin
  if auth.uid() is null then return new; end if;
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then return new; end if;
  if p.role = 'Admin' then return new; end if;

  if coalesce(d->>'kind','') <> 'Payment' then return new; end if;

  if jsonb_typeof(d->'splits') = 'array' and jsonb_array_length(d->'splits') > 0 then
    select coalesce(sum((e->>'amountINR')::numeric), 0) into split_sum
      from jsonb_array_elements(d->'splits') e;
    if abs(split_sum - amt) > tol then
      raise exception 'payments: split amounts (₹%) must sum to the total (₹%)', split_sum, amt;
    end if;
    for s in select e from jsonb_array_elements(d->'splits') e loop
      s_amt := coalesce((s->>'amountINR')::numeric, 0);
      s_proj := s->>'projectId';
      s_po := s->>'linkedPOId';
      if s_proj is null or s_proj = '' then raise exception 'payments: each split needs a projectId'; end if;
      perform pg_advisory_xact_lock(1, hashtext(s_proj));
      if s_po is not null and s_po <> '' then perform pg_advisory_xact_lock(2, hashtext(s_po)); end if;
      if not public.has_active_project_budget(s_proj) then
        raise exception 'payments: no active budget for project %', s_proj;
      end if;
      avail := public.active_project_budget_amount(s_proj) - public.project_spend(s_proj);
      if s_amt > avail + tol then
        raise exception 'payments: % exceeds available project budget (₹%)', s_proj, greatest(0, avail);
      end if;
      if s_po is null or s_po = '' then raise exception 'payments: each split needs an approved PO'; end if;
      select data into po from public.pos where id = s_po;
      if po is null then raise exception 'payments: split PO % not found', s_po; end if;
      if coalesce(po->>'status','') = 'Cancelled' then raise exception 'payments: split PO % is cancelled', s_po; end if;
      if po->>'projectId' is distinct from s_proj then raise exception 'payments: split PO % belongs to a different project', s_po; end if;
      if s_amt > public.po_available(s_po) + tol then
        raise exception 'payments: % exceeds PO % available (₹%)', s_proj, s_po, public.po_available(s_po);
      end if;
    end loop;
    return new;
  end if;

  if coalesce(d->>'isProject','') = 'true' and coalesce(d->>'projectId','') <> '' then
    proj := d->>'projectId';
    po_id := d->>'linkedPOId';
    perform pg_advisory_xact_lock(1, hashtext(proj));
    if po_id is not null and po_id <> '' then perform pg_advisory_xact_lock(2, hashtext(po_id)); end if;
    if not public.has_active_project_budget(proj) then
      raise exception 'payments: no active budget for project %', proj;
    end if;
    avail := public.active_project_budget_amount(proj) - public.project_spend(proj);
    if amt > avail + tol then
      raise exception 'payments: exceeds available project budget (₹%)', greatest(0, avail);
    end if;
    if po_id is not null and po_id <> '' then
      select data into po from public.pos where id = po_id;
      if po is null then raise exception 'payments: linked PO % not found', po_id; end if;
      if coalesce(po->>'status','') = 'Cancelled' then raise exception 'payments: linked PO % is cancelled', po_id; end if;
      if amt > public.po_available(po_id) + tol then
        raise exception 'payments: exceeds PO % available (₹%)', po_id, public.po_available(po_id);
      end if;
    end if;
    return new;
  end if;

  return new;
end $$;

-- PO cap guard (BEFORE INSERT on pos)
create or replace function public.po_caps_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  d jsonb := new.data;
  amt numeric := coalesce((d->>'amountINR')::numeric, 0);
  tol numeric := 0.5;
  proj text; b jsonb; budget_amt numeric; cov numeric; ceiling numeric;
  committed numeric; total_after numeric;
  dept_ text; cat text; mon text := to_char(now(),'YYYY-MM');
begin
  if auth.uid() is null then return new; end if;
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then return new; end if;
  if p.role = 'Admin' then return new; end if;

  if coalesce(d->>'type','') <> 'POCreate' then return new; end if;

  if coalesce(d->>'isProject','') = 'true' then
    proj := d->>'projectId';
    if proj is null or proj = '' then raise exception 'po: a project PO needs a projectId'; end if;
    perform pg_advisory_xact_lock(1, hashtext(proj));
    select data into b from public.budgets
      where data->>'type' = 'Project' and data->>'projectId' = proj
        and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active')
      limit 1;
    if b is null then raise exception 'po: selected project % has no active budget', proj; end if;
    budget_amt := coalesce((b->>'amountINR')::numeric, 0);
    committed := public.project_po_committed(proj);
    total_after := committed + amt;
    if total_after > budget_amt + tol then
      raise exception 'po: PO commitments (₹%) would exceed the project budget (₹%). Raise a Budget Extension first.',
        total_after, budget_amt;
    end if;
    -- Live client-order value from approved PIs; legacy stored value as fallback.
    cov := public.project_client_order_value(proj);
    if cov <= 0 then cov := coalesce((b->>'clientOrderValue')::numeric, 0); end if;
    -- Hard stop at 100% of COV — the 20% margin is a star cost (charged on the
    -- budget/extension), not a wall; the project-budget cap above is the real limit.
    if coalesce(b->>'projectType','') = 'Client' and cov > 0 then
      if total_after > cov + tol then
        raise exception 'po: PO commitments (₹%) would exceed 100%% of client order value (₹% from approved PIs)', total_after, cov;
      end if;
    end if;
    return new;
  else
    dept_ := d->>'dept';
    cat := d->>'category';
    perform pg_advisory_xact_lock(1, hashtext(coalesce(dept_,'') || ':' || coalesce(cat,'')));
    if not exists (
      select 1 from public.budgets
      where data->>'type' = 'Monthly' and data->>'dept' = dept_ and data->>'category' = cat
        and data->>'month' = mon
        and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active')
    ) then
      raise exception 'po: no active Monthly Budget for % → % (%). Ask your Dept Head to raise one first.', dept_, cat, mon;
    end if;
    return new;
  end if;
end $$;

drop trigger if exists payment_caps_guard_ins on public.requests;
create trigger payment_caps_guard_ins before insert on public.requests
  for each row execute function public.payment_caps_guard();

drop trigger if exists po_caps_guard_ins on public.pos;
create trigger po_caps_guard_ins before insert on public.pos
  for each row execute function public.po_caps_guard();
