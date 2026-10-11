# Frontend architecture — demonstration build

> This document describes the current local/static frontend only. It is not an as-built architecture for a government, treasury, bank, or production tax service.

## Current application

- React and TypeScript screens are assembled by src/App.tsx and built by Vite.
- UI demonstration records are in src/data/. They are not verified taxpayer, payment, or legal-source records.
- The 170-record candidate catalogue is preserved as read-only, unverified source data; selected entries remain blocked.
- Local Supabase SQL migrations are source files only. The public Pages configuration disables Supabase URL and key use.
- No production authentication, NBR API, treasury service, bank gateway, receipt issuance, tax calculation, or payment execution is configured or certified.

## Verification boundary

TypeScript, domain, browser, and build results are recorded in TEST_REPORT.md. The full browser run requires a verified backend for three positive source-integrity assertions; those assertions fail closed with an explicit offline snapshot when that service is unavailable. Local Auth/PostgREST persistence remains unresolved. No deployment or legal acceptance is evidenced by this source tree.
