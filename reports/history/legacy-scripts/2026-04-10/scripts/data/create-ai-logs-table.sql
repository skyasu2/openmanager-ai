-- 🗄️ AI 자연어 질의 로그 테이블 생성
-- OpenManager Vibe v5 - AI 기능 로그 저장용
-- 1. AI 질의 로그 테이블 생성
CREATE TABLE IF NOT EXISTS ai_query_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    -- AI 엔진 정보
    engine_used VARCHAR(50) NOT NULL DEFAULT 'unknown',
    mode VARCHAR(50) NOT NULL DEFAULT 'UNIFIED',
    confidence FLOAT DEFAULT 0.0,
    processing_time INTEGER DEFAULT 0,
    -- milliseconds
    -- 메타데이터
    user_intent VARCHAR(100),
    category VARCHAR(50),
    language VARCHAR(10) DEFAULT 'ko',
    -- 성능 지표
    token_count INTEGER DEFAULT 0,
    cost_estimate DECIMAL(10, 6) DEFAULT 0.0,
    -- 타임스탬프
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 2. 인덱스 생성 (검색 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_ai_query_logs_session ON ai_query_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_query_logs_created ON ai_query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_query_logs_engine ON ai_query_logs(engine_used);
CREATE INDEX IF NOT EXISTS idx_ai_query_logs_category ON ai_query_logs(category);
CREATE INDEX IF NOT EXISTS idx_ai_query_logs_intent ON ai_query_logs(user_intent);
-- 3. 자동 업데이트 트리거 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER update_ai_query_logs_updated_at BEFORE
UPDATE ON ai_query_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- 4. 성능 통계 뷰 생성
CREATE OR REPLACE VIEW ai_query_stats AS
SELECT DATE_TRUNC('day', created_at) as date,
    engine_used,
    category,
    COUNT(*) as query_count,
    AVG(confidence) as avg_confidence,
    AVG(processing_time) as avg_processing_time,
    SUM(token_count) as total_tokens,
    SUM(cost_estimate) as total_cost
FROM ai_query_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at),
    engine_used,
    category
ORDER BY date DESC,
    query_count DESC;
-- 5. 자동 정리 함수 (무료 티어 최적화)
CREATE OR REPLACE FUNCTION cleanup_old_ai_logs(retention_days INTEGER DEFAULT 30) RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
DELETE FROM ai_query_logs
WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
GET DIAGNOSTICS deleted_count = ROW_COUNT;
RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
-- 6. 세션별 통계 뷰
CREATE OR REPLACE VIEW ai_session_stats AS
SELECT session_id,
    COUNT(*) as query_count,
    MIN(created_at) as first_query,
    MAX(created_at) as last_query,
    AVG(confidence) as avg_confidence,
    AVG(processing_time) as avg_processing_time,
    ARRAY_AGG(DISTINCT engine_used) as engines_used,
    ARRAY_AGG(DISTINCT category) as categories
FROM ai_query_logs
GROUP BY session_id
ORDER BY last_query DESC;
-- 7. 일일 정리 자동화 (cron 작업용)
-- 실행 방법: SELECT cleanup_old_ai_logs(30);
-- 8. 성능 모니터링 쿼리
-- 최근 24시간 AI 사용량
-- SELECT * FROM ai_query_stats WHERE date >= CURRENT_DATE - INTERVAL '1 day';
-- 9. 테이블 설명 추가
COMMENT ON TABLE ai_query_logs IS 'AI 자연어 질의 로그 저장 테이블 - 베르셀 파일 업로드 제거 대응';
COMMENT ON COLUMN ai_query_logs.session_id IS '사용자 세션 ID';
COMMENT ON COLUMN ai_query_logs.query IS '사용자 질의 (최대 1000자)';
COMMENT ON COLUMN ai_query_logs.response IS 'AI 응답 (최대 2000자)';
COMMENT ON COLUMN ai_query_logs.engine_used IS '사용된 AI 엔진 (예: unified-google-rag, cloud-functions, command-router)';
COMMENT ON COLUMN ai_query_logs.mode IS 'AI 모드 (단일 통합 파이프라인: UNIFIED)';
COMMENT ON COLUMN ai_query_logs.confidence IS '응답 신뢰도 (0.0 ~ 1.0)';
COMMENT ON COLUMN ai_query_logs.processing_time IS '처리 시간 (밀리초)';
COMMENT ON COLUMN ai_query_logs.user_intent IS '사용자 의도 (monitoring, analysis, prediction 등)';
COMMENT ON COLUMN ai_query_logs.category IS '질의 카테고리 (server, database, network 등)';
COMMENT ON COLUMN ai_query_logs.token_count IS '토큰 수 (비용 계산용)';
COMMENT ON COLUMN ai_query_logs.cost_estimate IS '비용 추정 (USD)';
-- 10. 권한 설정 (읽기/쓰기 권한)
-- 일반 사용자는 자신의 로그만 읽을 수 있도록 제한
-- ALTER TABLE ai_query_logs ENABLE ROW LEVEL SECURITY;
-- 11. 샘플 데이터 (테스트용)
-- INSERT INTO ai_query_logs (session_id, query, response, engine_used, mode, confidence, processing_time, user_intent, category)
-- VALUES ('test_session_1', '서버 상태를 확인해주세요', '모든 서버가 정상 작동 중입니다.', 'unified-google-rag', 'UNIFIED', 0.95, 1250, 'monitoring', 'server');
-- 12. 완료 메시지
SELECT 'AI 자연어 질의 로그 테이블 생성 완료! 🎉' as status;
