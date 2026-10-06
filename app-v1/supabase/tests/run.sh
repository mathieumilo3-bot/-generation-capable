#!/usr/bin/env bash
# Lance un Postgres 16 jetable, applique le stub Supabase + toutes les migrations
# + seed, puis exécute chaque tests/*.test.sql. Sortie ≠ 0 au premier échec.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PORT=${PGTEST_PORT:-54329}
DIR=$(mktemp -d)
trap '"$PGBIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

if [ "$(id -u)" = "0" ]; then
  # Postgres refuse de tourner en root : on délègue à l'utilisateur postgres.
  chown -R postgres "$DIR"
  RUN="runuser -u postgres --"
else
  RUN=""
fi
$RUN "$PGBIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
$RUN "$PGBIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
PSQL="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X"
$PSQL -c "create database app" postgres
PSQL="$PSQL -d app"
export PSQL
$PSQL -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do echo "▶ $f"; $PSQL -f "$f"; done
[ -f seed.sql ] && { echo "▶ seed.sql"; $PSQL -f seed.sql; }
fail=0
for t in tests/*.test.sql; do
  echo "▶ $t"
  if ! $PSQL -f "$t"; then fail=1; echo "✗ $t"; break; fi
done
[ $fail = 0 ] && echo "✓ all SQL tests passed" || exit 1
