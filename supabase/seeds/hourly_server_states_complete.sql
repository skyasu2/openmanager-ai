-- history-only local seed stub
-- non-replayable
-- retained for local ledger/config parity
--
-- Reason:
-- - The active hosted public schema no longer includes `hourly_server_states`.
-- - Runtime server metrics now use `public/data/otel-data/*` as the primary
--   SSOT rather than Supabase seed tables.
-- - Replaying the legacy hourly seed during local bootstrap breaks fresh
--   environments that intentionally match the current hosted schema.
--
-- The original minimized seed payload remains available in git history for
-- legacy reference only.

DO $$
BEGIN
  RAISE NOTICE 'history-only local seed stub: hourly_server_states_complete';
END
$$;
