# 데이터베이스 설계

> Supabase 중심 데이터베이스 스키마/운영 원칙 레퍼런스
> Owner: platform-data
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-10
> Canonical: docs/reference/architecture/infrastructure/database.md
> Tags: database,supabase,schema,infrastructure
>
> **프로젝트 버전**: v8.11.120 | **Updated**: 2026-05-10

## 현재 역할

Supabase는 인증, RAG/KB, audit 같은 영속 데이터의 기준입니다. Dashboard/AI monitoring runtime의 서버 메트릭 SSOT는 Supabase가 아니라 `public/data/otel-data` synthetic OTel dataset입니다.

| 영역 | 현재 기준 |
|---|---|
| Auth/session | Supabase Auth + 자체 guest session |
| RAG/KB | `knowledge_base` + `search_knowledge_text` Knowledge Retrieval Lite. `command_vectors`/`knowledge_relationships`는 legacy service-role inventory |
| Audit/security logs | `security_audit_logs` 계열 |
| Monitoring runtime | `public/data/otel-data` → `MetricsProvider`/AI Engine precomputed state |
| AI jobs/cache | Redis/Cloud Tasks, Supabase가 job store 아님 |
| Schema source | `supabase/migrations/**` |

AI나 dashboard 메트릭 구현을 바꿀 때는 이 문서보다 [OTel Data Architecture](../data/otel-data-architecture.md)를 먼저 확인합니다. Supabase schema/RLS/extension 변경이면 이 문서를 기준으로 봅니다.

## Supabase PostgreSQL 스키마

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

### Legacy vector/graph RPC cleanup (2026-05-10)

운영 DB read-only inventory 결과, 현재 런타임에서 사용하지 않는 legacy RAG RPC가 아직 public schema에 남아 있습니다.

| 객체 | 운영 DB 상태 | 현재 판단 |
|------|-------------|-----------|
| `search_knowledge_text(text, integer, text)` | 존재 | 현재 Knowledge Retrieval Lite runtime RPC. 유지 |
| `search_knowledge_base(vector, ...)` | 제거됨 | legacy vector RPC. `20260510022419` 적용 완료 |
| `match_documents(vector, ...)` | 제거됨 | legacy vector RPC. `20260510022419` 적용 완료 |
| `match_knowledge_base(text, ...)` | 제거됨 | legacy text fallback RPC. `20260510022419` 적용 완료 |
| `hybrid_search_with_text(vector, ...)` | 제거됨 | legacy hybrid vector/text/graph RPC. `20260510022419` 적용 완료 |
| `hybrid_graph_vector_search(vector, ...)` | 제거됨 | legacy graph/vector RPC. `20260510022419` 적용 완료 |
| `hybrid_search_vectors(vector, ...)` | 제거됨 | legacy vector RPC. `20260510022419` 적용 완료 |

정리 migration:
- `supabase/migrations/20260510022419_drop_legacy_vector_graph_rag_rpcs.sql`
- 범위: 위 legacy RPC 함수만 `DROP FUNCTION ... RESTRICT`
- 보존: `knowledge_base`, `command_vectors`, `knowledge_relationships`, `search_knowledge_text`

운영 적용 완료:
- 적용일: 2026-05-10
- Supabase ledger: `20260510022419 drop_legacy_vector_graph_rag_rpcs`
- post-check: legacy RPC 6개 `to_regprocedure(...)=false`, `search_knowledge_text=true`
- live smoke: `npm run supabase:rag:smoke` rows `3/3`

테이블 삭제는 별도 데이터 migration으로 분리합니다. 2026-05-10 운영 DB 실측 기준 `knowledge_base=53`, `command_vectors=26`, `knowledge_relationships=170` 행이 있어, 테이블/컬럼 삭제는 현재 코드 cleanup 범위를 넘습니다. 같은 날 `pg_depend` read-only 조회 기준 제거 대상 legacy RPC 6개에 매달린 dependent object는 0건이었습니다.

### Remaining legacy vector/graph helper cleanup (2026-05-10)

