-- ============================================================================
-- Server-side payment-workflow enforcement test for the accountant stages
-- (migration 0024 on top of 0023). Run by scripts/test-requests-rls.sh against
-- a throwaway Postgres with a Supabase auth stub. Each scenario runs as an
-- AUTHENTICATED session (real auth.uid()) issuing raw SQL — i.e. exactly what a
-- UI-bypassing caller can do. Verifies the two-step accountant flow
-- (Accountant -> Processing -> Paid), the SuperManager direct-pay override, the
-- Undo-Payment reversal, and that the generic earlier-stage path still works.
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

create schema if not exists test;

create or replace function test.expect_ok(label text, sql text)
returns void language plpgsql as $$
begin
  execute sql;
  raise notice 'PASS (allowed) %', label;
exception when others then
  raise exception 'LEGIT FLOW BROKEN — % :: %', label, sqlerrm;
end $$;

create or replace function test.expect_fail(label text, sql text)
returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'SECURITY HOLE — should have been blocked: %', label;
exception
  when raise_exception then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
    raise notice 'PASS (blocked) % :: %', label, sqlerrm;
  when others then
    raise notice 'PASS (blocked) % :: %', label, sqlerrm;
end $$;

-- Apply a transition the way ActionButtons does: append one history entry
-- attributed to the caller, then write the new stage/status + promoted columns.
create or replace function test.req_act(p_id text, p_by text, p_stage text, p_status text)
returns void language plpgsql as $$
declare d jsonb;
begin
  select data into d from public.requests where id = p_id;
  d := jsonb_set(d, '{history}',
        coalesce(d->'history','[]'::jsonb) ||
        jsonb_build_object('action','Act','by',p_by,'byId',p_by,'at',now()::text,'comments',''));
  d := jsonb_set(d, '{currentStage}', to_jsonb(p_stage));
  d := jsonb_set(d, '{status}',       to_jsonb(p_status));
  update public.requests set status = p_status, current_stage = p_stage, data = d where id = p_id;
end $$;

-- -------------------------------------------------------------- fixtures
-- Profiles (with backing auth.users). Caller is identified by legacy_id.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),   -- accountant
  ('00000000-0000-0000-0000-0000000000a2'),   -- supermanager
  ('00000000-0000-0000-0000-0000000000a3'),   -- VP
  ('00000000-0000-0000-0000-0000000000a4');   -- finance head

insert into public.profiles (auth_id, legacy_id, email, name, dept, role) values
  ('00000000-0000-0000-0000-0000000000a1','U-ACC','acc@x.io','Acc','Finance','Accountant'),
  ('00000000-0000-0000-0000-0000000000a2','U-SM','sm@x.io','SM',null,'SuperManager'),
  ('00000000-0000-0000-0000-0000000000a3','U-VP','vp@x.io','VP','Executive','VP'),
  ('00000000-0000-0000-0000-0000000000a4','U-FH','fh@x.io','FH','Finance','FinanceHead');

-- Seed payment rows directly (service role: test.uid unset -> guard bypassed).
-- requesterId 'U-EMP' differs from every actor (segregation of duties holds).
create or replace function test.mk_req(p_id text, p_amt numeric, p_stage text, p_status text)
returns void language plpgsql as $$
begin
  insert into public.requests (id, kind, type, requester_id, dept, status, current_stage, amount_inr, data)
  values (p_id, 'Payment', 'Payment', 'U-EMP', 'Product', p_status, p_stage, p_amt,
    jsonb_build_object(
      'id', p_id, 'kind','Payment','type','Payment','requesterId','U-EMP','requesterName','Emp',
      'dept','Product','amount',p_amt,'amountINR',p_amt,'currency','INR','fxRate',1,
      'currentStage',p_stage,'status',p_status,
      'history', jsonb_build_array(jsonb_build_object('action','Submitted','by','Emp','byId','U-EMP','at',now()::text,'comments',''))));
end $$;

select test.mk_req('R-ACC1', 50000, 'Accountant',  'Pending Accountant Processing'); -- acc -> Processing
select test.mk_req('R-PRO1', 50000, 'Processing',  'Processing Payment');            -- acc -> Paid
select test.mk_req('R-ACC2', 50000, 'Accountant',  'Pending Accountant Processing'); -- SM  -> Paid (direct)
select test.mk_req('R-ACC3', 50000, 'Accountant',  'Pending Accountant Processing'); -- acc -> Paid (blocked)
select test.mk_req('R-ACC4', 50000, 'Accountant',  'Pending Accountant Processing'); -- VP  -> Processing (blocked)
select test.mk_req('R-PAID1',50000, 'Paid',        'Paid');                          -- acc undo -> Processing
select test.mk_req('R-PAID2',50000, 'Paid',        'Paid');                          -- SM undo (blocked)
select test.mk_req('R-PRO2', 50000, 'Processing',  'Processing Payment');            -- acc -> Accountant (blocked)
select test.mk_req('R-FH1',  50000, 'FinanceHead', 'Pending Finance Head');          -- FH  -> Accountant (generic path)

-- -------------------------------------------------------------- scenarios
-- Accountant (caller U-ACC)
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
select test.expect_ok  ('acc: Accountant -> Processing',      $$select test.req_act('R-ACC1','U-ACC','Processing','Processing Payment')$$);
select test.expect_ok  ('acc: Processing -> Paid',            $$select test.req_act('R-PRO1','U-ACC','Paid','Paid')$$);
select test.expect_fail('acc: Accountant -> Paid (no direct)',$$select test.req_act('R-ACC3','U-ACC','Paid','Paid')$$);
select test.expect_ok  ('acc: Paid -> Processing (undo)',     $$select test.req_act('R-PAID1','U-ACC','Processing','Processing Payment')$$);
select test.expect_fail('acc: Processing -> Accountant (bad)',$$select test.req_act('R-PRO2','U-ACC','Accountant','Pending Accountant Processing')$$);

-- SuperManager (caller U-SM)
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
select test.expect_ok  ('sm: Accountant -> Paid (direct)',    $$select test.req_act('R-ACC2','U-SM','Paid','Paid')$$);
select test.expect_fail('sm: Paid -> Processing (not acc)',   $$select test.req_act('R-PAID2','U-SM','Processing','Processing Payment')$$);

-- VP cannot touch the accountant stage
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
select test.expect_fail('vp: Accountant -> Processing (deny)',$$select test.req_act('R-ACC4','U-VP','Processing','Processing Payment')$$);

-- Generic earlier-stage path still intact: FinanceHead -> Accountant for a <1L payment
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a4', false);
select test.expect_ok  ('fh: FinanceHead -> Accountant',      $$select test.req_act('R-FH1','U-FH','Accountant','Pending Accountant Processing')$$);

do $$ begin raise notice 'ALL REQUESTS RLS TESTS PASSED'; end $$;
