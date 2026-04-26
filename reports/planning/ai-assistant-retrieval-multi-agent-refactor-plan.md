> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-04-26

# AI Assistant Retrieval and Multi-Agent Runtime Refactor Plan

- 상태: Approved
- 작성일: 2026-04-26
- TODO.md 연결: Backlog > AI assistant retrieval and multi-agent runtime refactor

## 목표

AI 어시스턴트의 멀티 에이전트 구조는 유지하되, 현재 과도하게 커진 RAG/GraphRAG 런타임을 무료 티어에 맞는 단순한 내부 지식 검색 구조로 재설계한다.

이 작업의 backend 실행 위치는 Vercel 함수가 아니라 Google Cloud Run의 `cloud-run/ai-engine`이다. 따라서 개선 방향은 Cloud Run 무료 티어 운영, stateless container, cold start, 제한된 CPU/메모리, GCP Secret Manager 기반 환경변수 운영을 전제로 잡는다.

핵심 결정은 다음과 같다.

- Mistral은 text last-resort fallback으로 유지한다.
- Mistral은 RAG runtime 경로에서 제거한다.
- custom GraphRAG runtime, graph traversal, `useGraphRAG` 중심 계약은 제거하거나 deprecated 처리한다.
- RAG는 "GraphRAG"가 아니라 "Knowledge Retrieval Lite"로 격하한다.
- 프론트엔드의 RAG/Web/심층 분석 기능은 실제 backend 실행 계약과 `used/suppressed/unavailable` 상태가 맞도록 재정렬한다.
- 멀티 에이전트는 유지하되 agent/provider/tool policy를 중앙화해 drift를 줄인다.
- Cerebras는 `qwen-3-235b-a22b-instruct-2507`를 deprecated 전까지 primary로 사용하고, `llama3.1-8b`는 intra-Cerebras fallback으로 낮춘다.
- `gpt-oss-120b`는 무료 티어 모델 목록에 없으므로 target upgrade 후보에서 제거한다.
- Cloud Run 스펙 증설 없이 코드 경로 축소, 요청당 외부 호출 절감, deterministic contract test 중심으로 검증한다.
- 현재 18대 서버 구성은 RAG가 추론하는 지식이 아니라 구조화된 운영 데이터 SSOT로 고정한다.
- RAG는 서버 목록/상태/의존 관계의 정본이 아니라 운영 매뉴얼, 장애 이력, 대응 런북, 토폴로지 설명을 보강하는 지식 계층으로 제한한다.

## 배경

현재 RAG는 처음 도입 목적이 실질 기능 강화보다 RAG 구현과 연결 가능성을 보여주는 데 가까웠다. 그러나 이후 기능이 누적되면서 runtime 구조가 목적보다 커졌다.

현재 문제는 RAG 자체가 아니라 아래 구조적 복잡도다.

| 영역 | 현재 문제 |
|------|-----------|
| custom GraphRAG | `knowledge_relationships`, graph traversal, stats/related route가 실제 사용자 가치 대비 복잡하다. |
| Mistral embedding | RAG query마다 외부 embedding 호출 가능성이 생겨 Mistral rate limit과 latency에 묶인다. |
| HyDE/rerank | 품질 보강용이지만 무료 티어와 기본 chat path에는 과하다. |
| Tavily fallback | RAG 내부 fallback과 Web toggle이 섞여 사용량 예측이 어렵다. |
| agent instructions | agent가 직접 `searchKnowledgeBase`를 호출하도록 유도해 server-side retrieval policy보다 모델 판단에 의존한다. |
| frontend status | "허용됨"과 "실제로 사용됨"의 구분이 약하다. |
| docs/UI 표현 | `GraphRAG`, `Mistral + RAG`가 핵심 기능처럼 보이나 실제 운영 가치는 제한적이다. |

### Cloud Run backend 전제

| 항목 | 계획 반영 |
|------|-----------|
| 실행 위치 | AI assistant backend는 `cloud-run/ai-engine`에서 실행되며 GitLab CI `deploy_ai_engine` 또는 `cloud-run/ai-engine/deploy.sh` 경로로 배포된다. |
| 비용 원칙 | Cloud Run은 1 vCPU/512Mi 기준을 유지하고 `--machine-type`, min instances, 상시 worker 같은 비용 증가형 개선은 제외한다. |
| 런타임 모델 | 컨테이너는 stateless로 보고, request path에서 대형 in-memory graph/index를 생성하거나 유지하지 않는다. |
| cold start | Graph traversal, runtime embedding, HyDE/rerank처럼 cold start와 latency를 키우는 경로는 기본 비활성화한다. |
| Secret/env | provider key와 feature flag는 `.env.local` 로컬 개발값과 GCP Secret Manager/Cloud Run env 동기화를 전제로 한다. |
| 검증 전략 | CI/로컬 기본 검증은 mock/contract test를 우선하고, 실 LLM/외부 서비스 smoke는 장애 진단 시 1회성으로 제한한다. |

### Cerebras 모델 정책 업데이트

2026-04-26 로컬 live smoke 기준, 현재 계정에서 `qwen-3-235b-a22b-instruct-2507`는 사용 가능하다. 공식 문서 기준 Qwen은 Preview 모델이고 2026-05-27 deprecated 예정이므로 deprecation 전까지 Cerebras primary로 사용한다. `gpt-oss-120b`는 Cerebras 무료 티어 모델 목록에 없어 제외한다.

| 모델 | 현재 판단 | 계획 반영 |
|------|-----------|-----------|
| `qwen-3-235b-a22b-instruct-2507` | SQL/text smoke 성공, structured output 성공, 강제 tool call 성공. Preview + 2026-05-27 deprecation 예정. | Cerebras primary. `CEREBRAS_MODEL_ID` 기본값으로 설정. model-aware quota/deprecation guard 필수. |
| `llama3.1-8b` | chat completions, tool calling, `generateObject` smoke green. 2026-05-27 deprecation 예정. | Qwen 실패/quota 초과/capability mismatch 시 intra-Cerebras fallback으로만 사용. |
| `gpt-oss-120b` | 무료 티어 모델 목록 미포함. 현재 키 smoke 404. | **제외** — 무료 티어 미포함으로 target upgrade 후보에서 제거. |

