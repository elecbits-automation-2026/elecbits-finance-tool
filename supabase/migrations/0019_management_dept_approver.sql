-- 0019_management_dept_approver.sql
-- Route Management-department budget approvals to the Management DeptApprover
-- (like every other project department) instead of to SuperManagers. SuperManagers
-- can still override any budget; this only changes the default dept-stage approver
-- so the Management head actually approves Management requests.
-- Mirrors the client change in workflow.ts (getEligibleDeptApprovers).
--
-- Only change: the 'Management' branch is dropped so it falls through to the
-- generic DeptApprover-by-department rule.

create or replace function public.budget_eligible_approvers(
  req_uid text, req_dept text, req_role text, req_scope text, is_project boolean
) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare ids text[];
begin
  if req_dept = 'Executive' then
    if req_role = 'CEO' then
      select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
        from public.profiles p where p.status = 'active' and p.role = 'CEO'
        and public.app_user_id(p) <> req_uid;
    elsif req_role = 'VP' then
      select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
        from public.profiles p where p.status = 'active' and p.role = 'CEO';
    else
      ids := '{}';
    end if;
  elsif req_dept = 'Finance' then
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'FinanceHead';
  else
    -- Every other department (incl. Management): its own DeptApprover(s).
    -- Pure role + department — no scopes or cross-department bridges.
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'DeptApprover'
      and req_dept = any(public.user_depts(p));
  end if;
  return ids;
end $$;
