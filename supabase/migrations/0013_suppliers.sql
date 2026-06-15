-- ============================================================================
-- 0013: supplier master
-- ----------------------------------------------------------------------------
-- Suppliers were free-text on every PO. This adds a shared supplier master so
-- the PO form can offer a dropdown and autofill address + GSTIN. New suppliers
-- are auto-saved here when a PO is raised with a manually-entered supplier, so
-- the list curates itself with no separate admin step.
--
-- Like requests/budgets/pos this is a shared finance table: the full app object
-- lives in `data` (jsonb), with a few promoted columns for indexing. Any
-- authenticated user may read/write (no server-side workflow validation).
-- ============================================================================

create table if not exists public.suppliers (
  id         text primary key,
  name       text not null,
  gstin      text,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_name_idx on public.suppliers (name);

alter table public.suppliers enable row level security;

drop policy if exists suppliers_auth_all on public.suppliers;
create policy suppliers_auth_all on public.suppliers
  for all to authenticated using (true) with check (true);
