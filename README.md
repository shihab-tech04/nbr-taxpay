# TaxPay frontend demonstrator

> **Demonstration only.** This is an independent frontend prototype, not an NBR-operated or endorsed service. It is not approved for tax advice, statutory decisions, real taxpayer identity or tax-credit entitlement, tax calculations, payment settlement, government challan issuance, or operational tax use. The published Pages build enables only scoped application authentication and synthetic planning/review through a public Supabase publishable key. It has no official payment or Treasury connection.

This repository contains a React and TypeScript interface, mock demonstration data, a candidate 170-record payment-head catalogue, and local test contracts. The catalogue is not an authoritative legal source. IDs 5 and 150 remain blocked for review. Screen names and route mappings describe source organization; they do not certify workflow completeness or parity with a government service.

## Current verification

The historical TEST_REPORT.md records the 2026-10-11 baseline, not the current release. Check the latest `main` commit's Pages and disposable Auth/RLS GitHub Actions workflows for current automated evidence. `RELEASE_GATE.md` records the public/hosted boundary and its outstanding production prerequisites. Passing tests establish the explicitly tested synthetic behaviors, not completion of the 387-story register or government financial integrations.

## Local development

Requires Node.js 24.21.0 as selected in .node-version.

    npm ci
    npm run lint
    npm run test:domain
    npm run dev

Build an isolated offline Pages demonstration with application Auth disabled:

    GITHUB_PAGES=true VITE_SUPABASE_DISABLED=true VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run build

The configured base path is /nbr-taxpay/. No production endpoint or credential is required for this offline configuration. The production Pages workflow deliberately builds with a separately scoped hosted **publishable** key and must be reviewed against `RELEASE_GATE.md` before publication.

## Source map

- src/components/screens/ contains UI screens.
- src/data/ contains prototype catalogue, glossary, and demonstration records.
- supabase/migrations/ contains local SQL source contracts; these files do not prove that a database was deployed or certified.
- tests/ contains domain and browser checks. A passing UI test does not certify legal rules, real Auth/PostgREST persistence, or payment processing.
- FEATURE_PARITY_v11.md maps route keys to source files only.

Real taxpayer identity and entitlement verification, tax calculations, payment settlement, official tax credits and challan issuance remain outside this release. Scoped application Auth is not evidence of any of those capabilities.
