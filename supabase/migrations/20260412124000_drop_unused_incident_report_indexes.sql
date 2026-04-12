-- =============================================================================
-- Drop unused incident_reports indexes that do not match current runtime queries
-- =============================================================================
-- Purpose:
-- - idx_incident_reports_pattern is a btree index, but runtime search uses
--   pattern ILIKE '%...%' and cannot benefit from it.
-- - idx_incident_reports_affected_servers has no current repository-backed
--   query path using array containment/overlap operators.
-- - Keep severity/status/FK indexes unchanged because they still align with
--   current API filters and likely future growth.
-- =============================================================================

DROP INDEX IF EXISTS public.idx_incident_reports_pattern;
DROP INDEX IF EXISTS public.idx_incident_reports_affected_servers;
