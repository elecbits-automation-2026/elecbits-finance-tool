-- ============================================================================
-- Server-side budget-workflow enforcement test (migration 0011).
-- Run by scripts/test-budget-rls.sh against a throwaway Postgres with a
-- Supabase auth stub. Every scenario runs as an AUTHENTICATED session with a
-- real auth.uid(), issuing raw SQL — i.e. exactly what an attacker bypassing
-- the UI can do. expect_fail/expect_ok raise (aborting the script, exit != 0)
-- on any unexpected outcome.
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ---------------------------------------------------------------- helpers
create schema if not exists test;
grant usage on schema test to authenticated;

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

create or replace function test.expect_ok(label text, sql text)
returns void language plpgsql as $$
begin
  execute sql;
  raise notice 'PASS (allowed) %', label;
exception when others then
  raise exception 'LEGIT FLOW BROKEN — % :: %', label, sqlerrm;
end $$;

-- For write attacks that the SELECT policy neutralises by hiding the target
-- row: the UPDATE/DELETE raises no error but must match ZERO rows (nothing
-- mutated). A non-zero row count means the attack actually changed data.
create or replace function test.expect_no_rows(label text, sql text)
returns void language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'SECURITY HOLE — % changed % row(s)', label, n; end if;
  raise notice 'PASS (no-op) %', label;
exception
  when raise_exception then
    if sqlerrm like 'SECURITY HOLE%' then raise; end if;
    raise notice 'PASS (blocked) % :: %', label, sqlerrm;
  when others then
    raise notice 'PASS (blocked) % :: %', label, sqlerrm;
end $$;

-- Build a plausible budget object the way the form does.
create or replace function test.mk_budget(
  p_id text, p_type text, p_dept text, p_requester text, p_amt numeric,
  p_stage text, p_approvers text[], p_extra jsonb default '{}'::jsonb
) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'kind', 'Budget', 'type', p_type, 'dept', p_dept,
    'requesterId', p_requester, 'requesterName', p_requester,
    'amount', p_amt, 'amountINR', p_amt, 'currency', 'INR', 'fxRate', 1,
    'isProject', p_type <> 'Monthly',
    'createdDate', now()::text,
    'selectedApprovers', to_jsonb(p_approvers),
    'currentStage', p_stage, 'status', public.budget_stage_status(p_stage),
    'history', jsonb_build_array(jsonb_build_object(
      'action', 'Submitted', 'by', p_requester, 'byId', p_requester, 'at', now()::text, 'comments', ''))
  ) || p_extra;
$$;

create or replace function test.ins_sql(b jsonb) returns text language sql as $$
  select format(
    'insert into public.budgets (id, type, dept, status, current_stage, amount_inr, data) values (%L, %L, %L, %L, %L, %s, %L::jsonb)',
    b->>'id', b->>'type', b->>'dept', b->>'status', b->>'currentStage',
    coalesce(b->>'amountINR', '0'), b::text);
$$;

-- A transition update the way ActionButtons builds it.
create or replace function test.act_sql(
  p_id text, p_by text, p_stage text, p_status text, p_action text,
  p_tamper jsonb default '{}'::jsonb
) returns text language plpgsql as $$
declare d jsonb;
begin
  select data into d from public.budgets where id = p_id;
  d := d || p_tamper
         || jsonb_build_object('currentStage', p_stage, 'status', p_status,
              'history', (d->'history') || jsonb_build_array(jsonb_build_object(
                'action', p_action, 'by', p_by, 'byId', p_by, 'at', now()::text, 'comments', '')));
  if p_stage = 'Active' then
    d := d || jsonb_build_object('approvedBy', p_by, 'approvedDate', now()::text);
  end if;
  return format(
    'update public.budgets set status=%L, current_stage=%L, data=%L::jsonb where id=%L',
    d->>'status', d->>'currentStage', d::text, p_id);
end $$;

-- Become an app user (transaction-local).
create or replace function test.as_user(legacy text) returns void language plpgsql as $$
declare a uuid;
begin
  select auth_id into a from public.profiles where legacy_id = legacy;
  if a is null then raise exception 'no such test user %', legacy; end if;
  perform set_config('test.uid', a::text, true);
  execute 'set local role authenticated';
