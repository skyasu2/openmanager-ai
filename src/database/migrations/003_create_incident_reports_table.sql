-- Incident Reports Table for Automatic Incident Detection
-- Phase 2: Auto Incident Report Backend

-- Drop table if exists (for development)
DROP TABLE IF EXISTS incident_reports;

-- Create incident_reports table
CREATE TABLE incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  pattern VARCHAR(50), -- cascade_failure, network_saturation, resource_exhaustion, isolated_spike
  
  -- Affected servers
  affected_servers TEXT[] NOT NULL DEFAULT '{}',
  
  -- Anomalies (stored as JSONB for flexibility)
  anomalies JSONB NOT NULL DEFAULT '[]',
  
  -- Root cause analysis
  root_cause_analysis JSONB NOT NULL DEFAULT '{}',
  
  -- Recommendations
  recommendations JSONB NOT NULL DEFAULT '[]',
  
  -- Timeline of events
  timeline JSONB NOT NULL DEFAULT '[]',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Resolution details
  resolution_notes TEXT,
  resolution_actions JSONB DEFAULT '[]',
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  
  -- Notification tracking
  notifications_sent BOOLEAN DEFAULT FALSE,
  notification_channels TEXT[] DEFAULT '{}',
  last_notification_at TIMESTAMP WITH TIME ZONE,
  
  -- Performance metrics
  detection_time_ms INTEGER,
  generation_time_ms INTEGER,
  
  -- User association
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX idx_incident_reports_created_at ON incident_reports(created_at DESC);
CREATE INDEX idx_incident_reports_severity ON incident_reports(severity);
CREATE INDEX idx_incident_reports_status ON incident_reports(status);
CREATE INDEX idx_incident_reports_pattern ON incident_reports(pattern);
CREATE INDEX idx_incident_reports_affected_servers ON incident_reports USING GIN(affected_servers);

-- Create a view for incident statistics
CREATE OR REPLACE VIEW incident_statistics AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  severity,
  pattern,
  COUNT(*) as incident_count,
  AVG(CASE 
    WHEN resolved_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 
    ELSE NULL 
  END) as avg_resolution_hours,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END)::FLOAT / COUNT(*) * 100 as resolution_rate
FROM incident_reports
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at), severity, pattern
ORDER BY day DESC;

-- Function to get incident trends
CREATE OR REPLACE FUNCTION get_incident_trends(
  time_window INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS TABLE (
  period TIMESTAMP WITH TIME ZONE,
  critical_count BIGINT,
  high_count BIGINT,
  medium_count BIGINT,
  low_count BIGINT,
  total_count BIGINT,
  avg_anomalies_per_incident FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE_TRUNC('hour', created_at) as period,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
    COUNT(*) as total_count,
    AVG(jsonb_array_length(anomalies))::FLOAT as avg_anomalies_per_incident
  FROM incident_reports
  WHERE created_at > NOW() - time_window
  GROUP BY DATE_TRUNC('hour', created_at)
  ORDER BY period DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get pattern analysis
CREATE OR REPLACE FUNCTION analyze_incident_patterns(
  time_window INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS TABLE (
  pattern VARCHAR(50),
  occurrence_count BIGINT,
  affected_servers_total BIGINT,
  avg_severity_score FLOAT,
  most_common_time_of_day INTEGER,
  prediction_accuracy FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ir.pattern,
    COUNT(*) as occurrence_count,
    COUNT(DISTINCT unnest(ir.affected_servers)) as affected_servers_total,
    AVG(CASE 
      WHEN ir.severity = 'critical' THEN 4
      WHEN ir.severity = 'high' THEN 3
      WHEN ir.severity = 'medium' THEN 2
      WHEN ir.severity = 'low' THEN 1
      ELSE 0
    END)::FLOAT as avg_severity_score,
    MODE() WITHIN GROUP (ORDER BY EXTRACT(HOUR FROM ir.created_at))::INTEGER as most_common_time_of_day,
    -- Placeholder for prediction accuracy (would be calculated from actual predictions)
    0.75::FLOAT as prediction_accuracy
  FROM incident_reports ir
  WHERE ir.created_at > NOW() - time_window
    AND ir.pattern IS NOT NULL
  GROUP BY ir.pattern
  ORDER BY occurrence_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get server incident history
CREATE OR REPLACE FUNCTION get_server_incident_history(
  server_id_param TEXT,
  time_window INTERVAL DEFAULT INTERVAL '30 days'
)
RETURNS TABLE (
  incident_id UUID,
  title TEXT,
  severity VARCHAR(20),
  pattern VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20),
  anomaly_details JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ir.id as incident_id,
    ir.title,
    ir.severity,
    ir.pattern,
    ir.created_at,
    ir.status,
    (
      SELECT jsonb_agg(anomaly)
      FROM jsonb_array_elements(ir.anomalies) anomaly
      WHERE anomaly->>'server_id' = server_id_param
    ) as anomaly_details
  FROM incident_reports ir
  WHERE server_id_param = ANY(ir.affected_servers)
    AND ir.created_at > NOW() - time_window
  ORDER BY ir.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to view all reports
CREATE POLICY "Users can view all incident reports"
  ON incident_reports
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create reports
CREATE POLICY "Users can create incident reports"
  ON incident_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their assigned reports
CREATE POLICY "Users can update assigned reports"
  ON incident_reports
  FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (assigned_to = auth.uid() OR created_by = auth.uid());

-- Service role has full access
CREATE POLICY "Service role has full access to incident reports"
  ON incident_reports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON incident_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_incident_trends TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_incident_patterns TO authenticated;
GRANT EXECUTE ON FUNCTION get_server_incident_history TO authenticated;

-- Add comments
COMMENT ON TABLE incident_reports IS 'Stores automatic incident reports generated from server anomaly detection';
COMMENT ON COLUMN incident_reports.severity IS 'Incident severity: critical, high, medium, low';
COMMENT ON COLUMN incident_reports.pattern IS 'Detected pattern: cascade_failure, network_saturation, resource_exhaustion, isolated_spike';
COMMENT ON COLUMN incident_reports.anomalies IS 'JSON array of detected anomalies with server, metric, value, and threshold information';
COMMENT ON COLUMN incident_reports.root_cause_analysis IS 'AI-generated root cause analysis with primary cause, contributing factors, and confidence';
COMMENT ON COLUMN incident_reports.recommendations IS 'JSON array of recommended actions with priority and expected impact';