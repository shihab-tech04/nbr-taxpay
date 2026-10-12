# Supabase backend — Phase 1: authentication and private drafts

**Phase 02 reconciliation (2026-10-12):** a connected Supabase project named `Tax Payer Payment` (`eyqhoavnitkrajvyqvxn`) exists. Read-only inspection found the drafts table and six migration-history entries, no application users or drafts at inspection time, and **no owner UPDATE policy or column UPDATE grant**. The repository has seven migration files, including the missing owner-update migration. The connected project's status as a specifically approved disposable *development* target is not established. No DDL or user-data writes were made there. Public GitHub Pages stays backend-disabled.

## Required dedicated environment
Create a brand-new **TaxPay** Supabase project in the organization explicitly selected by the owner. Do not reuse `Bangladesh-NBR-eReturn`, `hrmis-saas`, or `sobaike-production` and do not touch production or government data.

The initial draft migration in this repository is **`supabase/migrations/202610100001_taxpay_drafts.sql`**. It is followed by numbered `202610100002` through `202610100006`, then **`202610110001_taxpay_draft_owner_updates.sql`**. The earlier `DEMO-TIN-001_taxpay_drafts.sql` reference was obsolete; do not apply it. Reconcile the **actual** Supabase migration version/name records before installing anything in an owner-approved isolated TaxPay development environment. On that project configure Supabase Auth email OTP/magic link and the official URL allow-list for the intended staging hostname. Authentication identifies an application user **only**; it does not validate an eTIN or confer taxpayer/officer powers.

In a locally controlled `.env.local`, set:
- `VITE_SUPABASE_URL=https://<approved-project-ref>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

**Do not configure these variables on the public GitHub Pages build.** Its CI explicitly forces `VITE_SUPABASE_DISABLED=true` and clears both endpoint and publishable key. Only an approved private isolated preview may use the publishable key; service-role/secret keys must never enter Vite variables or the repository.

## What is real in this batch once connected
1. Supabase Auth signs the user in by emailed magic link.
2. `taxpay_payment_drafts` is stored in PostgreSQL and protected by RLS.
3. An authenticated user can create, list, update and delete **only their own** private plans once the numbered owner-update migration is applied and independently verified.
4. Database CHECK constraints exclude purpose/category mixing and non-draft status.
5. The owner-update migration grants UPDATE **only** for `purpose`, `category`, `assessment_year`, `amount_minor`, and `memo`, guarded by owner-only RLS. It never grants UPDATE on `owner_uid`, `record_status`, `id`, or `created_at`, nor settlement/credit rights.

## Explicitly NOT enabled
Official eTIN matching, named taxpayer association, payment gateway, actual ACS remittance, challan issuance, eLedger credit, eTDS matching, correction authority, and officer role access. Existing 29-route prototype remains a separately labeled demo and must not be treated as an authenticated system. The new secure workspace is a distinct route; demo records are never migrated as authentic data.

## Verification and acceptance
- `npm run test:domain`: positive/negative amount/year/category validation.
- `npm run lint` and `npm run build`.
- In a disposable loopback stack, run the existing synthetic HTTP suite **with direct PostgreSQL read-back**. It now requires `TAXPAY_LOCAL_PG_DSN` as well as the loopback API URL and publishable/anon key; a PostgREST 201 or subsequent HTTP GET alone does not certify direct SQL persistence. Test both owners' SELECT/INSERT/UPDATE/DELETE, cross-owner isolation, forbidden owner/status changes, restart persistence, and migration execution.
- Confirm sign-in redirect on the deployed project-site subpath, refresh persistence, sign out and re-login. Document exact outputs before claiming **PASS**.
- Next gate: reconcile original v11's 170 payment-head identities before any executable payment submission.

Current milestone: **PARTIAL — code and repository schema exist; dedicated authenticated DB acceptance, local HTTP-to-PostgreSQL identity check, restart persistence, migration installation and full end-to-end certification remain BLOCKED/NOT VERIFIED**.
