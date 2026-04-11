# Orphan Function Cleanup Plan

## Objective
- Remove remote PostgreSQL functions that are no longer backed by live tables/views and are not used by the current app runtime.
- Keep live approval functions intact:
  - `get_approval_history`
  - `get_approval_stats`

## Current State
- Remote DB still contains `19` non-approval functions that appear orphaned.
- App/runtime code references only the approval RPCs.
- The object families these functions depend on are absent in the current remote schema.

## Verified Facts

### Live functions to keep
- `get_approval_history`
- `get_approval_stats`

### Absent remote objects
- `public.conversation_history`
- `public.agent_context`
- `public.ai_jobs`
- `public.query_logs`
- `public.server_metrics_history`
- `public.ml_training_results`
- `public.hourly_server_states`

### Drop-safe orphan candidates

#### MCP / monitoring legacy
- `cleanup_old_mcp_data`
- `get_mcp_server_summary`
- `detect_mcp_anomalies`
- `generate_mcp_aggregates`

#### Conversation history legacy
- `get_or_create_conversation`
- `append_conversation_message`
- `cleanup_old_conversations`

#### Agent context legacy
- `get_session_context`
- `save_agent_context`
- `cleanup_expired_agent_context`

#### AI jobs legacy
- `cleanup_old_ai_jobs`

#### Query logs legacy
- `get_popular_queries`
- `analyze_query_patterns`

#### Metrics / ML legacy
- `get_metrics_window`
- `calculate_realtime_kpis`
- `analyze_performance_trend`
- `calculate_prediction_accuracy`
- `get_prediction_performance`
- `get_previous_training_stats`

## Why this is safe
- No current app code references the `19` candidates.
- Their backing object families are already gone from remote schema.
- Keeping them does not preserve runtime capability; it only preserves dead surface area.

## Execution Plan
1. Create a single minimal migration that drops the `19` orphan functions with `DROP FUNCTION IF EXISTS`.
2. Apply the migration to remote Supabase.
3. Verify:
   - orphan functions no longer appear in `information_schema.routines`
   - approval RPCs still work
   - `supabase migration list` remains aligned
   - `supabase db push --dry-run --linked` stays clean

## Out of Scope
- Recreating any of the deleted legacy tables
- Replacing legacy analytics/reporting functions with new implementations
- Approval history/runtime changes

## Decision
- Next safe execution step is a **drop-only orphan-function cleanup migration**.
- Do not mix this with `security_audit_logs` / `server_logs` policy decisions.
