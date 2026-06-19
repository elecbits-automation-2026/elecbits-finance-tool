-- 0018_must_reset_password.sql
-- A re-activated account is set straight back to 'active', but its password was
-- reset on deactivation — so the user's old password no longer works and they
-- have no way to know why. Flag such accounts so the login page can tell them to
-- use Forgot Password. The flag is set on re-activation and cleared when they set
-- a new password (or sign in successfully).

alter table public.profiles
  add column if not exists must_reset_password boolean not null default false;

-- Anon-callable lookup so the login page can show a helpful message after a
-- failed sign-in on an otherwise-active account.
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
