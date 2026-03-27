-- ============================================================================
-- Migration: 005_ai_jobs_table.sql
-- Purpose: Create ai_jobs table for async AI Job Queue
-- Task: AI Job Queue Integration
-- Date: 2025-12-23
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Create ENUM types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_type AS ENUM ('analysis', 'report', 'optimization', 'prediction', 'general');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Create ai_jobs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  type job_type NOT NULL DEFAULT 'general',
  query TEXT NOT NULL,
  priority job_priority NOT NULL DEFAULT 'normal',
  status job_status NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step VARCHAR(255),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================================
-- 3. Create indexes for performance
-- ============================================================================

-- Index for status-based queries (most common: get queued jobs)
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status
  ON ai_jobs(status);

-- Index for user job lookups
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_id
  ON ai_jobs(user_id) WHERE user_id IS NOT NULL;

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_ai_jobs_session_id
  ON ai_jobs(session_id) WHERE session_id IS NOT NULL;

-- Index for priority queue processing (get highest priority queued jobs first)
CREATE INDEX IF NOT EXISTS idx_ai_jobs_queue_priority
  ON ai_jobs(priority DESC, created_at ASC)
  WHERE status = 'queued';

-- Index for job history/cleanup
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at
  ON ai_jobs(created_at DESC);

-- Composite index for user's recent jobs
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_recent
  ON ai_jobs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- 4. Create helper functions
-- ============================================================================

-- Get next job to process (highest priority, oldest first)
CREATE OR REPLACE FUNCTION get_next_job()
RETURNS ai_jobs AS $$
DECLARE
  next_job ai_jobs;
BEGIN
  SELECT * INTO next_job
  FROM ai_jobs
  WHERE status = 'queued'
  ORDER BY
    CASE priority
      WHEN 'high' THEN 1
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 3
    END,
    created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE ai_jobs
    SET status = 'processing',
        started_at = NOW()
    WHERE id = next_job.id;

    next_job.status := 'processing';
    next_job.started_at := NOW();
  END IF;

  RETURN next_job;
END;
$$ LANGUAGE plpgsql;

-- Update job progress
CREATE OR REPLACE FUNCTION update_job_progress(
  p_job_id UUID,
  p_progress INTEGER,
  p_current_step VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_jobs
  SET progress = p_progress,
      current_step = COALESCE(p_current_step, current_step)
  WHERE id = p_job_id AND status = 'processing';
END;
$$ LANGUAGE plpgsql;

-- Complete job
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_jobs
  SET status = 'completed',
      progress = 100,
      result = p_result,
      completed_at = NOW(),
      current_step = NULL
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Fail job
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_jobs
  SET status = 'failed',
      error = p_error,
      completed_at = NOW(),
      current_step = NULL
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old completed/failed jobs (older than 7 days by default)
CREATE OR REPLACE FUNCTION cleanup_old_jobs(p_retention_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - (p_retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % old job entries', deleted_count;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own jobs
CREATE POLICY ai_jobs_user_read ON ai_jobs
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR user_id IS NULL  -- Anonymous jobs are visible
    OR auth.role() = 'service_role'
  );

-- Policy: Users can create jobs
CREATE POLICY ai_jobs_user_insert ON ai_jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL  -- Allow anonymous job creation
    OR auth.role() = 'service_role'
  );

-- Policy: Service role can do everything
CREATE POLICY ai_jobs_service_all ON ai_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON TABLE ai_jobs IS
  'Async AI Job Queue for heavy processing tasks';

COMMENT ON COLUMN ai_jobs.id IS
  'Unique job identifier (UUID)';

COMMENT ON COLUMN ai_jobs.user_id IS
  'User who created the job (nullable for anonymous)';

COMMENT ON COLUMN ai_jobs.session_id IS
  'Session identifier for grouping related jobs';

COMMENT ON COLUMN ai_jobs.type IS
  'Job type: analysis, report, optimization, prediction, general';

COMMENT ON COLUMN ai_jobs.query IS
  'User query or task description';

COMMENT ON COLUMN ai_jobs.priority IS
  'Job priority for queue ordering: low, normal, high';

COMMENT ON COLUMN ai_jobs.status IS
  'Job status: queued, processing, completed, failed, cancelled';

COMMENT ON COLUMN ai_jobs.progress IS
  'Processing progress percentage (0-100)';

COMMENT ON COLUMN ai_jobs.current_step IS
  'Current processing step description';

COMMENT ON COLUMN ai_jobs.result IS
  'JSON result from AI processing';

COMMENT ON COLUMN ai_jobs.error IS
  'Error message if job failed';

COMMENT ON COLUMN ai_jobs.metadata IS
  'Additional job metadata (JSON)';

COMMENT ON FUNCTION get_next_job() IS
  'Get and lock the next job to process (priority queue)';

COMMENT ON FUNCTION update_job_progress(UUID, INTEGER, VARCHAR) IS
  'Update job progress and current step';

COMMENT ON FUNCTION complete_job(UUID, JSONB) IS
  'Mark job as completed with result';

COMMENT ON FUNCTION fail_job(UUID, TEXT) IS
  'Mark job as failed with error message';

COMMENT ON FUNCTION cleanup_old_jobs(INTEGER) IS
  'Remove old completed/failed jobs (default: 7 days retention)';
