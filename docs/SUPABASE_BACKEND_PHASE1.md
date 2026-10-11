# Supabase backend — Phase 1: authentication and private drafts

**Current status: code prepared; no Supabase project created, migration installed, account connected, or authenticated end-to-end test passed.**

## Required dedicated environment
Create a brand-new **TaxPay** Supabase project in the organization explicitly selected by the owner. Do not reuse `Bangladesh-NBR-eReturn`, `hrmis-saas`, or `sobaike-production` and do not touch production or government data.

Apply `supabase/migrations/DEMO-TIN-001_taxpay_drafts.sql` in the approved TaxPay project. On that project configure Supabase Auth email OTP/magic link and the official URL allow-list for the intended staging hostname. Authentication identifies an application user **only**; it does not validate an eTIN or confer taxpayer/officer powers.

In a locally controlled `.env.local`, set:
- `VITE_SUPABASE_URL=https://<approved-project-ref>.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

For GitHub Pages, create the same repository **Actions variables** (not secret keys) in Settings → Secrets and variables → Actions → Variables. No secret/service-role key may enter a Vite variable or the repository.

## What is real in this batch once connected
1. Supabase Auth signs the user in by emailed magic link.
2. `taxpay_payment_drafts` is stored in PostgreSQL and protected by RLS.
3. An authenticated user can create, list, and delete their **own** draft plans only.
4. Database CHECK constraints exclude purpose/category mixing and non-draft status.
5. No browser-facing policy grants `UPDATE` or financial settlement/credit rights.

## Explicitly NOT enabled
Official eTIN matching, named taxpayer association, payment gateway, actual ACS remittance, challan issuance, eLedger credit, eTDS matching, correction authority, and officer role access. Existing 29-route prototype remains a separately labeled demo and must not be treated as an authenticated system. The new secure workspace is a distinct route; demo records are never migrated as authentic data.

## Verification and acceptance
- `npm run test:domain`: positive/negative amount/year/category validation.
- `npm run lint` and `npm run build`.
- After Supabase installation, repeat SQL RLS checks as two distinct test users: own select/create/delete PASS, another user's SELECT/DELETE returns no rows, anonymous writes denied, UPDATE denied, processing/credit status write denied.
- Confirm sign-in redirect on the deployed project-site subpath, refresh persistence, sign out and re-login. Document exact outputs before claiming **PASS**.
- Next gate: reconcile original v11's 170 payment-head identities before any executable payment submission.

Current milestone: **DRAFT / NOT BACKEND CERTIFIED**.
