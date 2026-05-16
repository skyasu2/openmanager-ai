# Knowledge Retrieval Lite Architecture

> OpenManager 내부 지식 검색 및 EvidenceCard 아키텍처 레퍼런스
> Owner: platform-architecture
> Status: Active
> Doc type: Reference
> Last reviewed: 2026-05-15
> Canonical: docs/reference/architecture/ai/rag-knowledge-engine.md
> Tags: ai,rag,knowledge-engine,architecture
>
> **v1.11.0** | Updated 2026-05-15
>
> 내부 지식 검색 및 근거 주입 아키텍처 상세 문서입니다.

**관련 문서**: [AI Engine Architecture](./ai-engine-architecture.md)

---

## Overview

OpenManager AI의 내부 지식 검색은 **Knowledge Retrieval Lite** 기반입니다. 목적은 운영 매뉴얼, 사용 가이드, 서버 역할/토폴로지, 장애 이력, 장애 대응 절차를 LLM 컨텍스트에 주입하는 것입니다.

현재 런타임은 무료 티어와 Cloud Run request path 제약을 우선합니다. 따라서 내부 지식 검색 단계에서 외부 embedding, graph expansion, query-expansion LLM, reranking LLM, 자동 web-search fallback을 호출하지 않습니다. 외부 웹 검색은 별도 `searchWeb` 도구와 quota 정책으로 분리합니다.

즉, retrieval 단계는 deterministic search/metadata boost이고, LLM은 최종 agent 답변 생성 단계에서 `EvidenceCard[]`를 참고할 때만 사용됩니다.

## Storage And Serving Decision

현재 규모에서는 Supabase PostgreSQL Full Text Search를 검색 serving index로 유지합니다. 원본 지식은 repo 문서와 seed JSON에 남기고, Supabase `knowledge_base`는 재생성 가능한 materialized index로 취급합니다.

```text
Source of truth
  repo docs / seed JSON
        |
        v
Search serving index
  Supabase knowledge_base
  + search_vector
  + search_knowledge_text RPC
        |
        v
AI runtime
  Knowledge Retrieval Lite
  + EvidenceCard[]
```

| 선택지 | 현재 판단 | 이유 |
|---|---|---|
| Supabase Postgres FTS | 유지 | 60건 규모의 운영 지식에는 충분하고, 추가 검색 SaaS/embedding 비용 없이 deterministic smoke가 가능 |
| Google Cloud Vertex AI Search | 보류 | PDF/DOCX/웹 대량 ingest, IAM 연동, managed indexing이 필요할 때 검토할 상위 옵션 |
| Google Cloud Storage | 보조 후보 | 원본 파일 보관에는 적합하지만 검색 인덱스 자체는 아님 |
| Vercel Blob / Edge Config | 비주력 | 파일·작은 설정 보관에는 적합하지만 운영 지식 검색 DB로는 맞지 않음 |

이 구조는 Supabase 의존을 검색 인덱스 계층으로 제한합니다. Supabase를 바꾸더라도 repo 원본에서 새 인덱스를 재생성할 수 있어 벤더 락인 위험을 낮춥니다.

## Retrieval Quality Gate

KRL 품질 관리는 새 검색 인프라를 붙이는 대신 현재 corpus와 운영 질문에 맞춘 deterministic fallback과 live golden smoke로 제한합니다.

```text
operator wording
  프로세서 사용률 / mysql 접속 실패 / 서버 토폴로지 구성도
        |
        v
KRL query fallback
  cpu / database connection / topology
        |
        v
Supabase smoke
  expected top title/category checks
```

현재 `npm run supabase:rag:smoke`는 row count만 보지 않고 CPU, 디스크, Redis, topology, OTel SSOT, Nginx 502, command backfill, category filter, MySQL connection alias의 기대 제목/카테고리를 확인합니다. 이 gate는 CI 기본 경로가 아니라 수동/릴리즈 gate로 실행하며, 운영 DB 상태가 바뀌면 기대값을 corpus 변경과 함께 갱신합니다.

## Internal Knowledge Corpus Governance (2026-02-23)

`knowledge_base` 운영 품질을 유지하기 위한 문서 수/길이 제약입니다. 기준은 `cloud-run/ai-engine/src/lib/rag-doc-policy.ts`를 SSOT로 사용합니다.

### 현재 규모 (실측, 정리 후)

| 지표 | 값 |
|------|---:|
| 총 문서 수 | 60 |
| 타깃 길이(280~520자) | 60 |
| 타깃 미달(<280자) | 0 |
| 하드 제한 초과(>600자) | 0 |
| command 카테고리 | 25 (41.67%) |
| auto_generated | 0 |

### 운영 제약 (권장/하드)

