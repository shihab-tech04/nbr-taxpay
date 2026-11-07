# TaxPay verified release path

This note documents the release process; it does not change the application.

## Preserved functionality

TaxPay continues to use its existing **simulated payment UI**. Taxpayer payment amounts and the matching Office/Admin records remain synchronized through the existing SQL and application workflows. No payment gateway is part of this release-speed work. No UI, database schema, sign-in behavior, payment calculations, or taxpayer records are modified by this note.

## Release safety rules

1. Changes are reviewed and merged through protected Main by the authorized workflow.
2. Pull requests complete the existing TypeScript, domain, browser, disposable Supabase and independent source-recovery checks before merge.
3. A reviewed source tree and its immutable build artifact may be reused only when the merge has exactly the same Git tree, the required PR workflows passed before merge, and the changed paths are within the narrowly allowed presentation/documentation paths.
4. Workflow, dependency, SQL, authentication infrastructure, and unknown changes require the complete release pipeline; missing evidence fails closed to the full checks.
5. A verified pre-release Git-history and source backup must be retained **outside GitHub**, checksum-tested and restore-tested before production release.
6. Every production publish must pass actual GitHub Pages deployment, hosted HTML readback, and existing live browser checks.

The protected Main branch, approved TaxPay UI, simulated payment behavior, and Taxpayer → SQL → Admin/Office synchronization are unchanged by these release instructions.

## Measurement

Report actual pull-request validation time and actual production deployment time separately. Never claim an improvement is live or meets a speed target until the deployment and live URL are verified. Retain the full workflow as a fail-closed fallback if artifact reuse cannot be proven.
