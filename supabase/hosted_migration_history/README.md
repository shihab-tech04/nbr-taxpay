# Hosted TaxPay SQL migration recovery — 2026-10-19

The 14 SQL files here were recovered **read-only** from the connected
Taxpayer Supabase project's `supabase_migrations.schema_migrations.statements`
history. They were active on the hosted project but absent from this GitHub
repository. Filenames retain their hosted migration versions and names.

They are **historical source evidence**, not a second set of migrations to run
blindly. In particular, the existing files in `../migrations/` contain
several differently named or consolidated revisions; running both sets may
duplicate DDL. Do not copy these files into `../migrations/` or invoke
`supabase db push` until a complete, ordered, disposable-project rebuild
proves the history is equivalent. Never store the hosted bridge's
dispatch/signing credentials in this repository.

Scope: request lifecycle, durable inbox/outbox, bridge, officer roles and
actions, synthetic handoff, and legacy simulation protections. No real bank,
ACS, Treasury or eLedger integration is implied.
