-- ============================================================================
-- Allow a freshly-signed-up user to create their OWN profile row.
--
-- 0001 gave profiles only read + update-self policies, so the signUp() upsert
-- (an INSERT … ON CONFLICT) was blocked by RLS and the profile was never
-- written. This adds an insert policy scoped to the caller's own auth row, so
-- self-service signup can create its pending profile. Status still defaults to
-- 'pending' (see column default) — an admin promotes the account to 'active'.
--
-- NOTE: the new user must be authenticated at insert time for auth.uid() to
-- match. That means email confirmation should be OFF in Supabase
-- (Authentication → Providers → Email → "Confirm email"); otherwise signUp
-- returns no session and this insert runs as the anon role and is rejected.
-- ============================================================================
create policy profiles_insert_self on public.profiles
  for insert to authenticated with check (auth.uid() = auth_id);