`20260510022419` 이후에도 request path에서 사용하지 않는 보조 함수가 public schema에 남아 있었습니다. active code 검색 기준 호출자가 없고, current KRL은 `search_knowledge_text`만 호출하므로 아래 helper RPC를 추가 제거했습니다.

| 객체 | 운영 DB 상태 | 현재 판단 |
|------|-------------|-----------|
| `get_knowledge_neighbors(...)` | 제거됨 | legacy graph neighbor helper. `20260510030704` 적용 완료 |
| `traverse_knowledge_graph(...)` | 제거됨 | legacy graph traversal helper. `20260510030704` 적용 완료 |
| `get_vector_stats()` | 제거됨 | legacy `command_vectors` stats helper. `20260510030704` 적용 완료 |
| `search_all_commands(vector, ...)` | 제거됨 | legacy vector command helper. `20260510030704` 적용 완료 |
| `search_all_commands(text)` | 제거됨 | legacy command text helper. `20260510030704` 적용 완료 |
| `search_similar_commands(vector, ...)` | 제거됨 | legacy command vector helper. `20260510030704` 적용 완료 |
| `search_similar_vectors(vector, ...)` | 제거됨 | legacy command vector helper. `20260510030704` 적용 완료 |
| `search_vectors_by_category(vector, ...)` | 제거됨 | legacy command vector helper. `20260510030704` 적용 완료 |
| `search_vectors_with_filters(vector, ...)` | 제거됨 | legacy command vector helper. `20260510030704` 적용 완료 |
| `idx_kr_weight` | 제거됨 | legacy graph traversal weight ordering index. Supabase advisor unused index INFO 해소 대상 |
| `generate_knowledge_search_vector(...)` | 존재 | current `search_vector` trigger helper. 유지 |
| `update_knowledge_search_vector()` | 존재 | current `search_vector` trigger function. 유지 |

정리 migration:
- `supabase/migrations/20260510030704_drop_remaining_legacy_vector_graph_helpers.sql`
- 범위: 위 legacy helper 함수만 `DROP FUNCTION ... RESTRICT`, unused `idx_kr_weight` 제거
- 보존: `search_knowledge_text`, `generate_knowledge_search_vector`, `update_knowledge_search_vector`, `knowledge_base`, `command_vectors`, `knowledge_relationships`, `idx_knowledge_base_search_vector`

운영 적용 완료:
- 적용일: 2026-05-10
- Supabase ledger: `20260510030704 drop_remaining_legacy_vector_graph_helpers`
- post-check: 제거 대상 helper 함수는 `to_regprocedure(...)=false`, KRL/trigger helper는 `true`
- data tables: `knowledge_base`, `command_vectors`, `knowledge_relationships` 모두 유지

### Remaining command vector text backfill (2026-05-10)

legacy helper 제거 후에도 `command_vectors` 26행 중 7행은 `knowledge_base`에 `cv:<id>` 태그로 복사되지 않은 상태였습니다. 현재 request path는 `command_vectors`를 직접 조회하지 않으므로, 해당 7개 문서를 KRL corpus로 비파괴 이관합니다.

| 객체 | 운영 DB 상태 | 현재 판단 |
|------|-------------|-----------|
| `command_vectors` | 26행, embedding 26건 | legacy inventory. 테이블/컬럼은 이번 단계에서 삭제하지 않음 |
| `knowledge_base` | 53행, embedding 52건 | current KRL corpus. 누락 command 문서를 text/search_vector 기반으로 추가 |
| `knowledge_relationships` | 170행, 모두 `knowledge_base` -> `knowledge_base` | request path 미사용이나 seed/분석 inventory로 보존 |

정리 migration:
- `supabase/migrations/20260510032441_backfill_remaining_command_vectors_to_knowledge_base.sql`
- 범위: `command_vectors` 중 `knowledge_base`에 `cv:<id>` 태그 또는 `metadata.command_id`로 존재하지 않는 문서만 `knowledge_base`에 insert
- 보존: `command_vectors.embedding`, `knowledge_base.embedding`, `command_vectors`, `knowledge_relationships`

