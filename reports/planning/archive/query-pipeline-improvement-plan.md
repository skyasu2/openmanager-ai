> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-15
> Tags: rag,graphrag,knowledge-retrieval-lite,free-tier,ai-engine,supabase

# GraphRAG Removal and Knowledge Retrieval Lite Improvement Plan

- 상태: Completed
- 작성일: 2026-05-15
- TODO.md 연결: Backlog 완료 이력

## 목표

GraphRAG를 현재 제품/런타임/데이터 계약에서 완전히 제거하고, 남길 검색 경로를 Knowledge Retrieval Lite(KRL)로 단순화한다. 개선은 무료 티어와 현재 프로젝트 구조를 기준으로 진행하며, runtime embedding, pgVector, graph traversal, GraphRAG 재도입은 제외한다.

## 현재 RAG 방식 분석

현재 활성 검색 경로는 GraphRAG가 아니라 Supabase PostgreSQL full-text search 기반 KRL이다.

```text
Frontend / BFF
  -> enableRAG
  -> Cloud Run resolveRAGSetting()
  -> searchKnowledgeBase tool
  -> retrieveKnowledgeEvidence()
  -> Supabase RPC search_knowledge_text
  -> EvidenceCard[] + RetrievalMetadata
  -> AI answer / analysis basis
```

현재 request path에서 사용하지 않는 것:

- `/api/ai/graphrag/*` route
- graph traversal RPC
- vector/graph hybrid RPC
- runtime embedding 생성
- LLM rerank / HyDE query expansion
- Knowledge Retrieval 내부의 web fallback

현재 남아 있는 GraphRAG/legacy 표면:

| 표면 | 현재 상태 | 처리 방향 |
|------|-----------|-----------|
| `searchKnowledgeBase.useGraphRAG` | 제거 완료. active schema/registry에 없음 | 완료 |
| `legacy-contracts.ts`의 `searchKnowledgeBaseUseGraphRAG` | 제거 완료 | 완료 |
| `RAGResultItem.sourceType`의 `vector`/`graph` | 과거 결과 타입 호환 | 제거 |
| `RetrievalMode: 'cosine-neighbor'` | vector-era 모드 호환 | 제거 검토 후 제거 |
| `ragSources` | legacy response bridge | 신규 응답에서는 제거하고 `evidenceCards` 중심으로 전환 |
| `tavily-hybrid-rag.ts` | 실제 web search client이나 이름/타입이 Hybrid RAG | `web-search-client` 계층으로 분리 |
| `knowledge_relationships` | graph historical inventory | 운영 DB precheck 후 drop |
| `command_vectors` | legacy vector inventory. text는 KRL corpus로 backfill 완료 기록 있음 | 운영 DB precheck 후 drop |
| `knowledge_base.embedding` | runtime 미사용 vector 컬럼 | 운영 DB precheck 후 drop |

## 무료 티어 기준 판단

| 선택지 | 무료 티어 적합성 | 판단 |
|--------|------------------|------|
| GraphRAG 재도입 | 낮음. graph traversal, 관계 데이터 유지, 복잡한 QA 비용 증가 | 제외 |
| pgVector/embedding 검색 재도입 | 낮음. embedding provider/API 비용과 인덱스 관리 부담 증가 | 제외 |
| KRL 유지 + cache/contract 정리 | 높음. Supabase FTS와 제한된 evidence budget만 사용 | 채택 |
| Web search를 KRL fallback으로 결합 | 낮음. Tavily 비용/지연이 내부 검색에 섞임 | 제외 |
| 명시적 web search tool 유지 | 보통. 사용자가 최신/외부 정보를 요구할 때만 사용 | 유지 |
| 파일/PDF ingest 확장 | 별도 신규 기능. 범위가 크고 RAG cleanup과 독립 | 별도 plan 권장 |

무료 티어 원칙:

- Cloud Run은 1 vCPU / 512Mi 기준을 유지한다.
- 신규 background worker, graph DB, vector DB, managed search service를 추가하지 않는다.
- request path에서 embedding provider를 호출하지 않는다.
- KRL 결과 수는 기본 5개, 최대 10개 범위를 유지한다.
- Supabase RPC 호출은 cache TTL과 evidence budget으로 제어한다.

## 범위

포함:

- GraphRAG compatibility 입력/타입 제거
- RAG 결과 계약을 `EvidenceCard[]` + `RetrievalMetadata` 중심으로 정리
- `ragSources` 신규 응답 제거 또는 최소화
- Tavily web search와 KRL의 이름/계층 분리
- KRL cache TTL, cache size, telemetry 개선
- 근거 출처 가시성 및 category별 KRL smoke 보강
- Supabase legacy graph/vector 데이터 구조 제거 migration 준비
- active docs/data의 GraphRAG 재도입 표현 제거

제외:

- GraphRAG, Adaptive RAG, pgVector, embedding 검색 재도입
- PDF/파일 텍스트 추출 파이프라인
- 신규 검색 SaaS 또는 graph DB 도입
- historical migration/archive 파일의 과거 기록 삭제
- production DB drop의 무승인 실행

## 계약 (Contract)

2026-05-15 Codex 검토 기준, 삭제 범위와 DB migration 승인 기준이 구현 착수 가능한 수준으로 정리되어 Status를 Approved로 전환한다. T5 destructive DB migration은 이 승인에 포함하지 않으며, 운영 DB precheck와 사용자 명시 승인 후에만 진행한다.

### 변경 대상 파일

