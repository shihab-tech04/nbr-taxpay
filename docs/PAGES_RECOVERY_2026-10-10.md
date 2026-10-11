# GitHub Pages recovery — 2026-10-10

## Root cause
GitHub Pages currently serves the repository's uncompiled Vite development `index.html`.
It imports `/src/main.tsx`. A Pages project-site host cannot transpile TSX or serve that root-relative dev source. The user-visible 404 is therefore a deployment/build-path failure, not evidence that the React source is missing.

## Repair
- `vite.config.ts` enables the React and Tailwind v4 Vite plugins.
- In the GitHub Actions build only, it sets `base=/NBR-Tax-Payment/`.
- `.github/workflows/pages.yml` builds on pull requests. After code is merged, it deploys the compiled `dist/` output on pushes to `main`, never raw TypeScript.
- A build smoke assertion checks that `dist/index.html` does not reference `/src/main.tsx` and that assets use the project Pages path.
- There is no external payment system, API credential, or database connection added by this repair.

## GitHub Pages owner setting required
Under **Repository Settings → Pages → Build and deployment**, choose **Source: GitHub Actions**, not **Deploy from a branch**. This settings switch cannot be proven or executed with the available code-file connector.

## Certification
Build, typecheck, full parity and Pages delivery status are **NOT VERIFIED** until the workflow executes and the served site is checked. Do not mark as PASS on source inspection alone.

## Release policy
Keep this migration and the draft financial safeguards reviewable together. Do not deploy a separate placeholder or commit a generated `dist/` directory into `main`.