운영 적용 완료:
- 적용일: 2026-05-10
- Supabase ledger: `20260510032441 backfill_remaining_command_vectors_to_knowledge_base`
- post-check: `knowledge_base=60`, `command_vectors=26`, `command_vectors` 26행 모두 `knowledge_base`에 `cv:<id>` 태그로 표현됨, 신규 backfill 7행
- live smoke: `systemctl service status restart`, `sfc scannow dism`, `docker run port volume` command query top result가 backfilled `Command:*` 문서로 resolve됨

판단 기준:
- embedding 컬럼은 운영 DB에 실제 값이 남아 있으므로 즉시 `DROP COLUMN` 대상이 아닙니다.
- `command_vectors` 삭제는 전체 26행이 `knowledge_base`에 이관된 뒤, 별도 archive/export와 명시 승인 하에 진행해야 합니다.
- 루트 `src/scripts/*`의 Mistral embedding 기반 seed script는 제거하고, canonical seed 경로는 `cloud-run/ai-engine/scripts/seed-knowledge-base.ts`로 유지합니다.

운영 적용 전/후 체크:

```sql
-- 적용 전: legacy RPC 6개 + current KRL RPC 1개가 resolve되는지 확인
select label, to_regprocedure(signature) is not null as resolves
from (values
  ('search_knowledge_base', 'public.search_knowledge_base(extensions.vector,double precision,integer,text,text)'),
  ('hybrid_graph_vector_search', 'public.hybrid_graph_vector_search(extensions.vector,double precision,integer,integer,integer)'),
  ('hybrid_search_vectors', 'public.hybrid_search_vectors(extensions.vector,text,double precision,integer)'),
  ('hybrid_search_with_text', 'public.hybrid_search_with_text(extensions.vector,text,double precision,double precision,double precision,double precision,integer,integer,integer,integer,text)'),
  ('match_documents', 'public.match_documents(extensions.vector,integer,jsonb)'),
  ('match_knowledge_base', 'public.match_knowledge_base(text,double precision,integer)'),
  ('search_knowledge_text', 'public.search_knowledge_text(text,integer,text)')
) as t(label, signature);

-- 적용 후: legacy 6개는 false, search_knowledge_text만 true여야 함
```

적용 후에는 `npm run supabase:rag:smoke`로 `search_knowledge_text` 경로를 다시 확인합니다.

### Low-value operational index cleanup (2026-05-10)

Supabase performance advisor가 unused index 10건을 보고했습니다. 코드 검색과 운영 DB 실측을 함께 확인한 결과, 데이터 삭제 없이 제거 가능한 단일 컬럼 인덱스 6건만 정리했습니다.

운영 실측:
- `incident_reports`: 2행, total size 104kB
- `security_audit_logs`: 287행, total size 312kB
- `approval_history`: 0행, total size 128kB
- advisor 대상 10개 인덱스 모두 `idx_scan=0`

정리 migration:
- `supabase/migrations/20260510034213_drop_low_value_unused_operational_indexes.sql`

제거:
- `idx_incident_reports_severity`
- `idx_incident_reports_status`
- `idx_security_audit_logs_action_type`
- `idx_security_audit_logs_ip`
- `idx_approval_history_status`
- `idx_approval_history_decided_at`

보존:
- `idx_incident_reports_assigned_to_fk`, `idx_incident_reports_created_by_fk`, `idx_incident_reports_resolved_by_fk`: FK/RLS update policy 보조
- `idx_security_audit_logs_user_id`: user-scoped RLS/read policy 보조
- `idx_security_audit_logs_created_at`, `idx_security_audit_logs_resource`: retention/resource access path 보조
- `idx_approval_history_status_time`, `idx_approval_history_requested_at`, `idx_approval_history_action_type`, `idx_approval_history_session_id`: current `get_approval_history`/stats access path 보조

운영 적용 완료:
- 적용일: 2026-05-10
- Supabase ledger: `20260510034213 drop_low_value_unused_operational_indexes`
- post-check: 제거 대상 6개 `to_regclass(...)=false`, 보존 대상 10개 `true`
- performance advisor: unused index INFO 10건에서 4건으로 감소. 남은 4건은 FK/RLS 보존 판단 대상입니다.
