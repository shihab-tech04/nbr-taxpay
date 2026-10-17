# NBR TaxPay ↔ Office Management: payment-v1 API checkpoint

As of 2026-10-17. **API-first workstream; UI unchanged.** Identical versioned migrations
are committed on branch `api/payment-v1-backend-20261017` in both repositories and
applied to the two selected Supabase projects. Do not treat these APIs as a live
payment gateway or government revenue ledger.

## Systems and authority

| Project | Supabase project | Authoritative records |
| --- | --- | --- |
| TaxPay | `eyqhoavnitkrajvyqvxn` | TaxPay-created request intents and their review states |
| Office Management | `ihbtabrvmyiwikqqbhrf` | Office-created request intents, Office officer identities/roles, Office review commands |

Both have the private `payment_sync` schema. Only authenticated RPC functions in
`public` expose relevant data. All new private tables use RLS with no direct
browser-role table access. Browser clients never receive bridge signing keys.

## Public authenticated RPCs

| RPC | Intent | Scope |
| --- | --- | --- |
| `payment_v1_create_request(p_input)` | Validate and create an idempotent intent for one of eight services | Authenticated; Office requests also require officer role |
| `payment_v1_get_request(p_id)` | Read local intent and independent request, settlement, credit and review states | Owner or authorized Office officer |
| `payment_v1_my_requests(p_limit)` | List authorized local intents | Owner or authorized Office officer |
| `payment_v1_cancel_request(p_request_id,p_idempotency_key,p_reason)` | Cancel a user's own unstarted intent | Owner; never cancels a settled item |
| `payment_v1_request_activity(p_request_id,p_limit)` | Read signed local or applied remote event history | Owner or authorized Office officer |
| `payment_v1_sync_status(p_request_id)` | Read delivery/acknowledgment of local event or latest received mirror | Owner or authorized Office officer |
| `payment_v1_my_notifications(p_limit)` | Read local user notifications | Owner |
| `payment_v1_set_notice_read(p_id,p_is_read)` | Change local user notice state | Recipient |
| `payment_v1_office_inbox(p_limit)` | Read mirrored TaxPay-originated intents, including review state | Office MAKER/REVIEWER/APPROVER |
| `payment_v1_officer_action(p_request_id,p_action,p_reason,p_idempotency_key)` | Queue signed Office review command for TaxPay-owned intent | Office role relevant to action |
| `payment_v1_my_officer_decisions(p_request_id,p_limit)` | Read delivery state of Office-to-TaxPay command decisions | Office officers |
| `payment_v1_office_local_action(p_request_id,p_action,p_reason,p_idempotency_key)` | Review Office-owned intent and publish new signed event | Office role relevant to action |
| `payment_v1_my_local_officer_decisions(p_request_id,p_limit)` | Read Office-owned review decisions | Office officers |
| `payment_v1_office_notifications(p_limit,p_unread_only)` | Read TaxPay-originated cross-project notices | Office officers |
| `payment_v1_office_set_notice_read(p_notice_id,p_is_read)` | Maintain per-officer cross-project notice read receipts | Office officers |
| `payment_v1_office_my_role()` | Discover the signed-in Office user's role and whether it is active | Authenticated Office user |
| `payment_v1_internal_set_officer_role(p_user_uid,p_role,p_active,p_reason)` | Grant, change or disable an existing Office user's role with an audit trail | Service role only; Office origin |

All RPCs are deployed to both databases for migration symmetry. Origin-specific
functions explicitly reject calls made on the wrong project. Every `payment_v1_internal_*`
RPC is service-role-only, not a browser API.

## Valid services and review transitions

`TAX_WITH_RETURN`, `ADVANCE_TAX`, `ASSESSED_DEMAND`, `PENALTY`,
`SOURCE_TAX_DEPOSIT`, `APPELLATE_TRIBUNAL`, `OTHER_TAX_PAYMENT`, `TRAVEL_TAX`.

