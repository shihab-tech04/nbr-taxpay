# TaxPay ↔ Office Management — API handoff for the UI phase

Date: 2026-10-17 (Bangladesh). Both repositories use the API-only branch
`api/payment-v1-backend-20261017`. The approved UI files and production
`main` branches were not edited in this API checkpoint.

## Scope

The handoff endpoints are fully internal, SQL-persistent and synthetic.
**No external payment provider, Treasury, challan service, government VPN,
verified eTIN, real tax credit or financial transaction is involved.**
Protected `payment_v1_*`, `sim_my_*` and Office `office_v1_query` remain
untouched. No live taxpayer data is copied into the handoff schemas.

## One base URL per app

**Office Management**

`https://ihbtabrvmyiwikqqbhrf.supabase.co/functions/v1/office-handoff-api/api/v1`

**TaxPay**

`https://eyqhoavnitkrajvyqvxn.supabase.co/functions/v1/taxpay-handoff-api/api/v1`

These public development endpoints require no login token; they access only
synthetic records. Browsers require no service-role key. Both Edge gateways
implement CORS and a fixed route allowlist. This contract is NOT an
authorization scheme for real taxpayers.

## TaxPay routes

| Method and path | Purpose |
| --- | --- |
| `POST /payments` | Create idempotent synthetic request for one of 8 service types |
| `GET /payments/:requestId` | Request details and event history |
| `GET /payments?sessionId=:uuid&limit=20` | Fictional session payment history |
| `GET /payments/:requestId/summary` | Internal transaction summary after completed simulation |
| `GET /notifications?sessionId=:uuid` | Fictional session notifications |
| `PATCH /notifications/:noticeId` | Mark fictional notification read/unread |
| `GET /office/inbox` | Fictional Office payment-review queue |
| `POST /office/payments/:requestId/review` | Maker/Reviewer/Approver progression |
| `POST /office/payments/:requestId/state` | Complete, fail or reverse fictional lifecycle |

The eight service codes are:
`TAX_WITH_RETURN`, `ADVANCE_TAX`, `ASSESSED_DEMAND`, `PENALTY`,
`SOURCE_TAX_DEPOSIT`, `APPELLATE_TRIBUNAL`,
`OTHER_TAX_PAYMENT`, `TRAVEL_TAX`.

Example `POST /payments` request for a guest Travel Tax journey:

```json
{
  "service": "TRAVEL_TAX",
  "amountMinor": 17500,
  "sessionId": "b2000000-0000-4000-8000-000000000002",
  "idempotencyKey": "f2000000-0000-4000-8000-000000000001"
}
```

`amountMinor` is an integer number of paisa. Reuse the same idempotency
UUID only when retrying the same exact request. Generate fresh random UUIDs
for real UI interactions. Non-Travel services require an assessment year and
TIN input; `OTHER_TAX_PAYMENT` additionally requires a reference. The
handoff API validates but does not persist raw TIN or external reference.

Review payload for `POST /office/payments/:requestId/review`:

```json
{
  "role": "MAKER",
  "actorCode": "sample-maker",
  "action": "MAKER_ACKNOWLEDGE",
  "reason": "Maker reviewed the synthetic payment request",
  "idempotencyKey": "c1000000-0000-4000-8000-000000000001"
}
```

Next actions are `REVIEWER_VERIFY` by a different actor, then
`APPROVER_CLOSE` by a third actor. The same approving actor can then call
`POST /office/payments/:requestId/state` with
`{"actorCode":"sample-approver","action":"COMPLETE_SIMULATION","idempotencyKey":"<new UUID>"}`.
Other simulated actions are `FAIL_SIMULATION` and `REVERSE_SIMULATION`
from permitted lifecycle states. SQL enforces review order, distinct actors,
allowed state transitions and idempotency.

## Office Management routes

All **30 read routes** from the existing endpoint wrappers are available
through the Office base URL. They return their existing object/list envelopes
plus `origin:"SYNTHETIC_HANDOFF"`. Examples:

- `GET /dashboard/kpis`
- `GET /returns/approvals?page=1&perPage=10`
- `GET /psr/double-entry/status`
- `GET /litigation/income-tax`
- `GET /demand-payment/ledger/DEMO-TIN-001`
- `GET /certificates/requests`
- `GET /admin/users`

