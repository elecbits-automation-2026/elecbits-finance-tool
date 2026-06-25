#!/usr/bin/env bash
# ============================================================================
# Verifies the server-side payment workflow enforcement for the accountant
# stages (migration 0024). Boots a throwaway postgres:16, installs the Supabase
# auth stub, applies supabase/schema.sql, then runs scripts/test-requests-rls.sql.
# Exits non-zero if any legitimate flow breaks or any blocked transition lands.
#
# Usage: bash scripts/test-requests-rls.sh
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="ebits-req-rls-test-$$"
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
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
SQL

echo "==> applying supabase/schema.sql (includes 0023 + 0024 requests guard)"
"${PSQL[@]}" < supabase/schema.sql >/dev/null

echo "==> granting table access to the authenticated role"
"${PSQL[@]}" <<'SQL'
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
SQL

echo "==> running accountant-flow matrix (scripts/test-requests-rls.sql)"
OUT=$("${PSQL[@]}" -v ON_ERROR_STOP=1 < scripts/test-requests-rls.sql 2>&1) || {
  echo "$OUT" | tail -40
  echo "FAILED"
  exit 1
}
echo "$OUT" | grep -E "NOTICE|PASSED" | sed 's/^NOTICE:  //'
echo "$OUT" | grep -q "ALL REQUESTS RLS TESTS PASSED" && echo "==> OK: all accountant-stage scenarios behaved as required"