end $$;

-- ---------------------------------------------------------------- roster
-- Mirrors the audit roster (docs/AUDIT-budget-workflow-test.md).
insert into auth.users (id)
select ('00000000-0000-0000-0000-0000000000' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 19) n;

insert into public.profiles (auth_id, legacy_id, email, name, dept, designation, role, scope, extra_depts) values
  ('00000000-0000-0000-0000-000000000001', 'U-CEO',        'ceo@t',  'Cara Ceo',        'Executive',  'CEO',                'CEO',              null, '{}'),
  ('00000000-0000-0000-0000-000000000002', 'U-VP',         'vp@t',   'Vikram Vp',       'Executive',  'VP',                 'VP',               null, '{}'),
  ('00000000-0000-0000-0000-000000000003', 'U-SM1',        'sm1@t',  'Stuti Sm',        'Management', 'Manager',            'SuperManager',     null, '{}'),
  ('00000000-0000-0000-0000-000000000004', 'U-SM2',        'sm2@t',  'Sarthak Sm',      'Management', 'Manager',            'SuperManager',     null, '{}'),
  ('00000000-0000-0000-0000-000000000005', 'U-FH',         'fh@t',   'Fiona FinHead',   'Finance',    'Finance Head',       'FinanceHead',      null, '{}'),
  ('00000000-0000-0000-0000-000000000006', 'U-ACC',        'acc@t',  'Arya Accountant', 'Finance',    'Accountant',         'Accountant',       null, '{}'),
  ('00000000-0000-0000-0000-000000000007', 'U-HR-HEAD',    'hrh@t',  'Hema HrHead',     'HR',         'HR Head',            'DeptApprover',     'HR', '{}'),
  ('00000000-0000-0000-0000-000000000008', 'U-HR-E',       'hre@t',  'Hari HrEmp',      'HR',         'HR Executive',       'Employee',         null, '{}'),
  ('00000000-0000-0000-0000-000000000009', 'U-ODM-ALL',    'oa@t',   'Omar OdmHead',    'ODM',        'ODM Head',           'DeptApprover',     'ODM-ALL', '{}'),
  ('00000000-0000-0000-0000-000000000010', 'U-ODM-PROJ',   'op@t',   'Pia OdmProjHead', 'ODM',        'ODM Project Head',   'DeptApprover',     'ODM-PROJECT', '{}'),
  ('00000000-0000-0000-0000-000000000011', 'U-ODM-E',      'oe@t',   'Eron OdmEmp',     'ODM',        'ODM Engineer',       'Employee',         null, '{}'),
  ('00000000-0000-0000-0000-000000000012', 'U-SALES-HEAD', 'sh@t',   'Sana SalesHead',  'Sales',      'Sales Head',         'DeptApprover',     'ODM-SALES', '{}'),
  ('00000000-0000-0000-0000-000000000013', 'U-SALES-E',    'se@t',   'Sam SalesEmp',    'Sales',      'Sales Executive',    'Employee',         null, '{}'),
  ('00000000-0000-0000-0000-000000000014', 'U-PROD-HEAD',  'ph@t',   'Prachi ProdHead', 'Product',    'Product Head',       'DeptApprover',     null, '{}'),
  ('00000000-0000-0000-0000-000000000015', 'U-PROD-E',     'pe@t',   'Pranav ProdEmp',  'Product',    'Product Analyst',    'Employee',         null, '{}'),
  ('00000000-0000-0000-0000-000000000016', 'U-MULTI',      'mu@t',   'Mira MultiHead',  'Marketing',  'Marketing Head',     'DeptApprover',     null, '{Product}'),
  ('00000000-0000-0000-0000-000000000017', 'U-RO',         'ro@t',   'Rhea ReadOnly',   'HR',         'Analyst',            'EmployeeReadOnly', null, '{}'),
  ('00000000-0000-0000-0000-000000000018', 'U-OTH-E',      'ot@t',   'Omi OtherEmp',    'Other',      'Generalist',         'Employee',         null, '{}'),
  ('00000000-0000-0000-0000-000000000019', 'U-EXEC-E',     'ee@t',   'Esha ExecAsst',   'Executive',  'Executive Asst',     'Employee',         null, '{}');

