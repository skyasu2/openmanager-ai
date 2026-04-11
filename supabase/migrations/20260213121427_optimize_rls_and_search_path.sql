-- =============================================================================
-- Optimize RLS Policies and Harden Function search_path
-- =============================================================================
-- Purpose:
-- 1) Reduce permissive/inefficient RLS policy patterns for incident/RAG tables
-- 2) Set fixed search_path for warning-targeted public functions
-- =============================================================================

-- 1) incident_reports: tighten INSERT policy + optimize UPDATE policy
DROP POLICY IF EXISTS "Users can create incident reports" ON public.incident_reports;
CREATE POLICY "Users can create incident reports"
    ON public.incident_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by IS NULL OR created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update assigned reports" ON public.incident_reports;
CREATE POLICY "Users can update assigned reports"
    ON public.incident_reports
    FOR UPDATE
    TO authenticated
    USING (
        assigned_to = (select auth.uid())
        OR created_by = (select auth.uid())
    )
    WITH CHECK (
        assigned_to = (select auth.uid())
        OR created_by = (select auth.uid())
    );

-- 2) RAG tables: make service-role policies role-scoped
DROP POLICY IF EXISTS "Service role full access" ON public.knowledge_base;
CREATE POLICY "Service role full access"
    ON public.knowledge_base
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow write for service role" ON public.knowledge_relationships;
CREATE POLICY "Allow write for service role"
    ON public.knowledge_relationships
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3) search_path hardening for functions flagged by advisors
DO $$
DECLARE
    fn regprocedure;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'get_server_logs',
              'cleanup_old_logs',
              'add_server_log',
              'update_approval_history_updated_at',
              'get_approval_stats',
              'get_approval_history'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn);
    END LOOP;
END $$;