| 규칙 | 기준 |
|------|------|
| 총 문서 수 | 권장 `<=60`, 하드 `<=64` |
| 문서 길이 | 권장 `280~520자`, 하드 `<=600자` |
| 타깃 미달 비율 | `<=15%` |
| 하드 초과 비율 | `<=8%` |
| command 비중 | `<=42%` |
| auto_generated 문서 | `<=1` |
| placeholder 제목(예: `제목`) | `0` 유지 |

### 카테고리 목표 범위

| 카테고리 | 목표 범위 |
|----------|-----------|
| command | 18~25 |
| incident | 8~12 |
| best_practice | 8~12 |
| troubleshooting | 8~12 |
| architecture | 2~5 |
| security | 1~2 |

### 큐레이션 우선순위

1. `auto_generated` 중 placeholder 제목/내용 문서 우선 삭제 또는 재생성
2. `below_target` 문서(특히 130~220자대 seed_script)를 주제별로 병합 또는 확장
3. `over_limit` 장문 문서는 2~3개 문서로 분할해 검색 정밀도 개선
4. `command` 과다 시 Windows 전용/저빈도 명령부터 축소 검토

### Best Practice Reference

- Azure AI Search의 RAG 가이드: 인덱싱/청킹/관련성 튜닝을 검색 품질 핵심 요소로 명시  
  https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview
- Azure의 청킹 전략 가이드: 의미 단위 청킹과 파이프라인 단순화를 권장  
  https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-chunk-documents
- Google Vertex AI RAG Engine: 검색 품질을 위한 인덱싱/임베딩/구조화 워크플로 강조  
  https://cloud.google.com/vertex-ai/generative-ai/docs/rag-overview

위 외부 가이드는 방향성 근거이며, OpenManager의 최종 기준값은 deterministic test, `supabase:rag:smoke`, production telemetry로 주기 재보정합니다.

### Key Technologies

| 기술 | 역할 | 구현체 |
|------|------|--------|
| **Retrieval Policy** | 지식 검색 실행 여부, feature 상태, suppressed reason 결정 | `retrieval-contract.ts`, supervisor/orchestrator routing |
| **Postgres Full Text Search** | 내부 지식 키워드 검색. exact/full query를 우선하고 결과가 좁으면 token-prefix OR recall fallback + token-overlap ranking 사용 | Supabase RPC `search_knowledge_text` |
| **Metadata Boost** | 서버 역할, AZ, severity, category, tag 기반 재정렬 | `knowledge-retrieval-lite.ts` |
| **EvidenceCard** | frontend/backend 공통 evidence 계약 | `retrieval-contract.ts` |
| **Legacy Boundary** | `ragSources` response bridge. 신규 계약은 `EvidenceCard[]` + `RetrievalMetadata` | `legacy-contracts.ts`, frontend history parser |

---

## Architecture

### Retrieval Pipeline

```mermaid
graph TD
    Query["User Query"] --> Policy{"Retrieval policy"}
    Policy -->|"Retrieval off / suppressed"| NoRetrieval["No retrieval context"]
    Policy -->|"Retrieval on"| RPC["Supabase RPC<br/>search_knowledge_text"]
    RPC --> Normalize["Normalize rows"]
    Normalize --> Boost["Metadata boost<br/>category/tag/server role/severity"]
    Boost --> Evidence["EvidenceCard[]<br/>retrieval metadata"]
    Evidence --> Agent["Agent generation"]
    NoRetrieval --> Agent
```

### ASCII Fallback

```
User Query
     │
     ▼
┌────────────────────┐
│ Retrieval policy   │
│ server policy/tool │
│ budget / category  │
└─────────┬──────────┘
          │ retrieval on
          ▼
┌─────────────────────────────────────────────┐
│ Supabase search_knowledge_text RPC          │
│ PostgreSQL full-text/BM25-style ranking     │
└─────────┬───────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────┐
│ Metadata boost                              │
│ category, tags, server role, severity       │
└─────────┬───────────────────────────────────┘
          ▼
┌─────────────────────────────────────────────┐
│ EvidenceCard[] + retrieval metadata         │
│ used / suppressed / unavailable / count     │
└─────────┬───────────────────────────────────┘
          ▼
    Agent context
```

> Source of truth (2026-04-26): `cloud-run/ai-engine/src/lib/knowledge-retrieval-lite.ts`, `cloud-run/ai-engine/src/lib/retrieval-contract.ts`, `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.ts`, `cloud-run/ai-engine/src/lib/legacy-contracts.ts`, `cloud-run/ai-engine/src/lib/rag-doc-policy.ts`.

### Data Flow

