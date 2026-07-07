-- 0027_hr_expenses_read.sql
-- The HR Expenses tab needs to show every user's HR-relevant expenses org-wide.
-- requests_select (via can_select_request) only lets non-company-wide roles read
-- their OWN department's requests, so HR could not read other departments' rows.
--
-- This grants HR org-wide read of the HR expense categories ONLY (people +
-- office/admin ops), without exposing any other department's commercial payments,
-- POs, or budgets. Category list mirrors HR_EXPENSE_NAMES in src/constants.ts.
-- Writes are unchanged.

create or replace function public.caller_in_hr()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.auth_id = auth.uid() and 'HR' = any(public.user_depts(p))
  );
$$;

drop policy if exists requests_select on public.requests;
create policy requests_select on public.requests
  for select to authenticated
  using (
    public.can_select_request(dept, requester_id)
    or ( public.caller_in_hr()
         and (data->>'expenseTypeName') in
             ('Travel','Accommodation','Salary & Payroll','Employee Reimbursements',
              'Office Supplies','Marketing Events','Utilities & Office Expenses') )
  );
