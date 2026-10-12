# Local review notes — 2026-10-12

Base: `2f06ae9ba81acb4299fd5160a603e44b472d046a`  
Branch: `fix/taxpay-certificate-preview-20261012`  
Publication: not committed, pushed or deployed.

## Included

- Replaced the official-looking certificate mock with a clearly non-official, localized preview whose status follows the selected certificate type.
- Kept locale switching available in the compact navigation menu and kept the header expanded while a form field is focused.
- Added browser coverage for certificate status and bilingual copy, and for the compact locale path.
- Saved English and Bengali certificate screenshots at mobile and desktop sizes under `docs/acceptance-evidence/2026-10-12/`.

## Verification

- TypeScript check: passed.
- Domain tests: 51 passed.
- Production build: passed, with existing large-chunk advisory.
- Secure-workspace mock browser suite: 15 passed.
- Public citizen browser suite: 123 passed, 6 skipped.
- Diff whitespace check: passed.

## Known release blockers

- Hosted Supabase is missing the source draft-update migration and owner-scoped update authorization.
- Live payment, Treasury and NBR/ACS integrations are not verified or enabled.
- The 387-story register and original v11 reference package were not recoverable, so formal story-level acceptance remains unverified.