로컬 smoke evidence:

| 테스트 | 결과 |
|--------|------|
| Direct text/SQL | `qwen-3-235b-a22b-instruct-2507` 성공, latency 약 408ms |
| Structured output | `{ route: "nlq", confidence: 0.95 }` 생성 성공 |
| Forced tool call | `toolCalls=1`, `toolResults=1` 성공 |
| Tool loop final text | 비강제 경로는 `result=91` 생성, 강제 tool call 직후 final text는 비어 있어 agent loop 계약 테스트 필요 |

모델별 quota 기준은 코드에 고정하지 않고 account Limits와 response header를 우선한다. 현재 계정 Limits 화면 기준 Qwen은 `5 RPM / 30K TPM / 14.4K RPD / 1M TPD / 65,536 context`로 보수 적용한다. 공식 일반 Free tier 표는 더 높게 표시될 수 있으므로 production guard는 계정 Limits를 우선한다.

참조:

- `https://inference-docs.cerebras.ai/models/overview`
- `https://inference-docs.cerebras.ai/support/rate-limits`
- `https://inference-docs.cerebras.ai/capabilities/tool-use`

## 18대 서버 구성 컨셉

Task 2의 Knowledge Retrieval Lite 구현 전에 서버 구성을 먼저 고정한다. 이 프로젝트의 서버 토폴로지는 실제 외부 인프라 조회가 아니라 `public/data/otel-data`의 사전 생성 OTel 데이터와 resource catalog가 정본이다.

현재 컨셉은 **OnPrem DC1 3-AZ 계층형 부하 전파 관측 데이터셋**이다.

```text
Internet/User
  -> HAProxy LB tier
  -> Nginx Web tier
  -> API/WAS tier
  -> MySQL / Redis / Storage tier
```

| 축 | 결정 |
|----|------|
| 서버 수 | 18대 |
| 가용 영역 | `DC1-AZ1`, `DC1-AZ2`, `DC1-AZ3` |
| AZ 배치 | AZ별 6대 균등 배치 |
| 역할 배치 | Web/API/DB/Redis/Storage/LB 각각 3대 |
| 운영 컨셉 | 15대 주 서비스 경로와 3대 보조 capacity node를 함께 관측하는 단일 DC 데이터셋 |
| 데이터 정본 | `resource-catalog.json`, hourly OTel, `timeseries.json`, AI Engine precomputed state |
| RAG 역할 | 위 정본을 대체하지 않고 운영 설명, 대응 절차, 장애 이력만 보강 |

### 역할별 인벤토리 계약

| 역할 | 서버 | 컨셉 |
|------|------|------|
| Load Balancer | `lb-haproxy-dc1-01`, `lb-haproxy-dc1-03`, `lb-haproxy-dc1-02` | AZ별 L7 entrypoint. `lb-haproxy-dc1-03`은 AZ2 pool member로 관측한다. |
| Web | `web-nginx-dc1-01`, `web-nginx-dc1-02`, `web-nginx-dc1-03` | AZ별 Nginx reverse proxy. LB에서 Web tier로 라우팅한다. |
| API/WAS | `api-was-dc1-01`, `api-was-dc1-02`, `api-was-dc1-03` | AZ별 application worker. metrics/status query와 장애 영향 분석의 중심 계층이다. |
| Database | `db-mysql-dc1-primary`, `db-mysql-dc1-replica`, `db-mysql-dc1-backup` | AZ1 primary, AZ2 read replica, AZ3 cold-standby/daily snapshot target. |
| Cache | `cache-redis-dc1-01`, `cache-redis-dc1-02`, `cache-redis-dc1-03` | AZ별 Redis node. `cache-redis-dc1-03`은 AZ3 replica member로 관측한다. |
| Storage | `storage-nfs-dc1-01`, `storage-nfs-dc1-02`, `storage-s3gw-dc1-01` | AZ1 NFS active, AZ2 NFS hot-standby, AZ3 object gateway. |

### 관측 패턴 컨셉

AI가 정답지를 읽지 않도록 로그와 메트릭에는 scenario name, root-cause label, topology 해설을 넣지 않는다. 데이터에는 수치 변화와 증상성 로그만 남기고, 원인 분석은 AI가 metrics/log correlation으로 수행해야 한다.

| 관측 패턴 | 데이터에 남길 것 | 데이터에 남기지 않을 것 |
|----------|----------------|----------------------|
| DB batch pressure | DB disk/cpu 상승, slow query, WAS queue/latency 증가 | "DB가 원인" 같은 라벨 |
| API peak load | API CPU/queue 증가, Web upstream timeout, DB connection pressure | "출근 피크" 같은 설명 |
| Redis memory pressure | Redis memory/eviction/latency 증가, API cache read latency 증가 | "Redis 장애 원인" 같은 문구 |
| Storage I/O pressure | storage write queue/commit latency, API file operation latency 증가 | "SPOF", "전파됨", "caused by" 같은 문구 |
| LB traffic burst | HAProxy session/conntrack/retry 증가, Web/API queue 증가 | 현재 원인을 직접 지목하는 정답성 문구 |

RAG는 위 패턴의 일반적인 운영 매뉴얼과 대응 런북을 설명할 수 있지만, 현재 장애의 정답 원인을 문서로 제공하면 안 된다.

### RAG와 구조화 데이터의 경계