| 영역 | 파일 |
|------|------|
| Tool schema | `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.ts` |
| Retrieval contract | `cloud-run/ai-engine/src/lib/retrieval-contract.ts` |
| Tool result types | `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-types.ts` |
| Legacy registry | `cloud-run/ai-engine/src/lib/legacy-contracts.ts` |
| Legacy registry test | `cloud-run/ai-engine/src/lib/legacy-contracts.test.ts` |
| Runtime cleanup guard | `cloud-run/ai-engine/src/knowledge-runtime-cleanup.test.ts` |
| Drift guard | `tests/unit/dev/ai-retrieval-legacy-drift.test.ts` |
| Web search client | `cloud-run/ai-engine/src/lib/tavily-hybrid-rag.ts` and imports |
| Frontend retrieval status | `src/types/ai/retrieval-status.ts`, `src/lib/ai/utils/retrieval-status.ts` |
| AI sidebar metadata | `src/hooks/ai/**`, `src/components/ai/**` |
| Evidence/source visibility | `src/components/ai/analysis-basis/**`, `src/components/ai-sidebar/SidebarMessage.tsx`, `src/hooks/ai/utils/message-helpers.ts` |
| KRL category smoke | `scripts/**`, `cloud-run/ai-engine/scripts/**`, `package.json` scripts if needed |
| Supabase migration | `supabase/migrations/<timestamp>_drop_legacy_graphrag_inventory.sql` |
| Architecture docs | `docs/reference/architecture/ai/rag-knowledge-engine.md` |
| Planning | `reports/planning/TODO.md`, this file |

### 입출력 계약

| 함수/API | 현재 입력/출력 | 변경 후 계약 |
|----------|----------------|---------------|
| `searchKnowledgeBase` | `query`, `category`, `severity`, `fastMode`, `includeWebSearch` | `query`, `category`, `severity`만 canonical. `useGraphRAG`는 제거 완료. `fastMode/includeWebSearch` 제거 여부는 별도 호환성 검토 후 결정 |
| `searchKnowledgeBase` result | `results`, `evidenceCards`, `retrieval`, `ragSources` 파생 가능 | `evidenceCards` + `retrieval`을 canonical로 유지. `results`는 tool 내부 호환 결과만 유지하거나 축소 |
| `RAGResultItem.sourceType` | `vector`, `graph`, `web`, `fallback`, `knowledge`, `incident`, `runbook` | `knowledge`, `incident`, `runbook`, `web`, `fallback`만 허용. `vector/graph` 제거 |
| `RetrievalMode` | `off`, `lite`, `text-only`, `cosine-neighbor` | `off`, `lite` 우선. `text-only` 유지 필요성은 사용처 확인 후 결정. `cosine-neighbor` 제거 |
| `enableRAG` | API/BFF request flag | 이름은 호환상 유지. UI 문구는 "지식 검색" 또는 "근거 검색"으로 정리 가능 |
| Supabase KRL | `search_knowledge_text` | 유지. `knowledge_base.search_vector` trigger helper 유지 |
| Supabase legacy inventory | `vector_documents_stats`, `knowledge_relationships`, `command_vectors`, `knowledge_base.embedding` | 운영 DB precheck 후 drop migration |
| Evidence source UI | `analysisBasis`, `retrieval`, `semanticQueryTrace`, `toolResultSummaries`가 분산 표시 | OTel/domain evidence/KB/web/tool 근거를 operator가 구분할 수 있도록 표시. 신규 계약은 기존 metadata를 읽는 read-only UI 확장으로 제한 |
| KRL category smoke | 일반 RAG smoke 중심 | `architecture`, `command`, `incident` category별 대표 질의가 기대 category 결과를 반환하는 smoke를 추가. live smoke는 수동/릴리즈 gate로만 실행 |

### DB migration 계약

T5는 destructive schema change이므로 적용 전 명시 승인이 필요하다. migration은 기본적으로 `CASCADE`를 사용하지 않고, 예상 밖 dependency가 있으면 실패해야 한다.

Precheck:

```sql
SELECT to_regclass('public.knowledge_relationships') AS knowledge_relationships;
SELECT to_regclass('public.command_vectors') AS command_vectors;
SELECT to_regclass('public.vector_documents_stats') AS vector_documents_stats;
SELECT COUNT(*) FROM public.knowledge_base WHERE source = 'command_vectors_migration';
SELECT to_regprocedure('public.search_knowledge_text(text,integer,text)') AS search_knowledge_text;
```

Migration 방향:

```sql
DROP VIEW IF EXISTS public.vector_documents_stats;
DROP TABLE IF EXISTS public.knowledge_relationships;
DROP TABLE IF EXISTS public.command_vectors;
ALTER TABLE public.knowledge_base DROP COLUMN IF EXISTS embedding;
```

Postcheck:

```sql
SELECT to_regprocedure('public.search_knowledge_text(text,integer,text)') IS NOT NULL AS search_ready;
SELECT to_regclass('public.knowledge_relationships') IS NULL AS graph_table_removed;
SELECT to_regclass('public.command_vectors') IS NULL AS command_vectors_removed;
```

### 테스트 시나리오 (구현 전 확정)

- [x] `searchKnowledgeBase` schema가 `useGraphRAG`를 노출하지 않는다.
- [x] active runtime source에서 `useGraphRAG` 허용 경계가 0건이다.
- [x] active runtime source에서 graph traversal / GraphRAG endpoint import가 0건이다.
- [x] `RAGResultItem.sourceType`에 `vector`/`graph`가 없다.
- [x] `RetrievalMode`에 `cosine-neighbor`가 없다.
- [x] KRL은 `search_knowledge_text`만 호출한다.
- [x] `includeWebSearch`가 KRL 내부 web fallback으로 이어지지 않는다.
- [x] Tavily web search는 `searchWeb` 계층에서만 실행된다.
- [x] Supabase migration 초안에 `CASCADE`가 없고 `search_knowledge_text` 보존 check가 있다. 실제 적용은 T5 승인 후 진행한다.
- [x] frontend analysis basis는 `evidenceCards/retrieval` 중심으로 동작한다.
- [x] 기존 저장된 chat history가 깨지는 경우 fallback parser가 최소한으로 방어한다.
- [x] operator-facing UI에서 OTel/domain evidence/KB/web/tool 출처가 구분 가능하다.
- [x] category별 KRL smoke가 `architecture`, `command`, `incident` 대표 질의를 검증한다.

