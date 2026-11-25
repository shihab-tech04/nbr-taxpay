#!/usr/bin/env bash
set -euo pipefail
# Only the isolated runner is authorized; never accept external DSNs or cloud links.
test "$GITHUB_ACTIONS" = true
test "$GITHUB_REF_NAME" = recovery/pay-again-gift-lineage-rollback-20261125
export PGHOST=127.0.0.1 PGPORT=54322 PGDATABASE=postgres PGUSER=postgres PGPASSWORD=postgres
export PGCONNECT_TIMEOUT=5
unset PGOPTIONS PGSERVICE PGSERVICEFILE
out="$RUNNER_TEMP/gift-pay-again-proof"
mkdir -p "$out"
sql() { psql -X -v ON_ERROR_STOP=1 "$@"; }
sql -Atqc "select current_database()='postgres' and inet_server_addr() is not null" | grep -qx t
# Capture full executable definitions, ownership, ACL and trigger state.
snapshot() {
  sql -Atqc "select p.oid::regprocedure::text||'|'||pg_get_userbyid(p.proowner)||'|'||p.proacl::text||'|'||md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid in ('demo_payment.assert_gift_tax_simulation(jsonb)'::regprocedure,'demo_payment.check_new_pay_again_source_lineage()'::regprocedure) order by 1; select tgname||'|'||tgenabled::text||'|'||pg_get_triggerdef(oid) from pg_trigger where tgrelid='demo_payment.story_payments'::regclass and not tgisinternal order by tgname;"
}
fingerprint() {
  sql -Atqc "select 'payment|'||count(*)||'|'||md5(coalesce(string_agg(md5(to_jsonb(p)::text),'' order by id),'')) from demo_payment.story_payments p; select 'notices|'||count(*)||'|'||md5(coalesce(string_agg(md5(to_jsonb(n)::text),'' order by id),'')) from demo_payment.story_notifications n; select 'outbox|'||count(*)||'|'||md5(coalesce(string_agg(md5(to_jsonb(o)::text),'' order by md5(to_jsonb(o)::text)),'')) from demo_payment.mirror_outbox o;"
}
snapshot > "$out/before.txt"
grep -Fqx 'demo_payment.assert_gift_tax_simulation(jsonb)|postgres|{postgres=X/postgres}|d90a264587d67b32699236ad9804fd16' "$out/before.txt"
grep -Fqx 'demo_payment.check_new_pay_again_source_lineage()|postgres|{postgres=X/postgres}|49da5393b57a914d771ae17a6782905b' "$out/before.txt"
fingerprint > "$out/rows-before.txt"
{
  echo BEGIN\;
  sql -Atqc "select pg_get_functiondef(p.oid)||';' from pg_proc p where p.oid in ('demo_payment.assert_gift_tax_simulation(jsonb)'::regprocedure,'demo_payment.check_new_pay_again_source_lineage()'::regprocedure) order by 1;"
  echo COMMIT\;
} > "$out/rollback.sql"
# Supabase CLI generates the versioned filename; never replace an installed migration.
supabase migration new gift_tax_pay_again_lineage
mapfile -t migrations < <(find supabase/migrations -maxdepth 1 -name '*_gift_tax_pay_again_lineage.sql' -type f)
test "${#migrations[@]}" -eq 1
migration="${migrations[0]}"
cp scripts/recovery/gift-tax-pay-again-lineage.sql "$migration"
cp "$migration" "$out/"
sql -f "$migration"
snapshot > "$out/after.txt"
! cmp -s "$out/before.txt" "$out/after.txt"
fingerprint > "$out/rows-after.txt"
cmp "$out/rows-before.txt" "$out/rows-after.txt"
# Idempotent reapplication; preserve grants, trigger and every stored row.
sql -f "$migration"
snapshot > "$out/reapplied.txt"
cmp "$out/after.txt" "$out/reapplied.txt"
sql -f "$out/rollback.sql"
snapshot > "$out/restored.txt"
cmp "$out/before.txt" "$out/restored.txt"
fingerprint > "$out/rows-restored.txt"
cmp "$out/rows-before.txt" "$out/rows-restored.txt"
sql -f "$migration"
snapshot > "$out/second-apply.txt"
cmp "$out/after.txt" "$out/second-apply.txt"
sql -f "$out/rollback.sql"
snapshot > "$out/second-restore.txt"
cmp "$out/before.txt" "$out/second-restore.txt"
fingerprint > "$out/rows-second-restore.txt"
cmp "$out/rows-before.txt" "$out/rows-second-restore.txt"
(cd "$out" && sha256sum * > SHA256SUMS)
echo 'PASS exact hosted-definition baseline, migration generation, idempotent apply, two rollback round trips, original ACL and trigger state, unchanged payment/notice/outbox fingerprints'
