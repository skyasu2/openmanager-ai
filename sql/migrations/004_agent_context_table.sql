-- ============================================================================
-- Migration: 004_agent_context_table.sql
-- Purpose: Create agent_context table for storing LangGraph agent session context
-- Task: Task 4 - PostgreSQL Context Table
-- Date: 2025-12-23
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Create agent_context table
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_context (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL,
  agent_type VARCHAR(50) NOT NULL,
  result JSONB NOT NULL,
  context_type VARCHAR(50) DEFAULT 'agent_result',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 hour',

  -- Constraints
  CONSTRAINT valid_agent_type CHECK (
    agent_type IN ('nlq', 'analyst', 'reporter', 'verifier', 'supervisor')
  ),
  CONSTRAINT valid_context_type CHECK (
    context_type IN ('agent_result', 'tool_output', 'verification', 'shared_context')
  )
);

-- ============================================================================
-- 2. Create indexes for performance
-- ============================================================================

-- Index for session lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_agent_context_session
  ON agent_context(session_id);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_agent_context_expires
  ON agent_context(expires_at);

-- Composite index for session + agent type lookups
CREATE INDEX IF NOT EXISTS idx_agent_context_session_agent
  ON agent_context(session_id, agent_type);

-- Index for recent context lookups
CREATE INDEX IF NOT EXISTS idx_agent_context_created
  ON agent_context(created_at DESC);

-- ============================================================================
-- 3. Create cleanup function
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_agent_context()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM agent_context
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % expired agent context entries', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Create helper functions
-- ============================================================================

-- Get latest context for a session
CREATE OR REPLACE FUNCTION get_session_context(p_session_id VARCHAR)
RETURNS TABLE (
  agent_type VARCHAR(50),
  result JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (ac.agent_type)
    ac.agent_type,
    ac.result,
    ac.created_at
  FROM agent_context ac
  WHERE ac.session_id = p_session_id
    AND ac.expires_at > NOW()
  ORDER BY ac.agent_type, ac.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Save context for an agent
CREATE OR REPLACE FUNCTION save_agent_context(
  p_session_id VARCHAR,
  p_agent_type VARCHAR,
  p_result JSONB,
  p_context_type VARCHAR DEFAULT 'agent_result',
  p_ttl_hours INTEGER DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO agent_context (
    session_id,
    agent_type,
    result,
    context_type,
    expires_at
  ) VALUES (
    p_session_id,
    p_agent_type,
    p_result,
    p_context_type,
    NOW() + (p_ttl_hours || ' hours')::INTERVAL
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE agent_context ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role
CREATE POLICY agent_context_service_policy ON agent_context
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON TABLE agent_context IS
  'Stores LangGraph multi-agent session context for result sharing between agents';

COMMENT ON COLUMN agent_context.session_id IS
  'Unique identifier for the conversation/session';

COMMENT ON COLUMN agent_context.agent_type IS
  'Type of agent that produced this context (nlq, analyst, reporter, verifier)';

COMMENT ON COLUMN agent_context.result IS
  'JSON result from the agent, structure varies by agent_type';

COMMENT ON COLUMN agent_context.context_type IS
  'Type of context entry (agent_result, tool_output, verification, shared_context)';

COMMENT ON COLUMN agent_context.expires_at IS
  'TTL timestamp, entries older than this are eligible for cleanup';

COMMENT ON FUNCTION cleanup_expired_agent_context() IS
  'Removes expired context entries, call periodically via cron or pg_cron';

COMMENT ON FUNCTION get_session_context(VARCHAR) IS
  'Get latest context for each agent type in a session';

COMMENT ON FUNCTION save_agent_context(VARCHAR, VARCHAR, JSONB, VARCHAR, INTEGER) IS
  'Save agent context with configurable TTL (default 1 hour)';