-- ---------------------------------------------------------------- fixtures
-- Seeded as superuser (auth.uid() is null -> service path, like seed.ts).
insert into public.budgets (id, type, dept, status, current_stage, amount_inr, data) values
  ('BUD-FIX-ODM', 'Project', 'ODM', 'Active', 'Active', 1000000,
   '{"id":"BUD-FIX-ODM","kind":"Budget","type":"Project","projectType":"Client","projectId":"PRJ-ODM-1","projectName":"Fixture","dept":"ODM","requesterId":"U-SM1","clientOrderValue":2000000,"amountINR":1000000,"isProject":true,"currentStage":"Active","status":"Active","history":[]}'),
  ('RDCAP-ODM', 'RDCap', 'ODM', 'Active', 'Active', 200000,
   ('{"id":"RDCAP-ODM","kind":"RDCap","type":"RDCap","dept":"ODM","month":"' || to_char(now(), 'YYYY-MM') || '","amountINR":200000,"status":"Active","currentStage":"Active","history":[]}')::jsonb);

-- ============================================================================
-- A. ATTACKS — every one of these is a raw-SQL replay of an audit finding and
--    must be BLOCKED by the trigger / policies.
-- ============================================================================
begin;
select test.as_user('U-HR-E');
select test.expect_fail('A1: HR employee raises Monthly budget (GATE_BYPASS_MONTHLY)',
  test.ins_sql(test.mk_budget('BUD-A1', 'Monthly', 'HR', 'U-HR-E', 50000, 'DeptApproval', array['U-HR-HEAD'])));
select test.expect_fail('A2: forged requesterId (raise as someone else)',
  test.ins_sql(test.mk_budget('BUD-A2', 'Monthly', 'HR', 'U-HR-HEAD', 50000, 'DeptApproval', array['U-HR-HEAD'])));
select test.expect_fail('A5: budget born Active (skip the whole chain)',
  test.ins_sql(test.mk_budget('BUD-A5', 'Monthly', 'HR', 'U-HR-E', 50000, 'Active', array[]::text[])));
rollback;

begin;
select test.as_user('U-HR-HEAD');
select test.expect_fail('A3: HR head puts THEMSELVES in selectedApprovers (SELF_APPROVAL)',
  test.ins_sql(test.mk_budget('BUD-A3', 'Monthly', 'HR', 'U-HR-HEAD', 50000, 'DeptApproval', array['U-HR-HEAD'])));
select test.expect_fail('A4: HR head raises Extension on an ODM project (CROSS_DEPT_EXTENSION)',
  test.ins_sql(test.mk_budget('BUD-A4', 'Extension', 'HR', 'U-HR-HEAD', 50000, 'FinanceHead', array[]::text[],
    '{"extensionFor":"PRJ-ODM-1"}')));
rollback;

