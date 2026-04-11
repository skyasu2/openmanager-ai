-- ============================================================================
-- Server Metrics History Table
-- Purpose: Store historical server metrics for AI analysis and anomaly detection
-- Pattern: Based on FIXED_24H_DATASETS structure
-- Free Tier: 500MB DB limit → Retention policy needed for production
-- ============================================================================

-- 1. server_metrics_history 테이블 생성
CREATE TABLE IF NOT EXISTS server_metrics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Server Identification
    server_id TEXT NOT NULL,
    server_type TEXT DEFAULT 'unknown', -- web, database, application, storage, cache, loadbalancer

    -- Metrics (0-100 percentage values)
    cpu FLOAT CHECK (cpu >= 0 AND cpu <= 100),
    memory FLOAT CHECK (memory >= 0 AND memory <= 100),
    disk FLOAT CHECK (disk >= 0 AND disk <= 100),
    network FLOAT CHECK (network >= 0 AND network <= 100),

    -- Status
    status TEXT DEFAULT 'normal', -- normal, warning, critical, maintenance

    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for efficient querying
-- Primary query pattern: Get metrics for a server within a time range
CREATE INDEX IF NOT EXISTS idx_metrics_server_time
ON server_metrics_history(server_id, timestamp DESC);

-- For anomaly detection: Query by timestamp range across all servers
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp
ON server_metrics_history(timestamp DESC);

-- For filtering by server type
CREATE INDEX IF NOT EXISTS idx_metrics_server_type
ON server_metrics_history(server_type);

-- For status-based queries
CREATE INDEX IF NOT EXISTS idx_metrics_status
ON server_metrics_history(status);

-- 3. Partitioning hint (for future optimization)
-- COMMENT: Consider time-based partitioning if data grows significantly

-- 4. RLS Policies
ALTER TABLE server_metrics_history ENABLE ROW LEVEL SECURITY;

-- Service Role has full access (Cloud Run AI Engine)
CREATE POLICY "Service role full access" ON server_metrics_history
    FOR ALL
    USING (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated read access" ON server_metrics_history
    FOR SELECT
    TO authenticated
    USING (true);

-- Anon users can also read (for dashboard)
CREATE POLICY "Anon read access" ON server_metrics_history
    FOR SELECT
    TO anon
    USING (true);

-- 5. Helper function for anomaly detection window
CREATE OR REPLACE FUNCTION get_metrics_window(
    p_server_id TEXT,
    p_window_hours INTEGER DEFAULT 6,
    p_interval_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
    recorded_at TIMESTAMPTZ,
    cpu FLOAT,
    memory FLOAT,
    disk FLOAT,
    network FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.timestamp AS recorded_at,
        m.cpu,
        m.memory,
        m.disk,
        m.network
    FROM server_metrics_history m
    WHERE m.server_id = p_server_id
      AND m.timestamp > NOW() - (p_window_hours || ' hours')::INTERVAL
    ORDER BY m.timestamp ASC;
END;
$$;

-- 6. Cleanup function for old data (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_metrics(
    retention_days INTEGER DEFAULT 7
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM server_metrics_history
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 7. Comments
COMMENT ON TABLE server_metrics_history IS 'Historical server metrics for AI anomaly detection (6-hour window analysis)';
COMMENT ON COLUMN server_metrics_history.timestamp IS 'When the metric was recorded';
COMMENT ON FUNCTION get_metrics_window IS 'Get metrics window for SimpleAnomalyDetector (default: 6 hours, 10-min intervals = 36 points)';
COMMENT ON FUNCTION cleanup_old_metrics IS 'Cleanup metrics older than retention_days (default: 7 days)';