1. **Retrieval Decision**: server-side Auto policy, active tool allowlist, query intent, feature budget으로 retrieval 실행 여부를 결정
2. **Text Retrieval**: `search_knowledge_text` RPC로 내부 지식 문서 검색
3. **Metadata Boost**: category/tag/server role/severity/runbook metadata로 evidence 순서 보정
4. **Evidence Contract**: `EvidenceCard[]`와 `RetrievalMetadata`를 backend response와 frontend state에 보존
5. **Agent Context Injection**: 허용된 에이전트가 evidence를 참고하되, evidence가 없거나 unavailable이면 명시 metadata를 반환

---

## Components

### 1. Retrieval Contract (`retrieval-contract.ts`)

frontend/backend가 공유하는 evidence 계약입니다.

| 필드 | 역할 |
|------|------|
| `EvidenceCard` | title, content, category, score, source metadata를 가진 evidence 단위 |
| `RetrievalMetadata` | `enabled`, `used`, `mode`, `suppressedReason`, `evidenceCount`, `webUsed` 상태 |
| `RetrievalMode` | 기본값은 `lite`; legacy graph mode는 active runtime이 아님 |

### 2. Knowledge Retrieval Lite (`knowledge-retrieval-lite.ts`)

Supabase RPC `search_knowledge_text` 결과를 받아 category/tag/server metadata로 재정렬합니다.

| 단계 | 설명 |
|------|------|
| Query normalize | 빈 문자열/과도한 길이를 방어하고 검색어를 정규화 |
| Text search | `search_knowledge_text` RPC 호출. exact/full query match 우선, multi-token 운영 질의는 relaxed token-prefix fallback으로 recall 보강 후 token overlap으로 정렬 정밀도 보정 |
| Metadata boost | 운영 도메인 metadata가 query/context와 맞으면 score 보정 |
| Result cap | evidence budget에 맞춰 상위 결과만 반환 |
| Unavailable fallback | Supabase/RPC 오류 시 `retrievalUsed=false`, `suppressedReason=unavailable`로 명시 |

### 3. Tool Adapter (`knowledge-search-tool.ts`)

`searchKnowledgeBase` 이름은 frontend/tool-call 호환성을 위해 유지합니다. 내부 구현은 Lite retrieval만 호출합니다.

```typescript
// 개념 흐름
async execute({ query, category }) {
  const evidence = await retrieveKnowledgeEvidence({ query, category });
  return {
    evidenceCards: evidence.cards,
    metadata: evidence.metadata,
  };
}
```

`useGraphRAG`는 active tool schema에서 제거됐습니다. `fastMode`와 `includeWebSearch`는 과거 payload 호환용 deprecated 입력으로만 남아 있으며, Lite retrieval은 graph traversal이나 web fallback을 호출하지 않습니다.

### 4. Legacy Boundary (`legacy-contracts.ts`)

Graph runtime endpoint 호환 기간은 종료됐습니다. `/api/ai/graphrag/*` route는 더 이상 등록하지 않으며, `searchKnowledgeBase.useGraphRAG`도 active schema/legacy registry에서 제거됐습니다. 남은 legacy 표면은 저장된 chat history와 response boundary의 `ragSources` bridge뿐이며, 신규 UI/응답은 `EvidenceCard[]` + `RetrievalMetadata`를 canonical로 사용합니다.

| Legacy surface | 현재 동작 | Replacement |
|----------------|-----------|-------------|
| `/api/ai/graphrag/*` | route 미등록 | `/api/ai/supervisor` + `searchKnowledgeBase` |
| `searchKnowledgeBase.useGraphRAG` | schema/registry에서 제거. 오래된 unknown payload는 canonical 입력으로 승격하지 않음 | Knowledge Retrieval Lite |
| `ragSources` | response/history legacy bridge. 신규 렌더링은 `evidenceCards` 우선 | `EvidenceCard[]` + `RetrievalMetadata` |
| `search_knowledge_base`, `match_documents`, `hybrid_*` Supabase RPC | legacy vector/graph 함수. 운영 Supabase와 repo migration `20260510022419_drop_legacy_vector_graph_rag_rpcs.sql`에서 제거 완료 | `search_knowledge_text` |
| `get_knowledge_neighbors`, `traverse_knowledge_graph`, `search_*vectors*`, `search_*commands*` helper RPC | legacy helper 함수. 운영 Supabase와 repo migration `20260510030704_drop_remaining_legacy_vector_graph_helpers.sql`에서 제거 완료 | `search_knowledge_text` |
| `command_vectors`, `knowledge_relationships`, `knowledge_base.embedding` | historical data inventory. request path에서 graph/vector search 없음. 제거 migration은 destructive T5로 분리되어 승인 전 적용 금지 | `knowledge_base` + `search_vector` corpus |

---

## Integration Point

### reporter-tools / agent runtime

```typescript
if (enableRAG && activeTools.includes('searchKnowledgeBase')) {
  toolChoice = shouldForceKnowledgeLookup(query)
    ? { type: 'tool', toolName: 'searchKnowledgeBase' }
    : 'auto';
}
```