| 질문 유형 | 처리 계층 | 이유 |
|-----------|-----------|------|
| "현재 서버는 몇 대인가?" | 구조화 데이터 조회 | 숫자/목록은 최신 catalog가 정본이다. |
| "Redis 서버는 어느 AZ에 있나?" | 구조화 데이터 조회 | role/AZ 관계는 RAG가 생성하면 안 된다. |
| "NFS 장애 시 어떤 순서로 대응하나?" | RAG runbook | 절차와 판단 기준은 운영 지식 검색에 적합하다. |
| "DB replica lag가 왜 위험한가?" | RAG incident/runbook + metrics evidence | 설명은 RAG, 현재 상태는 metrics tool이 담당한다. |
| "이 장애가 어떤 계층에 전파되나?" | deterministic topology lookup + RAG 설명 | topology edge는 구조화 데이터, 영향 설명은 RAG가 보강한다. |

따라서 Knowledge Retrieval Lite는 `serverId`, `role`, `az`, `metricName`, `docType`, `severity`, `runbookPhase` metadata를 사용해 evidence를 고르되, 서버 인벤토리 자체를 생성하거나 수정하지 않는다.

## 현재 상태 분석

### Frontend surface

| 기능 | 현재 상태 | 개선 필요 |
|------|-----------|-----------|
| RAG toggle | `ragEnabled`가 `enableRAG`로 streaming/job queue에 전달된다. | "RAG 검색" 대신 "내부 지식 보강"으로 의미를 축소한다. |
| Web toggle | `webSearchEnabled`가 `enableWebSearch`로 전달된다. | RAG 내부 fallback에서 분리하고 Web 사용 결과만 web evidence로 표시한다. |
| 심층 분석 | `analysisMode='thinking'`이 routing/job queue에 반영된다. | provider-native reasoning으로 오해하지 않도록 deep path 정책과 연결한다. |
| evidence UI | `ragSources` 중심이다. | `EvidenceCard[]`로 통합하고 source type을 `knowledge`, `incident`, `runbook`, `web`으로 분리한다. |
| badge | `RAG 허용`, `Web 허용`을 표시한다. | `enabled`, `used`, `suppressed`, `unavailable`을 분리 표시한다. |

### Backend retrieval path

| 구성 | 현재 상태 | 개선 필요 |
|------|-----------|-----------|
| `searchKnowledgeBase` | 기본 `useGraphRAG=true`, Mistral embedding 기반 검색 경로가 존재한다. | `retrieveKnowledgeEvidence` 내부 구현으로 교체하고 Mistral 호출을 제거한다. |
| `graphrag-service.ts` | BM25 + vector + graph traversal을 묶는다. | runtime graph traversal 제거 후 knowledge retrieval service로 대체한다. |
| `graphrag-graph.ts` | `traverse_knowledge_graph` RPC를 호출한다. | 기본 runtime path에서 제거한다. |
| `/graphrag/stats`, `/graphrag/related` | GraphRAG 노출 API다. | `/knowledge/stats`로 대체하거나 deprecated/410 처리한다. |
| HyDE/rerank | deep RAG 경로에서 LLM을 추가 호출할 수 있다. | 기본 runtime에서 제거하고 필요하면 demo/deep opt-in으로만 남긴다. |
| Tavily enhancement | RAG 결과 부족 시 web search 보강이 가능하다. | RAG 내부 자동 web fallback을 제거한다. |

### Multi-agent runtime

| 구성 | 현재 상태 | 개선 필요 |
|------|-----------|-----------|
| Orchestrator | structured routing은 `Cerebras -> Groq -> Mistral` 방향이다. | 유지하되 agent runtime policy SSOT로 중앙화한다. |
| Text agents | NLQ/Analyst/Reporter/Advisor가 `Groq -> Cerebras -> Mistral` fallback을 사용한다. | 역할별 tool/evidence budget을 명시한다. |
| Agent tools | 여러 agent config와 instruction에 `searchKnowledgeBase`가 직접 포함된다. | retrieval policy가 허용한 경우에만 tool 또는 preloaded evidence를 주입한다. |
| forced routing | topology query에서 direct KB path가 `useGraphRAG: true`를 강제한다. | deterministic Knowledge Retrieval Lite direct path로 대체한다. |
| quota/circuit breaker | provider fallback은 정리되어 있으나 retrieval budget은 분리되어 있지 않다. | provider budget과 retrieval budget을 분리한다. |
| observability | provider fallback metadata는 개선 중이나 retrieval decision metadata는 부족하다. | retrieval decision, evidence count, suppressed reason을 기록한다. |
| Cerebras model | 현재 코드 기본값은 `llama3.1-8b`다. | Qwen primary + `llama3.1-8b` intra-Cerebras fallback으로 재정렬한다. `gpt-oss-120b`는 무료 티어 미포함으로 제외. |

## 설계 선택지 비교

### 선택지 A - Knowledge Retrieval Lite v2

기본 추천안이다.

```text
query
  -> retrieval policy
  -> BM25/text search
  -> category/severity/tags boost
  -> optional precomputed cosine-neighbor 1-hop
  -> EvidenceCard 3~5개
  -> agent prompt/tool result에 압축 전달
```

| 평가 | 내용 |
|------|------|
| 장점 | Mistral을 RAG runtime에서 제거하면서 내부 지식 검색 가치는 유지한다. |
| 장점 | custom GraphRAG보다 설명과 유지보수가 쉽다. |
| 장점 | 무료 티어 사용량 예측이 쉽다. |
| 단점 | 기존 GraphRAG 마케팅/문서/테스트를 많이 정리해야 한다. |
| 단점 | cosine-neighbor edge 생성 방식은 별도 offline/indexing 작업이 필요할 수 있다. |
| 추천도 | 1순위 |

### 선택지 B - Text-only Knowledge Search

```text
query
  -> PostgreSQL tsvector/BM25/trigram
  -> metadata filter/boost
  -> EvidenceCard
```

