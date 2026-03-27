-- Query Logs Table for AI Query Pattern Analysis
-- Phase 1: Natural Language Query Enhancement

-- Drop table if exists (for development)
DROP TABLE IF EXISTS query_logs;

-- Create query_logs table
CREATE TABLE query_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  response_time INTEGER NOT NULL, -- in milliseconds
  cache_hit BOOLEAN DEFAULT FALSE,
  intent VARCHAR(50) DEFAULT 'general', -- metric_query, status_check, incident_history, optimization, general
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Additional metadata for future analysis
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  query_hash VARCHAR(32), -- MD5 hash for deduplication
  error_message TEXT,
  
  -- Indexing for performance
  CONSTRAINT query_logs_response_time_check CHECK (response_time >= 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_query_logs_created_at ON query_logs(created_at DESC);
CREATE INDEX idx_query_logs_intent ON query_logs(intent);
CREATE INDEX idx_query_logs_cache_hit ON query_logs(cache_hit);
CREATE INDEX idx_query_logs_response_time ON query_logs(response_time);
CREATE INDEX idx_query_logs_query_hash ON query_logs(query_hash);

-- Create a view for query statistics
CREATE OR REPLACE VIEW query_statistics AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  intent,
  COUNT(*) as query_count,
  AVG(response_time) as avg_response_time,
  MIN(response_time) as min_response_time,
  MAX(response_time) as max_response_time,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100 as cache_hit_rate
FROM query_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), intent
ORDER BY hour DESC;

-- Create a function to get popular queries
CREATE OR REPLACE FUNCTION get_popular_queries(
  time_window INTERVAL DEFAULT INTERVAL '24 hours',
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  query TEXT,
  query_count BIGINT,
  avg_response_time FLOAT,
  cache_hit_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ql.query,
    COUNT(*) as query_count,
    AVG(ql.response_time)::FLOAT as avg_response_time,
    (SUM(CASE WHEN ql.cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100) as cache_hit_rate
  FROM query_logs ql
  WHERE ql.created_at > NOW() - time_window
  GROUP BY ql.query
  ORDER BY query_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to analyze query patterns
CREATE OR REPLACE FUNCTION analyze_query_patterns(
  time_window INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE (
  intent VARCHAR(50),
  total_queries BIGINT,
  avg_response_time FLOAT,
  cache_hit_rate FLOAT,
  p95_response_time FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ql.intent,
    COUNT(*) as total_queries,
    AVG(ql.response_time)::FLOAT as avg_response_time,
    (SUM(CASE WHEN ql.cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) * 100) as cache_hit_rate,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ql.response_time)::FLOAT as p95_response_time
  FROM query_logs ql
  WHERE ql.created_at > NOW() - time_window
  GROUP BY ql.intent
  ORDER BY total_queries DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE query_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow authenticated users to insert their own logs
CREATE POLICY "Users can insert their own query logs"
  ON query_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow authenticated users to view their own logs
CREATE POLICY "Users can view their own query logs"
  ON query_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Allow service role full access
CREATE POLICY "Service role has full access to query logs"
  ON query_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON query_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_popular_queries TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_query_patterns TO authenticated;

-- Add comment to table
COMMENT ON TABLE query_logs IS 'Stores AI query logs for pattern analysis and performance monitoring';
COMMENT ON COLUMN query_logs.intent IS 'Query intent classification: metric_query, status_check, incident_history, optimization, general';
COMMENT ON COLUMN query_logs.response_time IS 'Response time in milliseconds';
COMMENT ON COLUMN query_logs.cache_hit IS 'Whether the query was served from cache';