begin;
select test.as_user('U-SALES-E');
select test.expect_fail('A6: Sales budget routed to ODM heads (CROSS_DEPT_ACT routing)',
  test.ins_sql(test.mk_budget('BUD-A6', 'Project', 'Sales', 'U-SALES-E', 50000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"Client","projectId":"PRJ-S1","clientOrderValue":200000}')));
select test.expect_fail('A7: hand-picked single approver (drops a required co-approver)',
  test.ins_sql(test.mk_budget('BUD-A7', 'Project', 'Sales', 'U-SALES-E', 50000, 'DeptApproval',
    array[]::text[], '{"projectType":"Client","projectId":"PRJ-S2","clientOrderValue":200000}')));
rollback;

begin;
select test.as_user('U-OTH-E');
select test.expect_fail('A8: Other-dept employee raises with escalated stage (NO_APPROVER_AT_RAISE)',
  test.ins_sql(test.mk_budget('BUD-A8', 'Project', 'Other', 'U-OTH-E', 50000, 'FinanceHead',
    array[]::text[], '{"projectType":"Client","projectId":"PRJ-O1","clientOrderValue":200000}')));
rollback;

begin;
select test.as_user('U-ODM-E');
select test.expect_fail('A9: Client project over the 80% order cap',
  test.ins_sql(test.mk_budget('BUD-A9', 'Project', 'ODM', 'U-ODM-E', 850000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"Client","projectId":"PRJ-X1","clientOrderValue":1000000}')));
select test.expect_fail('A10: R&D budget over the monthly allocation',
  test.ins_sql(test.mk_budget('BUD-A10', 'Project', 'ODM', 'U-ODM-E', 250000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"RD","projectId":"PRJ-RD1"}')));
select test.expect_fail('A11: non-SuperManager inserts an R&D cap allocation',
  'insert into public.budgets (id, type, dept, status, current_stage, amount_inr, data) values
   (''RDCAP-HACK'', ''RDCap'', ''ODM'', ''Active'', ''Active'', 9000000,
    ''{"id":"RDCAP-HACK","type":"RDCap","dept":"ODM","month":"2099-01","amountINR":9000000,"status":"Active","currentStage":"Active"}'')');
rollback;

begin;
select test.as_user('U-RO');
select test.expect_fail('A12: read-only account raises a budget',
  test.ins_sql(test.mk_budget('BUD-A12', 'Project', 'HR', 'U-RO', 50000, 'DeptApproval', array['U-HR-HEAD'])));
rollback;

-- In-flight request for the approval attacks (raised legitimately).
begin;
select test.as_user('U-ODM-E');
select test.expect_ok('setup: ODM employee raises 2.5L client project',
  test.ins_sql(test.mk_budget('BUD-LIVE', 'Project', 'ODM', 'U-ODM-E', 250000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"Client","projectId":"PRJ-LIVE","clientOrderValue":1000000}')));

select test.as_user('U-PROD-E');
select test.expect_no_rows('A13: random employee approves another dept''s budget (row hidden by SELECT policy)',
  test.act_sql('BUD-LIVE', 'U-PROD-E', 'DeptApproval', 'Pending Dept Head (1/2)', 'Approved (Dept)'));

select test.as_user('U-ODM-E');
select test.expect_fail('A14: requester approves their own budget (SELF_APPROVAL act)',
  test.act_sql('BUD-LIVE', 'U-ODM-E', 'DeptApproval', 'Pending Dept Head (1/2)', 'Approved (Dept)'));

select test.as_user('U-ODM-PROJ');
select test.expect_fail('A15: eligible approver jumps DeptApproval straight to Active (stage skip)',
  test.act_sql('BUD-LIVE', 'U-ODM-PROJ', 'Active', 'Active', 'Approved (Dept)'));
select test.expect_fail('A16: approver inflates amountINR mid-approval (tamper)',
  test.act_sql('BUD-LIVE', 'U-ODM-PROJ', 'DeptApproval', 'Pending Dept Head (1/2)', 'Approved (Dept)',
    '{"amountINR": 9500000}'::jsonb));
select test.expect_fail('A17: approval history entry forged as another user',
  test.act_sql('BUD-LIVE', 'U-ODM-ALL', 'DeptApproval', 'Pending Dept Head (1/2)', 'Approved (Dept)'));

select test.as_user('U-HR-E');
select test.expect_no_rows('A18: non-requester cancels someone else''s budget (row hidden by SELECT policy)',
  test.act_sql('BUD-LIVE', 'U-HR-E', 'Cancelled', 'Cancelled', 'Cancelled by requester'));
rollback;

-- Deletes: silently filtered by policy, not an error (bulk-save prune safety).
begin;
select test.as_user('U-HR-E');
do $$
declare n int;
begin
  delete from public.budgets where id = 'BUD-FIX-ODM';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'SECURITY HOLE — employee deleted a budget row'; end if;
  raise notice 'PASS (filtered) A19: employee delete affects 0 rows';
end $$;
rollback;

-- SELECT scoping
begin;
select test.as_user('U-HR-E');
do $$
declare n int;
begin
  select count(*) into n from public.budgets where dept = 'ODM';
  if n <> 0 then raise exception 'SECURITY HOLE — HR employee can read % ODM budget rows', n; end if;
  raise notice 'PASS (hidden) A20: HR employee sees no ODM budgets';
end $$;
select test.as_user('U-FH');
do $$
declare n int;
begin
  select count(*) into n from public.budgets where dept = 'ODM';
  if n = 0 then raise exception 'BROKEN — FinanceHead cannot see ODM budgets'; end if;
  raise notice 'PASS (visible) A21: FinanceHead sees ODM budgets (company-wide role)';
end $$;
rollback;

-- ============================================================================
-- B. LEGITIMATE FLOWS — the app's real behavior must still work.
-- ============================================================================

-- B1: full ≥5L chain: dept consensus -> FinanceHead -> VP -> CEO -> Active.
begin;
select test.as_user('U-ODM-E');
select test.expect_ok('B1a: raise 7.5L client project',
  test.ins_sql(test.mk_budget('BUD-B1', 'Project', 'ODM', 'U-ODM-E', 750000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"Client","projectId":"PRJ-B1","clientOrderValue":2000000}')));
select test.as_user('U-ODM-ALL');
select test.expect_ok('B1b: first dept approval (1/2)',
  test.act_sql('BUD-B1', 'U-ODM-ALL', 'DeptApproval', 'Pending Dept Head (1/2)', 'Approved (Dept)'));
select test.expect_fail('B1c: same approver cannot approve twice (DOUBLE_APPROVE)',
  test.act_sql('BUD-B1', 'U-ODM-ALL', 'FinanceHead', 'Pending Finance Head', 'Approved (Dept)'));
select test.as_user('U-ODM-PROJ');
select test.expect_ok('B1d: consensus completes -> FinanceHead',
  test.act_sql('BUD-B1', 'U-ODM-PROJ', 'FinanceHead', 'Pending Finance Head', 'Approved (Dept)'));
select test.as_user('U-FH');
select test.expect_ok('B1e: FinanceHead -> VP (>=1L escalates)',
  test.act_sql('BUD-B1', 'U-FH', 'VP', 'Pending VP', 'Approved by Finance Head'));
select test.as_user('U-VP');
select test.expect_ok('B1f: VP -> CEO (>=5L goes through BOTH)',
  test.act_sql('BUD-B1', 'U-VP', 'CEO', 'Pending CEO', 'Approved by VP'));
select test.as_user('U-CEO');
select test.expect_ok('B1g: CEO -> Active',
  test.act_sql('BUD-B1', 'U-CEO', 'Active', 'Active', 'Approved by CEO'));
rollback;

-- B2: SuperManager override; rejection; requester cancel; no-op bulk save.
begin;
select test.as_user('U-ODM-E');
select test.expect_ok('B2a: raise 2.5L project',
  test.ins_sql(test.mk_budget('BUD-B2', 'Project', 'ODM', 'U-ODM-E', 250000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"Client","projectId":"PRJ-B2","clientOrderValue":1000000}')));
select test.as_user('U-SM1');
select test.expect_ok('B2b: SuperManager override -> Active',
  test.act_sql('BUD-B2', 'U-SM1', 'Active', 'Active', 'Approved by Stuti Sm'));

select test.as_user('U-ODM-E');
select test.expect_ok('B2c: raise another (1L -> VP tier)',
  test.ins_sql(test.mk_budget('BUD-B2R', 'Project', 'ODM', 'U-ODM-E', 100000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"Client","projectId":"PRJ-B2R","clientOrderValue":1000000}')));
select test.as_user('U-ODM-ALL');
select test.expect_ok('B2d: dept head rejects with reason',
  test.act_sql('BUD-B2R', 'U-ODM-ALL', 'Rejected', 'Rejected', 'Rejected at Pending Dept Head'));

select test.as_user('U-ODM-E');
select test.expect_ok('B2e: raise then cancel own pending request',
  test.ins_sql(test.mk_budget('BUD-B2C', 'Project', 'ODM', 'U-ODM-E', 50000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"Client","projectId":"PRJ-B2C","clientOrderValue":1000000}')));
select test.expect_ok('B2f: requester cancels own request',
  test.act_sql('BUD-B2C', 'U-ODM-E', 'Cancelled', 'Cancelled', 'Cancelled by requester'));
select test.as_user('U-HR-E');
select test.expect_ok('B2g: bulk-save no-op on a foreign row is tolerated',
  'update public.budgets set data = data, status = status, current_stage = current_stage where id = ''BUD-B2''');
rollback;

-- B3: sole-head escalation + R&D + RD cap config lifecycle.
begin;
select test.as_user('U-HR-HEAD');
select test.expect_ok('B3a: sole HR head raises own Monthly -> escalates to FinanceHead',
  test.ins_sql(test.mk_budget('BUD-B3', 'Monthly', 'HR', 'U-HR-HEAD', 50000, 'FinanceHead', array[]::text[])));
select test.as_user('U-FH');
select test.expect_ok('B3b: FinanceHead approves escalated budget -> Active',
  test.act_sql('BUD-B3', 'U-FH', 'Active', 'Active', 'Approved by Finance Head'));

select test.as_user('U-ODM-E');
select test.expect_ok('B3c: R&D project within allocation',
  test.ins_sql(test.mk_budget('BUD-B3RD', 'Project', 'ODM', 'U-ODM-E', 150000, 'DeptApproval',
    array['U-ODM-ALL', 'U-ODM-PROJ'], '{"projectType":"RD","projectId":"PRJ-RD-OK"}')));
select test.expect_ok('B3d: ODM employee files an R&D allocation request',
  'insert into public.budgets (id, type, dept, status, current_stage, amount_inr, data) values
   (''RDCAPREQ-ODM-X'', ''RDCapRequest'', ''ODM'', ''Open'', null, null,
    ''{"id":"RDCAPREQ-ODM-X","kind":"RDCapRequest","type":"RDCapRequest","dept":"ODM","status":"Open","requesterId":"U-ODM-E"}'')');
select test.as_user('U-SM1');
select test.expect_ok('B3e: SuperManager allocates an R&D cap',
  'insert into public.budgets (id, type, dept, status, current_stage, amount_inr, data) values
   (''RDCAP-SALES'', ''RDCap'', ''Sales'', ''Active'', ''Active'', 100000,
    ''{"id":"RDCAP-SALES","type":"RDCap","dept":"Sales","month":"2099-01","amountINR":100000,"status":"Active","currentStage":"Active"}'')');
do $$
declare n int;
begin
  delete from public.budgets where id = 'RDCAPREQ-ODM-X';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'BROKEN — SuperManager could not dismiss an RD cap request'; end if;
  raise notice 'PASS (allowed) B3f: SuperManager dismisses the RD cap request';
end $$;
rollback;

-- B4: multi-department head approves in their EXTRA department.
begin;
select test.as_user('U-PROD-E');
select test.expect_fail('B4-pre: Product employee cannot raise Project (non-project dept)',
  test.ins_sql(test.mk_budget('BUD-B4X', 'Project', 'Product', 'U-PROD-E', 50000, 'DeptApproval',
    array['U-PROD-HEAD', 'U-MULTI'])));
select test.as_user('U-PROD-HEAD');
select test.expect_ok('B4a: Product head raises Monthly (consensus with U-MULTI)',
  test.ins_sql(test.mk_budget('BUD-B4', 'Monthly', 'Product', 'U-PROD-HEAD', 50000, 'DeptApproval',
    array['U-MULTI'])));
select test.as_user('U-MULTI');
select test.expect_ok('B4b: multi-dept head (primary Marketing) approves Product budget',
  test.act_sql('BUD-B4', 'U-MULTI', 'FinanceHead', 'Pending Finance Head', 'Approved (Dept)'));
rollback;

select 'ALL BUDGET RLS TESTS PASSED' as result;
