> Owner: project
> Status: In Progress
> Doc type: How-to
> Last reviewed: 2026-05-15
> Tags: rag,graphrag,knowledge-retrieval-lite,free-tier,ai-engine,supabase

# GraphRAG Removal and Knowledge Retrieval Lite Improvement Plan

- 상태: In Progress
- 작성일: 2026-05-15
- TODO.md 연결: Active Tasks > P1: GraphRAG 완전 제거 SDD

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
| `searchKnowledgeBase.useGraphRAG` | compat-only 입력. 실행 로직에서는 무시 | 제거 |
| `legacy-contracts.ts`의 `searchKnowledgeBaseUseGraphRAG` | 제거 예정 계약 | 제거 |
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
| Supabase migration | `supabase/migrations/<timestamp>_drop_legacy_graphrag_inventory.sql` |
| Architecture docs | `docs/reference/architecture/ai/rag-knowledge-engine.md` |
| Planning | `reports/planning/TODO.md`, this file |

### 입출력 계약

| 함수/API | 현재 입력/출력 | 변경 후 계약 |
|----------|----------------|---------------|
| `searchKnowledgeBase` | `query`, `category`, `severity`, `useGraphRAG`, `fastMode`, `includeWebSearch` | `query`, `category`, `severity`만 canonical. `fastMode/includeWebSearch` 제거 여부는 별도 호환성 검토 후 결정 |
| `searchKnowledgeBase` result | `results`, `evidenceCards`, `retrieval`, `ragSources` 파생 가능 | `evidenceCards` + `retrieval`을 canonical로 유지. `results`는 tool 내부 호환 결과만 유지하거나 축소 |
| `RAGResultItem.sourceType` | `vector`, `graph`, `web`, `fallback`, `knowledge`, `incident`, `runbook` | `knowledge`, `incident`, `runbook`, `web`, `fallback`만 허용. `vector/graph` 제거 |
| `RetrievalMode` | `off`, `lite`, `text-only`, `cosine-neighbor` | `off`, `lite` 우선. `text-only` 유지 필요성은 사용처 확인 후 결정. `cosine-neighbor` 제거 |
| `enableRAG` | API/BFF request flag | 이름은 호환상 유지. UI 문구는 "지식 검색" 또는 "근거 검색"으로 정리 가능 |
| Supabase KRL | `search_knowledge_text` | 유지. `knowledge_base.search_vector` trigger helper 유지 |
| Supabase legacy inventory | `knowledge_relationships`, `command_vectors`, `knowledge_base.embedding` | 운영 DB precheck 후 drop migration |

### DB migration 계약

T5는 destructive schema change이므로 적용 전 명시 승인이 필요하다. migration은 기본적으로 `CASCADE`를 사용하지 않고, 예상 밖 dependency가 있으면 실패해야 한다.

Precheck:

```sql
SELECT to_regclass('public.knowledge_relationships') AS knowledge_relationships;
SELECT to_regclass('public.command_vectors') AS command_vectors;
SELECT COUNT(*) FROM public.knowledge_base WHERE source = 'command_vectors_migration';
SELECT to_regprocedure('public.search_knowledge_text(text,integer,text)') AS search_knowledge_text;
```

Migration 방향:

