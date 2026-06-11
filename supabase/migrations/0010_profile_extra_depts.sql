-- ============================================================================
-- 0010_profile_extra_depts.sql
-- Adds multi-department support for a single user. `dept` remains the PRIMARY
-- department (stamps the user's own requests and drives their default view).
-- `extra_depts` is an admin-managed list of ADDITIONAL departments the user
-- also belongs to / heads. A department head with extra_depts approves and sees
-- work in every one of their departments; in the dashboard they switch between
-- them with a per-department tab.
--
-- Only the admin assigns/removes extra_depts (the existing row-level
-- profiles_update_admin policy from 0003 already covers this new column, so no
-- new policy is needed). Defaults to an empty array, so existing single-dept
-- users are unaffected.
-- ============================================================================

alter table public.profiles
  add column if not exists extra_depts text[] not null default '{}';