| 평가 | 내용 |
|------|------|
| 장점 | Mistral, pgVector, graph traversal 의존을 runtime에서 거의 제거할 수 있다. |
| 장점 | 구현과 운영이 가장 단순하다. |
| 단점 | semantic search 품질이 낮아질 수 있다. |
| 단점 | 포트폴리오 관점에서 RAG/Vector DB 역량 노출은 약해진다. |
| 추천도 | 2순위 |

### 선택지 C - Local Vector Search v2

```text
query
  -> local lexical/hash/TF-IDF vector
  -> pgVector cosine
  -> EvidenceCard
```

| 평가 | 내용 |
|------|------|
| 장점 | 외부 embedding provider 없이 vector DB 구조를 유지할 수 있다. |
| 장점 | "Vector DB 기반 내부 지식 검색" 표현을 유지할 수 있다. |
| 단점 | 기존 `knowledge_base.embedding`은 Mistral 1024d 기준이므로 새 vector 컬럼과 재색인이 필요하다. |
| 단점 | local vector 품질이 BM25보다 낫다는 보장이 없다. |
| 추천도 | 3순위 |

### 선택지 D - Fullscreen Deep Retrieval

```text
sidebar
  -> basic chat, attach, minimal options

fullscreen workspace
  -> internal knowledge, web, deep analysis, evidence trace
```

| 평가 | 내용 |
|------|------|
| 장점 | 작은 sidebar의 기능 밀도를 낮출 수 있다. |
| 장점 | EvidenceCard, agent handoff, tool trace를 더 설득력 있게 보여줄 수 있다. |
| 단점 | frontend 상태 공유와 UX 테스트 범위가 커진다. |
| 단점 | backend RAG 리팩터링과 동시에 진행하면 범위가 과해진다. |
| 추천도 | 4순위 |

### 선택지 E - Showcase-only RAG

```text
production chat
  -> no RAG or text-only retrieval

demo/portfolio path
  -> retrieval demo with explanation
```

| 평가 | 내용 |
|------|------|
| 장점 | 운영 안정성과 무료 티어 보호가 가장 강하다. |
| 장점 | RAG 구현 역량은 별도 데모로 보여줄 수 있다. |
| 단점 | 실제 AI assistant의 내부 지식 기반 답변 차별점은 약해진다. |
| 추천도 | 5순위 |

## 권장 방향

1차 목표는 선택지 A다.

```text
GraphRAG runtime 제거
Mistral RAG 의존 제거
Knowledge Retrieval Lite 도입
EvidenceCard contract 도입
Agent runtime policy 중앙화
Frontend used/suppressed/unavailable 상태 표시
```

동시에 provider 정책은 아래처럼 정리한다.

```text
Orchestrator structured routing:
  Cerebras Qwen -> Cerebras llama3.1-8b -> Groq -> Mistral

Text agents:
  Groq -> Cerebras Qwen -> Cerebras llama3.1-8b -> Mistral
```

선택지 B는 fallback 설계로 둔다. 선택지 A의 cosine-neighbor 보강이 과하거나 품질이 낮으면 text-only로 후퇴한다.

## 범위

### 포함

- RAG runtime에서 Mistral embedding 호출 제거
- `useGraphRAG` 계약 제거 또는 deprecated 처리
- custom GraphRAG runtime path 제거
- `searchKnowledgeBase` 내부 구현을 Knowledge Retrieval Lite로 교체
- RAG 내부 Tavily fallback 제거
- HyDE/rerank 기본 runtime 제거
- frontend `RAG 검색` 표현을 `내부 지식 보강` 중심으로 변경
- `ragSources`를 `EvidenceCard[]` 중심으로 전환
- multi-agent provider/tool/evidence policy SSOT 도입
- Cerebras model-aware quota/capability/deprecation policy 도입
- Qwen primary와 `llama3.1-8b` intra-Cerebras fallback 경로 고정
- retrieval decision observability 추가
- docs/data 표시에서 `GraphRAG`, `Mistral + RAG` stale 설명 정리

### 제외

- Mistral provider 전체 제거
- text last-resort fallback 제거
- 신규 유료 provider 추가
- Brave/Tavily MCP 상시 추가
- Supabase DB table 즉시 drop
- Cloud Run 스펙 증설, min instances, 상시 background worker 추가
- production LLM 반복 QA
- RAG 지식 문서 대량 확장
- 멀티 에이전트 구조 폐기 또는 single-agent 전환
- `qwen-3-235b-a22b-instruct-2507`를 deprecation 이후에도 교체 없이 유지
- `gpt-oss-120b` 사용 (무료 티어 미포함)

## 계약 (Contract)

Status를 Approved로 올리기 전에 이 섹션을 완료해야 한다.

### 변경 대상 후보 파일

Backend:

- `cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.ts`
- `cloud-run/ai-engine/src/lib/graphrag-service.ts`
- `cloud-run/ai-engine/src/lib/graphrag-graph.ts`
- `cloud-run/ai-engine/src/lib/hybrid-text-search.ts`
- `cloud-run/ai-engine/src/lib/embedding.ts`
- `cloud-run/ai-engine/src/routes/graphrag.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-web-search.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/*.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-types.ts`

Frontend:

- `src/components/ai-sidebar/ChatInputArea.tsx`
- `src/hooks/ai/core/useQueryExecution.ts`
- `src/hooks/ai/useAsyncAIQuery.ts`
- `src/hooks/ai/utils/message-helpers.ts`
- `src/hooks/ai/utils/stream-data-handler.ts`
- `src/components/ai/analysis-basis/*`
- `src/components/ai-sidebar/EnhancedAIChat.tsx`
- `src/components/ai/AIWorkspace.tsx`

Docs/data:

- `src/data/tech-stacks/ai-assistant.ts`
- `src/data/feature-cards.data.ts`
- `src/data/architecture-diagrams/ai-assistant.ts`
- `src/data/architecture-diagrams/cloud-platform.ts`
- `docs/llms.md`
- `reports/planning/TODO.md`

### 신규/변경 타입 후보

