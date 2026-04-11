-- 20251124_create_command_vectors_table.sql
-- Canonical bootstrap for public.command_vectors (remote-schema rewrite)
-- Purpose: align local bootstrap ledger with the current hosted schema.
-- Notes:
-- - authoritative shape follows remote table, not the older 384d/HNSW local draft
-- - later hardening remains in 20260213_lockdown_command_vectors_rls.sql

CREATE TABLE IF NOT EXISTS public.command_vectors (
    id text PRIMARY KEY,
    content text NOT NULL,
    metadata jsonb NOT NULL,
    embedding vector(1024),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.command_vectors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF to_regclass('public.command_vectors') IS NOT NULL THEN
        DROP POLICY IF EXISTS "Users can insert their own command vectors" ON public.command_vectors;
        DROP POLICY IF EXISTS "Users can update their own command vectors" ON public.command_vectors;
        DROP POLICY IF EXISTS "Users can view their own command vectors" ON public.command_vectors;
        DROP POLICY IF EXISTS "Command vectors viewable by authenticated users" ON public.command_vectors;
        DROP POLICY IF EXISTS "Only service role can manage command vectors" ON public.command_vectors;
        DROP POLICY IF EXISTS "Service role full access" ON public.command_vectors;

        CREATE POLICY "Service role full access"
            ON public.command_vectors
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;
