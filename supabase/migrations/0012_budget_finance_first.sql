-- ============================================================================
-- 0012_budget_finance_first.sql
-- Reorder the budget approval chain so the Finance Head reviews FIRST.
-- ----------------------------------------------------------------------------
-- 0011 routed budgets Dept Head -> VP -> CEO -> Finance Head (Finance last).
-- The desired chain is Dept Head -> Finance Head -> VP -> CEO, with Finance
-- signing off immediately after the department head and the executive chain
-- (VP, then CEO for >=5L) escalating on top. The final approver — and the one
-- whose approval flips the budget to Active — is now the highest authority the
-- amount requires (Finance for <1L, VP for 1L–5L, CEO for >=5L).
--
-- Box Build still begins at BoxBuildMid (Delivery Head) before DeptApproval;
-- only the post-dept ordering changes. Thresholds are unchanged
-- (VP_THRESHOLD=100000, CEO_THRESHOLD=500000).
--
-- This only redefines budget_next_stage(); budget_stage_status() and every
-- per-stage authorization check (can_act_on_budget, the budgets_guard trigger)
-- are order-independent and need no change. KEEP IN SYNC with the budget branch
-- of computeNextStage() in src/lib/workflow.ts.
-- ============================================================================

create or replace function public.budget_next_stage(amount numeric, stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid' then 'DeptApproval'
    when 'DeptApproval' then 'FinanceHead'
    when 'FinanceHead' then case when amount >= 100000 then 'VP' else 'Active' end
    when 'VP' then case when amount >= 500000 then 'CEO' else 'Active' end
    when 'CEO' then 'Active'
    else stage end;
$$;
