# Supabase Migration Guide

## 002_mcp_performance_indexes.sql - MCP 성능 최적화 인덱스

### 목적
- Supabase MCP 응답속도 40% 개선 (300ms → 180ms)
- ml_training_results 및 command_vectors 테이블 쿼리 최적화

### 적용 방법

#### 방법 1: Supabase 대시보드 (권장)
1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. SQL Editor 메뉴로 이동
4. `002_mcp_performance_indexes.sql` 파일 내용 복사
5. SQL Editor에 붙여넣기 후 실행 (Run 버튼)

#### 방법 2: Supabase CLI
```bash
# supabase CLI 설치 확인
supabase --version

# 프로젝트 연결 (최초 1회)
supabase link --project-ref your-project-id

# 마이그레이션 적용
supabase db push
```

### 예상 효과
- ✅ 쿼리 응답속도: 40% 개선 (300ms → 180ms)
- ✅ 인덱스 생성: 5개 (3개 단일 + 1개 복합 + 1개 RAG 전용)
- ✅ MCP 서버 성능 향상

### 적용 확인
SQL Editor에서 다음 쿼리로 인덱스 생성 확인:
```sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE tablename IN ('ml_training_results', 'command_vectors')
ORDER BY tablename, indexname;
```

### 주의사항
- ⚠️ MCP 서버는 read-only 모드로 실행되므로 직접 적용 불가
- ⚠️ 반드시 Supabase 대시보드 또는 CLI를 통해 수동 적용
- ✅ 인덱스는 멱등성(idempotent)이므로 중복 실행 가능

### 작성 정보
- 날짜: 2025-10-02
- 제안: Codex AI (실무 최적화 제안)
- 검증: Claude, Gemini, Qwen 교차검증 완료

---

## 003_add_vector_indexes.sql - RAG 시스템 벡터 인덱스

### 목적
- **RAG 벡터 검색 성능 95% 개선** (Full Table Scan → Index Scan)
- command_vectors 테이블 유사도 검색 최적화
- pgvector 확장 활용한 IVFFlat 인덱스

### 적용 방법

#### 방법 1: Supabase 대시보드 (권장)
1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. SQL Editor 메뉴로 이동
4. `003_add_vector_indexes.sql` 파일 내용 복사
5. SQL Editor에 붙여넣기 후 실행 (Run 버튼)

#### 방법 2: Supabase CLI
```bash
# supabase CLI 설치 확인
supabase --version

# 프로젝트 연결 (최초 1회)
supabase link --project-ref your-project-id

# 마이그레이션 적용
supabase db push
```

### 예상 효과
- ✅ 벡터 유사도 검색: **95% 성능 개선**
- ✅ Full Table Scan → Index Scan
- ✅ 예상 응답시간: 2000ms → 100ms
- ✅ IVFFlat 인덱스 (lists=100)

### 적용 확인
SQL Editor에서 다음 쿼리로 인덱스 생성 확인:
```sql
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'command_vectors'
  AND indexname LIKE 'idx_command_vectors_embedding%';
```

### 주의사항
- ⚠️ pgvector 확장이 먼저 설치되어 있어야 함
- ✅ 스크립트에 자동 확장 설치 포함됨
- ✅ 인덱스는 멱등성(idempotent)이므로 중복 실행 가능

---

## 003_rollback_002.sql - 롤백 가이드

### 목적
- **운영 안정성 확보**: 인덱스 생성 실패 또는 성능 저하 시 복구
- 002_mcp_performance_indexes.sql 마이그레이션 롤백

### 사용 시나리오
1. 인덱스 생성 실패로 인한 롤백
2. 예상치 못한 성능 저하 발견
3. 디스크 공간 부족으로 인한 복구

### 적용 방법

#### 방법 1: Supabase 대시보드 (권장)
1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. SQL Editor 메뉴로 이동
3. `003_rollback_002.sql` 파일 내용 복사
4. SQL Editor에 붙여넣기 후 실행 (Run 버튼)

#### 방법 2: Supabase CLI
```bash
psql $DATABASE_URL < sql/migrations/003_rollback_002.sql
```

