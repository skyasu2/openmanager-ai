-- =============================================================================
-- Approval History Table for Audit Trail
-- =============================================================================
-- Purpose: Persist all Human-in-the-Loop approval decisions for auditing
--          and analytics. This complements the ephemeral Redis state.
--
-- Architecture:
-- - Redis (Upstash): Real-time state for active approvals (TTL: 5 min)
-- - PostgreSQL: Permanent audit log of all decisions
--
-- Cost Impact: $0 (uses existing Supabase PostgreSQL)
-- =============================================================================

-- Create enum for action types
DO $$ BEGIN
    CREATE TYPE approval_action_type AS ENUM (
        'incident_report',
        'system_command',
        'critical_alert'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for decision status
DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM (
        'pending',
        'approved',
        'rejected',
        'expired',
        'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create approval_history table
CREATE TABLE IF NOT EXISTS approval_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Session identification
    session_id TEXT NOT NULL,

    -- Request details
    action_type approval_action_type NOT NULL,
    description TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,

    -- Requester info
    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Decision info
    status approval_status NOT NULL DEFAULT 'pending',
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    reason TEXT,

    -- Metadata
    expires_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_approval_history_session_id
    ON approval_history(session_id);

CREATE INDEX IF NOT EXISTS idx_approval_history_status
    ON approval_history(status);

CREATE INDEX IF NOT EXISTS idx_approval_history_action_type
    ON approval_history(action_type);

CREATE INDEX IF NOT EXISTS idx_approval_history_requested_at
    ON approval_history(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_history_decided_at
    ON approval_history(decided_at DESC)
    WHERE decided_at IS NOT NULL;

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_approval_history_status_time
    ON approval_history(status, requested_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_approval_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_approval_history_updated_at ON approval_history;
CREATE TRIGGER trigger_approval_history_updated_at
    BEFORE UPDATE ON approval_history
    FOR EACH ROW
    EXECUTE FUNCTION update_approval_history_updated_at();

-- =============================================================================
-- Query Functions
-- =============================================================================

-- Function: Get approval history with pagination
CREATE OR REPLACE FUNCTION get_approval_history(
    p_status approval_status DEFAULT NULL,
    p_action_type approval_action_type DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0,
    p_from_date TIMESTAMPTZ DEFAULT NULL,
    p_to_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    session_id TEXT,
    action_type approval_action_type,
    description TEXT,
    status approval_status,
    requested_by TEXT,
    requested_at TIMESTAMPTZ,
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ah.id,
        ah.session_id,
        ah.action_type,
        ah.description,
        ah.status,
        ah.requested_by,
        ah.requested_at,
        ah.decided_by,
        ah.decided_at,
        ah.reason
    FROM approval_history ah
    WHERE (p_status IS NULL OR ah.status = p_status)
      AND (p_action_type IS NULL OR ah.action_type = p_action_type)
      AND (p_from_date IS NULL OR ah.requested_at >= p_from_date)
      AND (p_to_date IS NULL OR ah.requested_at <= p_to_date)
    ORDER BY ah.requested_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function: Get approval statistics
CREATE OR REPLACE FUNCTION get_approval_stats(
    p_days INT DEFAULT 7
)
RETURNS TABLE (
    total_requests BIGINT,
    approved_count BIGINT,
    rejected_count BIGINT,
    expired_count BIGINT,
    pending_count BIGINT,
    approval_rate NUMERIC,
    avg_decision_time_seconds NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'approved') as approved,
            COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
            COUNT(*) FILTER (WHERE status = 'expired') as expired,
            COUNT(*) FILTER (WHERE status = 'pending') as pending,
            AVG(EXTRACT(EPOCH FROM (decided_at - requested_at)))
                FILTER (WHERE decided_at IS NOT NULL) as avg_decision_time
        FROM approval_history
        WHERE requested_at >= NOW() - (p_days || ' days')::INTERVAL
    )
    SELECT
        stats.total as total_requests,
        stats.approved as approved_count,
        stats.rejected as rejected_count,
        stats.expired as expired_count,
        stats.pending as pending_count,
        CASE
            WHEN (stats.approved + stats.rejected) > 0
            THEN ROUND(stats.approved::NUMERIC / (stats.approved + stats.rejected) * 100, 2)
            ELSE 0
        END as approval_rate,
        ROUND(COALESCE(stats.avg_decision_time, 0)::NUMERIC, 2) as avg_decision_time_seconds
    FROM stats;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Enable RLS
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access for authenticated" ON approval_history
    FOR SELECT USING (true);

-- Allow insert/update for service role only
CREATE POLICY "Allow write for service role" ON approval_history
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE approval_history IS 'Audit log for Human-in-the-Loop approval decisions';
COMMENT ON COLUMN approval_history.session_id IS 'Unique session identifier from supervisor';
COMMENT ON COLUMN approval_history.payload IS 'JSON payload of the action (report content, commands, etc.)';
COMMENT ON COLUMN approval_history.metadata IS 'Additional metadata (IP, user-agent, etc.)';
COMMENT ON FUNCTION get_approval_history IS 'Paginated approval history query';
COMMENT ON FUNCTION get_approval_stats IS 'Approval statistics for dashboard';
