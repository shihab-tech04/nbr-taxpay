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

## 2026-11-26 — WS5 recipient-report immediate dual-source release

This section records the already activated, nonfinancial correction migrations
from Taxpayer #1102 (Main `84134509af607d2977b4cd3927d0aba295412c1e`)
and Office #308 (Main `a4a1dfcd1dc51aa96d44dbdd104aae2e2e283567`).
The repository's ordered migration version and the hosted connector's actual
history timestamp are different. The following mapping was independently
read back from each hosted project's schema_migrations table.

| Project | Ordered repository file | Actual hosted version | Actual hosted name |
| --- | --- | --- | --- |
| Original Taxpayer | 20261125205131_recipient_immediate_dual_source.sql | 20261126020826 | recipient_immediate_dual_source |
| Replacement Taxpayer | 20261125205131_recipient_immediate_dual_source.sql | 20261126020829 | recipient_immediate_dual_source |
| Office | 20261125205132_office_recipient_immediate_dual_source.sql | 20261126014641 | office_recipient_immediate_dual_source |

Each project contains exactly one matching history row. The affected function
bodies match the respective merged ordered migration: four source functions
on each Taxpayer project and the Office intake function. The owner is postgres;
the internal event function is owner-only, and the public privileged RPCs
retain service_role-only execution (besides their owner). No new grant,
migration, record or configuration change was made to obtain this evidence.

**Future release gate:** the timestamp mismatch is not an unapplied migration.
The existing Pages release publishes static assets; the SQL CI operates on
disposable databases. Neither current publication workflow automatically pushes
these migrations to linked hosted projects. Do not introduce a blind linked
`supabase db push`, rename migration files, reapply the above SQL, or edit
migration history to make the timestamps match. Before a subsequent hosted
migration release, compare repository versions with actual hosted history,
reconcile these aliases in the release plan, and verify the existing function
definitions, ACLs, and constraints. Any history reconciliation must be an
explicitly authorized, supported, non-destructive procedure after verified
recovery and a reviewed dry-run; if the plan would reapply these entries, stop
that deployment and resolve the mapping first. Do not weaken branch protections.

Evidence: controller issue #230 and exact Main publication runs
45740377265 (Taxpayer), 45737999452 (Office); the installed function bodies
and owners/grants were re-read on 26 November 2026. This mapping is release
traceability, not a claim of complete hosted functional UAT.
