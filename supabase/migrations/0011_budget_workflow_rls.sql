-- ============================================================================
-- 0011_budget_workflow_rls.sql
-- Server-side enforcement of the BUDGET approval workflow.
-- ----------------------------------------------------------------------------
-- Until now every rule in the budget flow (who may raise, who may approve,
-- what the next stage is, self-approval bans, amount caps) lived ONLY in the
-- browser (src/lib/access.ts, src/lib/workflow.ts) while the `budgets` table
-- was writable by any authenticated user (`using(true) with check(true)`), as
-- flagged in docs/AUDIT-budget-workflow-test.md §6 item 8. This migration
-- mirrors those rules in Postgres so a caller talking to the API directly is
-- bound by the same workflow as the UI.
--
-- Mechanism:
--  * Validation lives in an AFTER INSERT/UPDATE/DELETE row trigger, NOT in
--    `with check` policies, because the app writes via upsert (INSERT ... ON
--    CONFLICT DO UPDATE): only AFTER triggers fire on the branch actually
--    taken and see both OLD and NEW for transition checks.
--  * SELECT is scoped: company-wide finance/exec roles see everything, others
--    see their own departments' rows + their own requests. (Slightly broader
--    than the UI's per-user visibility — same-dept employees can read dept
--    rows because forms need them — but cross-department scraping is closed.)
--  * DELETE is an RLS policy (not a trigger error) so the app's bulk-save
--    prune silently skips rows the caller may not delete instead of failing:
--    only SuperManagers may delete, and only R&D-cap config rows.
--  * Service-role / SQL-editor sessions (auth.uid() IS NULL) and the 'Admin'
--    console role bypass the trigger: seeding and admin repair keep working.
--
-- KEEP IN SYNC: thresholds and rules here mirror src/constants.ts
-- (VP_THRESHOLD=100000, CEO_THRESHOLD=500000, MAX_BUDGET_RATIO=0.80,
-- NON_PROJECT_DEPTS) and the budget branches of src/lib/workflow.ts /
-- src/lib/access.ts. A change on either side must be made on both.
-- ============================================================================

-- ---------------------------------------------------------------- helpers

-- The app identifies users by profiles.legacy_id when present (U01…), falling
-- back to auth_id text — must match profileToUser() in src/lib/auth.ts.
create or replace function public.app_user_id(p public.profiles)
returns text language sql immutable as $$
  select coalesce(p.legacy_id, p.auth_id::text);
$$;

-- Every department a user belongs to (primary + admin-granted extras).
-- Mirrors effectiveDepts() in src/lib/access.ts.
create or replace function public.user_depts(p public.profiles)
returns text[] language sql immutable as $$
  select case when p.dept is null or p.dept = '' then coalesce(p.extra_depts, '{}')
              else array[p.dept] || coalesce(p.extra_depts, '{}') end;
$$;