```ts
type RetrievalMode = 'off' | 'lite' | 'text-only' | 'cosine-neighbor';

type RetrievalSuppressedReason =
  | 'disabled'
  | 'not_needed'
  | 'no_results'
  | 'budget_guard'
  | 'unavailable';

interface EvidenceCard {
  id: string;
  title: string;
  summary: string;
  sourceType: 'knowledge' | 'incident' | 'runbook' | 'web';
  score: number;
  category?: string;
  reason?: string;
  url?: string;
}

interface RetrievalMetadata {
  retrievalEnabled: boolean;
  retrievalUsed: boolean;
  retrievalMode: RetrievalMode;
  suppressedReason?: RetrievalSuppressedReason;
  evidenceCount: number;
  webUsed: boolean;
}
```

```ts
type CerebrasRuntimeModel =
  | 'qwen-3-235b-a22b-instruct-2507'  // primary (deprecated 2026-05-27 예정)
  | 'llama3.1-8b';                     // intra-Cerebras fallback (deprecated 2026-05-27 예정)

interface ProviderModelPolicy {
  provider: 'cerebras' | 'groq' | 'mistral' | 'gemini' | 'openrouter';
  modelId: string;
  role: 'primary' | 'fallback' | 'vision';
  lifecycle: 'production' | 'preview' | 'custom';
  enabled: boolean;
  toolCallingEnabled: boolean;
  structuredOutputEnabled: boolean;
  contextWindowTokens?: number;
  quota: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
    tokensPerDay: number;
  };
  deprecationDate?: string;
  blockAfterDeprecation: boolean;
  smokeStatus: 'green' | 'red' | 'unknown';
}
```

### Runtime 계약

| 계약 | 기대 동작 |
|------|-----------|
| Mistral text fallback | 유지한다. Provider chain에서 last-resort text fallback 역할은 남긴다. |
| Mistral RAG runtime | 제거한다. 일반 RAG query가 `mistral-embed`를 호출하지 않는다. |
| GraphRAG runtime | 제거한다. 일반 RAG query가 `traverse_knowledge_graph`를 호출하지 않는다. |
| RAG default | off 또는 conservative auto다. UI toggle on이어도 server policy와 budget에 따라 suppressed 가능하다. |
| Web search | RAG 내부 fallback이 아니라 Web toggle/policy 경로에서만 실행한다. |
| Evidence | agent 응답에는 raw tool output이 아니라 `EvidenceCard[]` 또는 압축 요약만 전달한다. |
| Deep analysis | 일반 chat path보다 더 긴 라우팅을 허용하되 추가 LLM retrieval enhancement는 기본 금지한다. |
| DB cleanup | 기존 graph table/function은 code path 제거 후 별도 migration plan에서 drop 여부를 결정한다. |

### Provider/model 계약

| 계약 | 기대 동작 |
|------|-----------|
| Cerebras Qwen | `qwen-3-235b-a22b-instruct-2507`를 deprecated 전까지 Cerebras primary로 사용한다. `CEREBRAS_MODEL_ID` 기본값. |
| Cerebras 8B | `llama3.1-8b`는 primary가 아니라 Qwen 실패/쿼터 초과/preview 차단 시 intra-Cerebras fallback으로만 사용한다. |
| Cerebras GPT-OSS | 무료 티어 모델 목록 미포함 — 사용하지 않는다. |
| Model-aware quota | Cerebras quota는 provider 단일 값이 아니라 model별 값으로 계산한다. Qwen은 계정 Limits 기준 `5 RPM / 30K TPM`을 보수 적용한다. |
| Deprecation guard | Qwen과 `llama3.1-8b`는 2026-05-27 이후 기본 runtime model로 선택되지 않아야 한다. |
| Tool loop guard | Qwen은 tool call 자체는 가능하지만 forced tool call 이후 final text가 비는 경로가 있어, final answer 재합성 또는 fallback 조건을 테스트로 고정한다. |
| Metadata | Langfuse/Cloud Run 로그에 `provider`, `modelId`, `modelRole`, `quotaPolicy`, `deprecationStatus`, `fallbackReason`을 남긴다. |

### Cloud Run runtime 계약

| 계약 | 기대 동작 |
|------|-----------|
| Backend authority | AI assistant 실행 계약은 `cloud-run/ai-engine`을 기준으로 설계하고, Vercel frontend는 요청 전달/표시 계층으로 본다. |
| Stateless runtime | 요청 간 in-memory graph state, local file cache, long-lived background indexing에 의존하지 않는다. |
| Resource guard | 1 vCPU/512Mi 기준에서 동작해야 하며 리팩터링 해법으로 Cloud Run 스펙 증설을 선택하지 않는다. |
| Request path | embedding 재생성, graph traversal, web fallback, LLM rerank를 request 기본 경로에서 제거한다. |
| Secret handling | Cerebras/Groq/Mistral/Gemini/Tavily key는 코드나 테스트 fixture에 하드코딩하지 않고 env/Secret Manager 계약으로만 접근한다. |
| Health/observability | retrieval mode, provider, suppressed reason은 Cloud Run 로그와 Langfuse metadata에서 추적 가능한 필드로 남긴다. |
| Deploy validation | backend 변경은 `cd cloud-run/ai-engine && npm run type-check`와 관련 unit/contract test를 최소 게이트로 한다. |

### Server topology 계약

| 계약 | 기대 동작 |
|------|-----------|
| Inventory SSOT | 서버 수, 서버 ID, role, AZ, host spec은 `public/data/otel-data/resource-catalog.json`과 precomputed state를 기준으로 한다. |
| Active inventory | 현재 active inventory는 18대이며, role별 3대와 AZ별 6대 균등 분산을 유지한다. |
| Topology docs | active docs/data가 15대 서버를 현재 기준처럼 설명하지 않는다. 과거 문맥은 archived 문서에만 허용한다. |
| Diagram sync | `infrastructure-topology` 다이어그램은 `lb-haproxy-dc1-03`, `cache-redis-dc1-03`, `storage-nfs-dc1-02`를 포함해야 한다. |
| RAG boundary | RAG 문서는 운영 설명과 대응 지식만 제공하며 inventory/status/topology edge의 정본 역할을 하지 않는다. |
| Deterministic lookup | topology/direct query는 RAG가 아니라 구조화 topology lookup 결과를 우선 evidence로 사용한다. |
| Evidence composition | topology lookup 결과와 RAG runbook evidence는 같은 답변에서 합성할 수 있지만 source와 reason을 분리해 표시한다. |