```sql
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

- [ ] `searchKnowledgeBase` schema가 `useGraphRAG`를 노출하지 않는다.
- [ ] active runtime source에서 `useGraphRAG` 허용 경계가 0건이다.
- [ ] active runtime source에서 graph traversal / GraphRAG endpoint import가 0건이다.
- [ ] `RAGResultItem.sourceType`에 `vector`/`graph`가 없다.
- [ ] `RetrievalMode`에 `cosine-neighbor`가 없다.
- [ ] KRL은 `search_knowledge_text`만 호출한다.
- [ ] `includeWebSearch`가 KRL 내부 web fallback으로 이어지지 않는다.
- [ ] Tavily web search는 `searchWeb` 계층에서만 실행된다.
- [ ] Supabase migration에 `CASCADE`가 없고 `search_knowledge_text` 보존 check가 있다.
- [ ] frontend analysis basis는 `evidenceCards/retrieval` 중심으로 동작한다.
- [ ] 기존 저장된 chat history가 깨지는 경우 fallback parser가 최소한으로 방어한다.

## Task 목록

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
- [ ] backend 신규 응답은 `evidenceCards` + `retrieval` 중심으로 정렬
- [ ] `ragSources`는 신규 응답 생성 경로에서 제거하거나 deprecated boundary로 격리
  - 주의: `ragSources` 사용처 74곳 — UI 렌더링 파일 포함
    - `AnalysisBasisMetadata.tsx` (lines 24-122): RAG 소스 목록 렌더링
    - `SidebarMessage.tsx` (lines 73, 297): 사이드바 소스 표시
    - `useAIChatCore.ts` (lines 149, 296): 스트리밍 데이터 수신
    - `stream-helpers.ts` (line 39): async job API 전달
  - 신규 UI는 `evidenceCards` 기반으로 렌더링하되, `ragSources ?? []` fallback을 한시 유지
- [ ] frontend metadata parser는 old localStorage/history를 최소 방어하되 신규 UI 표기는 `evidenceCards/retrieval` 기준 사용
- [ ] UI 회귀 확인: `AnalysisBasisMetadata`, `SidebarMessage`에서 RAG 근거 표시가 evidenceCards 기반으로 정상 동작하는지 수동 확인 필수

진행 기록:

- 2026-05-15 Codex: T2 타입 표면 1차 정리 완료. Backend/frontend `RetrievalMode`에서 `cosine-neighbor`를 제거하고, `RAGResultItem.sourceType`에서 `vector|graph`를 제거했다. legacy fixture는 현재 KRL source type(`knowledge|incident|runbook|web`) 기준으로 정렬했다.
- 검증:
  - `cd cloud-run/ai-engine && npx vitest run src/lib/retrieval-contract.test.ts src/tools-ai-sdk/reporter-tools/knowledge-types.test.ts src/lib/ai-sdk-utils.test.ts src/services/ai-sdk/agents/orchestrator-routing-direct-knowledge.test.ts --silent=false` → 3 files / 17 tests passed (`orchestrator-routing-direct-knowledge.test.ts`는 매칭 파일 없음으로 제외)
  - `npx vitest run --config config/testing/vitest.config.dom.ts src/hooks/ai/utils/message-helpers.test.ts src/hooks/ai/utils/chat-history-storage.test.ts src/hooks/ai/core/useChatHistory.test.ts --silent=false` → 3 files / 49 tests passed
  - `cd cloud-run/ai-engine && npm run type-check` → passed
  - `npm run type-check` → passed
  - 전체 T0 targeted 묶음 재실행 기준 잔여 실패는 T3/T5 계약으로 축소됨.

### Task 3 - Tavily web search와 RAG 계층 분리

완료 기준:

- `tavily-hybrid-rag.ts` 이름/타입을 web search 전용으로 정리
- `HybridRAGDocument`, `HybridRAGOptions`, `enhanceWithWebSearch`, `shouldTriggerWebSearch` 제거
- `knowledge-search-tool.test.ts:24`의 `enhanceWithWebSearch: mockEnhanceWithWebSearch` mock import 제거 (T3 범위에 포함)
- `searchWeb`와 routing policy는 web search client만 import
- KRL이 Tavily fallback을 호출할 수 있는 경로가 0건임을 테스트로 보장

### Task 4 - KRL 무료 티어 고도화

완료 기준:

- KRL cache TTL을 단일 30초에서 유형별 TTL로 변경
  - 실시간/상태성 질의: 5분
  - incident/runbook/command 질의: 15분
  - architecture/docs 질의: 60분
- cache max size와 eviction 정책 추가
- telemetry에 `cacheTtlMs`, `cacheKeyCategory`, `cacheHit` 기록
- Supabase RPC 호출 횟수 감소를 unit test로 검증
- web search 자동 감지는 KRL과 독립적으로 유지하고, 명시적 external/latest 신호 없이 내부 운영 질의에 Tavily가 켜지지 않도록 회귀 테스트 보강

### Task 5 - Supabase legacy GraphRAG inventory 제거 migration

완료 기준:

- 운영 DB read-only precheck 결과 기록
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

### Task 6 - 문서/데이터 표현 정리

완료 기준:

- active docs/data에서 GraphRAG를 현재 기능처럼 표현하지 않음
- `rag-knowledge-engine.md`를 KRL canonical 문서로 갱신
- `query-pipeline-improvement-plan.md`에서 GraphRAG 재도입/Adaptive RAG 전제 제거 유지
- historical archive/migration ledger는 과거 기록으로 보존
- `docs:budget`, `docs:ai-consistency`, `git diff --check` 통과

### Task 7 - 통합 검증 및 QA

완료 기준:

- AI Engine targeted tests 통과
- AI Engine `type-check` 통과
- root `type-check`, `lint`, `test:quick`, `test:contract` 통과
- Supabase RAG smoke 통과
- 배포가 포함되면 GitLab pipeline 확인
- Vercel production + Playwright MCP conversational QA 기록

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| T0 failing tests | `test(spec):` | 선택 | 아니오 | 아니오 |
| T1-T3 contract cleanup | `refactor(ai):` | 예 | 예 | frontend 변경 시 |
| T4 KRL cache/routing | `feat(ai):` 또는 `refactor(ai):` | 예 | 예 | 아니오 |
| T5 DB migration | `chore(db):` | 예 | migration 적용 후 smoke | 아니오 |
| T6 docs/data | `docs:` | 선택 | 아니오 | 아니오 |
| T7 QA evidence | `test(qa):` | 예 | 이미 배포된 경우만 | 이미 배포된 경우만 |

## 리스크와 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 오래된 tool-call payload가 `useGraphRAG`를 보냄 | schema parse 차이 | unknown key strip 동작 확인 또는 명확한 validation error로 고정 |
| chat history가 `ragSources`만 보유 | 과거 메시지 근거 표시 누락 | frontend read-only fallback parser는 한시 유지 가능 |
| `ragSources` 제거 시 UI 렌더링 공백 | `AnalysisBasisMetadata`/`SidebarMessage` RAG 소스 섹션 빈 화면 | T2에서 evidenceCards fallback 렌더링 확보 후 ragSources UI 코드 교체. 수동 QA 필수 |
| DB drop 후 숨은 dependency 발견 | migration 실패 또는 runtime 오류 | `CASCADE` 금지, precheck/postcheck, smoke 필수 |
| KRL TTL 증가로 오래된 상태성 답변 | 최신성 저하 | 상태성 질의 TTL 5분, status/metric tool은 RAG보다 우선 |
| `tavily-hybrid-rag.ts` rename으로 import 누락 | build 실패 | type-check와 targeted tests로 차단 |

## 완료 기준

- [ ] active runtime에 GraphRAG/useGraphRAG/graph traversal 경로가 없다.
- [ ] active response contract는 `EvidenceCard[]` + `RetrievalMetadata` 중심이다.
- [ ] KRL request path는 `search_knowledge_text`만 사용한다.
- [ ] Tavily web search는 독립 tool로만 동작한다.
- [ ] legacy graph/vector DB inventory가 승인된 migration으로 제거된다.
- [ ] 문서와 UI copy가 GraphRAG를 현재 기능처럼 표현하지 않는다.
- [ ] 로컬 검증, Supabase smoke, Vercel Playwright MCP QA가 기록된다.

## 실행 순서 제안

```text
T0 failing tests
  -> T1 useGraphRAG 제거
  -> T2 result contract 정리
  -> T3 web search 분리
  -> T4 KRL 무료 티어 고도화
  -> T6 docs 정리
  -> T5 DB migration 승인 후 적용
  -> T7 QA/배포 closure
```

T5는 destructive DB 변경이므로 T1-T4가 완료되고 운영 DB precheck가 끝난 뒤 별도 승인으로 진행한다.
