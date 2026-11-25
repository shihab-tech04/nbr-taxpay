\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE notice_recovery_before ON COMMIT DROP AS
SELECT pg_get_functiondef('public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)'::regprocedure) definition,
  p.proacl::text acl,pg_get_userbyid(p.proowner) owner,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' ORDER BY s.id),'')) FROM demo_payment.story_payments s) payment_digest,
  (SELECT md5(coalesce(string_agg(md5(to_jsonb(a)::text),'' ORDER BY a.demo_id,a.event_id),'')) FROM taxpay_guest_private.demo_received_payment_notice_ack a) ack_digest
FROM pg_proc p WHERE p.oid='public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)'::regprocedure;
\i :rollback_file
DO $verify_rollback$
BEGIN
 IF md5(pg_get_functiondef('public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)'::regprocedure)) <> 'cd5a0334df375b7343b07b7a999160c4'
 THEN RAISE EXCEPTION 'Hosted rollback definition mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p,notice_recovery_before b WHERE p.oid='public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)'::regprocedure AND p.proacl::text=b.acl AND pg_get_userbyid(p.proowner)=b.owner)
 THEN RAISE EXCEPTION 'Rollback privileges changed'; END IF;
END;
$verify_rollback$;
\i supabase/migrations/20261125174500_taxpay_recorded_walkin_recipient_notices.sql
DO $verify_reapply$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p,notice_recovery_before b WHERE p.oid='public.taxpay_demo_received_payment_notices(text,text,text,integer,integer)'::regprocedure AND pg_get_functiondef(p.oid)=b.definition AND p.proacl::text=b.acl AND pg_get_userbyid(p.proowner)=b.owner
 AND b.payment_digest=(SELECT md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' ORDER BY s.id),'')) FROM demo_payment.story_payments s)
 AND b.ack_digest=(SELECT md5(coalesce(string_agg(md5(to_jsonb(a)::text),'' ORDER BY a.demo_id,a.event_id),'')) FROM taxpay_guest_private.demo_received_payment_notice_ack a))
 THEN RAISE EXCEPTION 'Candidate reapply or immutable rows changed'; END IF;
 RAISE NOTICE 'PASS exact hosted function rollback and candidate reapply; ACL/owner and payment/ack fingerprints unchanged';
END;
$verify_reapply$;
ROLLBACK;