에이전트는 `agent-runtime-policy.ts`의 tool allowlist와 evidence budget을 따릅니다. Vision path는 내부 지식 검색과 결합하지 않고 Gemini/OpenRouter/Z.AI Vision path를 유지합니다.

---

## Data Schema

### `knowledge_base`

지식 원문 및 검색 metadata 저장

```sql
CREATE TABLE knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  search_vector tsvector,
  category text,
  tags text[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_kb_search_vector ON knowledge_base
  USING gin (search_vector);
```

### `search_knowledge_text`

```sql
SELECT * FROM search_knowledge_text(
  p_query_text := 'Redis 메모리 부족',
  p_max_results := 5,
  p_filter_category := 'troubleshooting'
);
```

`knowledge_relationships`, `command_vectors`, `knowledge_base.embedding`은 historical schema로 남아 있을 수 있지만, 현재 Knowledge Retrieval Lite request path의 필수 dependency가 아닙니다. `command_vectors`에만 남은 text는 `20260510032441`로 `knowledge_base`에 backfill됐고, 남은 legacy inventory 제거는 destructive T5 migration으로 분리되어 운영 DB 적용 전 명시 승인이 필요합니다. `search_knowledge_text`는 `plainto_tsquery` 기반 primary match를 먼저 정렬하고, `cpu high load`, `disk space cleanup`, `server topology dependency`처럼 여러 토큰이 섞인 운영 질의에는 token-prefix OR fallback rank를 낮은 가중치로 함께 반영합니다. 이후 query token overlap을 우선 정렬해 `nginx 5xx gateway timeout` 같은 질의에서 단일 `gateway` 토큰만 맞은 Storage 문서가 Web/LB 문서보다 위로 올라오는 노이즈를 줄입니다.

---

## Performance Characteristics

| 단계 | 예상 지연 | 비고 |
|------|:--------:|------|
| Retrieval policy | <10ms | request-local 결정 |
| Text search RPC | ~50-150ms | Supabase 상태에 의존 |
| Metadata boost | <10ms | in-process 계산 |
| Evidence mapping | <10ms | `EvidenceCard[]` 변환 |
| **총합** | ~70-200ms | 외부 LLM/embedding 호출 없음 |

---

## Version History

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| v1.11.0 | 2026-05-15 | `useGraphRAG` active schema/legacy registry 제거 반영. `ragSources`를 legacy response/history bridge로 축소하고 신규 frontend/backend retrieval 표면을 `EvidenceCard[]` + `RetrievalMetadata` 기준으로 정렬 |
| v1.10.0 | 2026-05-10 | `command_vectors`에만 남은 legacy command text를 `knowledge_base` KRL corpus로 backfill하는 migration 추가. 루트 embedding seed script 제거, drift guard 확장, full command inventory 기준 governance threshold 재조정 |
| v1.9.0 | 2026-05-10 | 남은 legacy graph/command-vector helper RPC와 unused `idx_kr_weight` 제거. KRL RPC 및 search_vector trigger helper는 유지 |
| v1.8.0 | 2026-05-10 | relaxed recall 이후 token-overlap precision ranking 추가. `nginx 5xx gateway timeout` smoke에서 Web/LB 문서가 Storage 단일 토큰 매치보다 우선되도록 검증 |
| v1.7.0 | 2026-05-10 | `search_knowledge_text` multi-token recall fallback 추가. smoke 대상에 CPU high load, disk cleanup, topology 질의 추가. corpus 실측값 53건으로 갱신 |
| v1.6.0 | 2026-05-10 | 운영 Supabase DB에 legacy vector/graph RPC cleanup 적용 완료. post-check 기준 legacy 6개 false, `search_knowledge_text` true |
| v1.5.0 | 2026-05-10 | 운영 DB inventory 기준 legacy vector/graph Supabase RPC 제거 migration 추가. `command_vectors`/`knowledge_relationships` 테이블은 데이터 보존 대상으로 분리 |
| v1.4.0 | 2026-05-10 | `/api/ai/graphrag/*` 410 tombstone route 제거 완료. 당시 남은 호환 표면은 `searchKnowledgeBase.useGraphRAG` 입력 무시 처리였고, v1.11.0에서 제거 완료 |
| v1.3.0 | 2026-04-26 | Knowledge Retrieval Lite 기준으로 legacy graph runtime, external embedding, query-expansion/rerank/web fallback 설명 제거 |
| v1.2.0 | 2026-02-23 | RAG corpus 운영 제약(문서 수/길이/카테고리 비중) 및 Best Practice 참조 추가 |
| v1.1.0 | 2026-01-26 | query expansion, reranking, web augmentation 상세 추가 |
| v1.0.0 | 2026-01-26 | 초기 문서 작성 |
