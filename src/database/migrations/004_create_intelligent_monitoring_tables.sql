-- Intelligent Monitoring Tables for Predictive Analytics
-- Phase 3: Intelligent Monitoring Backend

-- Drop tables if exists (for development)
DROP TABLE IF EXISTS prediction_history;
DROP TABLE IF EXISTS adaptive_thresholds;
DROP TABLE IF EXISTS learned_patterns;
DROP TABLE IF EXISTS scaling_recommendations;

-- Prediction History Table
CREATE TABLE prediction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR(100) NOT NULL,
  metric_type VARCHAR(20) NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk', 'network')),
  
  -- Prediction details
  predicted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  prediction_horizon_hours INTEGER NOT NULL,
  predicted_value DECIMAL(5,2) NOT NULL,
  actual_value DECIMAL(5,2),
  confidence DECIMAL(3,2) NOT NULL,
  
  -- Accuracy tracking
  accuracy DECIMAL(3,2), -- Calculated after actual value is known
  error_margin DECIMAL(5,2),
  
  -- Metadata
  data_quality VARCHAR(20) CHECK (data_quality IN ('good', 'sufficient', 'limited')),
  model_version VARCHAR(20) DEFAULT 'v1.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT prediction_history_server_metric_time_key 
    UNIQUE (server_id, metric_type, predicted_at, prediction_horizon_hours)
);

-- Adaptive Thresholds Table
CREATE TABLE adaptive_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR(100) NOT NULL,
  metric_type VARCHAR(20) NOT NULL CHECK (metric_type IN ('cpu', 'memory', 'disk', 'network')),
  
  -- Threshold values
  warning_threshold DECIMAL(5,2) NOT NULL,
  critical_threshold DECIMAL(5,2) NOT NULL,
  
  -- Confidence intervals
  confidence_lower DECIMAL(5,2),
  confidence_upper DECIMAL(5,2),
  
  -- Context-aware thresholds
  context VARCHAR(50), -- e.g., 'business_hours', 'off_hours', 'peak_season'
  time_range_start TIME,
  time_range_end TIME,
  
  -- Learning metadata
  based_on_samples INTEGER NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  false_positive_rate DECIMAL(3,2),
  false_negative_rate DECIMAL(3,2),
  
  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint for active thresholds
  CONSTRAINT adaptive_thresholds_unique_active 
    UNIQUE (server_id, metric_type, context, is_active)
);

