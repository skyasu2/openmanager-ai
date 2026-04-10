-- 🗑️ Supabase 미사용 테이블 정리 스크립트
-- 생성일: 2025-12-22
-- 분석 기반: 코드베이스 전체 grep 결과

-- ⚠️ 주의: 실행 전 반드시 백업 확인!
-- SELECT * FROM pg_tables WHERE schemaname = 'public';

-- ===============================================
-- 1. 미사용 테이블 확인 (DROP 전 검증)
-- ===============================================

-- 테이블 존재 여부 및 데이터 수 확인
DO $$
DECLARE
    table_info RECORD;
    row_count INTEGER;
BEGIN
    RAISE NOTICE '📋 === 미사용 가능 테이블 현황 ===';

    FOR table_info IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN (
            'hourly_server_states',
            'ml_training_results',
            'langgraph_checkpoints',
            'rate_limits',
            'template_backup_tables',
            'portfolio_server_tables',
            'command_vectors_backup'  -- 백업 테이블도 확인
        )
    LOOP
        EXECUTE 'SELECT COUNT(*) FROM ' || table_info.tablename INTO row_count;
        RAISE NOTICE '  📦 %: % 행', table_info.tablename, row_count;
    END LOOP;
END $$;

-- ===============================================
-- 2. 안전한 삭제 (IF EXISTS 사용)
-- ===============================================

-- 2.1 hourly_server_states (테스트 전용)
-- 상태: 테스트 파일에서만 참조됨, 프로덕션 미사용
DROP TABLE IF EXISTS hourly_server_states CASCADE;
RAISE NOTICE '✅ hourly_server_states 삭제 완료';

-- 2.2 ml_training_results (미사용)
-- 상태: 마이그레이션만 존재, 코드 참조 없음
DROP TABLE IF EXISTS ml_training_results CASCADE;
RAISE NOTICE '✅ ml_training_results 삭제 완료';

-- 2.3 langgraph_checkpoints (미사용)
-- 상태: Cloud Run에서 메모리 기반으로 전환됨
DROP TABLE IF EXISTS langgraph_checkpoints CASCADE;
RAISE NOTICE '✅ langgraph_checkpoints 삭제 완료';

-- 2.4 rate_limits (미사용)
-- 상태: 메모리 기반 rate limiting으로 전환됨
DROP TABLE IF EXISTS rate_limits CASCADE;
RAISE NOTICE '✅ rate_limits 삭제 완료';

-- 2.5 template_backup_tables (미사용)
-- 상태: 초기 설정용, 현재 불필요
DROP TABLE IF EXISTS template_backup_tables CASCADE;
RAISE NOTICE '✅ template_backup_tables 삭제 완료';

-- 2.6 portfolio_server_tables (미사용)
-- 상태: 레거시 테이블, fixed-24h-metrics로 대체됨
DROP TABLE IF EXISTS portfolio_server_tables CASCADE;
RAISE NOTICE '✅ portfolio_server_tables 삭제 완료';

-- ===============================================
-- 3. 백업 테이블 정리 (선택적)
-- ===============================================

-- command_vectors_backup: cleanup-recommendations.sql에서 생성됨
-- 필요시에만 삭제 (백업 용도로 유지 권장)
-- DROP TABLE IF EXISTS command_vectors_backup;

-- ===============================================
-- 4. 정리 후 상태 확인
-- ===============================================

-- 남은 테이블 목록
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;

-- 전체 DB 크기
SELECT
    pg_size_pretty(pg_database_size(current_database())) as total_db_size;

-- ===============================================
-- 5. 마이그레이션 파일 정리 권장
-- ===============================================

-- 다음 마이그레이션 파일들은 archived/ 폴더로 이동 권장:
-- - 20250807_create_hourly_server_states.sql
-- - 20251204_create_ml_training_results_table.sql
-- - 20251213_create_langgraph_checkpoints.sql
-- - 20251124_rate_limits_table.sql
-- - 20250116_create_template_backup_tables.sql
-- - 20251017_create_portfolio_server_tables.sql

RAISE NOTICE '';
RAISE NOTICE '🎉 === 미사용 테이블 정리 완료 ===';
RAISE NOTICE '📁 archived/로 이동 권장 마이그레이션:';
RAISE NOTICE '   - 20250807_create_hourly_server_states.sql';
RAISE NOTICE '   - 20251204_create_ml_training_results_table.sql';
RAISE NOTICE '   - 20251213_create_langgraph_checkpoints.sql';
RAISE NOTICE '   - 20251124_rate_limits_table.sql';
