-- ============================================================================
-- Allow admins (SuperManager / CEO) to update ANY profile.
--
-- 0001 only granted profiles_update_self (auth.uid() = auth_id), so the
-- in-app admin panel could not activate a pending signup or assign its role/
-- dept/designation — those updates touch a row the admin does not own. This
-- adds an admin-scoped update policy.
--
-- The admin check reads the caller's own role from public.profiles. Doing that
-- directly inside a policy USING clause on the same table causes infinite RLS
-- recursion, so it is wrapped in a SECURITY DEFINER function that bypasses RLS
-- when reading the role.
-- ============================================================================

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
      and role in ('SuperManager', 'CEO')
  );
$$;

create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