## Task 목록

### 개선 실행 우선순위

```text
완료됨
  T8  ragEnabled client dead state 제거
  T9  live knowledge_base inventory 확인 및 추가 불필요 판정
  T10 근거 출처 가시성 + category smoke hardening
  T11 한국어 운영 표현 fallback + golden smoke hardening
  T5  destructive DB inventory removal
  T7  Vercel Playwright MCP production QA

별도 plan 후보
  live-otel adapter
  long-term memory
```

판단 기준:

- T8은 기능 변경보다 혼선 제거가 목적이라 먼저 수행했고, 2026-05-15에 완료했다.
- T9는 live `rag:analyze` 기준 이미 목표 범위를 만족해 추가 seed 없이 닫았다.
- T5는 schema hygiene 성격의 destructive 변경이라 사용자 승인 후 진행했고, 2026-05-15에 완료했다.
- T10은 확인된 live category corpus를 고정하는 후속 작업이며, 2026-05-15에 완료했다.
- T11은 새 검색 인프라 없이 현재 corpus에 맞춘 alias/fallback 품질 gate를 보강하는 follow-up이며, 2026-05-15에 완료했다.
- T7은 `v8.11.154` 배포 후 Vercel production Playwright MCP QA `QA-20260515-0506`으로 완료했다.
- `live-otel adapter`와 `long-term memory`는 비용, 보안, retention 계약이 부족해 이 계획의 구현 Task로 승격하지 않는다.

### Task 0 - SDD failing tests 커밋

완료 기준:

- [x] GraphRAG 제거 계약을 표현하는 failing tests 추가
- [x] KRL canonical contract test 추가
- [x] DB migration SQL contract test 추가

진행 기록:

- 2026-05-15 Codex: `useGraphRAG` schema/legacy registry/runtime guard, `RetrievalMode` `cosine-neighbor`, `RAGResultItem.sourceType` `vector|graph`, HybridRAG web fallback API, legacy GraphRAG inventory cleanup migration 계약을 failing specs로 추가.
- 의도된 실패 확인:
  - `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts src/lib/legacy-contracts.test.ts src/knowledge-runtime-cleanup.test.ts src/lib/retrieval-contract.test.ts src/tools-ai-sdk/reporter-tools/knowledge-types.test.ts src/lib/tavily-web-search-client.contract.test.ts --silent=false` → 7 failed / 16 passed
  - `npx vitest run --config config/testing/vitest.config.node.ts tests/unit/dev/supabase-security-hardening-contract.test.ts --silent=false` → 1 failed / 11 passed

커밋 메시지:

```text
test(spec): add graphrag removal and krl cleanup specs
```

### Task 1 - GraphRAG tool contract 제거

완료 기준:

- [x] `searchKnowledgeBase.useGraphRAG` schema 제거
- [x] `legacy-contracts.ts`에서 `searchKnowledgeBaseUseGraphRAG` 제거
- [x] `legacy-contracts.test.ts`의 `'keeps useGraphRAG as input compatibility only'` 테스트 삭제 (제거 완료 검증으로 교체)
- [x] cleanup guard가 `useGraphRAG` active runtime 0건을 강제
- [x] 관련 테스트의 `useGraphRAG: true` 호환 케이스 삭제

진행 기록:

- 2026-05-15 Codex: T1 범위 구현 완료. `searchKnowledgeBase`는 더 이상 `useGraphRAG`를 schema/type/execute 입력으로 받지 않고, legacy registry에서 `searchKnowledgeBase.useGraphRAG` 계약을 제거했다.
- 검증:
  - `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts src/lib/legacy-contracts.test.ts src/knowledge-runtime-cleanup.test.ts --silent=false` → 3 files / 14 tests passed
  - `cd cloud-run/ai-engine && npm run type-check` → passed
  - 전체 T0 targeted 묶음 재실행 기준 잔여 실패는 T2/T3/T5 계약으로 축소됨.

### Task 2 - Retrieval result contract 정리

완료 기준:

- [x] `RAGResultItem.sourceType`에서 `vector`/`graph` 제거
- [x] `RetrievalMode`에서 `cosine-neighbor` 제거
- [x] backend 신규 응답은 `evidenceCards` + `retrieval` 중심으로 정렬
- [x] `ragSources`는 신규 응답 생성 경로에서 제거하거나 deprecated boundary로 격리
  - 주의: `ragSources` 사용처 74곳 — UI 렌더링 파일 포함
    - `AnalysisBasisMetadata.tsx` (lines 24-122): RAG 소스 목록 렌더링
    - `SidebarMessage.tsx` (lines 73, 297): 사이드바 소스 표시
    - `useAIChatCore.ts` (lines 149, 296): 스트리밍 데이터 수신
    - `stream-helpers.ts` (line 39): async job API 전달
  - 신규 UI는 `evidenceCards` 기반으로 렌더링하되, `ragSources ?? []` fallback을 한시 유지
- [x] frontend metadata parser는 old localStorage/history를 최소 방어하되 신규 UI 표기는 `evidenceCards/retrieval` 기준 사용
- [x] UI 회귀 확인: `AnalysisBasisMetadata`, `SidebarMessage`에서 RAG 근거 표시가 evidenceCards 기반으로 정상 동작하는지 수동 확인

진행 기록:

