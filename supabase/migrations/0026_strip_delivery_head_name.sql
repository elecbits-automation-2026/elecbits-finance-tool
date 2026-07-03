-- 0026_strip_delivery_head_name.sql
-- Cosmetic: the BoxBuildMid stage status label had a hardcoded person's name
-- ("Pending Delivery Head (Arun)"). Strip the name so it reads "Pending Delivery Head"
-- for whoever currently holds the Delivery Head (BoxBuildMidApprover) role. Routing is
-- unaffected (it is role-based); this only changes the display status string.
-- Note: BoxBuildMid is never a transition TARGET in payment_next_stage, so this branch
-- is not used in a guard comparison — this keeps the server label in sync with the
-- client (lib/workflow.ts getStageLabel).

create or replace function public.payment_stage_status(stage text)
returns text language sql immutable as $$
  select case stage
    when 'BoxBuildMid'  then 'Pending Delivery Head'
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
