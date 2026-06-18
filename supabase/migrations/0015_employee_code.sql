-- 0015_employee_code.sql
-- Adds an Employee Code (format EB-XXXX-XXX) captured at self-service signup.
-- Stored on the profile so it's part of the user's identity; nullable so all
-- existing accounts (which predate this field) remain valid. No RLS change is
-- needed: profiles_insert_self / _update_self only check auth.uid() = auth_id,
-- not which columns are written.

alter table public.profiles add column if not exists employee_code text;