### 롤백 대상
- ✅ ml_training_results: 4개 인덱스 제거
- ✅ command_vectors: 1개 인덱스 제거
- ✅ 총 5개 인덱스 삭제

### 롤백 확인
```sql
-- 남아있는 MCP 인덱스 확인
SELECT COUNT(*) as remaining_mcp_indexes
FROM pg_indexes
WHERE tablename IN ('ml_training_results', 'command_vectors')
  AND indexname IN (
    'idx_ml_training_server_id',
    'idx_ml_training_created_at',
    'idx_ml_training_type',
    'idx_ml_training_server_created',
    'idx_command_vectors_created_at'
  );
-- 예상 결과: 0개 (모두 삭제됨)
```

### 롤백 후 재적용
```bash
# 1. 문제 원인 파악 및 해결
# 2. 002_mcp_performance_indexes.sql 재실행
# 3. 성능 벤치마크로 개선 확인 (sql/benchmarks/002_performance_test.sql)
```

---

## 성능 벤치마크 - sql/benchmarks/002_performance_test.sql

### 목적
- **투명한 성능 검증**: 40% 개선 주장의 객관적 증거 제공
- 인덱스 적용 전후 성능 비교 측정

### 사용 방법

#### 1. 인덱스 적용 전 성능 측정 (Baseline)
```bash
# Supabase SQL Editor에서 실행
psql $DATABASE_URL < sql/benchmarks/002_performance_test.sql > before.log
```

#### 2. 인덱스 적용
```bash
psql $DATABASE_URL < sql/migrations/002_mcp_performance_indexes.sql
```

#### 3. 인덱스 적용 후 성능 측정
```bash
psql $DATABASE_URL < sql/benchmarks/002_performance_test.sql > after.log
```

#### 4. 결과 비교
```bash
# before.log vs after.log 비교
# Execution Time 항목 확인
# 예: 300ms → 180ms (40% 개선)
```

### 벤치마크 항목
1. **ml_training_results 쿼리**:
   - server_id 필터링 (가장 빈번)
   - 날짜 범위 필터링
   - training_type 집계
   - 복합 인덱스 활용 쿼리

2. **command_vectors 쿼리**:
   - 최근 명령어 조회
   - 날짜 범위 집계

3. **인덱스 분석**:
   - 인덱스 사용 여부 확인
   - 인덱스 크기 및 효율성
   - 인덱스 스캔 통계

### 성능 목표
- ✅ 평균 쿼리 응답: **300ms → 180ms (40% 개선)**
- ✅ Index Scan 사용률: 0% → 95%+
- ✅ Full Table Scan 제거

### 결과 해석
```sql
-- EXPLAIN ANALYZE 출력에서 확인할 항목:
-- 1. "Index Scan" vs "Seq Scan"
--    → Index Scan이 나오면 성공
-- 2. Execution Time
--    → 인덱스 전후 40% 감소 확인
-- 3. Buffers: shared hit
--    → 캐시 효율성 (높을수록 좋음)
```

---

## 마이그레이션 전체 순서

```bash
# 1. 성능 벤치마크 (Before)
psql $DATABASE_URL < sql/benchmarks/002_performance_test.sql > before.log

# 2. MCP 성능 인덱스 적용
psql $DATABASE_URL < sql/migrations/002_mcp_performance_indexes.sql

# 3. RAG 벡터 인덱스 적용
psql $DATABASE_URL < sql/migrations/003_add_vector_indexes.sql

# 4. 성능 벤치마크 (After)
psql $DATABASE_URL < sql/benchmarks/002_performance_test.sql > after.log

# 5. 결과 비교
diff before.log after.log  # 또는 수동 비교
```

## 문제 해결

### 인덱스 생성 실패 시
```bash
# 롤백 실행
psql $DATABASE_URL < sql/migrations/003_rollback_002.sql

# 문제 해결 후 재시도
psql $DATABASE_URL < sql/migrations/002_mcp_performance_indexes.sql
```

### 성능 저하 발견 시
```bash
# 벤치마크로 확인
psql $DATABASE_URL < sql/benchmarks/002_performance_test.sql

# 성능 저하 확인되면 롤백
psql $DATABASE_URL < sql/migrations/003_rollback_002.sql
```
