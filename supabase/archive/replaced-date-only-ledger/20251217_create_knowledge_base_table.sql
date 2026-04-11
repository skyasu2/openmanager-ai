-- ============================================================================
-- Knowledge Base Table for RAG (Reporter Agent)
-- Pattern: command_vectors 테이블 구조 참조
-- Free Tier: 500MB DB limit → 예상 사용량 ~5MB (1000 문서 기준)
-- ============================================================================

-- 1. knowledge_base 테이블 생성
CREATE TABLE IF NOT EXISTS knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 컨텐츠
    title TEXT NOT NULL,
    content TEXT NOT NULL,

    -- 벡터 임베딩 (Gemini embedding-001: 768차원, 하지만 기존 384 유지)
    -- 기존 command_vectors와 동일한 384차원 사용 (호환성)
    embedding vector(384),

    -- 메타데이터
    category TEXT NOT NULL DEFAULT 'general',
    -- 카테고리: incident, troubleshooting, best_practice, command, architecture
    tags TEXT[] DEFAULT '{}',
    severity TEXT DEFAULT 'info', -- info, warning, critical
    source TEXT DEFAULT 'manual', -- manual, auto_generated, imported

    -- 관계 (선택적)
    related_server_types TEXT[] DEFAULT '{}', -- web, database, application, storage, cache, loadbalancer

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. HNSW 인덱스 생성 (벡터 유사도 검색 최적화)
-- 기존 command_vectors와 동일한 설정 사용
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_hnsw
ON knowledge_base
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. 카테고리별 검색을 위한 B-tree 인덱스
CREATE INDEX IF NOT EXISTS idx_knowledge_base_category
ON knowledge_base (category);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_severity
ON knowledge_base (severity);

-- 4. Updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_knowledge_base_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_knowledge_base_updated_at ON knowledge_base;
CREATE TRIGGER trigger_knowledge_base_updated_at
    BEFORE UPDATE ON knowledge_base
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_base_updated_at();

-- 5. RAG 검색 함수 (Reporter Agent용)
CREATE OR REPLACE FUNCTION search_knowledge_base(
    query_embedding vector(384),
    similarity_threshold float DEFAULT 0.3,
    max_results int DEFAULT 5,
    filter_category text DEFAULT NULL,
    filter_severity text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    category text,
    tags text[],
    severity text,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kb.id,
        kb.title,
        kb.content,
        kb.category,
        kb.tags,
        kb.severity,
        1 - (kb.embedding <=> query_embedding) as similarity
    FROM knowledge_base kb
    WHERE kb.embedding IS NOT NULL
      AND 1 - (kb.embedding <=> query_embedding) >= similarity_threshold
      AND (filter_category IS NULL OR kb.category = filter_category)
      AND (filter_severity IS NULL OR kb.severity = filter_severity)
    ORDER BY kb.embedding <=> query_embedding
    LIMIT max_results;
END;
$$;

-- 6. RLS 정책 (읽기 전용 - Cloud Run에서 service_role 사용)
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- Service Role은 모든 작업 허용
CREATE POLICY "Service role full access" ON knowledge_base
    FOR ALL
    USING (auth.role() = 'service_role');

-- Anon은 읽기만 허용
CREATE POLICY "Anon read access" ON knowledge_base
    FOR SELECT
    USING (true);

-- 7. 코멘트 추가
COMMENT ON TABLE knowledge_base IS 'RAG 지식베이스 - Reporter Agent가 인시던트 분석 시 참조';
COMMENT ON COLUMN knowledge_base.embedding IS 'Gemini embedding-001 (384d, 무료티어)';
COMMENT ON COLUMN knowledge_base.category IS 'incident, troubleshooting, best_practice, command, architecture';
COMMENT ON FUNCTION search_knowledge_base IS 'Reporter Agent RAG 검색 - On-demand only (무료티어)';
