-- =============================================================================
-- Optimize approval/audit RLS policies and harden trigger search_path
-- =============================================================================
-- Purpose:
-- 1) Remove advisor warnings caused by auth.role()/auth.uid() per-row evaluation
-- 2) Keep policy intent unchanged while using explicit TO roles
-- 3) Fix mutable search_path warning on approval_history updated_at trigger
-- =============================================================================

-- 1) ai_feedback: service role only, without auth.role() row evaluation
DROP POLICY IF EXISTS "Service role full access" ON public.ai_feedback;
CREATE POLICY "Service role full access"
    ON public.ai_feedback
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 2) approval_history: service role only, without auth.role() row evaluation
DROP POLICY IF EXISTS "Service role full access" ON public.approval_history;
CREATE POLICY "Service role full access"
    ON public.approval_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3) security_audit_logs: keep user-scoped read access, but cache auth.uid() per statement
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.security_audit_logs;
CREATE POLICY "Users can view own audit logs"
    ON public.security_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        user_id IS NOT NULL
        AND user_id = (select auth.uid())
    );

-- 4) approval_history trigger helper: fixed search_path
ALTER FUNCTION public.update_approval_history_updated_at()
    SET search_path = public, pg_temp;
