-- =============================================================================
-- Harden RLS for server_logs and ai_user_feedback
-- =============================================================================
-- Purpose:
-- 1) Remove permissive WITH CHECK true insert policies
-- 2) Scope service-role policy by role instead of auth.role() expression
-- 3) Reduce advisor warnings without over-engineering
-- =============================================================================

DO $$
BEGIN
    -- -------------------------------------------------------------------------
    -- server_logs
    -- -------------------------------------------------------------------------
    IF to_regclass('public.server_logs') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Service role full access" ON public.server_logs;
        CREATE POLICY "Service role full access"
            ON public.server_logs
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);

        DROP POLICY IF EXISTS "Anon insert access" ON public.server_logs;
        CREATE POLICY "Anon insert access"
            ON public.server_logs
            FOR INSERT
            TO anon
            WITH CHECK (
                length(btrim(server_id)) > 0
                AND length(btrim(message)) > 0
                AND length(message) <= 5000
                AND COALESCE(source, 'system') = ANY (
                    ARRAY['system', 'api', 'monitoring', 'agent', 'frontend']
                )
            );
    END IF;

    -- -------------------------------------------------------------------------
    -- ai_user_feedback
    -- -------------------------------------------------------------------------
    IF to_regclass('public.ai_user_feedback') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.ai_user_feedback;
        CREATE POLICY "Anyone can insert feedback"
            ON public.ai_user_feedback
            FOR INSERT
            TO public
            WITH CHECK (
                length(btrim(interaction_id)) > 0
                AND length(interaction_id) <= 128
                AND (session_id IS NULL OR length(session_id) <= 128)
                AND (page_url IS NULL OR length(page_url) <= 1000)
            );
    END IF;
END $$;

