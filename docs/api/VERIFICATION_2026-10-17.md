# Payment-v1 backend verification — 2026-10-17

Verification performed against both selected **hosted** Supabase projects.
No payment-v1 requests or financial transactions were created during these checks.

| Check | TaxPay SQL | Office SQL |
| --- | --- | --- |
| Public `payment_v1_*` functions registered | 23 | 23 |
| `anon` can execute payment-v1 RPC | 0 | 0 |
| Internal RPCs restricted to `service_role` | 8/8 | 8/8 |
| Both event/command cron dispatch jobs enabled | Yes | Yes |
| `payment-command-bridge` deployed ACTIVE | Yes | Yes |
| Eight service validators returned expected 100 minor units | 8/8 | 8/8 |
| Client-supplied `requestState` rejected by validator | Yes | Yes |
| New private tables have RLS enabled | Yes | Yes |
| Command claim queue and failed outbox | Empty / 0 | Empty / 0 |
| Payment-v1 local / mirrored requests | 0 / 0 | 0 / 0 |
| Active authorized Office roles | 0 | 0 |
| Missing FK indexes in `payment_sync` after tuning | 0 | 0 |

Both command Edge deployments use the same source digest:
`2a13da09497a5b7033cfd2648d3bb84ba6f4d959cf1977ef5ab57038dbead105`.

An existing Office `public.rls_auto_enable()` SECURITY DEFINER event-trigger handler
had an anonymous EXECUTE grant. An Office-only hardening migration revoked its
`PUBLIC`, `anon`, and `authenticated` execution grants; the corresponding security
advisor warning disappeared. The event trigger was not removed.

Advisor informational messages about private RLS tables having no policies are
expected for service-only `payment_sync` tables. Other pre-existing Supabase
advisor notices, including TaxPay's legacy simulation tables, were not changed.

## Not yet certified

No positive end-to-end test can currently assert that a *real authenticated*
TaxPay-created request propagates into Office, receives three distinct officer
reviews, returns a signed command to TaxPay, and reappears in Office with the
new revision. Office has no provisioned roles/accounts to execute the workflow.

End-to-end certification requires approved Office MAKER/REVIEWER/APPROVER
identities and a designated non-financial integration-test dataset, then evidence
for normal delivery, replay, wrong-signature rejection, out-of-order transitions,
cancelled intents and retry/backoff. Real bank/Treasury integrations are a
separate developer handoff and are intentionally absent from payment-v1.
