-- 📈 OpenManager VIBE v5 - 성능 모니터링 및 분석 도구
-- PostgreSQL 성능 분석 및 최적화 추천 시스템
-- 최종 업데이트: 2025-08-10T16:59:00+09:00

-- =============================================
-- 1. 성능 통계 확장 활성화
-- =============================================

-- pg_stat_statements 확장 활성화 (느린 쿼리 분석)
-- Supabase에서 기본 제공되지만 확인
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- =============================================
-- 2. 성능 모니터링 뷰 생성
-- =============================================

-- 2.1. 테이블 성능 요약 뷰
CREATE OR REPLACE VIEW performance_summary AS
SELECT 
    schemaname,
    tablename,
    -- 스캔 통계
    seq_scan as table_scans,
    seq_tup_read as rows_from_table_scans,
    idx_scan as index_scans,
    idx_tup_fetch as rows_from_index_scans,
    
    -- 인덱스 사용률 계산
    CASE 
        WHEN (seq_scan + idx_scan) > 0 
        THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
        ELSE 0 
    END as index_usage_percent,
    
    -- 데이터 변경 통계
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_tup_hot_upd as hot_updates,
    
    -- 데드 튜플 통계  
    n_dead_tup as dead_tuples,
    CASE 
        WHEN n_live_tup > 0 
        THEN ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
        ELSE 0 
    END as dead_tuple_percent,
    
    -- 마지막 VACUUM/ANALYZE 시간
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY tablename;

-- 2.2. 인덱스 효율성 분석 뷰
CREATE OR REPLACE VIEW index_efficiency AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans_count,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    
    -- 인덱스 효율성 계산
    CASE 
        WHEN idx_tup_read > 0 
        THEN ROUND(100.0 * idx_tup_fetch / idx_tup_read, 2)
        ELSE 0 
    END as selectivity_percent,
    
    -- 테이블 크기 대비 인덱스 크기
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_size_pretty(pg_relation_size(indrelid)) as table_size,
    
    ROUND(
        100.0 * pg_relation_size(indexrelid) / 
        NULLIF(pg_relation_size(indrelid), 0), 2
    ) as index_to_table_ratio
    
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 2.3. 쿼리 성능 분석 뷰 (pg_stat_statements 필요)
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    LEFT(query, 100) as query_preview,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    min_exec_time,
    stddev_exec_time,
    
    -- 성능 분류
    CASE 
        WHEN mean_exec_time > 1000 THEN 'CRITICAL'
        WHEN mean_exec_time > 500 THEN 'SLOW'
        WHEN mean_exec_time > 100 THEN 'MODERATE'
        ELSE 'FAST'
    END as performance_category,
    
    -- 전체 실행 시간 대비 비율
    ROUND(100.0 * total_exec_time / SUM(total_exec_time) OVER(), 2) as time_percent,
    
    rows as avg_rows_returned,
    ROUND(shared_blks_hit * 100.0 / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) as cache_hit_percent
    
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'  -- 메타 쿼리 제외
ORDER BY mean_exec_time DESC;

-- =============================================
-- 3. 성능 진단 함수들
-- =============================================