- 2026-05-15 Codex: T2 타입 표면 1차 정리 완료. Backend/frontend `RetrievalMode`에서 `cosine-neighbor`를 제거하고, `RAGResultItem.sourceType`에서 `vector|graph`를 제거했다. legacy fixture는 현재 KRL source type(`knowledge|incident|runbook|web`) 기준으로 정렬했다.
- 2026-05-15 Codex: T2 evidence boundary 2차 정리 완료. Streaming done event, async job result, root SSE parser, message transform, `AnalysisBasisMetadata`, `SidebarMessage`가 `evidenceCards` + `retrieval`을 우선 사용하도록 정렬했다. `ragSources`는 web-source card 및 old localStorage/history fallback boundary로만 유지한다. UI copy는 사용자 노출 "RAG" 표현을 "지식 검색/지식 근거"로 교체했다.
- 2026-05-15 Codex: local Playwright MCP로 `/dashboard/ai-assistant` 저장 대화 복원 후 `EvidenceCard[]` 2건 fixture를 검증했다. `knowledge-base 2`, `tool-result 1` source grouping, runbook/incident 근거 제목과 score badge가 렌더링됐고 valid `featureStatus` shape 기준 error overlay는 없었다. QA 기록: `QA-20260515-0504`.
- 검증:
  - `cd cloud-run/ai-engine && npx vitest run src/lib/retrieval-contract.test.ts src/tools-ai-sdk/reporter-tools/knowledge-types.test.ts src/lib/ai-sdk-utils.test.ts src/services/ai-sdk/agents/orchestrator-routing-direct-knowledge.test.ts --silent=false` → 3 files / 17 tests passed (`orchestrator-routing-direct-knowledge.test.ts`는 매칭 파일 없음으로 제외)
  - `npx vitest run --config config/testing/vitest.config.dom.ts src/hooks/ai/utils/message-helpers.test.ts src/hooks/ai/utils/chat-history-storage.test.ts src/hooks/ai/core/useChatHistory.test.ts --silent=false` → 3 files / 49 tests passed
  - `cd cloud-run/ai-engine && npx vitest run src/lib/ai-sdk-utils.test.ts src/services/ai-sdk/supervisor-multi-fallback.test.ts src/services/ai-sdk/agents/base-agent.test.ts src/services/ai-sdk/agents/orchestrator.test.ts src/services/ai-sdk/agents/orchestrator-routing.test.ts --silent=false` → 5 files / 95 tests passed
  - `npx vitest run --config config/testing/vitest.config.dom.ts src/hooks/ai/utils/message-helpers.test.ts src/hooks/ai/utils/stream-data-handler.test.ts src/hooks/ai/utils/chat-history-storage.test.ts src/hooks/ai/core/useChatHistory.test.ts src/hooks/ai/core/asyncQuerySSE.test.ts src/components/ai/AnalysisBasisBadge.test.tsx src/components/ai-sidebar/SidebarMessage.rag-badge.test.tsx --silent=false` → 7 files / 120 tests passed
  - `cd cloud-run/ai-engine && npm run type-check` → passed
  - `npm run type-check` → passed
  - 전체 T0 targeted 묶음 재실행 기준 잔여 실패는 T3/T5 계약으로 축소됨.

### Task 3 - Tavily web search와 RAG 계층 분리

완료 기준:

- [x] `tavily-hybrid-rag.ts` 이름/타입을 web search 전용으로 정리
- [x] `HybridRAGDocument`, `HybridRAGOptions`, `enhanceWithWebSearch`, `shouldTriggerWebSearch` 제거
- [x] `knowledge-search-tool.test.ts:24`의 `enhanceWithWebSearch: mockEnhanceWithWebSearch` mock import 제거 (T3 범위에 포함)
- [x] `searchWeb`와 routing policy는 web search client만 import
- [x] KRL이 Tavily fallback을 호출할 수 있는 경로가 0건임을 테스트로 보장

진행 기록:

- 2026-05-15 Codex: `tavily-hybrid-rag.ts`를 `tavily-web-search-client.ts`로 전환하고 HybridRAG fallback API를 제거했다. `searchWeb`, routing policy, supervisor web-search availability imports/tests는 새 web-search client 경계만 참조한다.
- 검증:
  - `cd cloud-run/ai-engine && npx vitest run src/lib/tavily-web-search-client.contract.test.ts src/tools-ai-sdk/reporter-tools.test.ts src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts src/domains/monitoring/routing-policy.test.ts src/services/ai-sdk/supervisor-multi-fallback.test.ts src/services/ai-sdk/supervisor-domain-wiring.contract.test.ts --silent=false` → 6 files / 118 tests passed
  - `cd cloud-run/ai-engine && npm run type-check` → passed
  - T0 AI Engine targeted 묶음 → 6 files / 23 tests passed
  - root DB migration contract test는 T5 대기 실패 1건만 유지.

### Task 4 - KRL 무료 티어 고도화

완료 기준:

- [x] KRL cache TTL을 단일 30초에서 유형별 TTL로 변경
  - 실시간/상태성 질의: 5분
  - incident/runbook/command 질의: 15분
  - architecture/docs 질의: 60분
- [x] cache max size와 eviction 정책 추가
- [x] telemetry에 `cacheTtlMs`, `cacheKeyCategory`, `cacheHit` 기록
- [x] Supabase RPC 호출 횟수 감소를 unit test로 검증
- [x] web search 자동 감지는 KRL과 독립적으로 유지하고, 명시적 external/latest 신호 없이 내부 운영 질의에 Tavily가 켜지지 않도록 회귀 테스트 보강

진행 기록:

- 2026-05-15 Codex: KRL cache를 `realtime` 5분, `operational` 15분, `docs` 60분 TTL로 분리하고, max size 100 / oldest eviction 20 정책을 추가했다. telemetry payload에 `cacheKeyCategory`, `cacheTtlMs`, `cacheHit`를 포함했다.
- 검증:
  - `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts --silent=false` → 1 file / 9 tests passed
  - `cd cloud-run/ai-engine && npm run type-check` → passed

### Task 5 - Supabase legacy GraphRAG inventory 제거 migration

완료 기준:

- 운영 DB read-only precheck 결과 기록
- `vector_documents_stats` drop
- `knowledge_relationships` drop
- `command_vectors` drop
- `knowledge_base.embedding` drop
- `search_knowledge_text`, `generate_knowledge_search_vector`, `update_knowledge_search_vector`, `knowledge_base.search_vector` 유지
- `npm run supabase:rag:smoke` 또는 동등 smoke 통과

