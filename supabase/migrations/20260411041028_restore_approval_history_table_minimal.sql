-- =============================================================================
-- Restore approval_history table for approval audit/runtime path
-- =============================================================================
-- Purpose:
-- - Remote DB still has approval enums/functions, but the approval_history table
--   is missing.
-- - AI Engine approval persistence and stats/history queries depend on this table.
-- - This migration restores only the missing table, indexes, trigger, and RLS.
--
-- Scope:
-- - No enum recreation
-- - No get_approval_history/get_approval_stats redefinition
-- - No orphan function cleanup
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    action_type approval_action_type NOT NULL,
    description TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status approval_status NOT NULL DEFAULT 'pending',
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_session_id
    ON public.approval_history(session_id);

CREATE INDEX IF NOT EXISTS idx_approval_history_status
    ON public.approval_history(status);

CREATE INDEX IF NOT EXISTS idx_approval_history_action_type
    ON public.approval_history(action_type);

CREATE INDEX IF NOT EXISTS idx_approval_history_requested_at
    ON public.approval_history(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_history_decided_at
    ON public.approval_history(decided_at DESC)
    WHERE decided_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_history_status_time
    ON public.approval_history(status, requested_at DESC);

CREATE OR REPLACE FUNCTION public.update_approval_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_approval_history_updated_at ON public.approval_history;

CREATE TRIGGER trigger_approval_history_updated_at
    BEFORE UPDATE ON public.approval_history
    FOR EACH ROW
    EXECUTE FUNCTION public.update_approval_history_updated_at();

ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'approval_history'
          AND policyname = 'Service role full access'
    ) THEN
        EXECUTE $policy$
            CREATE POLICY "Service role full access" ON public.approval_history
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role')
        $policy$;
    END IF;
END $$;

COMMENT ON TABLE public.approval_history IS 'Audit log for Human-in-the-Loop approval decisions';
COMMENT ON COLUMN public.approval_history.session_id IS 'Unique session identifier from supervisor';
COMMENT ON COLUMN public.approval_history.payload IS 'JSON payload of the action (report content, commands, etc.)';
COMMENT ON COLUMN public.approval_history.metadata IS 'Additional metadata for audit and analytics';