-- 3.1. 테이블 건강 상태 체크
CREATE OR REPLACE FUNCTION check_table_health(table_name_param text DEFAULT NULL)
RETURNS TABLE (
    table_name text,
    health_score numeric,
    issues text[],
    recommendations text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    rec record;
    score numeric := 100;
    issues_array text[] := '{}';
    recommendations_array text[] := '{}';
BEGIN
    FOR rec IN 
        SELECT * FROM performance_summary 
        WHERE table_name_param IS NULL OR tablename = table_name_param
    LOOP
        -- 초기화
        score := 100;
        issues_array := '{}';
        recommendations_array := '{}';
        
        -- 인덱스 사용률 체크
        IF rec.index_usage_percent < 50 THEN
            score := score - 30;
            issues_array := issues_array || 'Low index usage';
            recommendations_array := recommendations_array || 'Consider adding indexes for frequent WHERE clauses';
        END IF;
        
        -- 데드 튜플 체크
        IF rec.dead_tuple_percent > 20 THEN
            score := score - 20;
            issues_array := issues_array || 'High dead tuple ratio';
            recommendations_array := recommendations_array || 'Run VACUUM more frequently';
        END IF;
        
        -- VACUUM 체크 (7일 이상 없으면 문제)
        IF rec.last_autovacuum < NOW() - INTERVAL '7 days' OR rec.last_autovacuum IS NULL THEN
            score := score - 15;
            issues_array := issues_array || 'VACUUM not run recently';
            recommendations_array := recommendations_array || 'Manual VACUUM required';
        END IF;
        
        -- ANALYZE 체크
        IF rec.last_autoanalyze < NOW() - INTERVAL '3 days' OR rec.last_autoanalyze IS NULL THEN
            score := score - 10;
            issues_array := issues_array || 'Statistics outdated';
            recommendations_array := recommendations_array || 'Run ANALYZE to update statistics';
        END IF;
        
        -- 점수 범위 제한
        score := GREATEST(0, LEAST(100, score));
        
        RETURN QUERY SELECT 
            rec.tablename::text,
            score,
            issues_array,
            recommendations_array;
    END LOOP;
END;
$$;

-- 3.2. 인덱스 추천 함수
CREATE OR REPLACE FUNCTION recommend_indexes()
RETURNS TABLE (
    table_name text,
    recommended_index text,
    reason text,
    priority text,
    estimated_benefit text
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- server_metrics 테이블 특화 추천
    RETURN QUERY
    WITH query_patterns AS (
        SELECT 
            'server_metrics' as tbl_name,
            'CREATE INDEX ON server_metrics (last_updated DESC, environment)' as idx_sql,
            'Frequent time-based queries with environment filter' as reason,
            'HIGH' as priority,
            '40-60% query speedup expected' as benefit
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'server_metrics' 
            AND indexdef ILIKE '%last_updated%environment%'
        )
        
        UNION ALL
        
        SELECT 
            'server_metrics',
            'CREATE INDEX ON server_metrics (environment, role) WHERE status = ''online''',
            'Dashboard queries filter by env/role for active servers',
            'MEDIUM',
            '20-30% query speedup expected'
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'server_metrics' 
            AND indexdef ILIKE '%environment%role%'
        )
        
        UNION ALL
        
        SELECT 
            'server_metric_vectors',
            'CREATE INDEX ON server_metric_vectors USING GIN (to_tsvector(''english'', server_id))',
            'Full-text search on server identifiers',
            'LOW',
            '10-15% search speedup'
        WHERE EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'server_metric_vectors')
        AND NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'server_metric_vectors' 
            AND indexdef ILIKE '%gin%tsvector%'
        )
    )
    SELECT * FROM query_patterns;
END;
$$;

-- 3.3. 용량 최적화 추천
CREATE OR REPLACE FUNCTION recommend_storage_optimization()
RETURNS TABLE (
    optimization_type text,
    current_usage_mb numeric,
    potential_savings_mb numeric,
    action_required text,
    priority text
)
LANGUAGE sql
AS $$
    WITH storage_analysis AS (
        SELECT 
            tablename,
            pg_total_relation_size(schemaname||'.'||tablename) / 1024 / 1024 as size_mb,
            COALESCE(n_dead_tup, 0) as dead_tuples,
            COALESCE(n_live_tup, 0) as live_tuples
        FROM pg_tables pt
        LEFT JOIN pg_stat_user_tables psut ON pt.tablename = psut.relname
        WHERE pt.schemaname = 'public'
    )
    SELECT 
        'Dead Tuple Cleanup' as optimization_type,
        SUM(size_mb) as current_usage_mb,
        ROUND(SUM(size_mb * dead_tuples / NULLIF(live_tuples + dead_tuples, 0)), 2) as potential_savings_mb,
        'Run VACUUM FULL on tables with high dead tuple ratio' as action_required,
        CASE 
            WHEN SUM(size_mb * dead_tuples / NULLIF(live_tuples + dead_tuples, 0)) > 50 THEN 'HIGH'
            WHEN SUM(size_mb * dead_tuples / NULLIF(live_tuples + dead_tuples, 0)) > 10 THEN 'MEDIUM'
            ELSE 'LOW'
        END as priority
    FROM storage_analysis
    WHERE dead_tuples > 0
    
    UNION ALL
    
    SELECT 
        'Data Archival',
        SUM(size_mb),
        ROUND(SUM(size_mb) * 0.7, 2), -- 70% 데이터를 아카이브 가정
        'Archive data older than 30 days to separate table',
        'MEDIUM'
    FROM storage_analysis
    WHERE tablename IN ('server_metrics', 'server_metric_vectors')
    AND size_mb > 100; -- 100MB 이상인 경우만
$$;

-- =============================================
-- 4. 자동 성능 리포트 생성
-- =============================================

CREATE OR REPLACE FUNCTION generate_performance_report()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    report_text text := '';
    rec record;
    total_size_mb numeric;
    storage_usage_percent numeric;
