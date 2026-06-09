-- 0007: account management is Admin-only
-- ----------------------------------------------------------------------------
-- Separates the dedicated 'Admin' account from the finance-workflow roles.
-- Previously is_admin() also recognised 'SuperManager' ("Special Access") and
-- 'CEO', which gave them the power to update any profile (assign roles,
-- deactivate/reactivate accounts) and read the admin_access password table.
--
-- Account management now belongs to the 'Admin' account ONLY. SuperManager and
-- CEO remain full participants in the approval workflow but have no user-admin
-- powers. The frontend "Pending Signups" tab that used to surface this to them
-- has also been removed (see src/pages/Dashboard.tsx); the Admin Console is the
-- sole place to approve signups, assign roles, and deactivate/reactivate.
--
-- This narrows is_admin(); the profiles_update_admin and admin_access_admin
-- policies (which key off is_admin()) tighten automatically with it.
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
      and role = 'Admin'
  );
$$;
