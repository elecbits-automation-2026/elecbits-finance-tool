-- 0023_requests_workflow_guard.sql
-- Full server-side workflow guard for the `requests` (payments) table — the
-- budgets_guard equivalent for payments. Replaces the lightweight
-- workflow_row_guard on requests with a per-stage approval guard so the payment
-- workflow can't be bypassed via the API (e.g. advancing your own payment, or a
-- dept approver jumping straight to "Paid"). `pos` keeps workflow_row_guard for
-- now (its edit/cancel/close flows need separate handling).
--
-- Mirrors lib/workflow.ts (computeNextStage) + lib/access.ts (canUserActOnRequest).

-- Who may act on this payment at its CURRENT stage? (mirrors canUserActOnRequest)
create or replace function public.can_act_on_request(p public.profiles, r jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare uid text := public.app_user_id(p); stage text := r->>'currentStage'; sa text[];
begin
  if p.role = 'EmployeeReadOnly' then return false; end if;
  if r->>'status' in ('Paid','Rejected','Cancelled','Active','Approved','Closed') then return false; end if;
  if r->>'requesterId' = uid then return false; end if;            -- segregation of duties
  if p.role = 'SuperManager' then return true; end if;             -- override
  if stage = 'BoxBuildMid' then return p.role = 'BoxBuildMidApprover'; end if;
  if stage = 'DeptApproval' then
    sa := coalesce(array(select jsonb_array_elements_text(r->'selectedApprovers')), '{}');
    if not (uid = any(sa)) then return false; end if;
    if p.role in ('DeptApprover','BoxBuildMidApprover') and not ((r->>'dept') = any(public.user_depts(p))) then return false; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(r->'history','[]'::jsonb)) h
               where h->>'byId' = uid and h->>'action' like '%Approved%') then return false; end if;
    return true;
  end if;
  if stage = 'VP' then return p.role = 'VP'; end if;
  if stage = 'CEO' then return p.role = 'CEO'; end if;
  if stage = 'FinanceHead' then return p.role = 'FinanceHead'; end if;
  if stage in ('Accountant','Processing') then return p.role = 'Accountant'; end if;
  return false;
end $$;

-- Next stage for a payment (mirrors computeNextStage for kind=Payment).
create or replace function public.payment_next_stage(amount numeric, stage text, is_sm boolean)
returns text language sql immutable as $$
  select case
    when is_sm and stage in ('BoxBuildMid','DeptApproval','VP','CEO','FinanceHead') then 'Accountant'
    when stage = 'BoxBuildMid'  then 'DeptApproval'
    when stage = 'DeptApproval' then 'FinanceHead'
    when stage = 'FinanceHead'  then case when amount >= 500000 then 'CEO' when amount >= 100000 then 'VP' else 'Accountant' end
    when stage = 'VP'           then 'Accountant'
    when stage = 'CEO'          then 'Accountant'
    when stage = 'Accountant'   then 'Paid'
    else stage end;
$$;

