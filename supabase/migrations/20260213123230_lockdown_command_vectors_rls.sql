-- =============================================================================
-- Lock Down command_vectors RLS (Deprecated Runtime Path)
-- =============================================================================
-- Purpose:
-- - command_vectors is no longer a primary runtime retrieval source.
-- - Keep table for compatibility/history, but restrict writes/reads to service_role.
-- =============================================================================

DO $$
BEGIN
    IF to_regclass('public.command_vectors') IS NOT NULL THEN
        -- Remove legacy permissive user policies
        DROP POLICY IF EXISTS "Users can insert their own command vectors" ON public.command_vectors;
        DROP POLICY IF EXISTS "Users can update their own command vectors" ON public.command_vectors;
        DROP POLICY IF EXISTS "Users can view their own command vectors" ON public.command_vectors;
        DROP POLICY IF EXISTS "Command vectors viewable by authenticated users" ON public.command_vectors;
        DROP POLICY IF EXISTS "Only service role can manage command vectors" ON public.command_vectors;

        -- Single minimal policy for service role only
        CREATE POLICY "Service role full access"
            ON public.command_vectors
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

