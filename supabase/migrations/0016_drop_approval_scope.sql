-- 0016_drop_approval_scope.sql
-- Simplify budget approval routing & visibility to pure ROLE + DEPARTMENT.
-- Removes the per-head `scope` overlay and the ODM/Sales cross-department bridge:
-- a department head now approves and sees ONLY their own department's requests
-- (multi-department heads via extra_depts still covered). Company-wide roles
-- (CEO/VP/FinanceHead/Accountant/SuperManager/Admin) still see everything.
-- Mirrors the client changes in workflow.ts / access.ts.
--
-- The profiles.scope column is left in place (nullable, now unused) to avoid a
-- destructive change; existing values are cleared below since nothing reads them.

-- 1. Eligible dept-stage approvers: drop the ODM/Sales/scope branches.
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
  elsif req_dept = 'Management' then
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'SuperManager'
      and public.app_user_id(p) <> req_uid;
  elsif req_dept = 'Finance' then
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'FinanceHead';
  else
    -- Every other department: its own DeptApprover(s). Pure role + department —
    -- no scopes or cross-department bridges.
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'DeptApprover'
      and req_dept = any(public.user_depts(p));
  end if;
  return ids;
end $$;

-- 2. Per-stage authorization: a head is held to their own departments, no scope exception.
create or replace function public.can_act_on_budget(p public.profiles, b jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  uid text := public.app_user_id(p);
  stage text := b->>'currentStage';
  sa text[];
begin
  if p.role = 'EmployeeReadOnly' then return false; end if;
  if b->>'type' in ('RDCap', 'RDCapRequest') then return false; end if;
  if b->>'status' in ('Paid','Rejected','Cancelled','Active','Approved','Closed') then return false; end if;
  if b->>'requesterId' = uid then return false; end if;   -- segregation of duties
  if p.role = 'SuperManager' then return true; end if;
  if stage = 'BoxBuildMid' then return p.role = 'BoxBuildMidApprover'; end if;
  if stage = 'DeptApproval' then
    sa := coalesce(array(select jsonb_array_elements_text(b->'selectedApprovers')), '{}');
    if not (uid = any(sa)) then return false; end if;
    -- A head is held strictly to their own departments (pure role + dept).
    if p.role in ('DeptApprover','BoxBuildMidApprover')
       and not ((b->>'dept') = any(public.user_depts(p))) then return false; end if;
    -- One approval per person at the consensus stage.
    if exists (select 1 from jsonb_array_elements(coalesce(b->'history','[]'::jsonb)) h
               where h->>'byId' = uid and h->>'action' like '%Approved%') then return false; end if;
    return true;
  end if;
  if stage = 'VP' then return p.role = 'VP'; end if;
  if stage = 'CEO' then return p.role = 'CEO'; end if;
  if stage = 'FinanceHead' then return p.role = 'FinanceHead'; end if;
  return false;
end $$;

-- 3. Budget read visibility: drop the scope/bridge clauses.
create or replace function public.can_select_budget(b_dept text, b_requester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_id = auth.uid()
      and ( p.role in ('CEO','VP','FinanceHead','Accountant','SuperManager','Admin')
         or b_requester = public.app_user_id(p)
         or b_dept = any(public.user_depts(p)) )
  );
$$;

-- 4. Clear the now-unused scope values (column kept for compatibility).
update public.profiles set scope = null where scope is not null;
