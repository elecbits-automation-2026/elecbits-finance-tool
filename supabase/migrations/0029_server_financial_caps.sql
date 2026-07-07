-- 0029_server_financial_caps.sql
-- Point #1: server-side HARD financial caps at creation time.
--
-- Moves the client-only hard money caps into BEFORE INSERT guards so a crafted
-- API call cannot overspend a PO or a project budget:
--   * a project payment may not exceed its project budget available, nor its
--     linked PO's remaining headroom (single + split);
--   * split amounts must sum to the payment total, and each split's PO must
--     belong to that split's project and not be cancelled;
--   * a new project PO's committed total (approved + in-flight) may not exceed
--     the project budget, nor 80% of a client order value (20% margin).
--
-- Soft / justified caps (accommodation per-night, travel urgency, monthly-pool
-- overshoot) stay client-side and are intentionally NOT enforced here, so the
-- server can never be stricter than the client and break a legitimate,
-- justification-backed submission.
--
-- Design: these are NEW, isolated BEFORE INSERT triggers that run alongside the
-- existing AFTER guards (which are left untouched). Because they fire BEFORE the
-- row lands, the availability helpers below observe exactly the pre-insert state
-- — matching the client's getPOAvailable / getProjectSpend math 1:1. Advisory
-- transaction locks on the parent budget / PO serialize concurrent inserts so
-- two requests that each fit individually cannot both slip past the cap.

-- ---------------- helpers (mirror src/lib/finance.ts, split-aware) ----------------

-- Money committed against a PO: full amount of single-PO payments + matching
-- split shares of split payments; excludes Rejected/Cancelled. (getPOUsage.total)
create or replace function public.po_committed(po_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    case
      when jsonb_typeof(r.data->'splits') = 'array' and jsonb_array_length(r.data->'splits') > 0
        then (select coalesce(sum((s->>'amountINR')::numeric), 0)
              from jsonb_array_elements(r.data->'splits') s
              where s->>'linkedPOId' = po_id)
      when r.data->>'linkedPOId' = po_id
        then coalesce((r.data->>'amountINR')::numeric, 0)
      else 0
    end), 0)
  from public.requests r
  where coalesce(r.data->>'status','') not in ('Rejected','Cancelled');
$$;

-- Remaining headroom on a PO (getPOAvailable). Cancelled PO => 0.
create or replace function public.po_available(po_id text)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare po jsonb; amt numeric;
begin
  select data into po from public.pos where id = po_id;
  if po is null then return 0; end if;
  if coalesce(po->>'status','') = 'Cancelled' or coalesce(po->>'currentStage','') = 'Cancelled' then return 0; end if;
  amt := coalesce((po->>'amountINR')::numeric, 0);
  return greatest(0, amt - public.po_committed(po_id));
end $$;

