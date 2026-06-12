#!/usr/bin/env bash
# ============================================================================
# Verifies the server-side budget workflow enforcement (migration 0011)
# against a real Postgres: boots a throwaway postgres:16 container, installs a
# minimal Supabase auth stub (auth.users + auth.uid() reading a session GUC),
# applies supabase/schema.sql (which includes 0011), then runs
# scripts/test-budget-rls.sql — an attack/legit matrix executed as
# authenticated sessions. Exits non-zero if any attack lands or any legitimate
# flow breaks.
#
# Usage: bash scripts/test-budget-rls.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="ebits-rls-test-$$"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> starting postgres container ($NAME)"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=pw postgres:16 >/dev/null

echo "==> waiting for postgres"
for i in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -U postgres -q 2>/dev/null; then break; fi
  sleep 1
  [ "$i" = 60 ] && { echo "postgres did not come up"; exit 1; }
done

PSQL=(docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q)

echo "==> installing supabase auth stub"
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
-- Stand-in for Supabase's auth.uid(): reads the test session's user.
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
SQL

echo "==> applying supabase/schema.sql (includes 0011 budget enforcement)"
"${PSQL[@]}" < supabase/schema.sql >/dev/null

echo "==> granting table access to the authenticated role (Supabase default)"
"${PSQL[@]}" <<'SQL'
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
SQL

echo "==> running attack/legit matrix (scripts/test-budget-rls.sql)"
OUT=$("${PSQL[@]}" -v ON_ERROR_STOP=1 < scripts/test-budget-rls.sql 2>&1) || {
  echo "$OUT" | tail -30
  echo "FAILED"
  exit 1
}
echo "$OUT" | grep -E "NOTICE|result|PASSED" | sed 's/^NOTICE:  //'
echo "$OUT" | grep -q "ALL BUDGET RLS TESTS PASSED" && echo "==> OK: all scenarios behaved as required"
