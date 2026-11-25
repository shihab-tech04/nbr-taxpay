#!/usr/bin/env bash
set -euo pipefail
BASE=1f890451000758091d208bf9922b9bf0d5a4eb98
CANDIDATE=4e7b63f77479af703a81f74909eada0f6274ba83
ROOT="$(pwd)"
git cat-file -e "$BASE^{commit}"
git cat-file -e "$CANDIDATE^{commit}"
git worktree add --detach "$RUNNER_TEMP/correction-baseline" "$BASE"
cd "$RUNNER_TEMP/correction-baseline"
test "$(git rev-parse HEAD)" = "$BASE"
# All database activity is confined to disposable GitHub runner containers.
# No cloud login, link, hosted credentials, or production URLs.
supabase start -x studio,imgproxy,realtime,storage-api,logflare,vector,supavisor,postgres-meta
mapfile -t DB_IDS < <(docker ps --filter name=supabase_db_ --format '{{.ID}}')
test "${#DB_IDS[@]}" = 1
DB="${DB_IDS[0]}"
sql() { docker exec -i "$DB" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
dump_schema() {
  docker exec "$DB" pg_dump -U postgres -d postgres --schema-only \
    --schema=public --schema=payment_sync --schema=taxpay_guest_private --schema=demo_payment |
    sed -E '/^\\(un)?restrict /d'
}
test "$(sql -Atqc "select count(*) from public.taxpay_correction_inquiries")" = 0
test "$(sql -Atqc "select count(*) from public.taxpay_correction_review_decisions")" = 0
test "$(sql -Atqc "select count(*) from payment_sync.correction_outbox")" = 0
test "$(sql -Atqc "select count(*) from public.taxpay_in_app_notifications")" = 0
dump_schema > "$RUNNER_TEMP/correction-before.sql"
# Capture exact catalog definitions from the baseline, not reconstructed SQL.
sql -Atqc "select pg_get_functiondef('public.taxpay_enqueue_correction_submission()'::regprocedure)||';'; select pg_get_functiondef('public.taxpay_correction_my_history(integer)'::regprocedure)||';'; select format('COMMENT ON FUNCTION %s IS %L;', p.oid::regprocedure, obj_description(p.oid,'pg_proc')) from pg_proc p where p.oid in ('public.taxpay_enqueue_correction_submission()'::regprocedure,'public.taxpay_correction_my_history(integer)'::regprocedure); select format('ALTER TABLE public.taxpay_in_app_notifications ADD CONSTRAINT %I %s;', conname,pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.taxpay_in_app_notifications'::regclass and conname='taxpay_notifications_one_target_check';" > "$RUNNER_TEMP/correction-original-definitions.sql"
MIGRATIONS=(
20261116041000_taxpay_correction_evidence_note
20261116054500_taxpay_office_initiated_review
20261116055000_taxpay_office_correction_history_origin
20261124044500_taxpay_demo_correction_intake
20261124060500_taxpay_v2_demo_correction_sync
20261124064500_taxpay_demo_correction_notifications
20261124065000_taxpay_demo_office_correction_intake
)
for migration in "${MIGRATIONS[@]}"; do
  git -C "$ROOT" show "$CANDIDATE:supabase/migrations/$migration.sql" | sql
done
test "$(sql -Atqc "select to_regclass('taxpay_guest_private.story_correction_requests') is not null and to_regprocedure('public.taxpay_claim_office_initiated_corrections(integer)') is not null and to_regprocedure('public.taxpay_demo_correction_office_initiation(jsonb)') is not null")" = t
# Rollback strictly before new traffic, never discard real requests or signing keys.
{
cat <<'SQL'
BEGIN;
DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM public.taxpay_correction_inquiries)
 OR EXISTS (SELECT 1 FROM public.taxpay_correction_review_decisions)
 OR EXISTS (SELECT 1 FROM payment_sync.correction_outbox)
 OR EXISTS (SELECT 1 FROM public.taxpay_in_app_notifications)
 OR EXISTS (SELECT 1 FROM payment_sync.office_initiated_correction_inbox)
 OR EXISTS (SELECT 1 FROM taxpay_guest_private.story_correction_requests)
 OR EXISTS (SELECT 1 FROM taxpay_guest_private.story_correction_decisions)
 OR EXISTS (SELECT 1 FROM taxpay_guest_private.story_correction_notice_reads)
 OR EXISTS (SELECT 1 FROM payment_sync.demo_correction_bridge_key)
 THEN RAISE EXCEPTION 'ROLLBACK_BLOCKED_NONEMPTY_CORRECTION_STATE'; END IF;
END
$guard$;
DROP FUNCTION public.taxpay_demo_correction_notices(text,integer,integer);
DROP FUNCTION public.taxpay_demo_correction_notice_read(text,text);
DROP VIEW taxpay_guest_private.story_correction_notice_events;
DROP FUNCTION taxpay_guest_private.correction_notice_owner(text);
DROP FUNCTION public.taxpay_demo_correction_office_initiation(jsonb);
DROP FUNCTION public.taxpay_demo_correction_office_decision(jsonb);
DROP FUNCTION public.taxpay_demo_correction_ack(uuid,uuid,boolean);
DROP FUNCTION public.taxpay_demo_correction_claim(integer,uuid);
DROP FUNCTION public.taxpay_demo_correction_get(uuid);
DROP FUNCTION public.taxpay_demo_historical_correction_save(text,text,uuid,jsonb);
DROP FUNCTION public.taxpay_demo_correction_save(text,uuid,uuid,jsonb);
DROP FUNCTION public.taxpay_demo_correction_list(text,integer,integer);
DROP FUNCTION taxpay_guest_private.story_correction_event(taxpay_guest_private.story_correction_requests);
DROP FUNCTION taxpay_guest_private.story_correction_json(taxpay_guest_private.story_correction_requests);
DROP FUNCTION public.payment_v1_demo_correction_key();
DROP FUNCTION public.taxpay_claim_office_initiated_corrections(integer);
DROP FUNCTION public.taxpay_correction_receive_office_initiation(jsonb);
DROP TABLE taxpay_guest_private.story_correction_notice_reads;
DROP TABLE taxpay_guest_private.story_correction_decisions;
DROP TABLE taxpay_guest_private.story_correction_requests;
DROP TABLE payment_sync.demo_correction_bridge_key;
DROP TABLE payment_sync.office_initiated_correction_inbox;
DROP INDEX public.taxpay_office_initiation_notice_unique;
ALTER TABLE public.taxpay_in_app_notifications DROP CONSTRAINT taxpay_notifications_one_target_check;
SQL
cat "$RUNNER_TEMP/correction-original-definitions.sql"
cat <<'SQL'
ALTER TABLE public.taxpay_correction_inquiries DROP COLUMN origin_system, DROP COLUMN evidence_note;
COMMIT;
SQL
} > "$RUNNER_TEMP/correction-rollback.sql"
sql < "$RUNNER_TEMP/correction-rollback.sql"
dump_schema > "$RUNNER_TEMP/correction-after.sql"
diff -u "$RUNNER_TEMP/correction-before.sql" "$RUNNER_TEMP/correction-after.sql"
sha256sum "$RUNNER_TEMP/correction-before.sql" "$RUNNER_TEMP/correction-after.sql"
echo "PASS: exact baseline source, seven candidate SQL migrations, empty-state guarded reversal, and schema/ACL/RLS/trigger/function/constraint dump equality in disposable PostgreSQL 17."