Review sequence (applies to both authoritative origins):

1. `PENDING_OFFICER` → `MAKER_ACKNOWLEDGED` via `MAKER_ACKNOWLEDGE` by MAKER.
2. `MAKER_ACKNOWLEDGED` → `REVIEWER_VERIFIED` via `REVIEWER_VERIFY` by REVIEWER.
3. `REVIEWER_VERIFIED` → `APPROVER_CLOSED` via `APPROVER_CLOSE` by APPROVER.
4. REVIEWER/APPROVER can `REJECT` from an active stage with a reason of at least five characters.

Reviewers cannot be the same user as the maker; approvers must differ from both
prior reviewers. Each action has a per-officer/request idempotency UUID. Review
state is separate from settlement/credit, which these endpoints cannot change.

## Bridge paths

- **TaxPay-created**: TaxPay `REQUEST_CREATED` event → `payment-sync-bridge`
  → Office mirror and officer inbox → `payment_v1_officer_action` → Office
  `control_outbox` → HMAC `payment-command-bridge` → TaxPay authoritative
  `OFFICER_ACTION` revision → event bridge → Office mirror and notices.
- **Office-created**: Office `REQUEST_CREATED` event → event bridge → TaxPay
  mirror → `payment_v1_office_local_action` in Office → `OFFICER_ACTION` event
  → event bridge → TaxPay mirror.
- Both bridges are active and have independent `pg_cron` dispatch every minute;
  insertion also requests an immediate wake. The command path validates HMAC,
  origin, idempotency, review order and officer separation. Failed attempts are
  retained for retry/diagnosis.

## Deployment and verification status

- **Deployed**: request lifecycle, authenticated request/activity queries,
  review state projection, Office remote and local actions, cross-project
  notification feeds and per-officer read receipts, delivery-status query.
- **Deployed**: `payment-command-bridge` on both Supabase projects; the original
  `payment-sync-bridge` remains in place.
- **Verified**: 25 `payment_v1_*` RPCs exist in each database; none grants
  `EXECUTE` to `anon`; all internal RPCs are service-role-only. Both cron jobs
  are enabled on each project. New private RLS tables are present.
- **Not yet certified**: positive two-project end-to-end request/review delivery.
  The Office database currently has no active officer roles or auth users;
  neither project has payment-v1 requests. Provision authorized test identities
  through the approved access workflow before an authenticated integration test.
- **Deferred**: live payment-provider confirmation, Bangladesh Treasury receipt
  verification, challan issuance, tax-credit posting/reversal and their
  externally signed evidence adapters. They require official integration
  credentials and a separately approved source-of-truth specification.
- **UI**: no UI files edited; API code is still on dedicated branches, not `main`.

## SQL source application order

1. Existing payment-v1 base schema and original sync bridge (already deployed).
2. `payment_v1_phase2_request_lifecycle.sql`
3. `payment_v1_phase4_officer_command.sql`
4. `payment_v1_phase4_review_projections.sql`
5. `payment_v1_phase5_notifications_and_status.sql`
6. `payment_v1_phase5_office_local_reviews.sql`
7. `payment_v1_phase5_office_roles.sql`

Office has one additional hardening migration:
`payment_v1_office_security_hardening.sql`, which revoked public execution of
the internal RLS event-trigger handler (without removing the trigger).

All migration files are stored under `docs/api/sql/`; command bridge source
is `supabase/functions/payment-command-bridge/index.ts` on both API branches.

## Remaining release gates (before UI integration)

1. Provision approved Office MAKER, REVIEWER and APPROVER test users and roles.
2. Exercise eight service-validation cases, cancellation idempotency, Office
   action order, duplicate command delivery, retries and event mirror parity.
3. Capture signed event and command acknowledgment evidence in both projects.
4. Review Supabase advisor warnings and threat model. Private RLS tables
   intentionally have no direct read policies; this produces an informational lint.
5. Merge the two API branches only after tests/review; then begin UI wiring.
