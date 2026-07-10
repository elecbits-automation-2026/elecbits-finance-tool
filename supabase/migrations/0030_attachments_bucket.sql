-- 0030_attachments_bucket.sql
-- Private Storage bucket for attachments + RLS so authenticated users can upload
-- and read (via signed URLs). Object keys are random/unguessable, and a path is
-- only ever surfaced from a row the caller's table RLS already lets them see, so
-- a blanket authenticated read is an acceptable balance for an internal tool. A
-- tighter per-record path policy can be layered on later.
--
-- Files move OUT of the row JSONB (base64) and into this bucket; the row keeps
-- only { name, size, type, path }. See src/lib/storage.ts and the backfill
-- script scripts/backfill-attachments.mjs.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase; just add the policies.
drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists attachments_select on storage.objects;
create policy attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments');

drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments');