착수 조건:

- 사용자가 production DB destructive migration 적용을 명시 승인
- `command_vectors` text backfill 상태가 운영 DB에서 재확인됨
- `search_knowledge_text` 함수 실제 시그니처를 운영 DB에서 확인 후 precheck SQL 보정
  ```sql
  -- 실제 시그니처 확인 (파라미터 타입이 다르면 to_regprocedure가 NULL 반환)
  SELECT proname, pg_get_function_arguments(oid)
  FROM pg_proc WHERE proname = 'search_knowledge_text';
  ```
  확인 후 precheck SQL의 `to_regprocedure('public.search_knowledge_text(text,integer,text)')` 를 실제 시그니처로 교체

진행 기록:

- 2026-05-15 Codex: Supabase MCP read-only precheck 완료. 실제 함수 시그니처는 `search_knowledge_text(text,integer,text)`, `generate_knowledge_search_vector(text,text,text[])`, `update_knowledge_search_vector()`로 계획서와 일치한다. 운영 DB에는 `knowledge_base=60`, `knowledge_base.embedding non-null=52`, `command_vectors=26`, `command_vectors.embedding non-null=26`, `knowledge_relationships=170`, `vector_documents_stats` view가 남아 있다. `command_vectors` 누락 backfill은 `0`건으로 제거 조건은 충족되지만, `vector_documents_stats` view가 `command_vectors`에 의존하므로 migration은 view를 먼저 제거해야 한다.
- 2026-05-15 Codex: `supabase/migrations/20260515000000_drop_legacy_graphrag_inventory.sql` 초안을 추가했다. 실제 production 적용은 destructive DB 변경이므로 사용자 명시 승인 전까지 보류한다.
- 2026-05-15 Codex: 사용자 승인 후 Supabase MCP `apply_migration`으로 production migration `drop_legacy_graphrag_inventory` 적용 완료(`20260515064903`). Postcheck에서 `knowledge_relationships`, `command_vectors`, `vector_documents_stats`, `knowledge_base.embedding` 제거 확인, `search_knowledge_text`, `generate_knowledge_search_vector`, `update_knowledge_search_vector`, `knowledge_base.search_vector` 보존 확인, `knowledge_base=60` 유지. `npm run supabase:rag:smoke` 16/16 PASS, `cd cloud-run/ai-engine && npm run rag:analyze` governance 12/12 PASS. QA 기록: `QA-20260515-0505`.

### Task 6 - 문서/데이터 표현 정리

완료 기준:

- [x] active docs/data에서 GraphRAG를 현재 기능처럼 표현하지 않음
- [x] `rag-knowledge-engine.md`를 KRL canonical 문서로 갱신
- [x] `query-pipeline-improvement-plan.md`에서 GraphRAG 재도입/Adaptive RAG 전제 제거 유지
- [x] historical archive/migration ledger는 과거 기록으로 보존
- [x] `docs:budget`, `docs:ai-consistency`, `git diff --check` 통과

진행 기록:

- 2026-05-15 Codex: `rag-knowledge-engine.md`, `ai-engine-architecture.md`, `database.md`에서 `useGraphRAG`를 현재 호환 기능처럼 설명하던 내용을 제거하고, `ragSources`를 legacy response/history bridge로 축소해 설명했다. 사용자 노출 UI copy는 "RAG" 대신 "지식 검색/지식 근거" 기준으로 정렬했다.
- 검증:
  - `npm run docs:budget` → PASS
  - `npm run docs:ai-consistency` → PASS

### Task 7 - 통합 검증 및 QA

완료 기준:

- [x] AI Engine targeted tests 통과
- [x] AI Engine `type-check` 통과
- [x] root `type-check`, `lint`, `test:quick`, `test:contract` 통과
- [x] Supabase RAG smoke 통과
- [x] Local Playwright MCP evidenceCards UI 회귀 QA 기록
- [x] Supabase legacy graph/vector inventory 제거 후 live smoke/governance QA 기록
- [x] 배포가 포함되면 GitLab pipeline 확인
- [x] Vercel production + Playwright MCP conversational QA 기록

진행 기록:

- 2026-05-15 Codex: T2/T6 로컬 deterministic gate 완료. Supabase RAG smoke와 Vercel/Playwright QA는 T5 승인 또는 배포가 포함될 때 실행한다.
- 2026-05-15 Codex: KRL alias/golden smoke 강화 후 `npm run supabase:rag:smoke` 통과. Supabase live RPC는 확인됐고, Vercel/Playwright QA 기록은 T5 적용 또는 배포가 포함될 때 진행한다.
- 2026-05-15 Codex: T2 UI 회귀 범위는 local Playwright MCP QA `QA-20260515-0504`로 기록했다. Production conversational QA는 배포/T5 적용이 포함될 때 T7로 별도 수행한다.
- 2026-05-15 Codex: T5 Supabase migration 범위는 live QA `QA-20260515-0505`로 기록했다. Vercel production QA는 push/deploy 후 T7에서 수행한다.
- 2026-05-15 Codex: `v8.11.154` release/tag 배포 후 GitLab tag pipeline `2527097775` success, main validate pipeline `2527097782` success, Vercel deployment `dpl_F8HDfrdVpxRCPUR113N32LBubvs8` ready를 확인했다. Landing AI Assistant card modal의 KRL/Postgres FTS/search_knowledge_text copy, `/dashboard/ai-assistant` 표준 5문항 대화 QA, console/network evidence를 Vercel production Playwright MCP로 검증하고 `QA-20260515-0506`에 17/17 PASS, pending 0, expert open gap 0으로 기록했다.
- 검증:
  - AI Engine targeted Vitest 5 files / 95 tests passed
  - frontend/root targeted Vitest 7 files / 120 tests passed
  - `cd cloud-run/ai-engine && npm run type-check` → passed
  - `npm run type-check` → passed
  - `npm run lint` → passed (`reports/qa/qa-tracker.json` size info only)
  - `npm run test:quick` → passed
  - `npm run test:contract` → 3 files / 24 tests passed

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| T0 failing tests | `test(spec):` | 선택 | 아니오 | 아니오 |
| T1-T3 contract cleanup | `refactor(ai):` | 예 | 예 | frontend 변경 시 |
| T4 KRL cache/routing | `feat(ai):` 또는 `refactor(ai):` | 예 | 예 | 아니오 |
| T5 DB migration | `chore(db):` | 예 | migration 적용 후 smoke | 아니오 |
| T6 docs/data | `docs:` | 선택 | 아니오 | 아니오 |
| T7 QA evidence | `test(qa):` | 예 | 이미 배포된 경우만 | 이미 배포된 경우만 |
| T8 store 잔재 제거 | `refactor(ai):` | 예 | 아니오 | 예 (BFF 변경 포함) |
| T9 live inventory closure | `docs:` 또는 `chore(knowledge):` | 선택 | 아니오 | 아니오 |
| T10 근거 출처/smoke hardening | `feat(ai):` 또는 `test(ai):` | 예 | smoke script 변경 시 아니오 | UI 변경 시 예 |

