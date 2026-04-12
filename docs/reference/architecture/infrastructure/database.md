# 🐘 데이터베이스 설계

> Supabase 중심 데이터베이스 스키마/운영 원칙 레퍼런스
> Owner: platform-data
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-04-12
> Canonical: docs/reference/architecture/infrastructure/database.md
> Tags: database,supabase,schema,infrastructure
>
> **프로젝트 버전**: v8.11.9 | **Updated**: 2026-04-12 (bootstrap blocker 해소 완료 검증)

## 🐘 Supabase PostgreSQL 스키마

### 플랫폼 구성
- **PostgreSQL**: 17 (최신)
- **무료 티어**: 500MB (현재 3% 사용)
- **RLS**: Row Level Security 완전 적용
- **실시간**: WebSocket 기반 동기화
- **성능**: 평균 쿼리 50ms

### 핵심 테이블 구조
```sql
-- 서버 정보
CREATE TABLE servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  location VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 서버 메트릭 히스토리
CREATE TABLE server_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  cpu_usage DECIMAL(5,2) NOT NULL,
  memory_usage DECIMAL(5,2) NOT NULL,
  disk_usage DECIMAL(5,2) NOT NULL,
  network_in BIGINT DEFAULT 0,
  network_out BIGINT DEFAULT 0,
  response_time INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT check_cpu_range CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
  CONSTRAINT check_memory_range CHECK (memory_usage >= 0 AND memory_usage <= 100)
);

-- 장애 로그
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  auto_resolved BOOLEAN DEFAULT FALSE
);
```

### RLS 보안 정책
```sql
-- 사용자별 데이터 접근 제어
CREATE POLICY "Users access own data" ON server_metrics
FOR ALL USING (auth.uid()::text = user_id);

-- 관리자 전체 접근
CREATE POLICY "Admin full access" ON servers
FOR ALL USING (
  EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

### 성능 최적화
```sql
-- 시계열 데이터 인덱스
CREATE INDEX idx_metrics_timestamp ON server_metrics (timestamp DESC);
CREATE INDEX idx_metrics_server_time ON server_metrics (server_id, timestamp);

-- 파티셔닝 (월별)
CREATE TABLE server_metrics_2025_01 PARTITION OF server_metrics
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

## Extension Migration Pre-Check

### 현재 상태
- 운영 Supabase에는 `vector`와 `pg_trgm` extension이 아직 `public` 스키마에 설치되어 있습니다.
- Supabase advisor 기준으로는 경고 대상이지만, 현재 레포의 RAG 마이그레이션과 함수 정의는 이 배치를 전제로 작성되어 있습니다.

### 지금 바로 옮기지 않는 이유
- `SECURITY DEFINER` RAG 함수는 `search_path = public, pg_temp`로 고정되어 있습니다.
- 일부 함수는 `similarity()`를 비정규화 이름으로 호출합니다.
- 벡터 타입과 operator class도 `vector(...)`, `vector_cosine_ops`, `gin_trgm_ops`처럼 비정규화 이름을 직접 사용합니다.
- 현재 레포에는 `create extension vector with schema extensions`를 정식 bootstrap migration으로 선언한 이력이 없습니다.

### bootstrap blocker 수정 이력 (2026-04-12)

다음 수정이 같은 날 순차적으로 적용됐습니다.

| 커밋 | 수정 내용 |
|------|-----------|
| `15144296d` | `20251216233232_create_knowledge_base_table.sql` 최상단에 `CREATE EXTENSION IF NOT EXISTS vector;` 추가 (최초 vector 사용 직전 진입점 확보) |
| `8d417ba61` | `20251228073223_sync_servers_with_vercel_json.sql` history-only stub 전환 (hosted schema 비존재 테이블 replay 차단), `add_missing_rag_functions_v2.sql` pg_trgm guard 정비 |
| `c91570551` | `20260213122551_simplify_rag_for_free_tier.sql`에 command_vectors bootstrap 복원 |
| `a6d196da1` | `20251223230707_create_conversation_history.sql` · `hourly_server_states_complete.sql` history-only stub 전환 (hosted schema 비존재 객체 replay 제거) |

**검증 완료 (`2026-04-12`)**: `supabase db reset` 기준 전체 migration chain이 에러 없이 완료됨. `type "vector" does not exist` blocker 소거 확인.

### 이동 전 체크리스트
1. 첫 `vector(...)` 사용 전 extension bootstrap 진입점(`CREATE SCHEMA extensions`, `CREATE EXTENSION vector`, 필요 시 `pg_trgm`)을 확정합니다.
2. `vector(...)` 타입 선언을 `extensions.vector(...)` 기준으로 정리합니다.
3. `vector_cosine_ops`, `gin_trgm_ops`, `similarity()` 같은 extension 심볼의 스키마 qualification 전략을 정합니다.
4. `SECURITY DEFINER` 함수의 고정 `search_path`와 extension 함수 호출이 충돌하지 않도록 함수 본문을 정리합니다.
5. fresh reset 또는 disposable branch DB에서 bootstrap이 끝까지 성공하는지 검증합니다.
6. 운영 DB 적용 전, advisor 경고 소거와 RAG RPC 동작을 둘 다 확인합니다.

### 실제 파일 인벤토리

#### 1차 대상: bootstrap blocker
- `supabase/migrations/20251216233232_create_knowledge_base_table.sql`
  - `embedding vector(384)`
  - `query_embedding vector(384)`
  - `embedding vector_cosine_ops`
- `supabase/migrations/20251231074458_migrate_to_mistral_1024d_embeddings.sql`
  - `ALTER COLUMN embedding TYPE vector(1024)`
  - `query_embedding vector(1024)`
  - `p_query_embedding vector(1024)`
  - `embedding vector_cosine_ops`
- `supabase/migrations/20251231110018_add_missing_rag_functions_v2.sql`
  - `query_embedding vector(1024)`
  - `p_query_embedding vector(1024)`
  - `similarity(...)`
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm`
  - `gin_trgm_ops`
- `supabase/migrations/20260411042939_add_command_vectors_hnsw_index.sql`
  - `embedding vector_cosine_ops`

#### 2차 대상: historical signature chain
- `supabase/migrations/20251217182536_create_knowledge_relationships.sql`
- `supabase/migrations/20251217182600_create_graph_traversal_functions.sql`
- `supabase/migrations/20251217182619_create_hybrid_graph_vector_search.sql`
- `supabase/migrations/20251217182637_add_knowledge_relationships_rls.sql`
- `supabase/migrations/20251217203434_add_bm25_text_search.sql`

#### 3차 대상: hardening dependency
- `supabase/migrations/20260213121317_harden_rag_functions_and_incident_fk_indexes.sql`
  - `ALTER FUNCTION ... SET search_path = public, pg_temp`
  - extension 함수 qualification 전략과 같이 검토해야 합니다.

### 운영 판단
- 현재 이 항목은 즉시 수정 대상이 아니라 `migration prep` 선행 과제입니다.
- checklist가 모두 끝나기 전에는 운영 DB에서 `vector`/`pg_trgm` extension 이동을 진행하지 않습니다.
