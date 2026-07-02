-- 0025_requests_posttravel.sql
-- Adds a narrowly-scoped allowance to requests_guard so a requester can file a
-- "post-travel report" on their OWN travel request AFTER it is fully approved/paid.
--
-- Background: travel requests (raised via the dedicated Raise Travel flow) are normal
-- kind:"Payment" rows carrying a `travel` sub-object. The business wants the traveller
-- to justify the trip afterwards (the old external Google Form). But requests_guard
-- (0023/0024) freezes every non-workflow field during an UPDATE and blocks any user
-- write on a finalised (Paid) row, so writing a `postTravel` object was rejected.
--
-- This re-creates requests_guard with ONE extra branch (right after the bulk-save
-- no-op, before the immutable-fields check): the requester may add a `postTravel`
-- object + exactly one history entry to their own row where `travel` is present, as
-- long as NOTHING else changes (money, stage, status, approvers, every other field
-- stay identical, and postTravel was previously absent). It's the only user write
-- permitted on a finalised row. All other transitions are unchanged from 0024.

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
  is_sm := p.role = 'SuperManager';

  -- Requester cancel: own, still-pending request only
  if n_stage = 'Cancelled' or d->>'status' = 'Cancelled' then
    if o->>'requesterId' is distinct from uid then raise exception 'requests: only the requester may cancel'; end if;
    if coalesce(o->>'status','') in ('Paid','Rejected','Cancelled','Approved','Closed') then raise exception 'requests: this request can no longer be cancelled'; end if;
    if d->>'status' is distinct from 'Cancelled' then raise exception 'requests: cancelled requests must have status Cancelled'; end if;
    return new;
  end if;

  -- Payment reversal ("Undo Payment"): Paid -> Processing, Accountant-only.
  if o_stage = 'Paid' and n_stage = 'Processing' then
    if p.role <> 'Accountant' then raise exception 'requests: only an Accountant may reverse a payment'; end if;
    if d->>'status' is distinct from 'Processing Payment' then raise exception 'requests: a reversed payment must return to "Processing Payment"'; end if;
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

  -- Accountant two-step processing
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

  -- Approve: the new stage must be exactly the workflow's next stage
  exp_stage := public.payment_next_stage(amt, o_stage, is_sm);
  exp_status := public.payment_stage_status(exp_stage);
  if n_stage is distinct from exp_stage or d->>'status' is distinct from exp_status then
    raise exception 'requests: invalid transition % -> % (expected % / "%")', o_stage, n_stage, exp_stage, exp_status;
  end if;
  return new;
end $$;
