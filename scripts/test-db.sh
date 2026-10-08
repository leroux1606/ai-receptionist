#!/usr/bin/env bash
# Applies the migration to a scratch Postgres database and runs the tenant
# isolation tests. Usage:  PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
# Needs a Postgres you can create databases on (a disposable one, never prod).
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-rcp_test}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
for f in supabase/tests/00_supabase_shim.sql supabase/migrations/*.sql supabase/tests/10_tenant_isolation.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1 | { grep -E "NOTICE|ERROR|PASSED|FAILED" || true; } | sed 's/^psql:[^ ]* //'
done