BEGIN
    -- 헤더
    report_text := '🎯 OpenManager VIBE v5 성능 리포트' || E'\n';
    report_text := report_text || '생성 시간: ' || NOW()::text || E'\n';
    report_text := report_text || '=====================================\n\n';
    
    -- 전체 스토리지 사용량
    SELECT 
        ROUND(SUM(pg_total_relation_size(schemaname||'.'||tablename))::numeric / 1024 / 1024, 2),
        ROUND(SUM(pg_total_relation_size(schemaname||'.'||tablename))::numeric / (500 * 1024 * 1024) * 100, 2)
    INTO total_size_mb, storage_usage_percent
    FROM pg_tables WHERE schemaname = 'public';
    
    report_text := report_text || '📊 스토리지 현황\n';
    report_text := report_text || '- 총 사용량: ' || total_size_mb || 'MB / 500MB\n';
    report_text := report_text || '- 사용률: ' || storage_usage_percent || '%\n\n';
    
    -- 테이블별 건강 상태
    report_text := report_text || '🏥 테이블 건강 상태\n';
    FOR rec IN SELECT * FROM check_table_health() ORDER BY health_score ASC LOOP
        report_text := report_text || '- ' || rec.table_name || ': ' || rec.health_score || '/100\n';
        IF array_length(rec.issues, 1) > 0 THEN
            report_text := report_text || '  문제점: ' || array_to_string(rec.issues, ', ') || E'\n';
        END IF;
    END LOOP;
    
    report_text := report_text || E'\n';
    
    -- 인덱스 추천
    report_text := report_text || '💡 인덱스 추천 사항\n';
    FOR rec IN SELECT * FROM recommend_indexes() ORDER BY 
        CASE priority WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END LOOP
        report_text := report_text || '- [' || rec.priority || '] ' || rec.table_name || E'\n';
        report_text := report_text || '  SQL: ' || rec.recommended_index || E'\n';
        report_text := report_text || '  이유: ' || rec.reason || E'\n';
    END LOOP;
    
    report_text := report_text || E'\n';
    
    -- 성능 경고
    IF storage_usage_percent > 80 THEN
        report_text := report_text || '⚠️ 경고: 스토리지 사용률이 80%를 초과했습니다!\n';
        report_text := report_text || '   데이터 정리 또는 아카이브가 필요합니다.\n\n';
    END IF;
    
    RETURN report_text;
END;
$$;

-- =============================================
-- 5. 실시간 성능 대시보드 뷰
-- =============================================

CREATE OR REPLACE VIEW performance_dashboard AS
SELECT 
    'Database Health' as metric_category,
    'Overall Score' as metric_name,
    ROUND(AVG(
        CASE 
            WHEN ps.index_usage_percent >= 80 THEN 100
            WHEN ps.index_usage_percent >= 50 THEN 75
            WHEN ps.index_usage_percent >= 25 THEN 50
            ELSE 25
        END
    ), 0)::text || '/100' as metric_value,
    CASE 
        WHEN AVG(ps.index_usage_percent) >= 80 THEN '🟢 EXCELLENT'
        WHEN AVG(ps.index_usage_percent) >= 50 THEN '🟡 GOOD' 
        WHEN AVG(ps.index_usage_percent) >= 25 THEN '🟠 NEEDS ATTENTION'
        ELSE '🔴 CRITICAL'
    END as status
FROM performance_summary ps
WHERE ps.tablename IN ('server_metrics', 'server_metric_vectors')

UNION ALL

SELECT 
    'Storage',
    'Usage',
    ROUND(
        (SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename))::numeric / (500 * 1024 * 1024) * 100)
        FROM pg_tables WHERE schemaname = 'public'
    , 1)::text || '%' as metric_value,
    CASE 
        WHEN (SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename))::numeric / (500 * 1024 * 1024) * 100 FROM pg_tables WHERE schemaname = 'public') > 90 THEN '🔴 CRITICAL'
        WHEN (SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename))::numeric / (500 * 1024 * 1024) * 100 FROM pg_tables WHERE schemaname = 'public') > 70 THEN '🟠 WARNING'
        ELSE '🟢 OK'
    END as status

UNION ALL

SELECT 
    'Query Performance',
    'Avg Response Time',
    COALESCE(
        (SELECT ROUND(AVG(mean_exec_time), 0)::text || 'ms' 
         FROM pg_stat_statements 
         WHERE query ILIKE '%server_metrics%' 
         AND calls > 10),
        'N/A'
    ) as metric_value,
    CASE 
        WHEN COALESCE((SELECT AVG(mean_exec_time) FROM pg_stat_statements WHERE query ILIKE '%server_metrics%'), 0) > 500 THEN '🔴 SLOW'
        WHEN COALESCE((SELECT AVG(mean_exec_time) FROM pg_stat_statements WHERE query ILIKE '%server_metrics%'), 0) > 100 THEN '🟡 MODERATE'
        ELSE '🟢 FAST'
    END as status;

-- 성능 모니터링 설정 완료
SELECT 
    '성능 모니터링 시스템 설정 완료' as status,
    COUNT(*) as monitoring_views_created
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('performance_summary', 'index_efficiency', 'slow_queries', 'performance_dashboard');