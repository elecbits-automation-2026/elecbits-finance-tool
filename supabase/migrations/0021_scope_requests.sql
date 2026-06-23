-- 0021_scope_requests.sql
-- Scope payment (requests) visibility to the user's own department, matching
-- budgets and POs/PIs. The `requests` table had a permissive `requests_auth_all`
-- policy (any authenticated user could read every payment). Replace its SELECT
-- with a dept-scoped policy; keep writes permissive (no guard trigger on
-- requests — write correctness is client-enforced, and the client now uses a
-- diff-based save so a scoped user never prunes rows they can't see).
--
-- Visibility after this: company-wide roles (CEO/VP/FinanceHead/Accountant/
-- SuperManager/Admin) see all payments; everyone else sees their own
-- departments' payments and their own.

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

-- Replace the permissive "for all" policy with per-command policies: scoped
-- SELECT, permissive writes.
drop policy if exists requests_auth_all on public.requests;
drop policy if exists requests_select on public.requests;
drop policy if exists requests_insert on public.requests;
drop policy if exists requests_update on public.requests;
drop policy if exists requests_delete on public.requests;

create policy requests_select on public.requests
  for select to authenticated
  using (public.can_select_request(dept, requester_id));
create policy requests_insert on public.requests for insert to authenticated with check (true);
create policy requests_update on public.requests for update to authenticated using (true) with check (true);
create policy requests_delete on public.requests for delete to authenticated using (true);
