# TaxPay production Travel Tax release gate — 2026-11-04

Scope: repair the deployed Chromium verification contract after removing a second, unconfirmed passenger. The first passenger must remain confirmed, cannot be silently added twice, and can only proceed after receipt contact is valid.

- Protected branch baseline: main 477ecd7aed9cc9438c22d86ed5cc1bf9317e5cce (dashboard PR #511 already merged).
- Related release failure: https://github.com/shihab-tech04/nbr-taxpay/actions/runs/41793727816
- Required production evidence: preserved original Check Passport and Add passenger flow, duplicate detection, removal, Add another passenger, mobile and desktop modal layout, receipt-contact validation, travel details, Back recovery, Pages HTML readback, Auth boundary and public search.
- Retained first passenger after removing incomplete passenger 2 is **confirmed**: the one-time “Add passenger” button must not reappear.
- Do not change tax calculation, Supabase/RLS, application UI, payment or receipt behavior.
- Do not claim LIVE until release workflow and deployed browser checks all succeed.
- The current pre-release main source and Git history must be backed up and restore-tested outside GitHub before merge.

This note preserves acceptance expectations and triggers a fresh protected pre-release recovery workflow on the current main.
