# Supabase Setup

This app now uses Supabase for **data persistence** (requests, budgets, POs,
notifications, PO counter) and **authentication** (login). It replaces the old
`window.storage` key-value store and the hardcoded `USERS` login.

You only need to do steps 1–4 once.

## 1. Get your project keys

In the Supabase dashboard → **Project Settings → API**, copy:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** key → `VITE_SUPABASE_ANON_KEY`
- **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY` (server-side only)

Paste them into `.env.local` (already created, and gitignored):

```
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> The `service_role` key bypasses all security — never commit it or ship it to
> the browser. It's used only by the local seed script.

## 2. Create the database schema

In the dashboard → **SQL Editor**, paste and run the contents of
[`supabase/schema.sql`](supabase/schema.sql) — the consolidated, idempotent
schema (equivalent to applying migrations `0001`–`0004` in order, and safe to
re-run).

This creates the tables (`profiles`, `requests`, `budgets`, `pos`,
`notifications`, `pending_signups`, `app_meta`, `roles`), the `is_admin()`
function, and the Row Level Security policies.

> Setting up an existing project incrementally instead? Apply the individual
> files in `supabase/migrations/` in numeric order — they are the source-of-truth
> history. The full data model and security design is documented in
> [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md).

## 3. Seed the 21 users + demo data

```bash
npm run seed
```

This creates the 21 employee auth accounts (same emails/passwords as before),
their `profiles` rows, and loads the demo budgets and purchase orders. It's
idempotent — safe to re-run. (Budgets/POs also auto-seed on first app load if
the tables are empty, so this step is mainly for the user accounts.)

## 4. Run the app

```bash
npm run dev
```

Log in with any of the existing credentials (e.g. `saurav@elecbits.in` /
`ceo123`). The "Show test credentials" panel still lists them all.

---

## How it's wired

- `src/lib/supabase.ts` — the browser Supabase client (reads `VITE_*` env vars).
- `src/lib/auth.ts` — `signIn` / `signOut` / `getCurrentUser` / `signUp`. A
  `profiles` row maps each auth account to the app's `currentUser` shape and
  keeps the legacy `U01..` id, so all existing references keep working.
- `src/lib/db.ts` — the data layer. The app keeps full arrays in React state and
  calls `save*(array)`; that becomes "upsert all rows + prune deleted ids".
- `src/App.tsx` — loads from / saves to Supabase and restores the session.

### Data model

Each entity gets its own table with a few promoted, indexed columns (status,
dept, amount, etc.) for querying, plus a `data jsonb` column holding the full
object exactly as the React code builds it (line items, history arrays, …).
This is fully relational without rewriting the form/page code.

### Security model

This is an internal tool: any **authenticated** employee can read/write the
shared finance tables, and role/department gating is enforced in the app
(`src/lib/access.ts`). RLS blocks anonymous access. If you later want the
database itself to enforce per-role permissions, tighten the policies in
`0001_init.sql`.

### Self-service signup (optional)

`auth.signUp(...)` creates an account with `status = 'pending'` and a
`pending_signups` row for an admin to assign a role/department. The UI for the
admin approval flow isn't built yet — the constants for it
(`ASSIGNABLE_ROLES`, `DEPARTMENTS`, `STORAGE_KEY_PENDING`) are in place.
