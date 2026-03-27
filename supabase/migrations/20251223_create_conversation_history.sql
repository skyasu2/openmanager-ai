-- ============================================================================
-- Conversation History Table
-- Purpose: Store AI conversation history with compression metadata
-- Used by: LangGraph Multi-Agent Supervisor, Context Compression Module
-- Free Tier: 500MB DB limit → Compression helps reduce storage
-- ============================================================================

-- 1. conversation_history 테이블 생성
CREATE TABLE IF NOT EXISTS conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Session Identification
    session_id TEXT NOT NULL UNIQUE,
    user_id TEXT DEFAULT 'anonymous',

    -- Conversation Data
    messages JSONB NOT NULL DEFAULT '[]',
    -- Format: [{ role: 'user' | 'assistant' | 'system', content: string, timestamp: string }]

    -- Context Compression (v5.86.0)
    summary TEXT, -- Compressed summary of older messages
    compression_metadata JSONB DEFAULT '{}',
    -- Format: {
    --   lastCompressedAt: string,
    --   totalCompressedMessages: number,
    --   compressionRatio: number,
    --   originalTokenCount: number,
    --   compressedTokenCount: number
    -- }

    -- Session Metadata
    agent_name TEXT, -- supervisor, nlq_agent, analyst_agent, reporter_agent
    last_query TEXT, -- Last user query for quick reference

    -- Verification Metadata (v5.85.0)
    verification_stats JSONB DEFAULT '{}',
    -- Format: {
    --   totalVerified: number,
    --   issuesFound: number,
    --   avgConfidence: number
    -- }

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes
-- Primary query: Get conversation by session_id
CREATE INDEX IF NOT EXISTS idx_conversation_session
ON conversation_history(session_id);

-- Query by user
CREATE INDEX IF NOT EXISTS idx_conversation_user
ON conversation_history(user_id);

-- Query recent conversations
CREATE INDEX IF NOT EXISTS idx_conversation_updated
ON conversation_history(updated_at DESC);

-- JSONB index for searching within messages
CREATE INDEX IF NOT EXISTS idx_conversation_messages
ON conversation_history USING gin(messages);

-- 3. Updated_at auto-update trigger
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_conversation_updated_at ON conversation_history;
CREATE TRIGGER trigger_conversation_updated_at
    BEFORE UPDATE ON conversation_history
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_updated_at();

-- 4. RLS Policies
ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

-- Service Role has full access (Cloud Run AI Engine)
CREATE POLICY "Service role full access" ON conversation_history
    FOR ALL
    USING (auth.role() = 'service_role');

-- Users can only see their own conversations
CREATE POLICY "User owns conversation" ON conversation_history
    FOR ALL
    TO authenticated
    USING (
        user_id = auth.uid()::TEXT
        OR user_id = 'anonymous'
    );

-- 5. Helper function: Get or create session
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_session_id TEXT,
    p_user_id TEXT DEFAULT 'anonymous'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Try to get existing
    SELECT id INTO v_id
    FROM conversation_history
    WHERE session_id = p_session_id;

    IF v_id IS NULL THEN
        -- Create new
        INSERT INTO conversation_history (session_id, user_id)
        VALUES (p_session_id, p_user_id)
        RETURNING id INTO v_id;
    END IF;

    RETURN v_id;
END;
$$;

-- 6. Helper function: Append message
CREATE OR REPLACE FUNCTION append_conversation_message(
    p_session_id TEXT,
    p_role TEXT,
    p_content TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE conversation_history
    SET messages = messages || jsonb_build_object(
        'role', p_role,
        'content', p_content,
        'timestamp', NOW()
    )
    WHERE session_id = p_session_id;

    RETURN FOUND;
END;
$$;

-- 7. Helper function: Update compression metadata
CREATE OR REPLACE FUNCTION update_compression_metadata(
    p_session_id TEXT,
    p_summary TEXT,
    p_metadata JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE conversation_history
    SET
        summary = p_summary,
        compression_metadata = p_metadata
    WHERE session_id = p_session_id;

    RETURN FOUND;
END;
$$;

-- 8. Cleanup function for old sessions
CREATE OR REPLACE FUNCTION cleanup_old_conversations(
    retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM conversation_history
    WHERE updated_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- 9. Comments
COMMENT ON TABLE conversation_history IS 'AI conversation history with context compression support (v5.86.0)';
COMMENT ON COLUMN conversation_history.messages IS 'JSONB array of messages [{role, content, timestamp}]';
COMMENT ON COLUMN conversation_history.summary IS 'Compressed summary from context compression';
COMMENT ON COLUMN conversation_history.compression_metadata IS 'Compression statistics and metadata';
COMMENT ON FUNCTION get_or_create_conversation IS 'Get existing or create new conversation session';
COMMENT ON FUNCTION append_conversation_message IS 'Append a message to conversation history';
COMMENT ON FUNCTION update_compression_metadata IS 'Update compression summary and metadata';
COMMENT ON FUNCTION cleanup_old_conversations IS 'Cleanup sessions older than retention_days (default: 30 days)';
