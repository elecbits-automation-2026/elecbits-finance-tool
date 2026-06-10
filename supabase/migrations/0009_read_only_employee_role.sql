-- ============================================================================
-- 0009_read_only_employee_role.sql
-- Adds a read-only employee role (catalog rank 0). These accounts can view their
-- own department's budgets but cannot raise any request or act on the workflow.
-- Enforced in the app (src/lib/access.ts: isReadOnly / canRaiseRequests); the
-- catalog row just surfaces it in the Admin Console role dropdown.
-- ============================================================================

insert into public.roles (id, key, label, titles, rank) values
  (0, 'EmployeeReadOnly', 'Employee (Read-only)', 'Read-only, Viewer', 0)
on conflict (id) do update
  set key = excluded.key, label = excluded.label, titles = excluded.titles, rank = excluded.rank;
