# One-off hosted Beneficiaries acceptance and cleanup

This runbook applies only to the manual, synthetic-data acceptance on the exact production Pages URL `https://shihab-tech04.github.io/nbr-taxpay/`. Dispatch `.github/workflows/phase02-local-supabase.yml` only on branch `codex/hosted-beneficiaries-acceptance-20261031`, with the required `expected_sha` input set to the exact commit SHA WS05 reviewed. The hosted job rejects a SHA mismatch and any second hosted run for the same reviewed SHA. Its non-cancelling concurrency group prevents a duplicate dispatch from canceling an active run; a queued duplicate fails before visiting production. Do not dispatch a new reviewed SHA until exact-hash cleanup and readback for the prior run are complete. The workflow uses no hosted database credential. The two 32-byte capability tokens exist only in the Playwright process and isolated browser contexts; the run log and artifact contain only their SHA-256 hashes.

## Preflight before dispatch

Run these read-only checks on TaxPay Supabase project `eyqhoavnitkrajvyqvxn` immediately before dispatch:

```sql
select count(*) as sessions_expiring_within_four_hours
from taxpay_guest_private.sessions
where expires_at <= now() + interval '4 hours';
```

Dispatch only when the result is `0`. Both `open` and `touch_session` run a global expiry cleanup, so a nonzero result is a hard stop. Run the query immediately before dispatch and require the hosted test step to begin within two hours; if setup or queueing delays it past that window, stop before the test step. The hosted test has a three-minute Playwright timeout, so the four-hour look-ahead covers the allowed start window plus its full maximum test duration. Dispatch once; do not use “re-run jobs” or start another run for this SHA. Record aggregate guest, owner, and simulated-payment counts before the run. These are counts only; do not inspect, reset, or delete other guest or owner records.

```sql
select 'guest_sessions' as relation, count(*) as row_count from taxpay_guest_private.sessions
union all select 'guest_lists', count(*) from taxpay_guest_private.lists
union all select 'guest_beneficiaries', count(*) from taxpay_guest_private.beneficiaries
union all select 'owner_lists', count(*) from public.taxpay_beneficiary_lists
union all select 'owner_beneficiaries', count(*) from public.taxpay_beneficiaries
union all select 'sim_payment_transactions', count(*) from public.sim_payment_transactions
union all select 'sim_payment_allocations', count(*) from public.sim_payment_allocations
union all select 'story_payments', count(*) from demo_payment.story_payments
union all select 'story_notifications', count(*) from demo_payment.story_notifications;
```

Capture this result immediately before dispatch and repeat it after exact test cleanup. Existing records and concurrent live activity must be preserved and any aggregate drift reported without attributing it to the acceptance.

The test itself probes each generated capability with the real `lists` action and requires `410 / GUEST_SESSION_UNAVAILABLE` before allowing the app's `open` request. A capability that already resolves to a session fails closed. This protects against accidental reuse before the browser creates any list. That probe is the first hosted RPC and can globally remove expired sessions, which is why the four-hour expiry look-ahead and immediate dispatch are required.

The manual workflow also starts the disposable local Phase02 suite in parallel. It does not wait for that job before the hosted test; treat its result as a separate check, not a P1 acceptance gate.

## Acceptance coverage and limits

The English flow verifies guest list/beneficiary create, XLSX duplicate/new-row import, reload persistence, two-capability isolation, reverse cross-guest update/remove attempts, edit, correct-row removal, single and multi-taxpayer payment prefill, separate 68A/68B allocations totaling BDT 50, and stopping at the review screen. It also reloads the saved row in Bengali and checks responsive widths 320, 375, 768, and 1280 px.

Every browser request whose path identifies a payment, gateway, challan, intent, slip, checkout, or transaction endpoint is aborted and recorded. The test waits for network idle and a two-second quiet period, then requires that no such route was attempted. A matching route attempt fails the acceptance even though the request is blocked.

Anonymous `HEAD` requests to both account-owned beneficiary tables must return HTTP 401 or 403; guest pages must not access those owner tables, and the signed-in workspace remains behind its auth gate. The preflight found no owner beneficiaries or lists, so privacy of a populated account-owned row remains **NOT TESTED**. The hosted run creates no authenticated owner row.

## Targeted pre-cleanup readback

Copy the two 64-character lowercase SHA-256 values from the workflow artifact `hosted-beneficiary-cleanup-<run id>`. Validate both against `^[0-9a-f]{64}$` and substitute them as quoted values below. Never use a prefix, timestamp, list name, TIN, or table-wide delete predicate.

```sql
with targets as (
  select s.id, s.capability_hash
  from taxpay_guest_private.sessions s
  where s.capability_hash in ('<HASH_A>', '<HASH_B>')
), payloads as (
  select t.id, t.capability_hash,
         jsonb_build_object('lists', coalesce((
           select jsonb_agg(jsonb_build_object(
             'name', l.name,
             'beneficiaries', coalesce((
               select jsonb_agg(jsonb_build_object('tin', b.tin, 'name', b.display_name) order by b.tin)
               from taxpay_guest_private.beneficiaries b
               where b.session_id = t.id and b.list_id = l.id
             ), '[]'::jsonb)
           ) order by l.name)
           from taxpay_guest_private.lists l where l.session_id = t.id
         ), '[]'::jsonb)) as canonical_payload
  from targets t
)
select p.capability_hash,
       p.id as session_id,
       1 as session_count,
       (select count(*) from taxpay_guest_private.lists l where l.session_id = p.id) as list_count,
       (select count(*) from taxpay_guest_private.beneficiaries b where b.session_id = p.id) as beneficiary_count,
       encode(digest(convert_to(p.canonical_payload::text, 'UTF8'), 'sha256'), 'hex') as canonical_payload_sha256
from payloads p
order by p.capability_hash;
```

On a fully passing run, the two exact hashes should resolve to two sessions, three lists, and two remaining beneficiaries after the UI removes the imported second row. The returned session IDs and canonical payload digests should be retained with the run evidence. If the test fails partway through, counts may be lower; cleanup still targets only these two hashes because the preflight proved they were absent before this run.

## Exact cleanup

Delete only the two generated, preflighted capability hashes. This cascades to lists and beneficiary rows belonging to those sessions; it cannot target the existing session or owner tables.

```sql
delete from taxpay_guest_private.sessions
where capability_hash in ('<HASH_A>', '<HASH_B>')
returning id, capability_hash;
```

The returned IDs must match the IDs from the targeted pre-cleanup readback. If the row count or IDs differ, stop and investigate; do not broaden the predicate.

## SQL cleanup verification

Substitute the two capability hashes and the session IDs captured before deletion:

```sql
select
  (select count(*) from taxpay_guest_private.sessions
   where capability_hash in ('<HASH_A>', '<HASH_B>')) as sessions_remaining,
  (select count(*) from taxpay_guest_private.lists
   where session_id in ('<SESSION_A>'::uuid, '<SESSION_B>'::uuid)) as lists_remaining,
  (select count(*) from taxpay_guest_private.beneficiaries
   where session_id in ('<SESSION_A>'::uuid, '<SESSION_B>'::uuid)) as beneficiaries_remaining;
```

All three values must be `0`. Re-read aggregate guest, owner, and simulated-payment counts. Retain the pre-cleanup per-session payload digests; the exact-hash zero readback proves those test sessions and cascaded rows are gone. Concurrent live activity can change aggregate counts; report such drift without attributing it to this test. The preflight absence, pre-cleanup payload digests, returned deleted IDs, and post-delete zero readback are the authoritative cleanup evidence. No payment API, gateway, challan, or payment submission is part of this acceptance.
