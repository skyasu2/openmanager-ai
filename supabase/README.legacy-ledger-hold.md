# Legacy Supabase Ledger Residual Notes

> Status: Historical reference
> Scope: remote-only migrations that were originally held out of ledger repair and later validated as history-only stubs
> Active workflow: use `reports/planning/supabase-migration-ledger-repair-plan.md` for current repair steps
>
> This file is intentionally kept outside `supabase/migrations/` so Supabase CLI does not
> treat it as a migration candidate. The active migration ledger is the SQL files under
> `supabase/migrations/`.

## Former Hold Set

These remote-only migrations were initially excluded from the active `history-only import`
stub set during ledger-repair analysis.

- `20250731085344 create_mcp_monitoring_schema_fixed`
- `20250731085432 add_mcp_analysis_functions`
- `20250803015807 create_thinking_steps_table`
- `20250806120552 004_create_intelligent_monitoring_tables`
- `20250806121533 create_ai_insight_tables`
- `20250807044444 create_hourly_server_states_table`

## Current Interpretation

- The hosted schema no longer exposes `mcp_monitoring`, `thinking_steps`, `ai_insight`,
  or `hourly_server_states` as active objects.
- Active runtime paths do not directly depend on these objects.
- These versions are now treated as **history-only parity stubs** rather than replayable
  schema migrations.
- They remain documented here because their domain meaning differs from the active
  application schema even though their version ids are now represented in the repaired ledger.

## Residual Remote-Only Context

One additional remote-only residual version was validated alongside the former hold set:

- `20250906043934 create_ml_training_results_table_fixed`

This version is also handled as a history-only parity stub because its object set is not part
of the current hosted runtime schema.
