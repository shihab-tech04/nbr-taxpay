# TaxPay frontend demonstrator

> **Demonstration only.** This is an independent frontend prototype, not an NBR-operated or endorsed service. It is not approved for tax advice, statutory decisions, real taxpayer accounts, tax calculations, payment initiation, challan issuance, or production use. The public Pages build disables hosted authentication and backend access.

This repository contains a React and TypeScript interface, mock demonstration data, a candidate 170-record payment-head catalogue, and local test contracts. The catalogue is not an authoritative legal source. IDs 5 and 150 remain blocked for review. Screen names and route mappings describe source organization; they do not certify workflow completeness or parity with a government service.

## Current verification

See TEST_REPORT.md for the commands and observed results. In brief, TypeScript and 48 domain tests pass, the static Pages-mode build succeeds, and the public-backend-disabled browser check passes at 320px, 375px, and desktop. The broader browser suite still has three unavailable-backend assertions and sixteen skips. Auth/PostgREST persistence and legal/source acceptance are not verified. RELEASE_GATE.md records this status.

## Local development

Requires Node.js 24.21.0 as selected in .node-version.

    npm ci
    npm run lint
    npm run test:domain
    npm run dev

Build the static GitHub Pages demonstration with backend access disabled:

    GITHUB_PAGES=true VITE_SUPABASE_DISABLED=true VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run build

The configured base path is /nbr-taxpay/. No production endpoint or credential is required.

## Source map

- src/components/screens/ contains UI screens.
- src/data/ contains prototype catalogue, glossary, and demonstration records.
- supabase/migrations/ contains local SQL source contracts; these files do not prove that a database was deployed or certified.
- tests/ contains domain and browser checks. A passing UI test does not certify legal rules, real Auth/PostgREST persistence, or payment processing.
- FEATURE_PARITY_v11.md maps route keys to source files only.

Real taxpayer calculations, authentication, payments, and deployments remain outside this release.