-- Active project budget amount, 0 if none (getActiveBudgetForProject).
create or replace function public.active_project_budget_amount(project_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((data->>'amountINR')::numeric, 0)
  from public.budgets
  where data->>'type' = 'Project' and data->>'projectId' = project_id
    and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active')
  limit 1;
$$;

create or replace function public.has_active_project_budget(project_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.budgets
    where data->>'type' = 'Project' and data->>'projectId' = project_id
      and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active'));
$$;

-- Project spend across all non-Rejected/Cancelled payments, split-aware
-- (getProjectSpend(...).total).
create or replace function public.project_spend(project_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(
    case
      when jsonb_typeof(r.data->'splits') = 'array' and jsonb_array_length(r.data->'splits') > 0
        then (select coalesce(sum((s->>'amountINR')::numeric), 0)
              from jsonb_array_elements(r.data->'splits') s
              where s->>'projectId' = project_id)
      when r.data->>'projectId' = project_id
        then coalesce((r.data->>'amountINR')::numeric, 0)
      else 0
    end), 0)
  from public.requests r
  where coalesce(r.data->>'status','') not in ('Rejected','Cancelled');
$$;

-- Committed PO value for a project (approved + in-flight POCreate), excl.
-- Rejected/Cancelled — the #3 ceiling base.
create or replace function public.project_po_committed(project_id text)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum((data->>'amountINR')::numeric), 0)
  from public.pos
  where data->>'type' = 'POCreate' and data->>'projectId' = project_id
    and coalesce(data->>'status','') not in ('Rejected','Cancelled');
$$;

-- ---------------- payment cap guard (BEFORE INSERT on requests) ----------------
create or replace function public.payment_caps_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  d jsonb := new.data;
  amt numeric := coalesce((d->>'amountINR')::numeric, 0);
  tol numeric := 0.5;                 -- half-rupee tolerance for FX float noise
  s jsonb; s_amt numeric; s_proj text; s_po text;
  split_sum numeric;
  proj text; po_id text; po jsonb; avail numeric;
begin
  -- Privileged / non-user paths (service role, seed, admin) are exempt.
  if auth.uid() is null then return new; end if;
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then return new; end if;      -- the AFTER guard will reject; nothing to cap
  if p.role = 'Admin' then return new; end if;

  if coalesce(d->>'kind','') <> 'Payment' then return new; end if;

  -- ---- split payment: one supplier across >= 2 projects ----
  if jsonb_typeof(d->'splits') = 'array' and jsonb_array_length(d->'splits') > 0 then
    select coalesce(sum((e->>'amountINR')::numeric), 0) into split_sum
      from jsonb_array_elements(d->'splits') e;
    if abs(split_sum - amt) > tol then
      raise exception 'payments: split amounts (₹%) must sum to the total (₹%)', split_sum, amt;
    end if;
    for s in select e from jsonb_array_elements(d->'splits') e loop
      s_amt := coalesce((s->>'amountINR')::numeric, 0);
      s_proj := s->>'projectId';
      s_po := s->>'linkedPOId';
      if s_proj is null or s_proj = '' then raise exception 'payments: each split needs a projectId'; end if;
      perform pg_advisory_xact_lock(1, hashtext(s_proj));                 -- budget lock
      if s_po is not null and s_po <> '' then perform pg_advisory_xact_lock(2, hashtext(s_po)); end if;
      if not public.has_active_project_budget(s_proj) then
        raise exception 'payments: no active budget for project %', s_proj;
      end if;
      avail := public.active_project_budget_amount(s_proj) - public.project_spend(s_proj);
      if s_amt > avail + tol then
        raise exception 'payments: % exceeds available project budget (₹%)', s_proj, greatest(0, avail);
      end if;
      if s_po is null or s_po = '' then raise exception 'payments: each split needs an approved PO'; end if;
      select data into po from public.pos where id = s_po;
      if po is null then raise exception 'payments: split PO % not found', s_po; end if;
      if coalesce(po->>'status','') = 'Cancelled' then raise exception 'payments: split PO % is cancelled', s_po; end if;
      if po->>'projectId' is distinct from s_proj then raise exception 'payments: split PO % belongs to a different project', s_po; end if;
      if s_amt > public.po_available(s_po) + tol then
        raise exception 'payments: % exceeds PO % available (₹%)', s_proj, s_po, public.po_available(s_po);
      end if;
    end loop;
    return new;
  end if;

  -- ---- single project payment ----
  if coalesce(d->>'isProject','') = 'true' and coalesce(d->>'projectId','') <> '' then
    proj := d->>'projectId';
    po_id := d->>'linkedPOId';
    perform pg_advisory_xact_lock(1, hashtext(proj));
    if po_id is not null and po_id <> '' then perform pg_advisory_xact_lock(2, hashtext(po_id)); end if;
    if not public.has_active_project_budget(proj) then
      raise exception 'payments: no active budget for project %', proj;
    end if;
    avail := public.active_project_budget_amount(proj) - public.project_spend(proj);
    if amt > avail + tol then
      raise exception 'payments: exceeds available project budget (₹%)', greatest(0, avail);
    end if;
    if po_id is not null and po_id <> '' then
      select data into po from public.pos where id = po_id;
      if po is null then raise exception 'payments: linked PO % not found', po_id; end if;
      if coalesce(po->>'status','') = 'Cancelled' then raise exception 'payments: linked PO % is cancelled', po_id; end if;
      if amt > public.po_available(po_id) + tol then
        raise exception 'payments: exceeds PO % available (₹%)', po_id, public.po_available(po_id);
      end if;
    end if;
    return new;
  end if;

  -- Non-project / monthly / travel payments: soft (justified) caps — not enforced here.
  return new;
end $$;

-- ---------------- PO cap guard (BEFORE INSERT on pos) ----------------
create or replace function public.po_caps_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  d jsonb := new.data;
  amt numeric := coalesce((d->>'amountINR')::numeric, 0);
  tol numeric := 0.5;
  proj text; b jsonb; budget_amt numeric; cov numeric; ceiling numeric;
  committed numeric; total_after numeric;
  dept_ text; cat text; mon text := to_char(now(),'YYYY-MM');
begin
  if auth.uid() is null then return new; end if;
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then return new; end if;
  if p.role = 'Admin' then return new; end if;

  -- Only brand-new POs commit budget. PIs (PICreate) and edit/cancel rows are out of scope.
  if coalesce(d->>'type','') <> 'POCreate' then return new; end if;

  if coalesce(d->>'isProject','') = 'true' then
    proj := d->>'projectId';
    if proj is null or proj = '' then raise exception 'po: a project PO needs a projectId'; end if;
    perform pg_advisory_xact_lock(1, hashtext(proj));
    select data into b from public.budgets
      where data->>'type' = 'Project' and data->>'projectId' = proj
        and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active')
      limit 1;
    if b is null then raise exception 'po: selected project % has no active budget', proj; end if;
    budget_amt := coalesce((b->>'amountINR')::numeric, 0);
    committed := public.project_po_committed(proj);
    total_after := committed + amt;
    if total_after > budget_amt + tol then
      raise exception 'po: PO commitments (₹%) would exceed the project budget (₹%). Raise a Budget Extension first.',
        total_after, budget_amt;
    end if;
    if coalesce(b->>'projectType','') = 'Client' and coalesce((b->>'clientOrderValue')::numeric, 0) > 0 then
      cov := (b->>'clientOrderValue')::numeric;
      ceiling := cov * 0.80;
      if total_after > ceiling + tol then
        raise exception 'po: breaches 20%% margin — max PO commitments ₹% (80%% of client order ₹%)', ceiling, cov;
      end if;
    end if;
    return new;
  else
    -- Monthly / non-project PO: an active monthly budget must EXIST for
    -- dept + category + current month. Overspend itself is soft (client allows
    -- it with a nudge) and is NOT blocked here.
    dept_ := d->>'dept';
    cat := d->>'category';
    perform pg_advisory_xact_lock(1, hashtext(coalesce(dept_,'') || ':' || coalesce(cat,'')));
    if not exists (
      select 1 from public.budgets
      where data->>'type' = 'Monthly' and data->>'dept' = dept_ and data->>'category' = cat
        and data->>'month' = mon
        and (data->>'status' in ('Active','Active Budget') or data->>'currentStage' = 'Active')
    ) then
      raise exception 'po: no active Monthly Budget for % → % (%). Ask your Dept Head to raise one first.', dept_, cat, mon;
    end if;
    return new;
  end if;
end $$;

drop trigger if exists payment_caps_guard_ins on public.requests;
create trigger payment_caps_guard_ins before insert on public.requests
  for each row execute function public.payment_caps_guard();

drop trigger if exists po_caps_guard_ins on public.pos;
create trigger po_caps_guard_ins before insert on public.pos
  for each row execute function public.po_caps_guard();
