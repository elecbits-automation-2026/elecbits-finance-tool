-- 0005: admin "deactivate & view"
-- ----------------------------------------------------------------------------
-- Lets the admin deactivate an employee, generating a password that the admin
-- can use to sign in AS that user and review their activity. The password is
-- always visible to the admin in the Admin Console (not one-time).
--
-- Status model:
--   active      — normal, can sign in
--   pending     — awaiting admin approval, cannot sign in
--   disabled    — rejected/blocked, cannot sign in (existing behaviour)
--   deactivated — admin reset the password; the real user can no longer sign in
--                 (their old password was replaced) and sees a "deactivated"
--                 message. Only the admin holds the new password, so a
--                 successful sign-in to a deactivated account is the admin
--                 viewing that user's activity.

-- Per-user access password. Written by the `admin-deactivate` edge function
-- (service role) and readable ONLY by admins. Kept in its own table — not a
-- column on profiles — so the existing `select *` the app runs on profiles can
-- never expose it to ordinary employees.
create table if not exists public.admin_access (
  auth_id    uuid primary key references public.profiles (auth_id) on delete cascade,
  password   text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_access enable row level security;

drop policy if exists admin_access_admin on public.admin_access;
create policy admin_access_admin on public.admin_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- login_status(email): returns the account status for an email so the login
-- page can distinguish a deactivated account from a wrong password after a
-- failed sign-in (the user's profile isn't readable pre-auth). SECURITY DEFINER
-- so it can read profiles before the caller is authenticated; callable by anon.
-- (Minor trade-off: reveals whether an email exists and its status — acceptable
-- for this internal tool.)
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
