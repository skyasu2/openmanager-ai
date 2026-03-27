-- ============================================================================
-- Server Logs Table
-- Purpose: Store server monitoring logs for dashboard display
-- Pattern: Same as server_metrics_history
-- Free Tier: 500MB DB limit → 7-day retention policy
-- ============================================================================

-- 1. server_logs 테이블 생성
CREATE TABLE IF NOT EXISTS server_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Server Identification
    server_id TEXT NOT NULL,

    -- Log Info
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
    message TEXT NOT NULL,
    source TEXT DEFAULT 'system',

    -- Context (optional JSON for additional data)
    context JSONB,

    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for efficient querying
-- Primary query: Get logs for a server within a time range
CREATE INDEX IF NOT EXISTS idx_logs_server_time
ON server_logs(server_id, timestamp DESC);

-- For filtering by log level
CREATE INDEX IF NOT EXISTS idx_logs_level
ON server_logs(level);

-- For timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_logs_timestamp
ON server_logs(timestamp DESC);

-- 3. RLS Policies
ALTER TABLE server_logs ENABLE ROW LEVEL SECURITY;

-- Service Role has full access (for API writes)
CREATE POLICY "Service role full access" ON server_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated read access" ON server_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Anon users can also read (for dashboard)
CREATE POLICY "Anon read access" ON server_logs
    FOR SELECT
    TO anon
    USING (true);

-- Anon users can insert (for logging from client)
CREATE POLICY "Anon insert access" ON server_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 4. Helper function to get recent logs for a server
CREATE OR REPLACE FUNCTION get_server_logs(
    p_server_id TEXT,
    p_limit INTEGER DEFAULT 50,
    p_level TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    level TEXT,
    message TEXT,
    source TEXT,
    context JSONB,
    log_timestamp TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id,
        l.level,
        l.message,
        l.source,
        l.context,
        l.timestamp
    FROM server_logs l
    WHERE l.server_id = p_server_id
      AND (p_level IS NULL OR l.level = p_level)
    ORDER BY l.timestamp DESC
    LIMIT p_limit;
END;
$$;

-- 5. Cleanup function for old logs (retention policy: 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_logs(
    retention_days INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM server_logs
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 6. Function to add a log entry
CREATE OR REPLACE FUNCTION add_server_log(
    p_server_id TEXT,
    p_level TEXT,
    p_message TEXT,
    p_source TEXT DEFAULT 'system',
    p_context JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO server_logs (server_id, level, message, source, context, timestamp)
    VALUES (p_server_id, p_level, p_message, p_source, p_context, NOW())
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

-- 7. Comments
COMMENT ON TABLE server_logs IS 'Server monitoring logs for dashboard display (7-day retention)';
COMMENT ON COLUMN server_logs.level IS 'Log level: info, warn, error';
COMMENT ON COLUMN server_logs.source IS 'Log source: system, api, monitoring, etc.';
COMMENT ON FUNCTION get_server_logs IS 'Get recent logs for a specific server';
COMMENT ON FUNCTION cleanup_old_logs IS 'Cleanup logs older than retention_days (default: 7 days)';
COMMENT ON FUNCTION add_server_log IS 'Add a new log entry for a server';