### Multi-agent 구조 개선 계약

| 구성 | 목표 계약 |
|------|-----------|
| Orchestrator | agent 선택만 담당한다. 지식 검색 자체를 임의로 무겁게 만들지 않는다. |
| Runtime policy | agent별 provider order, tool allowlist, evidence budget, maxSteps를 SSOT에서 관리한다. |
| NLQ Agent | current metrics/status 중심. Groq primary, Cerebras Qwen secondary, 내부 지식 evidence는 명시적으로 필요할 때만 3개 이하. |
| Analyst Agent | RCA/pattern 분석 중심. Groq primary, Cerebras Qwen secondary, evidence는 incident/runbook 위주 5개 이하. |
| Reporter Agent | 보고서 생성 중심. Groq primary, Cerebras Qwen secondary, evidence는 6개 이하, web은 명시적 최신성 요구 때만. |
| Advisor Agent | 조치/명령 추천 중심. Groq primary, Cerebras Qwen secondary, internal knowledge를 가장 자주 쓰되 retrieval lite만 사용. |
| Vision Agent | 기존 Gemini/OpenRouter path 유지. RAG와 결합하지 않는다. |
| Evaluator/Optimizer | 기본적으로 LLM 호출 없는 rule-based 후처리 유지. |

### 테스트 시나리오

- [x] RAG off: `searchKnowledgeBase` 또는 retrieval tool이 active tools에서 제거된다.
- [x] RAG on: Knowledge Retrieval Lite는 실행되지만 `mistral-embed`를 호출하지 않는다.
- [x] RAG on: `traverse_knowledge_graph` RPC를 호출하지 않는다.
- [x] topology/direct KB path: `useGraphRAG: true` 없이 deterministic evidence response를 만든다.
- [x] Web on: Tavily는 Web policy 경로에서만 호출되고 RAG 내부 fallback으로 호출되지 않는다.
- [x] Web off: retrieval 결과 부족 시에도 Tavily를 호출하지 않는다.
- [x] 심층 분석: `analysisMode='thinking'`은 deep routing metadata를 남기지만 provider-native reasoning으로 표시하지 않는다.
- [x] frontend badge: RAG 허용과 RAG 사용됨을 구분한다.
- [x] response metadata: `retrievalEnabled`, `retrievalUsed`, `retrievalMode`, `suppressedReason`, `evidenceCount`를 포함한다.
- [x] provider chain: Mistral은 text fallback으로 남고 RAG provider로 표시되지 않는다.
- [x] Cerebras Qwen: direct text, structured output, forced tool call smoke 결과를 근거로 model metadata가 green으로 표시된다.
- [x] Cerebras fallback: Qwen quota/circuit/deprecation block 시 `llama3.1-8b`로 fallback하고, `llama3.1-8b`도 실패하면 기존 provider chain으로 이동한다.
- [x] Cerebras quota: Qwen은 provider 공통 `30 RPM / 60K TPM`이 아니라 계정 Limits 기준 보수값으로 pre-emptive fallback 된다.
- [x] Cerebras deprecation: 2026-05-27 이후 Qwen/`llama3.1-8b`가 기본 runtime model로 선택되지 않는 guard test가 있다.
- [ ] Tool loop: Qwen forced tool call 뒤 final text 공백이면 deterministic summary/finalAnswer 재합성 또는 provider fallback이 동작한다.
- [x] Cloud Run contract: retrieval 기본 경로가 runtime embedding/graph traversal/background worker를 요구하지 않는다.
- [x] Cloud Run contract: 구현이나 문서가 Cloud Run 스펙 증설, min instances, paid always-on worker를 전제로 하지 않는다.
- [x] Secret contract: live provider key는 source/test fixture에 추가하지 않고 env/Secret Manager 참조만 사용한다.
- [x] Server topology contract: current inventory가 18대, role별 3대, AZ별 6대임을 검증한다.
- [x] Server topology contract: active docs/data의 현재 설명에 `15대 서버` stale 표현이 남지 않는다.
- [x] Server topology contract: `infrastructure-topology`가 resource catalog의 18대 핵심 노드를 누락하지 않는다.
- [ ] RAG boundary: 서버 수/role/AZ/status 질문은 RAG raw document가 아니라 deterministic topology/metrics evidence를 우선 사용한다.
- [ ] docs/data guard: active docs/data에 `Native GraphRAG`, `Mistral + RAG`, `useGraphRAG` stale 표현이 재도입되면 실패한다.

## Task 목록

> 구현 착수 전 Status가 Approved인지 확인한다.

- [x] Task 0 - 계약 확정 및 failing test 작성
  - 완료 기준: 위 테스트 시나리오와 Cloud Run runtime 계약을 기준으로 failing tests를 먼저 추가한다.
  - 완료 기록(2026-04-26): `test(spec): knowledge retrieval lite add failing tests before implementation` 커밋으로 Lite service/tool adapter 실패 계약을 먼저 고정했다.
- [x] Task 0A - Cerebras Qwen model policy 확정
  - 완료 기준: Qwen primary, `llama3.1-8b` intra-Cerebras fallback 정책과 model-aware quota/deprecation guard 테스트를 먼저 추가한다. `gpt-oss-120b`는 무료 티어 미포함으로 제외.
  - 완료 기록(2026-04-26): `CEREBRAS_MODEL_ID` 기본값을 Qwen으로 전환하고, `CEREBRAS_FALLBACK_MODEL_IDS=llama3.1-8b` intra-provider fallback, model-aware quota/usage key, pre-emptive model fallback, deprecation metadata, GPT-OSS runtime 제외 계약을 구현/검증했다.
