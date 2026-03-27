-- ============================================================================
-- Migration: 006_drop_ai_jobs_table.sql
-- Purpose: Remove ai_jobs table (migrated to Redis Only)
-- Task: Job Queue Redis Migration
-- Date: 2026-01-26
-- ============================================================================

-- ⚠️ WARNING: This migration drops the ai_jobs table and related objects.
-- Make sure all data has been migrated to Redis before running this.

-- ============================================================================
-- 1. Drop RLS policies
-- ============================================================================

DROP POLICY IF EXISTS ai_jobs_user_read ON ai_jobs;
DROP POLICY IF EXISTS ai_jobs_user_insert ON ai_jobs;
DROP POLICY IF EXISTS ai_jobs_service_all ON ai_jobs;

-- ============================================================================
-- 2. Drop helper functions
-- ============================================================================

DROP FUNCTION IF EXISTS get_next_job();
DROP FUNCTION IF EXISTS update_job_progress(UUID, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS complete_job(UUID, JSONB);
DROP FUNCTION IF EXISTS fail_job(UUID, TEXT);
DROP FUNCTION IF EXISTS cleanup_old_jobs(INTEGER);

-- ============================================================================
-- 3. Drop indexes (will be dropped with table, but explicit for clarity)
-- ============================================================================

DROP INDEX IF EXISTS idx_ai_jobs_status;
DROP INDEX IF EXISTS idx_ai_jobs_user_id;
DROP INDEX IF EXISTS idx_ai_jobs_session_id;
DROP INDEX IF EXISTS idx_ai_jobs_queue_priority;
DROP INDEX IF EXISTS idx_ai_jobs_created_at;
DROP INDEX IF EXISTS idx_ai_jobs_user_recent;

-- ============================================================================
-- 4. Drop table
-- ============================================================================

DROP TABLE IF EXISTS ai_jobs;

-- ============================================================================
-- 5. Drop ENUM types (optional - may be used by other tables)
-- ============================================================================

-- Only drop if not used elsewhere
DO $$ BEGIN
  DROP TYPE IF EXISTS job_status;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'job_status type still in use, skipping drop';
END $$;

DO $$ BEGIN
  DROP TYPE IF EXISTS job_type;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'job_type type still in use, skipping drop';
END $$;

DO $$ BEGIN
  DROP TYPE IF EXISTS job_priority;
EXCEPTION
  WHEN dependent_objects_still_exist THEN
    RAISE NOTICE 'job_priority type still in use, skipping drop';
END $$;

-- ============================================================================
-- Migration Notes:
--
-- This migration is part of the Job Queue architecture simplification:
-- - Before: Vercel → Supabase (ai_jobs) + Redis (cache)
-- - After:  Vercel → Redis (SSOT) → Cloud Run
--
-- Benefits:
-- - Simplified architecture (single data store)
-- - Faster response times (Redis vs PostgreSQL)
-- - No synchronization issues between stores
-- - Reduced Supabase usage
--
-- Redis Key Structure:
-- - job:{jobId}           → Job data (24h TTL)
-- - job:progress:{jobId}  → Progress info (10min TTL)
-- - job:list:{sessionId}  → Job ID list (1h TTL)
-- ============================================================================
