-- 0024_requests_processing_stage.sql
-- Fix: the requests_guard from 0023 mirrors computeNextStage, which collapses the
-- accountant step to a single Accountant -> Paid transition. But the client UI runs a
-- TWO-STEP accountant flow:
--   Accountant --"Start Processing"--> Processing --"Mark as Paid"--> Paid
-- so the very first step (Accountant -> Processing) was rejected with
--   "requests: invalid transition Accountant -> Processing (expected Paid / "Paid")".
--
-- This re-creates requests_guard to handle the accountant stages explicitly:
--   * Accountant  -> Processing  (any accountant; the normal "Start Processing")
--   * Accountant  -> Paid        (SuperManager only — the "Mark Paid Directly" override)
--   * Processing  -> Paid        (any accountant / SuperManager)
--   * Paid        -> Processing  (Accountant only — the "Undo Payment" reversal, which
--                                 0023 also blocked because a Paid row is non-actionable)
-- All earlier stages keep the exact next-stage equality check via payment_next_stage.
-- Only requests_guard changes; can_act_on_request / payment_next_stage / triggers are
-- unchanged (payment_next_stage's now-unused Accountant/Processing branches are harmless).

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
  is_sm := p.role = 'SuperManager';

  -- Requester cancel: own, still-pending request only
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

  -- Any other transition: caller must be an authorized actor for the CURRENT stage
  if not public.can_act_on_request(p, o) then
    raise exception 'requests: you are not an eligible approver at stage %', o_stage;
  end if;

  -- Reject
  if n_stage = 'Rejected' or d->>'status' = 'Rejected' then
    if d->>'status' is distinct from 'Rejected' then raise exception 'requests: rejected requests must have status Rejected'; end if;
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

  -- Approve: the new stage must be exactly the workflow's next stage
  exp_stage := public.payment_next_stage(amt, o_stage, is_sm);
  exp_status := public.payment_stage_status(exp_stage);
  if n_stage is distinct from exp_stage or d->>'status' is distinct from exp_status then
    raise exception 'requests: invalid transition % -> % (expected % / "%")', o_stage, n_stage, exp_stage, exp_status;
  end if;
  return new;
end $$;