-- Status label for a payment stage (mirrors getStageLabel default branch).
create or replace function public.payment_stage_status(stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid'  then 'Pending Delivery Head (Arun)'
    when 'DeptApproval' then 'Pending Dept Approval'
    when 'VP'           then 'Pending VP'
    when 'CEO'          then 'Pending CEO'
    when 'FinanceHead'  then 'Pending Finance Head'
    when 'Accountant'   then 'Pending Accountant Processing'
    when 'Processing'   then 'Processing Payment'
    when 'Paid'         then 'Paid'
    when 'Rejected'     then 'Rejected'
    when 'Cancelled'    then 'Cancelled'
    else stage end;
$$;

create or replace function public.requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles; uid text; o jsonb; d jsonb;
  o_hist jsonb; n_hist jsonb; last_entry jsonb;
  o_stage text; n_stage text; amt numeric; exp_stage text; exp_status text; is_sm boolean;
begin
  if auth.uid() is null then return coalesce(new, old); end if;     -- service role / seed
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then raise exception 'requests: no profile for caller'; end if;
  if p.role = 'Admin' then return coalesce(new, old); end if;
  uid := public.app_user_id(p);

  -- DELETE: only your own, non-finalised
  if tg_op = 'DELETE' then
    o := old.data;
    if old.requester_id is distinct from uid then raise exception 'requests: you may only delete your own rows'; end if;
    if coalesce(o->>'status','') in ('Paid','Rejected','Cancelled','Approved','Closed') then raise exception 'requests: a finalised row may not be deleted'; end if;
    return old;
  end if;

  d := new.data;
  -- promoted columns must agree with data
  if new.status is distinct from d->>'status'
     or new.current_stage is distinct from d->>'currentStage'
     or new.requester_id is distinct from d->>'requesterId' then
    raise exception 'requests: promoted columns must match data';
  end if;

  -- INSERT: requester must be the caller; may not start finalised
  if tg_op = 'INSERT' then
    if new.requester_id is distinct from uid or (d->>'requesterId') is distinct from uid then raise exception 'requests: requesterId must be the caller'; end if;
    if coalesce(d->>'status','') in ('Paid','Approved','Closed') or coalesce(d->>'currentStage','') in ('Paid','Approved','Closed','Active') then raise exception 'requests: a new row may not start in a finalised state'; end if;
    return new;
  end if;

  -- UPDATE (transition)
  o := old.data;
  if d = o then return new; end if;   -- bulk-save no-op

  -- core fields are immutable in a transition
  if (o->>'amountINR') is distinct from (d->>'amountINR')
     or (o->>'requesterId') is distinct from (d->>'requesterId')
     or (o->>'dept') is distinct from (d->>'dept')
     or (o->>'projectId') is distinct from (d->>'projectId')
     or coalesce(o->'splits','[]'::jsonb) is distinct from coalesce(d->'splits','[]'::jsonb) then
    raise exception 'requests: amount/requester/dept/project/splits cannot change in a transition';
  end if;

  -- history may only be appended to, last entry attributed to the caller
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

  -- Requester cancel: own, still-pending request only
  if n_stage = 'Cancelled' or d->>'status' = 'Cancelled' then
    if o->>'requesterId' is distinct from uid then raise exception 'requests: only the requester may cancel'; end if;
    if coalesce(o->>'status','') in ('Paid','Rejected','Cancelled','Approved','Closed') then raise exception 'requests: this request can no longer be cancelled'; end if;
    if d->>'status' is distinct from 'Cancelled' then raise exception 'requests: cancelled requests must have status Cancelled'; end if;
    return new;
  end if;

  -- Any other transition: caller must be an authorized actor for the CURRENT stage
  if not public.can_act_on_request(p, o) then
    raise exception 'requests: you are not an eligible approver at stage %', o_stage;
  end if;

  -- Reject
  if n_stage = 'Rejected' or d->>'status' = 'Rejected' then
    if d->>'status' is distinct from 'Rejected' then raise exception 'requests: rejected requests must have status Rejected'; end if;
    return new;
  end if;

  -- Approve: the new stage must be exactly the workflow's next stage
  is_sm := p.role = 'SuperManager';
  exp_stage := public.payment_next_stage(amt, o_stage, is_sm);
  exp_status := public.payment_stage_status(exp_stage);
  if n_stage is distinct from exp_stage or d->>'status' is distinct from exp_status then
    raise exception 'requests: invalid transition % -> % (expected % / "%")', o_stage, n_stage, exp_stage, exp_status;
  end if;
  return new;
end $$;

-- Swap requests onto the full guard (was workflow_row_guard ins/del only).
drop trigger if exists requests_guard_ins on public.requests;
drop trigger if exists requests_guard_del on public.requests;
drop trigger if exists requests_guard_upd on public.requests;
create trigger requests_guard_ins after insert on public.requests for each row execute function public.requests_guard();
create trigger requests_guard_upd after update on public.requests for each row execute function public.requests_guard();
create trigger requests_guard_del after delete on public.requests for each row execute function public.requests_guard();