The 28 list endpoints are paginated; the two KPI endpoints return an object.
Filters: `search`, `circle`, `zone`, `assessmentYear`, `status`,
`fromDate`, `toDate`. All fields were checked against the frontend
TypeScript response shapes. Status unions were separately verified.

**20 Office list routes** have a mutable status field. To update only a
synthetic record:

`PATCH /returns/approvals/SAMPLE-001/status`

```json
{
  "status": "Approved",
  "actorCode": "office-ui",
  "reason": "Approved synthetic return during UI testing",
  "idempotencyKey": "e1000000-0000-4000-8000-000000000001",
  "expectedRevision": 1
}
```

The status must be allowed by that exact TypeScript route contract;
optimistic revision checks, duplicate retries and 20-action limits are
enforced. Read the action trail with
`GET /returns/approvals/SAMPLE-001/history`.
Read-only KPI, archive, ledger, dormant and disposed-data views cannot
be mutated using this generic status RPC.

### TaxPay from the Office base URL

The Office gateway proxies **only synthetic TaxPay** endpoints:

| Office method and route | Delegates to TaxPay |
| --- | --- |
| `GET /payments/transactions` | `GET /office/inbox` |
| `GET /payments/transactions/:requestId` | `GET /payments/:requestId` |
| `POST /payments/transactions/:requestId/review` | `POST /office/payments/:requestId/review` |
| `POST /payments/transactions/:requestId/state` | `POST /office/payments/:requestId/state` |

This is a live API-to-API gateway bridge, **not a second replicated SQL
ledger**. TaxPay remains authoritative for the fictional transaction state;
Office reads and updates it through the gateway. The separately deployed
signed `payment_v1_*` two-database integration remains independent.

## Service access policy already approved

`src/services/paymentServiceAccessPolicy.ts` on TaxPay `main` permits
`MAKE_PAYMENT` publicly for **all eight** payment services. Viewing
account-bound records, saving private drafts and allocating eTDS deposit
records require the application's login journey; Travel Tax has no private
income-tax draft. The UI must preserve the selected service and form state
during login and resume the same step afterwards. This is a UI state and
capability distinction, not a request for production NBR authentication.

## Verification on the selected Supabase projects

| Evidence | Result |
| --- | --- |
| Office read contract registry | 30/30 |
| Office typed synthetic rows | 338, schema errors 0 |
| Office status-enabled modules | 20 |
| Office read RPCs successful | 30/30 |
| Invalid Office enum values | 0 |
| Office public direct access to real-source records | denied |
| TaxPay synthetic service codes with requests | 8/8 |
| TaxPay public handoff requests | 9 at acceptance checkpoint |
| TaxPay notices generated | 14 at acceptance checkpoint |
| Public write quota trigger | installed (30/session, 200 global per hour) |
| Guest Travel Tax HTTP submit | 200, pending request persisted |
| Guest history/detail and notice HTTP | 200 |
| Maker → Reviewer → Approver → completion SQL flow | PASS |
| Out-of-order review and idempotency assertions | PASS |
| Office HTTP cross-project maker action → TaxPay SQL change | PASS |
| Office sample status PATCH and audit history HTTP | 200 |

This proves API-level synthetic handoff, not finished browser user stories.
The Office frontend still has 30 fixture-backed service wrappers. The UI
integration phase should point `VITE_API_BASE_URL` to the Office gateway
and replace those wrappers with real API requests, while preserving the
accepted visual components and screen layout. TaxPay should consume its
handoff gateway behind the already accepted v11 service policy.

## Files

Office repository API branch:

- `docs/api/sql/office_v1_handoff_sample_api.sql`
- `docs/api/sql/office_v1_handoff_enum_alignment.sql`
- `docs/api/sql/office_v1_handoff_status_actions.sql`
- `supabase/functions/office-handoff-api/index.ts`

TaxPay repository API branch:

- `docs/api/sql/taxpay_v11_handoff_lifecycle.sql`
- `docs/api/sql/taxpay_v11_handoff_quota.sql`
- `supabase/functions/taxpay-handoff-api/index.ts`

These additions do not change existing protected application contracts.