- [x] Task 1 - Retrieval contract/type 추가
  - 완료 기준: `EvidenceCard`, `RetrievalMetadata`, `RetrievalMode` 타입과 metadata propagation 계약을 고정한다.
  - 완료 기록(2026-04-26): `retrieval-contract` SSOT를 추가해 `EvidenceCard`, `RetrievalMetadata`, `RetrievalMode`, suppressed reason union을 고정하고, legacy `ragSources`를 `EvidenceCard[]`로 변환하는 adapter 및 backend response metadata 타입 계약을 추가했다.
- [x] Task 1B - 18대 서버 topology contract 확정
  - 완료 기준: 18대 monitored inventory, role별 3대, AZ별 6대, 15대 주 서비스 경로 + 3대 보조 capacity node 컨셉을 docs/data/test 계약으로 고정한다.
  - 세부 범위: `ai-standards.md`의 15대 OTel 설명, `infrastructure-topology`의 15대 다이어그램, active docs/data의 stale topology 표현을 18대 컨셉으로 정렬한다.
  - RAG 경계: topology/direct query는 resource catalog와 topology lookup을 우선하고 RAG는 runbook/incident/manual 설명 evidence만 제공한다.
  - 완료 기록(2026-04-26): resource catalog/precomputed state/다이어그램을 18대 inventory로 동기화하고, role별 3대·AZ별 6대·다이어그램-카탈로그 일치 계약 테스트를 추가했다. active docs/UI/test fixture의 현재형 `15대 서버` 표현을 18대 관측 데이터셋 기준으로 갱신했고, OTel 로그에는 root-cause/topology answer label이 누출되지 않도록 `data:verify` 게이트를 추가했다.
- [x] Task 2 - Knowledge Retrieval Lite service 도입
  - 완료 기준: BM25/text search + metadata boost 기반 retrieval service를 추가하고 Mistral embedding 및 Cloud Run request-path index 생성 없이 동작한다.
  - 완료 기록(2026-04-26): `retrieveKnowledgeEvidence`를 추가해 `search_knowledge_text` RPC 기반 BM25 검색과 tag/metadata boost re-ranking을 구현했다. Supabase unavailable/no-results/error metadata를 명시하고, live provider key나 external embedding 호출 없이 deterministic unit contract로 검증했다.
- [x] Task 3 - custom GraphRAG runtime 제거
  - 완료 기준: 일반 runtime에서 `graphrag-service`, `graphrag-graph`, `traverse_knowledge_graph`, `useGraphRAG` 경로를 호출하지 않는다.
  - 완료 기록(2026-04-26): `/graphrag/*` legacy route를 410 호환 응답으로 정리하고, `graphrag-service.ts`, `graphrag-graph.ts`, `graphrag-types.ts`와 관련 service test를 삭제했다. topology direct KB path의 `useGraphRAG: true` 강제 플래그를 제거해 Knowledge Retrieval Lite direct path만 사용하도록 고정했다.
- [x] Task 4 - `searchKnowledgeBase`를 retrieval lite adapter로 교체
  - 완료 기준: tool 이름 호환은 유지하되 내부 구현은 `retrieveKnowledgeEvidence`를 사용한다.
  - 완료 기록(2026-04-26): `searchKnowledgeBase` tool은 이름과 legacy boolean input 호환을 유지하면서 내부 GraphRAG/vector/Tavily fallback 경로를 제거하고 `retrieveKnowledgeEvidence` adapter로 교체했다. `useGraphRAG`, `fastMode`, `includeWebSearch`는 호환 입력으로만 유지하며 Lite retrieval에서는 graph/web fallback을 호출하지 않는다.
- [x] Task 5 - multi-agent runtime policy SSOT 도입
  - 완료 기준: agent별 provider order, maxSteps, tool allowlist, evidence budget이 한 곳에서 관리된다.
  - 완료 기록(2026-04-26): `agent-runtime-policy.ts`를 추가해 text agent provider order, Orchestrator structured-output order, Vision native provider order, agent별 `maxSteps`, evidence budget, tool allowlist를 SSOT로 고정했다. `AGENT_CONFIGS`, agent model selectors, orchestrator forced routing/direct KB evidence cap이 이 정책을 참조하도록 정리했고, Mistral은 text fallback으로만 남도록 회귀 테스트를 추가했다.
- [x] Task 5A - provider model policy SSOT 도입
  - 완료 기준: Cerebras Qwen/8B의 role, lifecycle, quota, deprecation, smoke status가 한 곳에서 관리된다.
  - 완료 기록(2026-04-26): `provider-model-policy.ts`를 추가해 Cerebras Qwen primary, `llama3.1-8b` intra-provider fallback, GPT-OSS free-tier 제외, account Limits quota, deprecation block date, smoke status/evidence를 SSOT로 고정했다. `config-parser`는 상수 re-export만 유지하고, `provider-model-metadata`와 `quota-tracker`는 policy를 참조하도록 정리했다. provider route와 frontend tech stack의 Mistral/RAG stale 설명도 text fallback 기준으로 갱신했다.
- [x] Task 6 - frontend status contract 정리
  - 완료 기준: UI가 `enabled`, `used`, `suppressed`, `unavailable`을 구분한다.
  - 완료 기록(2026-04-26): frontend `retrieval-status` 타입/파생 유틸을 추가하고 `AnalysisBasis`에 `retrieval`/`featureStatus`를 보존했다. streaming done, async job result, chat history restore 경로에서 retrieval metadata를 유지하며 `RAG/Web/심층 분석` 뱃지가 `허용`, `사용됨`, `생략됨`, `사용 불가`를 구분하도록 정리했다. Cloud Run jobs 저장 경로도 `metadata.retrieval`을 보존한다.