-- Learned Patterns Table
CREATE TABLE learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name VARCHAR(100) NOT NULL,
  pattern_type VARCHAR(50) NOT NULL, -- 'recurring', 'seasonal', 'anomaly', 'correlation'
  
  -- Pattern details
  description TEXT,
  pattern_data JSONB NOT NULL, -- Flexible structure for different pattern types
  
  -- Occurrence tracking
  frequency VARCHAR(50), -- 'hourly', 'daily', 'weekly', 'monthly'
  last_occurrence TIMESTAMP WITH TIME ZONE,
  next_predicted_occurrence TIMESTAMP WITH TIME ZONE,
  occurrence_count INTEGER DEFAULT 0,
  
  -- Pattern quality metrics
  confidence DECIMAL(3,2) NOT NULL,
  accuracy DECIMAL(3,2),
  precision_score DECIMAL(3,2),
  recall_score DECIMAL(3,2),
  
  -- Associated servers and metrics
  affected_servers TEXT[],
  affected_metrics TEXT[],
  
  -- Learning metadata
  first_detected TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_version VARCHAR(20) DEFAULT 'v1.0',
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  requires_review BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scaling Recommendations Table
CREATE TABLE scaling_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id VARCHAR(100) NOT NULL,
  
  -- Recommendation details
  action VARCHAR(20) NOT NULL CHECK (action IN ('scale_up', 'scale_down', 'scale_out', 'scale_in')),
  resource VARCHAR(50) NOT NULL, -- 'CPU', 'Memory', 'Instance', etc.
  amount VARCHAR(100) NOT NULL, -- '2 vCPUs', '4GB RAM', etc.
  
  -- Urgency and timing
  urgency VARCHAR(20) NOT NULL CHECK (urgency IN ('immediate', 'scheduled', 'optional')),
  recommended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  execute_at TIMESTAMP WITH TIME ZONE,
  
  -- Impact analysis
  cost_impact DECIMAL(10,2),
  expected_improvement TEXT,
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Execution tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'rejected', 'expired')),
  executed_at TIMESTAMP WITH TIME ZONE,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  execution_result JSONB,
  
  -- Validation
  valid_until TIMESTAMP WITH TIME ZONE,
  confidence DECIMAL(3,2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_prediction_history_server_id ON prediction_history(server_id);
CREATE INDEX idx_prediction_history_predicted_at ON prediction_history(predicted_at DESC);
CREATE INDEX idx_prediction_history_accuracy ON prediction_history(accuracy) WHERE accuracy IS NOT NULL;

CREATE INDEX idx_adaptive_thresholds_server_id ON adaptive_thresholds(server_id);
CREATE INDEX idx_adaptive_thresholds_active ON adaptive_thresholds(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_adaptive_thresholds_context ON adaptive_thresholds(context);

CREATE INDEX idx_learned_patterns_type ON learned_patterns(pattern_type);
CREATE INDEX idx_learned_patterns_active ON learned_patterns(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_learned_patterns_next_occurrence ON learned_patterns(next_predicted_occurrence);

CREATE INDEX idx_scaling_recommendations_server_id ON scaling_recommendations(server_id);
CREATE INDEX idx_scaling_recommendations_status ON scaling_recommendations(status);
CREATE INDEX idx_scaling_recommendations_urgency ON scaling_recommendations(urgency);
CREATE INDEX idx_scaling_recommendations_execute_at ON scaling_recommendations(execute_at);

-- Function to calculate prediction accuracy
CREATE OR REPLACE FUNCTION calculate_prediction_accuracy()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actual_value IS NOT NULL AND OLD.actual_value IS NULL THEN
    NEW.accuracy := 1 - (ABS(NEW.predicted_value - NEW.actual_value) / 100);
    NEW.error_margin := ABS(NEW.predicted_value - NEW.actual_value);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update prediction accuracy
CREATE TRIGGER update_prediction_accuracy
  BEFORE UPDATE ON prediction_history
  FOR EACH ROW
  EXECUTE FUNCTION calculate_prediction_accuracy();

-- Function to get prediction performance metrics
CREATE OR REPLACE FUNCTION get_prediction_performance(
  server_id_param VARCHAR(100) DEFAULT NULL,
  time_window INTERVAL DEFAULT INTERVAL '7 days'
)
RETURNS TABLE (
  metric_type VARCHAR(20),
  avg_accuracy DECIMAL(3,2),
  avg_confidence DECIMAL(3,2),
  total_predictions BIGINT,
  accurate_predictions BIGINT,
  avg_error_margin DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.metric_type,
    AVG(ph.accuracy)::DECIMAL(3,2) as avg_accuracy,
    AVG(ph.confidence)::DECIMAL(3,2) as avg_confidence,
    COUNT(*) as total_predictions,
    COUNT(CASE WHEN ph.accuracy > 0.8 THEN 1 END) as accurate_predictions,
    AVG(ph.error_margin)::DECIMAL(5,2) as avg_error_margin
  FROM prediction_history ph
  WHERE 
    (server_id_param IS NULL OR ph.server_id = server_id_param)
    AND ph.predicted_at > NOW() - time_window
    AND ph.actual_value IS NOT NULL
  GROUP BY ph.metric_type
  ORDER BY avg_accuracy DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get active patterns
CREATE OR REPLACE FUNCTION get_active_patterns(
  pattern_type_param VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  pattern_name VARCHAR(100),
  pattern_type VARCHAR(50),
  confidence DECIMAL(3,2),
  next_occurrence TIMESTAMP WITH TIME ZONE,
  affected_servers TEXT[],
  occurrence_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lp.pattern_name,
    lp.pattern_type,
    lp.confidence,
    lp.next_predicted_occurrence,
    lp.affected_servers,
    lp.occurrence_count
  FROM learned_patterns lp
  WHERE 
    lp.is_active = TRUE
    AND (pattern_type_param IS NULL OR lp.pattern_type = pattern_type_param)
    AND (lp.next_predicted_occurrence IS NULL OR lp.next_predicted_occurrence > NOW())
  ORDER BY lp.confidence DESC, lp.occurrence_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE adaptive_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE scaling_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to view all monitoring data
CREATE POLICY "Users can view prediction history"
  ON prediction_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert prediction history"
  ON prediction_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view adaptive thresholds"
  ON adaptive_thresholds
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage adaptive thresholds"
  ON adaptive_thresholds
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view learned patterns"
  ON learned_patterns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage learned patterns"
  ON learned_patterns
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view scaling recommendations"
  ON scaling_recommendations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage scaling recommendations"
  ON scaling_recommendations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role full access prediction_history"
  ON prediction_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access adaptive_thresholds"
  ON adaptive_thresholds
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access learned_patterns"
  ON learned_patterns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access scaling_recommendations"
  ON scaling_recommendations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON prediction_history TO authenticated;
GRANT INSERT ON prediction_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON adaptive_thresholds TO authenticated;
GRANT SELECT, INSERT, UPDATE ON learned_patterns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON scaling_recommendations TO authenticated;

GRANT EXECUTE ON FUNCTION get_prediction_performance TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_patterns TO authenticated;

-- Add comments
COMMENT ON TABLE prediction_history IS 'Stores prediction history for intelligent monitoring and accuracy tracking';
COMMENT ON TABLE adaptive_thresholds IS 'Stores dynamically calculated thresholds based on historical patterns';
COMMENT ON TABLE learned_patterns IS 'Stores discovered patterns from machine learning analysis';
COMMENT ON TABLE scaling_recommendations IS 'Stores auto-generated scaling recommendations based on predictions';

COMMENT ON COLUMN prediction_history.accuracy IS 'Calculated accuracy after actual value is known (1 - error_rate)';
COMMENT ON COLUMN adaptive_thresholds.context IS 'Context for threshold application (business_hours, off_hours, etc.)';
COMMENT ON COLUMN learned_patterns.pattern_data IS 'Flexible JSONB structure containing pattern-specific data';
COMMENT ON COLUMN scaling_recommendations.cost_impact IS 'Estimated monthly cost impact in USD';