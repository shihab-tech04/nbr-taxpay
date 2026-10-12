# Supabase backend — Phase 1 history and Phase 02 gate (2026-10-12)

## Current verified boundary

The public GitHub Pages build is intentionally backend-disabled and is **not** an authenticated taxpayer service. The existing React secure workspace uses Supabase Auth only when an explicitly configured backend is supplied. Application account authentication does not establish eTIN ownership or official taxpayer privileges. Real payments, ACS/Treasury posting, official challans and tax-credit recognition remain disabled.

### Correct migration order (source-controlled)

Apply migrations only to an explicitly approved **isolated TaxPay development** database after inspecting its existing schema and migration ledger. Never replay the initial CREATE TABLE over an existing table or alter another project's database.

1. `supabase/migrations/202610100001_taxpay_drafts.sql`
2. `supabase/migrations/202610100002_restrict_auto_rls_helper.sql`
3. `supabase/migrations/202610100003_source_candidate_registry.sql`
4. `supabase/migrations/202610100004_unverified_head_change_proposals.sql`
5. `supabase/migrations/202610100005_correction_inquiries.sql`
6. `supabase/migrations/202610100006_correction_change_proposals.sql`
7. `supabase/migrations/202610110001_taxpay_draft_owner_updates.sql`

The earlier filename `DEMO-TIN-001_taxpay_drafts.sql` was stale and **does not exist** in the current repository; do not use it.

## Read-only hosted metadata discovery — NOT installation authorization

A separately connected Supabase account labelled **Tax Payer Payment** lists project reference `eyqhoavnitkrajvyqvxn`, created 2026-10-10. On 2026-10-12 read-only SQL reported `current_database() = postgres`, `current_schema() = public`, and the nine-column `public.taxpay_payment_drafts` table. RLS was enabled and forced. The table had owner-scoped SELECT/INSERT/DELETE policies, but **no UPDATE policy**, and the authenticated role did not have UPDATE permission on `amount_minor` or `owner_uid`.

The hosted `supabase_migrations.schema_migrations` ledger records six timestamp versions `20261010061507`, `20261010061612`, `20261010064359`, `20261010085807`, `20261010093744`, `20261010094421`. These do not match the repository's seven numeric migration versions. This is a genuine history-reconciliation gap: matching names or similar table shapes **do not prove identical migration bytes or safe replay**, and the owner-update migration has not been verified as installed. No schema mutation or synthetic login was performed on this hosted project. Its development-only authorization has not been established by the mere project name.

## Outstanding Mac localhost HTTP/PostgreSQL discrepancy

The previous local checkpoint recorded successful synthetic Auth, PostgREST insert, and HTTP second read, but an independent SQL connection did not see the row. **Root cause NOT VERIFIED.** Plausible explanations include mismatched local containers, ports, PG instance/database, row visibility, or connection/session timing; none is a certified finding. Before claiming persistence, capture a single run's PostgREST base URL, resolved local API-to-database identity, SQL connection fingerprint, query role, schema and migration ledger, exact synthetic UUID, independent SQL read and post-restart SQL read. Reject any run where these cannot be tied to the same instance. Do not disclose credentials in reports.

## Security gates remaining

- Obtain explicit confirmation of an isolated development target; do not reuse NBR, HRIS or Sobaike Janao production projects.
- Reconcile installed migration identities, schema fingerprints, owner grants and RLS without resetting data. Apply only approved versioned changes through the supported migration system.
- Run two independent synthetic Auth users and verify cross-user read/write denial, owner create/edit/delete, unauthorized owner/status updates denied, session expiry/refresh and sign out.
- Show draft persistence through a **separate SQL connection and backend restart**; in-memory/PGlite or PostgREST-only read-back is insufficient for the original discrepancy.
- Confirm Guest payment discovery, blocked source head IDs 5 and 150, no payments, no official receipts and no government account claims.
- Preserve the public GitHub Pages disabled-backend build; secure preview release requires separate approval and evidence.

**Status: PARTIAL — repository draft planning logic exists; isolated live authentication, migration reconciliation and durable persistence are NOT VERIFIED.**
