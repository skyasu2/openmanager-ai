-- history-only import
-- non-replayable
-- remote execution preserved
-- do not treat as fresh-bootstrap schema source
-- remote version: 20251223230707
-- remote name: create_conversation_history
--
-- Reason:
-- - `conversation_history` and its helper functions are not part of the current
--   hosted public schema.
-- - The original table/trigger/function bundle is not referenced by the current
--   app code and later cleanup migrations explicitly treat those helpers as
--   orphaned.
-- - Replaying the legacy table locally causes the active bootstrap chain to
--   diverge from the hosted schema and fail during orphan cleanup.

DO $$
BEGIN
  RAISE NOTICE 'history-only import stub: 20251223230707 create_conversation_history';
END
$$;
