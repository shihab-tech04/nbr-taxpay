# Public frontend release security boundary

This isolated release snapshot is intentionally independent of the original development Git history. The source-history bundle remains an offline backup and must not be uploaded with this public release.

Taxpayer-shaped historical mock records that could not be certified as synthetic were excluded from this release snapshot. Remaining personal-looking UI fixture fields in `src/data/mockData.ts` are explicitly marked synthetic and use reserved example values. The deployment is a demonstration frontend: production tax, payment, authentication, and backend services are disabled. No credentials or private endpoints belong in this release.

The original full development history remains preserved separately in the verified offline bundle recorded in the local checkpoint manifest.