- [x] Task 6A - legacy compatibility boundary registry 정리
  - 완료 기준: GraphRAG 제거 후 남겨야 하는 legacy 호환 지점은 contract registry로 격리하고, active runtime에 `useGraphRAG`나 `GRAPH_RAG_TELEMETRY_SAMPLE_RATE`가 재침투하지 않도록 guard한다.
  - 완료 기록(2026-04-26): `legacy-contracts.ts`를 추가해 `/api/ai/graphrag/*` gone shim, `searchKnowledgeBase.useGraphRAG` compat-only 입력, `ragSources` migration bridge를 SSOT로 등록했다. `/graphrag/*` 410 payload와 `useGraphRAG` schema 설명은 contract를 참조하고, `knowledge-runtime-cleanup.test.ts`가 허용 경계 밖의 legacy token 재도입을 차단한다.
- [ ] Task 7 - docs/data stale 표현 정리
  - 완료 기준: GraphRAG/Mistral RAG 중심 표현이 Knowledge Retrieval Lite 중심으로 바뀐다.
- [ ] Task 8 - 검증 및 QA 기록
  - 완료 기준: deterministic tests, Cloud Run ai-engine type-check, root type-check, lint, changed docs checks를 통과하고 필요 시 1회 targeted QA만 기록한다.

## 완료 기준

- [x] `cloud-run/ai-engine` type-check 통과
- [x] root type-check 통과
- [x] retrieval 관련 unit/contract tests 통과
- [x] frontend RAG/Web/analysis mode status tests 통과
- [x] legacy compatibility registry 및 active runtime guard 통과
- [x] provider/model drift guard 통과
- [x] Cerebras Qwen primary / llama3.1-8b intra-fallback model-aware quota/deprecation guard 통과
- [ ] Qwen tool-call final text fallback 또는 재합성 계약 테스트 통과
- [ ] docs/data stale reference guard 통과
- [x] `git diff --check` 통과
- [x] 변경이 AI/API 계약을 포함하므로 `npm run test:contract` 또는 해당 계약 테스트 subset 통과
- [x] production 외부 LLM/API 반복 호출 없이 검증 완료
- [x] Cloud Run 배포 스펙 증설 없이 완료
- [ ] GCP Secret Manager/Cloud Run env 동기화 필요 항목이 있으면 별도 env-sync 체크리스트로 분리

## 리스크와 완화

| 리스크 | 완화 |
|--------|------|
| 기존 RAG 품질 저하 | EvidenceCard 품질, metadata boost, cosine-neighbor optional path로 보완한다. |
| 기존 docs/portfolio 표현 약화 | "GraphRAG" 대신 "무료 티어 친화 Knowledge Retrieval 리팩터링"으로 설명한다. |
| DB migration 위험 | runtime code path 제거 후 별도 plan에서 table/function drop 여부를 판단한다. |
| frontend/backend 계약 drift | metadata contract와 UI tests로 enabled/used/suppressed 상태를 고정한다. |
| 범위 과대 | Phase별 커밋으로 분리하고 Fullscreen UX 재편은 후속 plan으로 넘긴다. |
| Cloud Run latency/cold start 악화 | request path에서 runtime embedding, graph traversal, LLM rerank를 제거하고 evidence 수를 제한한다. |
| Cloud Run env drift | `.env.local`, Cloud Run env, GCP Secret Manager 차이를 env-sync 절차로 검증한다. |
| Qwen deprecation 리스크 | Qwen은 2026-05-27 deprecated 예정이므로 deprecation guard와 replacement issue를 구현한다. |
| Qwen quota 오판 | provider-level quota가 아니라 model-aware quota를 적용하고 계정 Limits를 우선한다. |
| Qwen tool-loop final text 공백 | tool result 기반 deterministic final answer 재합성 또는 provider fallback 조건을 계약 테스트로 고정한다. |

## 구현 순서 제안

1. 18대 서버 topology contract를 먼저 확정하고 active docs/data의 15대 stale 설명을 제거한다.
2. retrieval/runtime failing test를 추가한다.
3. backend retrieval lite 교체를 진행한다.
4. graph runtime path를 제거한다.
5. multi-agent policy SSOT를 도입한다.
6. frontend status/evidence contract를 반영한다.
7. docs/data의 GraphRAG/Mistral RAG stale 표현을 Knowledge Retrieval Lite 기준으로 정리한다.
8. targeted verification을 수행한다.

## 현재 결론

이번 작업은 단순 기능 추가가 아니라 구조 축소형 리팩터링이다. 성능 강화보다 무료 티어 안정성, 실행 경로 예측 가능성, frontend/backend 계약 일치가 우선이다.

권장안은 `Knowledge Retrieval Lite v2`이며, 실패 시 `Text-only Knowledge Search`로 후퇴한다. Mistral은 provider fallback으로 유지하지만 RAG runtime에서는 제거한다. Backend가 Cloud Run에서 동작한다는 전제 때문에, 개선안은 infra 증설이 아니라 request path 단순화와 외부 호출 절감으로 달성해야 한다.

Provider 측면에서는 Qwen을 Cerebras primary로 설정하고 `llama3.1-8b`를 intra-Cerebras fallback으로 둔다. `gpt-oss-120b`는 무료 티어 모델 목록에 없으므로 제외한다. deprecation(2026-05-27) 대비 model-aware quota guard, deprecation guard, tool-loop final text guard를 구현한다.

Task 2 착수 전에는 18대 서버 컨셉을 먼저 고정한다. 현재 inventory는 3-AZ 계층형 부하 전파 관측 데이터셋이며, 서버 수/role/AZ/topology edge는 RAG가 아니라 resource catalog와 topology lookup이 정본이다. RAG는 운영 매뉴얼, 사용 가이드, 장애 이력, 대응 런북을 보강하는 계층으로 제한한다.
