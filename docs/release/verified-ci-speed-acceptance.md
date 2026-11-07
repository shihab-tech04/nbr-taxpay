# Release speed and verification acceptance

This document records what must be verified when benchmarking the TaxPay release workflow. It changes no product code or behavior.

## Separate the two timings

- **Pre-merge validation:** Full browser, domain and disposable SQL/Office acceptance executes against the exact PR head. Source backup archives are created and independently restored.
- **Main-branch production release:** Where the merged Git tree is identical to the fully tested PR head, the authorized, immutable review artifact may be reused rather than rebuilding and rerunning the same browser suite.
- If any required PR result, source-tree match, provenance stamp or allowed-path condition is missing, the release uses the full pipeline or blocks publishing.

## Live acceptance remains mandatory

Production cannot be marked LIVE merely because a PR merged or a static build was uploaded. The GitHub Pages publish must finish, the deployed page must be read back, and the existing deployed-site authentication boundary, public reference search, travel-tax and transaction-table journeys must pass.

## Preserve approved behavior

TaxPay retains its existing simulated-payment interface. Its payment amounts and the Office/Admin records already persist and synchronize through the current implementation. There is no payment gateway to introduce. The existing UI, calculations, sign-in, source design system and data storage must not be modified by release-optimization work.

## Backup gate

Before merging a production-bound PR, archive complete pre-release Main Git history and source to a location outside GitHub. Verify SHA-256 readback and perform a restore test.

## Reporting

Report both actual production release duration and total PR-to-live time. The 70–80% improvement target applies to measured production deployment time and must not be described as achieved until a real fast-path release confirms it.