## 리스크와 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 오래된 tool-call payload가 `useGraphRAG`를 보냄 | schema parse 차이 | unknown key strip 동작 확인 또는 명확한 validation error로 고정 |
| chat history가 `ragSources`만 보유 | 과거 메시지 근거 표시 누락 | frontend read-only fallback parser는 한시 유지 가능 |
| `ragSources` 제거 시 UI 렌더링 공백 | `AnalysisBasisMetadata`/`SidebarMessage` RAG 소스 섹션 빈 화면 | T2에서 evidenceCards fallback 렌더링 확보 후 ragSources UI 코드 교체. 수동 QA 필수 |
| DB drop 후 숨은 dependency 발견 | migration 실패 또는 runtime 오류 | `CASCADE` 금지, precheck/postcheck, smoke 필수 |
| KRL TTL 증가로 오래된 상태성 답변 | 최신성 저하 | 상태성 질의 TTL 5분, status/metric tool은 RAG보다 우선 |
| `tavily-hybrid-rag.ts` rename으로 import 누락 | build 실패 | type-check와 targeted tests로 차단 |
| 근거 출처 UI가 과도하게 복잡해짐 | 운영자 스캔성 저하 | 기존 analysis basis 영역 안에서 source grouping만 추가하고, 본문 답변에는 장식 문구를 넣지 않음 |
| category smoke가 운영 DB 상태에 의존 | CI false-fail 또는 외부 비용 | deterministic unit/contract test를 기본 gate로 두고 live smoke는 수동/릴리즈 gate에서만 실행 |

## 완료 기준

- [x] active runtime에 GraphRAG/useGraphRAG/graph traversal 경로가 없다.
- [x] active response contract는 `EvidenceCard[]` + `RetrievalMetadata` 중심이다.
- [x] KRL request path는 `search_knowledge_text`만 사용한다.
- [x] Tavily web search는 독립 tool로만 동작한다.
- [x] legacy graph/vector DB inventory가 승인된 migration으로 제거된다.
- [x] 문서와 UI copy가 GraphRAG를 현재 기능처럼 표현하지 않는다.
- [x] `ragEnabled` store 잔재가 제거되어 dead state가 남아 있지 않다.
- [x] 지식 베이스에 `architecture`·`command` 카테고리 항목이 각 3개 이상 존재한다.
- [x] 근거 출처가 OTel/domain evidence/KB/web/tool 중 무엇인지 operator-facing UI와 metadata에서 구분 가능하다.
- [x] KRL category smoke가 `architecture`, `command`, `incident` 대표 질의를 검증한다.
- [x] 로컬 검증과 Supabase smoke가 기록된다.
- [x] Vercel Playwright MCP QA가 기록된다.

### Task 8 - ragEnabled store 잔재 제거

**배경**: Product UI는 RAG 토글을 이미 노출하지 않으며(`// Product UI no longer exposes this`), `ragEnabled`는 항상 `false`로 고정된 dead state다. 그럼에도 store·hook·컴포넌트에 변수명이 남아 있어 오해를 유발한다.

완료 기준:

- [x] `useAISidebarStore.ts`에서 `ragEnabled`, `setRagEnabled` 상태 및 setter 제거
- [x] `useAIChatCore.ts`에서 `ragEnabled` 구독 및 supervisor 전달 제거 (Auto 동작은 서버사이드 `resolveRAGSetting()`이 담당하므로 클라이언트 플래그 불필요)
- [x] `SidebarMessage.tsx`에서 `ragEnabled: Boolean(analysisBasis.ragUsed)` prop 정리
- [x] store 리셋 경로(`ragEnabled: false`)·`reset()` 제거
- [x] 삭제 후 `type-check`, `test:quick` 통과

대상 파일:

| 파일 | 제거 대상 |
|------|-----------|
| `src/stores/useAISidebarStore.ts` | `ragEnabled`, `setRagEnabled` (lines 311, 333, 369, 451-455, 499, 532) |
| `src/hooks/ai/useAIChatCore.ts` | `ragEnabled` 구독(line 133), supervisor 전달(lines 239, 288) |
| `src/components/ai-sidebar/SidebarMessage.tsx` | `ragEnabled: Boolean(...)` prop(line 88) |

리스크:

- `ragEnabled`를 참조하는 테스트가 실패할 수 있음 → `SidebarMessage.rag-badge.test.tsx` 및 sidebar/workspace mock 동반 수정 완료

진행 기록:

- 2026-05-15 Codex: `useAISidebarStore`의 `ragEnabled/setRagEnabled` 상태와 rehydrate/reset 정규화 경로를 제거했다.
- 2026-05-15 Codex: `useAIChatCore`가 더 이상 store RAG override를 구독하거나 `useHybridAIQuery`/message transform으로 전달하지 않도록 정리했다. 지식 검색 활성 여부는 서버 Auto 정책과 응답 metadata/retrieval contract가 판단한다.
- 2026-05-15 Codex: `SidebarMessage`와 `AnalysisBasisMetadata`의 fallback status 계산에서 `ragEnabled` 플래그 전달을 제거하고, legacy `ragUsed`는 실제 evidence fallback으로만 유지했다.
- 2026-05-15 Codex: 관련 unit/story mock에서 dead state 필드를 제거했다.
- 검증:
  - `npx vitest run --config config/testing/vitest.config.dom.ts src/stores/useAISidebarStore.test.ts src/hooks/ai/useAIChatCore.test.ts src/hooks/ai/useEnhancedChatMessages.test.ts src/components/ai-sidebar/SidebarMessage.rag-badge.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx src/components/ai-sidebar/AISidebarV4.smoke.test.tsx src/components/ai/AIWorkspace.test.tsx --silent=false` → 7 files / 85 tests passed
  - `npm run type-check` → passed
  - `npm run test:quick` → passed
  - `git diff --check` → passed

---

### Task 9 - 지식 베이스 항목 강화

**배경**: 계획 작성 당시에는 built-in seed set만 보고 `architecture`, `command` 카테고리가 비어 있다고 판단했다. 하지만 운영 live `knowledge_base`는 이미 migration/import/manual 항목을 포함해 목표 범위를 만족하고 있었다. 따라서 이 Task는 추가 seed가 아니라 live inventory 확인 및 과증식 방지로 닫는다.

live 항목 분포 (`cd cloud-run/ai-engine && npm run rag:analyze`, 2026-05-15):

| 카테고리 | live 수 | 목표 범위 | 판정 |
|----------|:-------:|:---------:|:----:|
| `command` | 25 | 18-25 | PASS |
| `incident` | 9 | 8-12 | PASS |
| `best_practice` | 9 | 8-12 | PASS |
| `troubleshooting` | 11 | 8-12 | PASS |
| `architecture` | 5 | 2-5 | PASS |
| `security` | 1 | 1-2 | PASS |

완료 기준:

- [x] live `knowledge_base` category coverage를 `npm run rag:analyze`로 확인
- [x] `architecture` 카테고리 3개 이상 존재 (`5`)
- [x] `command` 카테고리 3개 이상 존재 및 target range 상한 이내 (`25`)
- [x] `incident`, `best_practice`, `security`가 target range 충족
- [x] `RAG-GOV-001` total docs 기준 PASS (`60 docs`, target `<=60`, hard `<=64`)
- [x] 잘못된 추가 seed 10건은 관계 참조 0건 확인 후 같은 turn에서 롤백 (`deleted=10`, total `60`)
- [x] seed script 변경은 최종 패치에 남기지 않음
- [x] category별 대표 질의 smoke는 T10에서 deterministic/live 분리 후 진행

진행 기록:

- 2026-05-15 Codex: built-in seed set에 10건을 추가해 dry-run을 통과시켰으나, live 적용 직후 기존 운영 KB가 이미 60건이었음을 확인했다.
- 2026-05-15 Codex: `npm run rag:analyze` 결과 total `70`으로 `RAG-GOV-001 FAIL`을 확인했고, 신규 title 10건만 관계 참조 0건 확인 후 롤백했다. 롤백 후 total은 `60`.
- 2026-05-15 Codex: 재실행한 `npm run rag:analyze`에서 governance checks 전부 PASS, category target range 전부 PASS 확인.
- 결론: T9의 원래 추가 작업은 stale plan assumption에 기반했으므로 더 진행하지 않는다. 다음 작업은 T10 category smoke hardening이다.

리스크:

- live inventory 확인 없이 seed만 보고 corpus를 추가하면 `HARD_MAX_TOTAL_DOCS=64`를 초과할 수 있다.
- 향후 KB 추가 전에는 반드시 `npm run rag:analyze`로 total/category/headroom을 먼저 확인한다.

---

### Task 10 - 근거 출처 가시성 및 KRL category smoke hardening

**배경**: 현재 `EvidenceCard[]`, `RetrievalMetadata`, `semanticQueryTrace`, `toolResultSummaries`는 존재하지만, 운영자가 답변 근거를 빠르게 구분하려면 "OTel replay/domain evidence/KB/web/tool" 출처가 더 명확해야 한다. 또한 T9 live inventory에서 category target range가 이미 PASS임을 확인했으므로, category별 smoke를 추가해 `architecture`, `command`, `incident` 검색 품질이 다시 비는 회귀를 막아야 한다.

완료 기준:

- [x] `AnalysisBasisMetadata` 또는 동등 analysis basis UI에서 근거 출처를 아래 그룹으로 구분한다.
  - `monitoring-data`: synthetic OTel replay, monitoring snapshot, deterministic domain evidence
  - `knowledge-base`: KRL `EvidenceCard[]`
  - `web-search`: Tavily `searchWeb`
  - `tool-result`: metrics/logs/RCA/math/command tool summaries
- [x] `semanticQueryTrace.selectedEvidenceProvider`가 있으면 domain evidence 출처로 표시한다.
- [x] `retrieval.webUsed`, `evidenceCards[].sourceType === 'web'`, web source cards를 web-search 출처로 묶는다.
- [x] 기존 저장된 메시지에 `ragSources`만 있어도 legacy fallback을 유지하되 신규 표기는 `EvidenceCard[]`를 우선한다.
- [x] category smoke가 최소 3개 대표 질의를 검증한다.
  - `architecture`: "서버 토폴로지 구조가 어떻게 되나요?"
  - `command`: "CPU 진단 명령어 알려줘"
  - `incident`: "DB 연결 장애 어떻게 대응하나요?"
- [x] smoke는 live Supabase 호출이 필요하면 CI 기본 gate에 넣지 않고 수동/릴리즈 gate 명령으로 분리한다.
- [x] `type-check`, 관련 targeted tests, `test:quick` 통과

