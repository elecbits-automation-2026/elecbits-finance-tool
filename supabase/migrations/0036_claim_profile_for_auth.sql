-- 0036_claim_profile_for_auth.sql
-- Google (OAuth) SSO support: let a signed-in user adopt the existing profile that
-- matches THEIR OWN verified email, by re-pointing profiles.auth_id to the current
-- auth uid. Needed because a Google sign-in may authenticate under a uid that isn't
-- yet linked to the email/password-created profile, and RLS (profiles_update_self)
-- blocks re-pointing auth_id from the client.
--
-- Safe: SECURITY DEFINER, but it only ever touches the single profile whose email
-- equals the CALLER'S OWN verified email (from auth.users), so a user can only claim
-- their own account — never someone else's.
create or replace function public.claim_profile_for_auth()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  em  text;
begin
  if uid is null then return; end if;
  select lower(email) into em from auth.users where id = uid;
  if em is null then return; end if;
  update public.profiles
     set auth_id = uid
   where lower(email) = em
     and auth_id is distinct from uid;
end $$;

grant execute on function public.claim_profile_for_auth() to authenticated;
