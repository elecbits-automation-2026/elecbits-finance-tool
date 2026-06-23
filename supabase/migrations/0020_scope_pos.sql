-- 0020_scope_pos.sql
-- Scope PO/PI visibility to the user's own department, matching budgets. POs/PIs
-- live in the `pos` table, which until now had a permissive `pos_auth_all` policy
-- (any authenticated user could read every row). Replace its SELECT with a
-- dept-scoped policy; keep writes permissive (there's no guard trigger on pos —
-- write correctness is client-enforced, and the client now uses a diff-based save
-- so a scoped user never prunes rows they can't see).
--
-- Visibility after this: company-wide roles (CEO/VP/FinanceHead/Accountant/
-- SuperManager/Admin) see all; everyone else sees their own departments' POs/PIs
-- and their own.

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

-- Replace the permissive "for all" policy with per-command policies: scoped
-- SELECT, permissive writes. (A "for all" permissive policy would OR with the
-- scoped SELECT and defeat it, so it must be dropped.)
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