-- Stage -> display status for budgets. Mirrors getStageLabel(stage,"Budget").
create or replace function public.budget_stage_status(stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid' then 'Pending Delivery Head'
    when 'DeptApproval' then 'Pending Dept Head'
    when 'VP' then 'Pending VP'
    when 'CEO' then 'Pending CEO'
    when 'FinanceHead' then 'Pending Finance Head'
    when 'Active' then 'Active'
    when 'Rejected' then 'Rejected'
    when 'Cancelled' then 'Cancelled'
    else stage end;
$$;

-- Next stage for a budget on a NON-SuperManager approval. Mirrors the budget
-- branches of computeNextStage(): >=1L adds VP, >=5L adds VP then CEO.
create or replace function public.budget_next_stage(amount numeric, stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid' then 'DeptApproval'
    when 'DeptApproval' then case when amount >= 100000 then 'VP' else 'FinanceHead' end
    when 'VP' then case when amount >= 500000 then 'CEO' else 'FinanceHead' end
    when 'CEO' then 'FinanceHead'
    when 'FinanceHead' then 'Active'
    else stage end;
$$;

-- Eligible DEPT-stage approvers for a budget raised by (uid, role, scope) in
-- req_dept. Returns app user ids. Mirrors getEligibleDeptApprovers(); takes
-- req_dept separately because a multi-department head raises under a tab dept.
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
  elsif req_dept in ('ODM', 'Sales') and req_scope = 'ODM-SALES' then
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'DeptApprover' and p.scope = 'ODM-SALES';
  elsif req_dept = 'Sales' then
    -- Sales routes to the Sales head (ODM-SALES scope), never the ODM heads.
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'DeptApprover' and p.scope = 'ODM-SALES';
  elsif req_dept = 'ODM' then
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'DeptApprover'
      and (p.scope = 'ODM-ALL' or (is_project and p.scope = 'ODM-PROJECT'));
  else
    select coalesce(array_agg(public.app_user_id(p)), '{}') into ids
      from public.profiles p where p.status = 'active' and p.role = 'DeptApprover'
      and case coalesce(p.scope, '')
            when 'HR' then req_dept = 'HR'
            when 'BOXBUILD' then req_dept = 'Box Build'
            when '' then req_dept = any(public.user_depts(p))
            else false
          end;
  end if;
  return ids;
end $$;

-- May this profile act (approve/reject) on this budget right now?
-- Mirrors canUserActOnRequest() for kind=Budget, including the self-approval
-- ban; dept matching uses ALL the user's departments (tab-independent).
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
    -- An unscoped head is held strictly to their own departments.
    if p.role in ('DeptApprover','BoxBuildMidApprover') and p.scope is null
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

-- ---------------------------------------------------------------- trigger

create or replace function public.budgets_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  uid text;
  depts text[];
  d jsonb;
  o jsonb;
  amt numeric;
  req_dept text;
  is_proj boolean;
  sa text[];
  elig text[];
  needs_mid boolean;
  stage text;
  o_stage text;
  exp_stage text;
  exp_status text;
  o_hist jsonb;
  n_hist jsonb;
  last_entry jsonb;
  total int;
  cnt int;
  cur_month text := to_char(now(), 'YYYY-MM');
  alloc numeric;
  used numeric;
  parent jsonb;
  ext_total numeric;
begin
  -- Service role / SQL editor / seed scripts: no JWT user — not subject to
  -- workflow rules (these paths are already privileged).
  if auth.uid() is null then return coalesce(new, old); end if;

  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then raise exception 'budgets: no profile for caller'; end if;
  if p.role = 'Admin' then return coalesce(new, old); end if;  -- admin console repair
  if p.status <> 'active' then raise exception 'budgets: account is not active'; end if;

  uid := public.app_user_id(p);
  depts := public.user_depts(p);

  -- ------------------------------------------------------------- DELETE
  if tg_op = 'DELETE' then
    -- RLS already limits deletes to SuperManagers on R&D-cap config rows;
    -- this is defense in depth.
    if not (p.role = 'SuperManager' and old.type in ('RDCap','RDCapRequest')) then
      raise exception 'budgets: % may not be deleted', old.id;
    end if;
    return old;
  end if;

  d := new.data;

  -- Promoted columns must agree with the canonical object in `data` —
  -- the SELECT policy and indexes key off them.
  if new.id is distinct from d->>'id'
     or new.type is distinct from d->>'type'
     or new.dept is distinct from d->>'dept'
     or new.status is distinct from d->>'status'
     or new.current_stage is distinct from d->>'currentStage' then
    raise exception 'budgets: promoted columns do not match data for %', new.id;
  end if;

  -- ------------------------------------------------------------- INSERT
  if tg_op = 'INSERT' then
    if new.type = 'RDCap' then
      if p.role <> 'SuperManager' then
        raise exception 'budgets: only a SuperManager may allocate an R&D cap';
      end if;
      return new;
    end if;

    if new.type = 'RDCapRequest' then
      if d->>'requesterId' is distinct from uid or not coalesce((d->>'dept') = any(depts), false) then
        raise exception 'budgets: R&D allocation request must be raised by yourself for your own department';
      end if;
      return new;
    end if;

    if new.type not in ('Project','Monthly','Extension') then
      raise exception 'budgets: unknown budget type %', new.type;
    end if;

    -- ---- raise gates (mirror NewBudgetRequestForm.submit) ----
    amt := coalesce((d->>'amountINR')::numeric, 0);
    req_dept := d->>'dept';
    is_proj := new.type <> 'Monthly';

    if d->>'requesterId' is distinct from uid then
      raise exception 'budgets: requesterId must be the caller';
    end if;
    if req_dept is null or not (req_dept = any(depts)) then
      raise exception 'budgets: dept % is not one of your departments', req_dept;
    end if;
    if amt <= 0 then raise exception 'budgets: invalid amount'; end if;
    if (d->>'isProject') is distinct from (case when is_proj then 'true' else 'false' end) then
      raise exception 'budgets: isProject flag does not match budget type';
    end if;

    if new.type in ('Monthly','Extension') and p.role not in ('DeptApprover','BoxBuildMidApprover') then
      raise exception 'budgets: only Department Heads may raise % budgets', new.type;
    end if;
    if new.type = 'Project' then
      if req_dept in ('HR','Finance','Product','Marketing') then
        raise exception 'budgets: % cannot raise Project budgets', req_dept;
      end if;
      if p.role not in ('Employee','DeptApprover','BoxBuildMidApprover') then
        raise exception 'budgets: role % cannot raise Project budgets', p.role;
      end if;
      if d->>'projectType' = 'RD' then
        if req_dept <> 'ODM' then
          raise exception 'budgets: only ODM may raise R&D budgets';
        end if;
        select (b.data->>'amountINR')::numeric into alloc from public.budgets b
          where b.type = 'RDCap' and b.dept = req_dept and b.data->>'month' = cur_month
            and (b.status = 'Active' or b.current_stage = 'Active') limit 1;
        if alloc is null then
          raise exception 'budgets: no R&D allocation for % in %', req_dept, cur_month;
        end if;
        select coalesce(sum((b.data->>'amountINR')::numeric), 0) into used from public.budgets b
          where b.data->>'type' = 'Project' and b.data->>'projectType' = 'RD' and b.dept = req_dept
            and (b.status = 'Active' or b.current_stage = 'Active')
            and left(coalesce(b.data->>'approvedDate', b.data->>'createdDate'), 7) = cur_month;
        if amt > greatest(0, alloc - used) then
          raise exception 'budgets: exceeds remaining R&D allocation (₹%)', greatest(0, alloc - used);
        end if;
      else
        if coalesce((d->>'clientOrderValue')::numeric, 0) <= 0 then
          raise exception 'budgets: client order value required';
        end if;
        if amt > (d->>'clientOrderValue')::numeric * 0.80 then
          raise exception 'budgets: exceeds 80%% of client order value';
        end if;
      end if;
      if exists (select 1 from public.budgets b
                 where b.data->>'type' = 'Project' and b.data->>'projectId' = d->>'projectId'
                   and b.status not in ('Rejected','Cancelled') and b.id <> new.id) then
        raise exception 'budgets: a budget already exists for project %', d->>'projectId';
      end if;
    end if;

    if new.type = 'Extension' then
      select b.data into parent from public.budgets b
        where b.data->>'projectId' = d->>'extensionFor' and b.data->>'type' = 'Project'
          and (b.status = 'Active' or b.current_stage = 'Active') limit 1;
      if parent is null then
        raise exception 'budgets: no active project % to extend', d->>'extensionFor';
      end if;
      if not coalesce((parent->>'dept') = any(depts), false) then
        raise exception 'budgets: cannot extend another department''s project';
      end if;
      if parent->>'projectType' = 'Client' then
        select coalesce(sum((b.data->>'amountINR')::numeric), 0) into ext_total from public.budgets b
          where b.data->>'type' = 'Extension' and b.data->>'extensionFor' = d->>'extensionFor'
            and (b.status = 'Active' or b.current_stage = 'Active');
        if (parent->>'amountINR')::numeric + ext_total + amt > (parent->>'clientOrderValue')::numeric * 0.80 then
          raise exception 'budgets: extension exceeds combined 80%% cap';
        end if;
      end if;
    end if;

    -- ---- routing: approvers + initial stage ----
    sa := coalesce(array(select jsonb_array_elements_text(d->'selectedApprovers')), '{}');
    if uid = any(sa) then
      raise exception 'budgets: requester may not be their own approver';
    end if;
    elig := array_remove(public.budget_eligible_approvers(uid, req_dept, p.role, p.scope, is_proj), uid);
    if not (sa <@ elig and elig <@ sa) then
      raise exception 'budgets: selectedApprovers must be exactly the eligible department approvers';
    end if;

    needs_mid := coalesce(p.dept = 'Box Build' and p.role = 'Employee'
                 and (p.designation like '%Project Manager%' or p.designation like '%Vendor Manager%'), false);
    stage := d->>'currentStage';
    if needs_mid then
      if stage <> 'BoxBuildMid' then
        raise exception 'budgets: Box Build PM/VM budgets must start at BoxBuildMid';
      end if;
    elsif cardinality(sa) = 0 then
      -- Sole-head escalation: allowed only when the requester themselves is
      -- the sole eligible approver (a department head raising their own
      -- request). A department with NO configured approver at all may not
      -- raise budgets — mirrors the client's "no approver configured" gate.
      if not (uid = any(public.budget_eligible_approvers(uid, req_dept, p.role, p.scope, is_proj))) then
        raise exception 'budgets: no approver is configured for department %', req_dept;
      end if;
      -- The request starts at the next authority for the amount.
      if stage is distinct from public.budget_next_stage(amt, 'DeptApproval') then
        raise exception 'budgets: empty approver list requires escalated initial stage %',
          public.budget_next_stage(amt, 'DeptApproval');
      end if;
    elsif stage <> 'DeptApproval' then
      raise exception 'budgets: new budgets must start at DeptApproval';
    end if;
    if d->>'status' is distinct from public.budget_stage_status(stage) then
      raise exception 'budgets: status must be % for stage %', public.budget_stage_status(stage), stage;
    end if;

    n_hist := coalesce(d->'history', '[]'::jsonb);
    if jsonb_array_length(n_hist) <> 1 or n_hist->0->>'byId' is distinct from uid
       or n_hist->0->>'action' is distinct from 'Submitted' then
      raise exception 'budgets: new budget history must be a single Submitted entry by the requester';
    end if;
    return new;
  end if;

  -- ------------------------------------------------------------- UPDATE
  o := old.data;
  if d = o then return new; end if;   -- bulk-save no-op rows

  if old.type = 'RDCap' then
    if p.role <> 'SuperManager' then
      raise exception 'budgets: only a SuperManager may modify R&D cap allocations';
    end if;
    return new;
  end if;
  if old.type = 'RDCapRequest' then
    -- SuperManagers manage these; a requester may refresh their own request.
    if p.role <> 'SuperManager'
       and (o->>'requesterId' is distinct from uid or d->>'requesterId' is distinct from uid) then
      raise exception 'budgets: not your R&D allocation request';
    end if;
    return new;
  end if;

  o_stage := o->>'currentStage';
  stage := d->>'currentStage';
  amt := coalesce((o->>'amountINR')::numeric, 0);

  -- History: exactly one appended entry, attributed to the caller.
  o_hist := coalesce(o->'history', '[]'::jsonb);
  n_hist := coalesce(d->'history', '[]'::jsonb);
  if jsonb_array_length(n_hist) <> jsonb_array_length(o_hist) + 1
     or coalesce((select jsonb_agg(h.e) from (
          select e from jsonb_array_elements(n_hist) with ordinality t(e, i)
          where i <= jsonb_array_length(o_hist) order by i) h), '[]'::jsonb) <> o_hist then
    raise exception 'budgets: history may only be appended to';
  end if;
  last_entry := n_hist->-1;
  if last_entry->>'byId' is distinct from uid then
    raise exception 'budgets: history entry must be attributed to the caller';
  end if;

  -- Everything except the workflow fields is immutable in a transition.
  if (o - 'currentStage' - 'status' - 'history'
        - (case when stage = 'Active' then 'approvedBy' else 'currentStage' end)
        - (case when stage = 'Active' then 'approvedDate' else 'currentStage' end))
     <> (d - 'currentStage' - 'status' - 'history'
        - (case when stage = 'Active' then 'approvedBy' else 'currentStage' end)
        - (case when stage = 'Active' then 'approvedDate' else 'currentStage' end)) then
    raise exception 'budgets: only stage, status and history may change in a transition';
  end if;

  -- Requester cancel: own, still-pending request only.
  if stage = 'Cancelled' then
    if o->>'requesterId' is distinct from uid then
      raise exception 'budgets: only the requester may cancel';
    end if;
    if o->>'status' in ('Paid','Rejected','Cancelled','Active','Approved','Closed') then
      raise exception 'budgets: % can no longer be cancelled', old.id;
    end if;
    if d->>'status' is distinct from 'Cancelled' then
      raise exception 'budgets: cancelled budgets must have status Cancelled';
    end if;
    return new;
  end if;

  -- Approve / reject: caller must be an authorized actor for the CURRENT stage.
  if not public.can_act_on_budget(p, o) then
    raise exception 'budgets: you are not an eligible approver for % at stage %', old.id, o_stage;
  end if;

  if stage = 'Rejected' then
    if d->>'status' is distinct from 'Rejected' then
      raise exception 'budgets: rejected budgets must have status Rejected';
    end if;
    return new;
  end if;

  -- Approval: the new stage must be exactly what the workflow dictates.
  if p.role = 'SuperManager' then
    exp_stage := 'Active';            -- special-access override (any stage)
    exp_status := 'Active';
  else
    sa := coalesce(array(select jsonb_array_elements_text(o->'selectedApprovers')), '{}');
    total := cardinality(sa);
    if o_stage = 'DeptApproval' and total > 1 then
      cnt := (select count(*) from jsonb_array_elements(o_hist) h
              where h->>'action' = 'Approved (Dept)') + 1;
      if last_entry->>'action' is distinct from 'Approved (Dept)' then
        raise exception 'budgets: dept-stage approvals must be recorded as Approved (Dept)';
      end if;
      if cnt < total then
        exp_stage := 'DeptApproval';
        exp_status := public.budget_stage_status('DeptApproval') || ' (' || cnt || '/' || total || ')';
      else
        exp_stage := public.budget_next_stage(amt, 'DeptApproval');
        exp_status := public.budget_stage_status(exp_stage);
      end if;
    else
      if coalesce(last_entry->>'action', '') not like 'Approved%' then
        raise exception 'budgets: approval history entry must record an approval';
      end if;
      exp_stage := public.budget_next_stage(amt, o_stage);
      exp_status := public.budget_stage_status(exp_stage);
    end if;
  end if;

  if stage is distinct from exp_stage or d->>'status' is distinct from exp_status then
    raise exception 'budgets: invalid transition % -> % (expected % / "%")', o_stage, stage, exp_stage, exp_status;
  end if;
  return new;
end $$;

drop trigger if exists budgets_guard_ins on public.budgets;
drop trigger if exists budgets_guard_upd on public.budgets;
drop trigger if exists budgets_guard_del on public.budgets;
create trigger budgets_guard_ins after insert on public.budgets
  for each row execute function public.budgets_guard();
create trigger budgets_guard_upd after update on public.budgets
  for each row execute function public.budgets_guard();
create trigger budgets_guard_del after delete on public.budgets
  for each row execute function public.budgets_guard();

-- ---------------------------------------------------------------- policies

-- May the caller read this budget row? Company-wide roles see all; everyone
-- else sees their own departments' rows, their own requests, and what their
-- scope sanctions (the ODM/Sales bridge).
create or replace function public.can_select_budget(b_dept text, b_requester text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_id = auth.uid()
      and ( p.role in ('CEO','VP','FinanceHead','Accountant','SuperManager','Admin')
         or b_requester = public.app_user_id(p)
         or b_dept = any(public.user_depts(p))
         or (p.scope = 'ODM-SALES' and b_dept in ('ODM','Sales'))
         or (p.scope in ('ODM-ALL','ODM-PROJECT') and b_dept = 'ODM') )
  );
$$;

drop policy if exists budgets_auth_all on public.budgets;
drop policy if exists budgets_select on public.budgets;
drop policy if exists budgets_insert on public.budgets;
drop policy if exists budgets_update on public.budgets;
drop policy if exists budgets_delete on public.budgets;

create policy budgets_select on public.budgets
  for select to authenticated
  using (public.can_select_budget(dept, data->>'requesterId'));

-- Fine-grained write rules are enforced by the budgets_guard trigger.
create policy budgets_insert on public.budgets
  for insert to authenticated with check (true);
create policy budgets_update on public.budgets
  for update to authenticated using (true) with check (true);

-- Deletes: only SuperManagers, only R&D-cap config rows. A policy (not an
-- error) so the app's bulk-save prune skips other rows silently.
create policy budgets_delete on public.budgets
  for delete to authenticated
  using (
    type in ('RDCap','RDCapRequest')
    and exists (select 1 from public.profiles p
                where p.auth_id = auth.uid() and p.role in ('SuperManager','Admin'))
  );
