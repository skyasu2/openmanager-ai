-- history-only import
-- non-replayable
-- remote execution preserved
-- do not treat as fresh-bootstrap schema source
-- remote version: 20251228073223
-- remote name: sync_servers_with_vercel_json
--
-- Reason:
-- - The original migration seeded legacy server-data tables (`servers`,
--   `server_metrics`, `hourly_server_states`, `server_alerts`) that are no
--   longer part of the current hosted public schema.
-- - Replaying the legacy seed on a fresh local bootstrap now fails because
--   those tables have no active replayable schema source in the current
--   migration chain.
-- - The original data payload is retained in archive/ for reference only.

DO $$
BEGIN
  RAISE NOTICE 'history-only import stub: 20251228073223 sync_servers_with_vercel_json';
END
$$;
