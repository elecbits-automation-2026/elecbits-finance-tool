-- 0028_return_transition.sql
-- Allow an eligible approver to RETURN a request to its requester for changes
-- (status 'Returned for Changes', stage 'Returned') — mirrors the existing Reject
-- allowance — in both budgets_guard (budgets) and requests_guard (payments).
-- PO/PI (pos table) need no change: pos has no update guard. Additive & low-risk.

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

    if new.type in ('Monthly','Extension') and p.role not in ('DeptApprover','BoxBuildMidApprover','FinanceHead') then
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
      elsif d->>'projectType' = 'OneTime' then
        -- One-time budget: a one-off spend with no client order value and no
        -- 80% cap. Same dept/role gates as a Client project; the unique
        -- projectId guard below still applies (the client auto-generates one).
        null;
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
      -- The request starts at the next authority. A Finance Head can't be
      -- approved at the Finance stage (they ARE it, and can't self-approve), so
      -- their own budget escalates straight to VP (then CEO by amount).
      if p.role = 'FinanceHead' then
        if stage is distinct from 'VP' then
          raise exception 'budgets: a Finance Head''s own budget must start at VP';
        end if;
      elsif stage is distinct from public.budget_next_stage(amt, 'DeptApproval') then
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

  -- Return to requester for changes (an eligible approver bounces it back, not terminal).
  if stage = 'Returned' then
    if d->>'status' is distinct from 'Returned for Changes' then
      raise exception 'budgets: returned budgets must have status "Returned for Changes"';
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

create or replace function public.requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles; uid text; o jsonb; d jsonb;
  o_hist jsonb; n_hist jsonb; last_entry jsonb;
  o_stage text; n_stage text; amt numeric; exp_stage text; exp_status text; is_sm boolean;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then raise exception 'requests: no profile for caller'; end if;
  if p.role = 'Admin' then return coalesce(new, old); end if;
  uid := public.app_user_id(p);

  if tg_op = 'DELETE' then
    o := old.data;
    if old.requester_id is distinct from uid then raise exception 'requests: you may only delete your own rows'; end if;
    if coalesce(o->>'status','') in ('Paid','Rejected','Cancelled','Approved','Closed') then raise exception 'requests: a finalised row may not be deleted'; end if;
    return old;
  end if;

  d := new.data;
  if new.status is distinct from d->>'status'
     or new.current_stage is distinct from d->>'currentStage'
     or new.requester_id is distinct from d->>'requesterId' then
    raise exception 'requests: promoted columns must match data';
  end if;

  if tg_op = 'INSERT' then
    if new.requester_id is distinct from uid or (d->>'requesterId') is distinct from uid then raise exception 'requests: requesterId must be the caller'; end if;
    if coalesce(d->>'status','') in ('Paid','Approved','Closed') or coalesce(d->>'currentStage','') in ('Paid','Approved','Closed','Active') then raise exception 'requests: a new row may not start in a finalised state'; end if;
    return new;
  end if;

  o := old.data;
  if d = o then return new; end if;

  -- Post-travel report: the requester may attach a `postTravel` object (plus one
  -- history entry) to their OWN travel request, even after it is finalised (Paid).
  -- This is the only user-write allowed on a finalised row. Nothing else may change:
  -- money, stage, status, approvers and every other field stay identical.
  if (o->'travel') is not null
     and (o->>'requesterId') = uid
     and (o->'postTravel') is null
     and (d->'postTravel') is not null
     and (d->>'status') is not distinct from (o->>'status')
     and (d->>'currentStage') is not distinct from (o->>'currentStage')
     and (d - 'postTravel' - 'history') = (o - 'postTravel' - 'history') then
    o_hist := coalesce(o->'history','[]'::jsonb); n_hist := coalesce(d->'history','[]'::jsonb);
    if jsonb_array_length(n_hist) <> jsonb_array_length(o_hist) + 1 then
      raise exception 'requests: a post-travel report may append exactly one history entry';
    end if;
    if (n_hist->-1->>'byId') is distinct from uid then
      raise exception 'requests: post-travel history entry must be attributed to the caller';
    end if;
    return new;
  end if;

  if (o->>'amountINR') is distinct from (d->>'amountINR')
     or (o->>'requesterId') is distinct from (d->>'requesterId')
     or (o->>'dept') is distinct from (d->>'dept')
     or (o->>'projectId') is distinct from (d->>'projectId')
     or coalesce(o->'splits','[]'::jsonb) is distinct from coalesce(d->'splits','[]'::jsonb) then
    raise exception 'requests: amount/requester/dept/project/splits cannot change in a transition';
  end if;

  o_hist := coalesce(o->'history','[]'::jsonb); n_hist := coalesce(d->'history','[]'::jsonb);
  if jsonb_array_length(n_hist) <> jsonb_array_length(o_hist) + 1
     or coalesce((select jsonb_agg(h.e) from (
          select e from jsonb_array_elements(n_hist) with ordinality t(e, i)
          where i <= jsonb_array_length(o_hist) order by i) h), '[]'::jsonb) <> o_hist then
    raise exception 'requests: history may only be appended to';
  end if;
  last_entry := n_hist->-1;
  if last_entry->>'byId' is distinct from uid then raise exception 'requests: history entry must be attributed to the caller'; end if;

  o_stage := o->>'currentStage'; n_stage := d->>'currentStage'; amt := coalesce((o->>'amountINR')::numeric, 0);
  is_sm := p.role = 'SuperManager';

  if n_stage = 'Cancelled' or d->>'status' = 'Cancelled' then
    if o->>'requesterId' is distinct from uid then raise exception 'requests: only the requester may cancel'; end if;
    if coalesce(o->>'status','') in ('Paid','Rejected','Cancelled','Approved','Closed') then raise exception 'requests: this request can no longer be cancelled'; end if;
    if d->>'status' is distinct from 'Cancelled' then raise exception 'requests: cancelled requests must have status Cancelled'; end if;
    return new;
  end if;

  -- Payment reversal ("Undo Payment"): Paid -> Processing, Accountant-only. Checked
  -- before the eligibility gate because can_act_on_request blocks every action on a
  -- Paid row by design. The 24h window stays a client-side UX guard.
  if o_stage = 'Paid' and n_stage = 'Processing' then
    if p.role <> 'Accountant' then raise exception 'requests: only an Accountant may reverse a payment'; end if;
    if d->>'status' is distinct from 'Processing Payment' then raise exception 'requests: a reversed payment must return to "Processing Payment"'; end if;
    return new;
  end if;

  if not public.can_act_on_request(p, o) then
    raise exception 'requests: you are not an eligible approver at stage %', o_stage;
  end if;

  if n_stage = 'Rejected' or d->>'status' = 'Rejected' then
    if d->>'status' is distinct from 'Rejected' then raise exception 'requests: rejected requests must have status Rejected'; end if;
    return new;
  end if;

  -- Return to requester for changes (an eligible approver bounces it back, not terminal).
  if n_stage = 'Returned' or d->>'status' = 'Returned for Changes' then
    if d->>'status' is distinct from 'Returned for Changes' then raise exception 'requests: returned requests must have status "Returned for Changes"'; end if;
    return new;
  end if;

  -- Accountant processing is a TWO-STEP flow that a single next-stage can't express:
  --   Accountant --Start Processing--> Processing --Mark as Paid--> Paid
  -- A SuperManager may also pay directly from either stage. Handle these explicitly;
  -- all earlier stages fall through to the exact next-stage equality below.
  if o_stage = 'Accountant' then
    if n_stage = 'Processing' then
      if d->>'status' is distinct from 'Processing Payment' then raise exception 'requests: moving to Processing must set status "Processing Payment"'; end if;
      return new;
    elsif n_stage = 'Paid' then
      if not is_sm then raise exception 'requests: only a SuperManager may pay directly from the Accountant stage'; end if;
      if d->>'status' is distinct from 'Paid' then raise exception 'requests: a paid request must have status "Paid"'; end if;
      return new;
    else
      raise exception 'requests: invalid transition Accountant -> % (expected Processing or Paid)', n_stage;
    end if;
  end if;

  if o_stage = 'Processing' then
    if n_stage = 'Paid' and d->>'status' = 'Paid' then return new; end if;
    raise exception 'requests: invalid transition Processing -> % (expected Paid / "Paid")', n_stage;
  end if;

  exp_stage := public.payment_next_stage(amt, o_stage, is_sm);
  exp_status := public.payment_stage_status(exp_stage);
  if n_stage is distinct from exp_stage or d->>'status' is distinct from exp_status then
    raise exception 'requests: invalid transition % -> % (expected % / "%")', o_stage, n_stage, exp_stage, exp_status;
  end if;
  return new;
end $$;
