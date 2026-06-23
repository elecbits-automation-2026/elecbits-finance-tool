-- 0022_employee_code_unique_and_workflow_guard.sql
-- (1) Make Employee Code unique. (2) Add server-side guards for the requests
--     (payments) and pos (PO/PI) tables, which previously had no trigger.

-- ---- (1) Employee Code unique (nullable: existing accounts keep NULL) ----
create unique index if not exists profiles_employee_code_uniq
  on public.profiles (employee_code) where employee_code is not null;

-- ---- (2) Workflow-row guard for requests + pos ----
-- Mirrors the budgets pattern (permissive RLS + a trigger). This is NOT the full
-- approval workflow ported to SQL — it's a targeted integrity guard that:
--   • INSERT: the row's requesterId must be the caller, and it may not be born in
--     a finalised state (Paid/Approved/Closed/Active) — blocks "insert a paid
--     payment" and impersonating another requester via the API.
--   • DELETE: only the requester may delete, and only a non-finalised row —
--     blocks deleting other departments' / finalised POs & payments.
--   • UPDATE: intentionally not constrained here; per-stage approval authorization
--     remains client-enforced (a larger SQL port, tracked separately).
-- AFTER INSERT/UPDATE upserts route correctly: a conflict-update fires AFTER
-- UPDATE (not INSERT), so legitimate status transitions via upsert are unaffected.
create or replace function public.workflow_row_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare p public.profiles; uid text; d jsonb;
begin
  if auth.uid() is null then return coalesce(new, old); end if;   -- service role / seed
  select * into p from public.profiles where auth_id = auth.uid();
  if p is null then raise exception 'workflow: no profile for caller'; end if;
  if p.role = 'Admin' then return coalesce(new, old); end if;
  uid := public.app_user_id(p);

  if tg_op = 'DELETE' then
    d := old.data;
    if old.requester_id is distinct from uid then
      raise exception 'workflow: you may only delete your own rows';
    end if;
    if coalesce(d->>'status','') in ('Paid','Approved','Closed') then
      raise exception 'workflow: a finalised row may not be deleted';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    d := new.data;
    if new.requester_id is distinct from uid or (d->>'requesterId') is distinct from uid then
      raise exception 'workflow: requesterId must be the caller';
    end if;
    if coalesce(d->>'status','') in ('Paid','Approved','Closed')
       or coalesce(d->>'currentStage','') in ('Paid','Approved','Closed','Active') then
      raise exception 'workflow: a new row may not start in a finalised state';
    end if;
    return new;
  end if;

  return new;  -- UPDATE: not guarded here
end $$;

drop trigger if exists requests_guard_ins on public.requests;
drop trigger if exists requests_guard_del on public.requests;
create trigger requests_guard_ins after insert on public.requests for each row execute function public.workflow_row_guard();
create trigger requests_guard_del after delete on public.requests for each row execute function public.workflow_row_guard();

drop trigger if exists pos_guard_ins on public.pos;
drop trigger if exists pos_guard_del on public.pos;
create trigger pos_guard_ins after insert on public.pos for each row execute function public.workflow_row_guard();
create trigger pos_guard_del after delete on public.pos for each row execute function public.workflow_row_guard();