대상 파일 후보:

| 파일 | 변경 방향 |
|------|-----------|
| `src/components/ai/analysis-basis/AnalysisBasisMetadata.tsx` | source grouping 표시 |
| `src/components/ai-sidebar/SidebarMessage.tsx` | compact source summary 반영 |
| `src/hooks/ai/utils/message-helpers.ts` | metadata → analysisBasis source grouping normalization |
| `src/lib/ai/utils/retrieval-status.ts` | evidence source normalization helper 보강 |
| `cloud-run/ai-engine/scripts/*` 또는 `scripts/*` | category smoke 명령 추가 |
| `package.json` | live smoke script가 필요할 때만 script 추가 |

테스트 시나리오:

- [x] `EvidenceCard[]`가 있으면 KB 근거가 `knowledge-base` 그룹으로 표시된다.
- [x] `semanticQueryTrace.evidenceAvailable=true`이면 domain evidence 그룹이 표시된다.
- [x] web evidence와 KB evidence가 섞여도 UI가 두 출처를 분리한다.
- [x] legacy `ragSources`만 있는 저장 메시지는 기존 fallback을 유지한다.
- [x] category smoke fixture 또는 live smoke가 expected category를 검증한다.

리스크:

- UI에 출처 라벨이 과도하게 늘면 답변보다 metadata가 더 시끄러워질 수 있다. 기본 compact 요약 + 상세 패널 확장 구조를 우선한다.
- live Supabase smoke는 외부 의존이므로 deterministic fixture test와 분리한다.

진행 기록:

- 2026-05-15 Codex: `AnalysisBasis.sourceGroups`를 추가하고 message transform에서 `monitoring-data`, `knowledge-base`, `web-search`, `tool-result`를 정규화하도록 구현했다.
- 2026-05-15 Codex: `AnalysisBasisMetadata` 상세 패널에 operator-facing source group badge를 추가했다. `semanticQueryTrace.selectedEvidenceProvider`는 `monitoring-data` detail로 표시한다.
- 2026-05-15 Codex: `supabase:rag:smoke`에 `architecture`, `command`, `incident` category 대표 질의와 expected category 검증을 추가했다.
- 검증:
  - `npx vitest run --config config/testing/vitest.config.dom.ts src/hooks/ai/utils/message-helpers.test.ts src/components/ai/AnalysisBasisBadge.test.tsx src/components/ai-sidebar/SidebarMessage.rag-badge.test.tsx --silent=false` → 3 files / 59 tests passed
  - `npm run type-check` → passed
  - `npm run supabase:rag:smoke` → category `architecture`, `command`, `incident` 포함 PASS
  - `npm run lint` → passed (`reports/qa/qa-tracker.json` size info only)
  - `npm run test:quick` → passed
  - `npm run docs:budget` → PASS
  - `npm run docs:ai-consistency` → PASS
  - `git diff --check` → passed

---

### Task 11 - KRL 한국어 운영 표현 fallback 및 golden smoke 강화

**배경**: 현재 corpus는 60건 규모로 충분하며, 별도 검색 SaaS나 embedding 재도입은 무료 티어/운영 복잡도 대비 이득이 작다. 대신 실제 운영자가 자주 쓰는 표현(`프로세서 사용률`, `mysql 접속 실패`, `서버 토폴로지 구성도`)이 KRL fallback과 live smoke에서 고정되도록 보강한다.

완료 기준:

- [x] KRL deterministic fallback이 `프로세서` 표현을 CPU 후보로 정규화한다.
- [x] KRL deterministic fallback이 `mysql`/`mariadb` 접속 실패를 database connection 후보로 정규화한다.
- [x] KRL deterministic fallback이 `구성도`/`구조` 표현을 topology 후보로 정규화한다.
- [x] `supabase:rag:smoke`가 row count 외에 기대 top title/category를 검증한다.
- [x] live smoke에 CPU processor alias, MySQL connection alias, Korean topology diagram, OTel SSOT path를 추가한다.
- [x] 새 vector/graph/managed search 인프라를 추가하지 않는다.

진행 기록:

- 2026-05-15 Codex: `knowledge-retrieval-lite.ts`의 fallback signal을 한국어 운영 표현 기준으로 확장했다. 변경은 KRL 후보 생성에만 한정했고 Supabase schema/RPC 변경은 하지 않았다.
- 2026-05-15 Codex: `scripts/test/supabase-rag-rpc-smoke.mjs`를 golden smoke로 강화해 기대 제목/카테고리와 금지 precision marker를 함께 확인하도록 정리했다.
- 검증:
  - `cd cloud-run/ai-engine && npx vitest run src/lib/knowledge-retrieval-lite.test.ts --silent=false` → 1 file / 11 tests passed
  - `node --check scripts/test/supabase-rag-rpc-smoke.mjs` → passed
  - `npm run supabase:rag:smoke` → 16 checks PASS (`cpu-processor-alias`, `mysql-connection-alias`, `korean-topology-diagram`, `otel-ssot-path` 포함)

리스크:

- live smoke는 운영 DB corpus와 연결되므로 기본 CI gate에 넣지 않는다.
- 기대 제목은 corpus 변경과 함께 갱신해야 하며, 단순 ranking 변동이 제품 결함인지 corpus 변경인지 확인 후 조정한다.

---

## 실행 순서 제안

```text
완료됨: T0 → T1 → T2(코드+UI QA) → T3 → T4 → T5 → T6 → T8 → T9(live inventory) → T10 → T11

현재 대기:
  T7 → T5 완료 또는 배포 후 production/Vercel QA 기록

신규: 없음
```

**착수 권장 순서**: push/deploy → T7(QA)

T5 destructive DB 변경은 사용자 승인 후 완료됐으며, 남은 검증은 배포된 frontend/Cloud Run 표면에서 production QA로 닫는다.
