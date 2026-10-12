# TaxPay account center — 2026-10-12 (PR acceptance record)

## In scope
- Taxpayer-only Sobaike-reference profile, profile settings, in-app notification center, and a genuine local-session sign-out option in the desktop rail and mobile More menu.
- Existing Guest and Officer shells/design/financial rules remain unchanged.
- Sample taxpayer profile is fictional and *does not* authorize access to a real account. "Exit sample" is a role/display reset, explicitly not authentication sign-out.
- Hosted public GitHub Pages remains backend-disabled; actual Auth operations are tested only with synthetic users in a disposable local Supabase stack.

## Source and functional contract
- `src/components/screens/AccountCenter.tsx` — authenticated application account email, display name, creation/email verification timestamps and account ID, with explicit eTIN non-verification.
- Settings use `supabase.auth.updateUser({data: ...})` to store only user-managed `taxpay_display_name`, `taxpay_language`, `taxpay_in_app_notifications` and `taxpay_notifications_read_at` metadata. No new database columns or tax-privileged flags. Users control their preferences, not their tax entitlements.
- Private in-app notices are a read-only projection of this exact authenticated owner's persisted `taxpay_payment_drafts` rows, ordered by creation. Independent `auth.getUser()` identity and `owner_uid` scope are required before reads, and existing PostgreSQL RLS remains the definitive enforcement. No unverified statutory demands or fictional payment updates.
- Notifications are **in-app only**. No email/SMS/push delivery service, scheduler, official NBR message, payment gateway or ledger-credit integration has been added or implied. Read status uses Auth account metadata.
- `src/services/accountIdentity.ts` — application-session observer; local-only `supabase.auth.signOut({scope:'local'})`. Navigation does not call tax submission, alter payment drafts or assume roles.
- `src/components/layout/TaxpayerReferenceRail.tsx`, `CitizenNavigation.tsx` — desktop and mobile access; sign-out appears only when Auth returns a real application user, otherwise sample users see an explicitly separate demo exit.
- `src/App.tsx` — account pages are accessible without falsely treating a sample role as authenticated. Officer and Guest payment routes never inherit private data.

## Executable gates
- Static/browser suite: `tests/e2e/taxpayer-account-center.spec.ts` at 320, 360, 375, 390, 768, 1280 and desktop 1600; Guest/Officer route isolation and EN/BN.
- Real local connected suite: `tests/e2e/secure-workspace-real-local.spec.ts` verifies Auth-owned notifications, persisted preferences, read state, and mobile sign-out in addition to existing two-user RLS draft creation, edit, delete, isolation and resume.
- Existing domain, payment safety, blocked payment source IDs 5 and 150, Guest UI, Officer UI, and Pages disabled-backend gates must remain passing.
- Before publishing report exact PR head/merge SHA, CI success/failure, Pages deployment and live HTML read-back. Do not count an unrun or skipped test as PASS.

## Intentional exclusions
No official taxpayer profile/eTIN identity verification, real tax liability or demand notifications, external notification dispatch, hosted Auth enablement, NBR payment processing, tax ledger posting, tax-credit ownership recognition, or deployment of sensitive account records to public Pages.

Status: IMPLEMENTED / AWAITING CI. This file must not be used as a PASS claim until the executable gates succeed.
