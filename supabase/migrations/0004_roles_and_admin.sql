-- ============================================================================
-- Roles catalog + dedicated Admin account support.
--
-- 1. A `roles` reference table holding the 7 flat role-groups the org admin
--    assigns to employees. `key` is the value stored in profiles.role and
--    consumed by the app's workflow/access logic (src/lib/access.ts) — the
--    catalog just gives the admin UI a single source of truth + display labels.
-- 2. Extends is_admin() to recognise the new 'Admin' role so the dedicated
--    administrator account can update any profile's role/status (the existing
--    profiles_update_admin policy from 0003 keys off is_admin()).
--
-- The admin AUTH user + profile (admin@elecbits.in / admin@123, role 'Admin')
-- is created by scripts/seed.ts (`npm run seed`) — it needs the service-role
-- key to create an auth user, which can't be done from SQL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- roles: the 7 assignable role-groups. `key` must match the role strings the
-- app checks in src/lib/access.ts.
-- ----------------------------------------------------------------------------
create table if not exists public.roles (
  id     int  primary key,        -- group number 1..7
  key    text unique not null,    -- system role value stored in profiles.role
  label  text not null,           -- display name shown in the admin dropdown
  titles text,                    -- reference: example titles within this group
  rank   int  not null            -- sort order in the UI
);

insert into public.roles (id, key, label, titles, rank) values
  (1, 'Employee',     'Employee',        'Emp, Junior, Intern, Executive',     1),
  (2, 'DeptApprover', 'Department Head', 'Manager, Dept Head, Reporting Manager', 2),
  (3, 'Accountant',   'Accountant',      'Accountant',                         3),
  (4, 'FinanceHead',  'Finance Head',    'Finance Head',                       4),
  (5, 'VP',           'Vice President',  'VP',                                 5),
  (6, 'CEO',          'CEO',             'CEO',                                6),
  (7, 'SuperManager', 'Special Access',  'Special',                           7)
on conflict (id) do update
  set key = excluded.key, label = excluded.label, titles = excluded.titles, rank = excluded.rank;

alter table public.roles enable row level security;

-- Reference data: any authenticated user may read it (the admin UI needs it).
create policy roles_read on public.roles
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- Let the dedicated 'Admin' account (in addition to SuperManager / CEO) update
-- any profile — assign roles and activate/deactivate accounts.
-- ----------------------------------------------------------------------------
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
      and role in ('SuperManager', 'CEO', 'Admin')
  );
$$;
