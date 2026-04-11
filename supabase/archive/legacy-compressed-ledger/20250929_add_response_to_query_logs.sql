-- Add response column to query_logs table for conversation history
-- Migration: 20250929_add_response_to_query_logs

-- Add response column to store AI responses
ALTER TABLE query_logs
ADD COLUMN response TEXT;

-- Add AI mode column to track which AI engine was used
ALTER TABLE query_logs
ADD COLUMN ai_mode VARCHAR(20) DEFAULT 'LOCAL';

-- Add status column to track success/failure
ALTER TABLE query_logs
ADD COLUMN status VARCHAR(10) DEFAULT 'success';

-- Add user identification for guest users
ALTER TABLE query_logs
ADD COLUMN guest_user_id VARCHAR(255);

-- Update the constraint to allow either user_id or guest_user_id
ALTER TABLE query_logs
DROP CONSTRAINT IF EXISTS query_logs_user_check;

-- Add check constraint to ensure at least one user identifier exists
ALTER TABLE query_logs
ADD CONSTRAINT query_logs_user_check
CHECK (user_id IS NOT NULL OR guest_user_id IS NOT NULL);

-- Create index for AI mode and status
CREATE INDEX idx_query_logs_ai_mode ON query_logs(ai_mode);
CREATE INDEX idx_query_logs_status ON query_logs(status);
CREATE INDEX idx_query_logs_guest_user_id ON query_logs(guest_user_id);

-- Update RLS policies to allow access by guest_user_id
-- Allow users to insert logs with guest_user_id
CREATE POLICY "Users can insert logs with guest user ID"
  ON query_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL
    OR guest_user_id IS NOT NULL
  );

-- Allow users to view logs with guest_user_id
CREATE POLICY "Users can view logs with guest user ID"
  ON query_logs
  FOR SELECT
  TO authenticated, anon
  USING (
    auth.uid() = user_id
    OR user_id IS NULL
    OR guest_user_id IS NOT NULL
  );

-- Allow admin access to all conversation logs
-- (This assumes admin authentication is handled at application level)
CREATE POLICY "Admin access to all query logs"
  ON query_logs
  FOR ALL
  TO authenticated
  USING (
    -- Allow if user has admin role (check against user metadata or custom logic)
    auth.jwt() ->> 'role' = 'admin'
    OR auth.uid()::text IN (
      SELECT user_id::text FROM auth.users
      WHERE raw_user_meta_data ->> 'role' = 'admin'
    )
  );

-- Create a view for conversation history (admin use)
CREATE OR REPLACE VIEW conversation_history AS
SELECT
  id,
  COALESCE(guest_user_id, user_id::text, 'anonymous') as user_identifier,
  query,
  response,
  ai_mode,
  status,
  response_time,
  cache_hit,
  intent,
  created_at,
  session_id
FROM query_logs
WHERE response IS NOT NULL
ORDER BY created_at DESC;

-- Grant access to the conversation view
GRANT SELECT ON conversation_history TO authenticated;

-- Create function to get conversation history for admin
CREATE OR REPLACE FUNCTION get_conversation_history(
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0,
  filter_date_from TIMESTAMP DEFAULT NULL,
  filter_ai_mode VARCHAR DEFAULT NULL,
  filter_status VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_identifier TEXT,
  query TEXT,
  response TEXT,
  ai_mode VARCHAR,
  status VARCHAR,
  response_time INTEGER,
  cache_hit BOOLEAN,
  intent VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  session_id VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ch.id,
    ch.user_identifier,
    ch.query,
    ch.response,
    ch.ai_mode,
    ch.status,
    ch.response_time,
    ch.cache_hit,
    ch.intent,
    ch.created_at,
    ch.session_id
  FROM conversation_history ch
  WHERE
    (filter_date_from IS NULL OR ch.created_at >= filter_date_from)
    AND (filter_ai_mode IS NULL OR ch.ai_mode = filter_ai_mode)
    AND (filter_status IS NULL OR ch.status = filter_status)
  ORDER BY ch.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_conversation_history TO authenticated;

-- Create function to get admin statistics
CREATE OR REPLACE FUNCTION get_admin_stats(
  time_window INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE (
  total_queries BIGINT,
  active_users BIGINT,
  error_rate FLOAT,
  avg_response_time FLOAT,
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_queries,
    COUNT(DISTINCT COALESCE(guest_user_id, user_id::text)) as active_users,
    (COUNT(CASE WHEN status = 'error' THEN 1 END)::FLOAT / COUNT(*) * 100) as error_rate,
    AVG(response_time)::FLOAT as avg_response_time,
    NOW() as last_updated
  FROM query_logs
  WHERE created_at > NOW() - time_window;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the admin stats function
GRANT EXECUTE ON FUNCTION get_admin_stats TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN query_logs.response IS 'AI response text for conversation history';
COMMENT ON COLUMN query_logs.ai_mode IS 'AI engine used: LOCAL, GOOGLE_AI, etc.';
COMMENT ON COLUMN query_logs.status IS 'Query status: success, error';
COMMENT ON COLUMN query_logs.guest_user_id IS 'Guest user identifier for anonymous users';
COMMENT ON VIEW conversation_history IS 'Admin view of all AI conversations';
COMMENT ON FUNCTION get_conversation_history IS 'Get paginated conversation history for admin dashboard';
COMMENT ON FUNCTION get_admin_stats IS 'Get admin statistics for dashboard';