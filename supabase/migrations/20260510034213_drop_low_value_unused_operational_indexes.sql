-- Drop low-value unused operational indexes flagged by Supabase advisors.
--
-- Data-preserving cleanup:
-- - No table or row data is removed.
-- - FK/RLS support indexes are preserved even if pg_stat reports idx_scan=0.
-- - Composite/current access path indexes are preserved.

-- incident_reports is currently inactive in portfolio/free-tier mode and has
-- only a tiny retained history set. Keep created_at and FK/RLS support indexes.
DROP INDEX IF EXISTS public.idx_incident_reports_severity;
DROP INDEX IF EXISTS public.idx_incident_reports_status;

-- Login audit writes are append-only today. Keep user_id for the user-scoped
-- RLS/read policy, created_at for retention windows, and resource composite.
DROP INDEX IF EXISTS public.idx_security_audit_logs_action_type;
DROP INDEX IF EXISTS public.idx_security_audit_logs_ip;

-- get_approval_history filters status + requested_at and orders by requested_at.
-- The composite status_time plus requested_at/action_type/session indexes cover
-- the current RPC path; decided_at is only projected/aggregated.
DROP INDEX IF EXISTS public.idx_approval_history_status;
DROP INDEX IF EXISTS public.idx_approval_history_decided_at;
