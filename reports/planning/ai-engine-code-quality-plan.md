> Owner: project
> Status: Completed
> Doc type: Reference
> Last reviewed: 2026-05-01
> Tags: ai-engine, refactoring, cleanup, quota, cerebras

# AI Engine Code Quality Plan

AI 어시스턴트 개선 사이클 완료 후 잔여 구조 정리 작업 계획.  
총 4개 작업, 우선순위 순으로 정렬. **전체 완료 (2026-05-01).**

---

## 배경: 현황과 웹 BP 비교

### 현황 진단

| 파일 | 현재 줄 수 | 문제 |
|------|----------:|------|
| `orchestrator-summary-fallback.ts` | 1,219 | 쿼리 분류 + 데이터 수집 + 템플릿 빌드 혼재 |
| `orchestrator-routing.ts` | 1,157 | Agent Execution + AgentFactory 2가지 진입점 혼재 |
| `quota-tracker.ts` | 1,145 | Types/상수/In-Memory/Redis/Core API 전부 단일 파일 |
| `approval-store.ts` | 389 | HITL 제거 후 write 레이어(3-layer) 전체가 dead 인프라 |

### 웹 BP 비교 결과

**1. Multi-Agent Orchestrator 파일 분리** (출처: LangGraph.js / TypeScript AI Agent 패턴)
- BP: Model Interface / Tool Executor / Router를 독립 레이어로 분리. 각 에이전트는 독립 인스턴스.
- 현재: orchestrator-routing.ts가 "Agent SDK 실행"과 "AgentFactory 실행" 두 진입점을 한 파일에 혼재.
- **갭**: AgentFactory 로직을 별도 파일로 분리하면 각 진입점을 독립적으로 테스트 가능.

**2. Quota/Rate-Limit 레이어 설계** (출처: Portkey / API7 token rate limiting)
- BP: Redis sliding window로 분산 동기화, In-memory는 단일 인스턴스용 L1 캐시로만 사용. 토큰 소비량 기반 추적.
- 현재: `quota-tracker.ts`가 Types + 상수 + In-Memory 레이어 + Redis 레이어 + Core API를 모두 포함.
- **갭**: Redis 레이어와 In-memory 레이어를 각각 독립 모듈로 분리하면 레이어별 교체/테스트 가능.

**3. HITL 제거 후 Audit Trail 패턴** (출처: SAP Agents HITL, Synvestable HITL Guide)
- BP: "Audit Trail Only" — 승인 workflow 완전 제거, reason/decision/outcome만 DB에 기록. Read-only 경로만 노출.
- 현재: `ApprovalStore` 3-layer 전체(Memory L1 + Redis L2 + Postgres write)가 유지되나 HTTP에서 write 경로가 호출되지 않음.
- **갭**: write 레이어 전체가 dead 인프라. audit read 2개 함수만 남기면 충분.

---

## Task 1 — approval-store 쓰기 레이어 제거

**우선순위**: P2 (버그 없음, 유지보수 위험 감소)
**상태**: 완료 (2026-04-30)

### 현황

`approvalStore`의 실제 사용:
```
routes/approval.ts:
  GET /history  → approvalStore.getHistory()   → Supabase 직접 조회
  GET /history/stats → approvalStore.getHistoryStats() → Supabase 직접 조회
```

사용되지 않는 메서드(dead): `registerPending`, `submitDecision`, `waitForDecision`,  
`getPending`, `hasPending`, `getDecision`, `cleanup`, `getStats`

### 계약 (Contract)

**제거 대상**:
- `ApprovalStore` 클래스 전체 (Memory Map, Redis 2-way sync, TTL 관리)
- `approval-store.ts`의 write/read 메서드 (history 조회 2개 제외)

**유지 대상**:
- `approval-store-supabase.ts` — Postgres read 함수 (`fetchApprovalHistory`, `fetchApprovalHistoryStats`)
- `approval-store-types.ts` — 타입 정의
- HTTP 엔드포인트 `GET /history`, `GET /history/stats`

**변경 결과**:
```
approval-store.ts (389줄) → ~20줄 (Supabase 함수 직접 re-export)
routes/approval.ts → approvalStore.getHistory() → fetchApprovalHistory() 직접 호출
```

### 테스트 시나리오

1. `GET /api/ai/approval/history` → Supabase 이력 반환 (기존 동작 동일)
2. `GET /api/ai/approval/history/stats` → 통계 반환 (기존 동작 동일)
3. approval-store 단위 테스트 (`approval-store.test.ts`) — Supabase mock만 필요

### 리스크

| 리스크 | 가능성 | 대응 |
|--------|:------:|------|
| 향후 HITL 재도입 시 재구현 필요 | 낮음 | git history에서 복원 가능 |
| Redis 의존 다른 코드가 ApprovalStore를 import | 낮음 | grep 확인됨: approval-store import는 routes/approval.ts만 |

**전제 조건**: HITL 재활성화 계획 없음을 사용자 확인 필요.

### 2026-04-30 구현 로그

- 사용자 진행 승인 후 HITL 재활성화 계획 없음 전제로 Task 1 착수.
- SDD 선행 테스트 커밋: `19aefcc0b test(spec): approval store add read-only contract specs`
- 구현 커밋: `862571a4f refactor(ai-engine): remove approval write layer`
- `ApprovalStore` class, Memory Map, Redis 2-way sync, TTL cleanup, pending/decision write APIs 제거.
- `approval-store.ts`는 `fetchApprovalHistory`, `fetchApprovalHistoryStats` re-export facade로 축소.
- `routes/approval.ts`는 `approvalStore.getHistory()`/`getHistoryStats()` 대신 Supabase read 함수를 직접 호출.
- `approval-store-supabase.ts`에서 dead write helper(`persistApprovalPending`, `persistApprovalDecision`, `markApprovalExpired`) 제거.
- `approval-store-types.ts`에서 write-layer 전용 `PendingApproval`, `ApprovalDecision`, `RedisApprovalEntry` 제거.
- 검증: targeted approval tests 9/9, AI Engine type-check, `cloud-run/ai-engine npm test` 938/938 통과.

---

## Task 2 — quota-tracker.ts 레이어 분리

**우선순위**: P3 (1,145줄 → 400줄 목표)
**상태**: 완료 (2026-05-01)

### 현황 섹션 구조

| 섹션 | 줄 범위 | 내용 |
|------|---------|------|
| Types | 27~89 | `LLMProviderName`, `ProviderQuota`, `QuotaStatus` 등 인터페이스 |
| 상수/설정 | 90~206 | `CEREBRAS_MODEL_QUOTAS`, `PROVIDER_QUOTAS`, `getQuotaForProvider()` |
| Pre-emptive 임계값 | 207~220 | `PREEMPTIVE_THRESHOLDS` |
| In-Memory 레이어 | 221~244 | `inMemoryUsage`, `inMemoryCooldowns`, locks |
| Redis Keys | 245~494 | Redis key 헬퍼, TTL 상수, Redis read/write 함수 |
| Core API | 495~1145 | `reserveProviderQuota`, `selectAvailableProvider` 등 공개 API |

### 제안 분리안

```
services/resilience/
├── quota-types.ts          (신규, ~180줄) — Types + 상수 + 설정
├── quota-store-memory.ts   (신규, ~120줄) — In-Memory 레이어
├── quota-store-redis.ts    (신규, ~250줄) — Redis Key/TTL/read/write
└── quota-tracker.ts        (수정, ~400줄) — Core API facade (위 3개 import)
```

BP 정렬: Redis sliding window(quota-store-redis)와 In-memory L1(quota-store-memory)을 명시적으로 분리하면 레이어별 독립 테스트 가능.

### 테스트 시나리오

1. `reserveProviderQuota('cerebras')` — Redis 사용 가능 시 Redis 경로
2. `reserveProviderQuota('cerebras')` — Redis 비가용 시 in-memory 경로
3. `selectAvailableProvider(['cerebras','groq'])` — cooldown/임계 적용 후 provider 선택
4. 기존 `quota-tracker.test.ts` 전체 통과 (경로 변경 없이)

### 리스크

| 리스크 | 가능성 | 대응 |
|--------|:------:|------|
| 순환 import | 중간 | types ← memory/redis ← tracker 단방향 유지 |
| 테스트 mock 경로 변경 | 있음 | 기존 `vi.mock('../resilience/quota-tracker')` 패턴 그대로 유지 가능 (facade 유지) |

### 2026-05-01 구현 로그

- SDD 선행 테스트 커밋: `5844bb989 test(spec): quota tracker layer split contracts`
- 구현 커밋: `02685431b refactor(ai-engine): split quota tracker layers`
- `quota-types.ts` 신규: provider/model quota types, constants, thresholds, `getQuotaForProvider`, `getQuotaModelCandidates`, `getQuotaUsageScope` 분리.
- `quota-store-memory.ts` 신규: default/normalize usage, memory usage/cooldown map, per-scope lock 분리.
- `quota-store-redis.ts` 신규: Redis key/TTL, usage/cooldown read/write, atomic reservation/reconcile Lua script 실행 분리.
- `quota-tracker.ts`는 기존 public import contract를 re-export로 유지하고 `getProviderUsage`, `recordProviderUsage`, `reserveProviderQuota`, `reconcileProviderQuotaReservation`, `markProviderQuotaCooldown`, `getQuotaStatus`, `selectAvailableProvider`, `getQuotaSummary` core facade만 보유.
- 검증: quota targeted 37/37, quota facade importer targeted 49/49, AI Engine type-check, AI Engine test 941/941, `lint:changed`, `git diff --check` 통과.

---

## Task 3 — orchestrator-routing.ts / orchestrator-summary-fallback.ts 분리

**우선순위**: P3 (유지보수 복잡도 감소)

### Task 3-A: orchestrator-routing.ts (1,157줄)

**상태**: 완료 (2026-05-01)

현재 구조:
- l.64~126: Orchestrator Model 설정 (상수/getter)
- l.127~1042: Agent Execution — `executeForcedRouting()` 핵심 라우팅 로직
- l.1043~1157: AgentFactory-based Execution — `executeWithAgentFactory()`

**제안 분리**:

```
orchestrator-routing.ts     (수정, ~1040줄) — 핵심 라우팅 유지
orchestrator-factory.ts     (신규, ~120줄)  — executeWithAgentFactory + getAgentTypeFromName
```

BP 정렬: LangGraph 패턴에서 에이전트 Factory는 독립 레지스트리로 분리.  
`executeWithAgentFactory`가 라우팅 로직과 독립적이라면 파일 분리 후 가독성 향상.

#### 2026-05-01 구현 로그

- SDD 선행 테스트 커밋: `88e5ff5ae test(spec): orchestrator factory split contract`
- 구현 커밋: `ae8aef08d refactor(ai-engine): extract orchestrator factory execution`
- `orchestrator-factory.ts` 신규: `executeWithAgentFactory`, `getAgentTypeFromName` 이동.
- `orchestrator-routing.ts`는 기존 import/mock 호환을 위해 `orchestrator-factory.ts` re-export 유지.
- 검증: targeted routing/factory/stream tests 43/43, AI Engine type-check, AI Engine test 942/942, `lint:changed`, `git diff --check` 통과.

### Task 3-B: orchestrator-summary-fallback.ts (1,219줄)

**상태**: 완료 (2026-05-01)

현재 구조 파악 필요:
- l.70: query intent re-export
- l.79: `isDeterministicSummaryQuery()`
- l.~80~1186: 데이터 수집 + 상태 빌드 로직
- l.1187~끝: `buildDeterministicSummaryFallback()`, `buildDeterministicSummaryFromCurrentState()`

**전제 조건**: 실제 섹션 경계 분석 후 분리 경계 확정. 내용 확인 없이 기계적 분리는 금지.

**권장 후속 순서**:
1. public facade 대상 characterization tests 보강 — 완료
2. `CollectedToolResult`, `ServerSnapshot`, `AlertServerSnapshot`, `MetricsToolPayload`, tool result parsing, current-state payload construction을 payload adapter 모듈로 추출 — 완료
3. metric threshold/ranking answer builder 추출 — 완료
4. operational/status summary builder 추출 — 완료
5. `orchestrator-summary-fallback.ts`는 `isDeterministicSummaryQuery`, `buildDeterministicSummaryFallback`, `buildDeterministicSummaryFromCurrentState` public compatibility facade로 유지

#### 2026-05-01 구현 로그 — 3-B.1 payload adapter

- SDD 선행 테스트 커밋: `8258a3700 test(spec): characterize summary fallback payload behavior`
- 구현 커밋: `3d32ca798 refactor(ai-engine): extract summary payload adapter`
- characterization tests: payload precedence, malformed `getServerMetrics`, empty status filter summary 경로 보강.
- `orchestrator-summary-payload.ts` 신규: `CollectedToolResult`, `ServerSnapshot`, `AlertServerSnapshot`, `MetricsToolPayload`, `getMetricsPayload`, `buildSummaryPayloadFromCurrentState`, `getPayloadServerEvidenceCount`, `toNumber` 분리.
- `orchestrator-summary-fallback.ts`는 기존 public export와 metric/operational renderer 로직을 유지.
- 검증: summary/routing/stream targeted tests 50/50, AI Engine type-check, AI Engine test 945/945, `lint:changed`, `git diff --check` 통과.

#### 2026-05-01 구현 로그 — 3-B.2 metric builder

- SDD 선행 테스트 커밋: `a3e9de9aa test(spec): characterize summary metric builders`
- 구현 커밋: `0ee776526 refactor(ai-engine): extract summary metric builders`
- characterization tests: filterServers matched count/returned row trust, network ranking, ascending CPU ranking 보강.
- `orchestrator-summary-metric.ts` 신규: `buildMetricThresholdFilterFromPayload`, `buildMetricRankingFromPayload`와 private metric helpers 분리.
- `orchestrator-summary-fallback.ts`는 public export와 operational/status renderer 유지.
- 검증: summary/routing/stream targeted tests 54/54, AI Engine type-check, AI Engine test 949/949, `lint:changed`, `git diff --check` 통과.

#### 2026-05-01 구현 로그 — 3-B.3 operational/status builder

- SDD 선행 테스트 커밋: `8fac9e02c test(spec): characterize summary operational builders`
- 구현 커밋: `53f90b623 refactor(ai-engine): extract summary operational builders`
- characterization tests: critical 우선순위, offline operational section, metric ranking drift 방지 경로 보강.
- `orchestrator-summary-operational.ts` 신규: status/explicit-server operational predicates, action/recommendation/trend/summary builders 분리.
- `orchestrator-summary-fallback.ts`는 deterministic facade와 metric/operational builder dispatch만 유지.
- 검증: summary/routing/stream targeted tests 56/56, AI Engine type-check, AI Engine test 951/951, `lint:changed`, `git diff --check` 통과.

### 테스트 시나리오

1. 분리 전/후 `orchestrator-routing.test.ts` 전체 통과
2. `executeWithAgentFactory` 호출 경로 smoke test (실제 agent 호출 없이 mock)
3. `buildDeterministicSummaryFallback` 단위 테스트 — 분리 후 import 경로만 변경

### 리스크

| 리스크 | 가능성 | 대응 |
|--------|:------:|------|
| executeForcedRouting ↔ executeWithAgentFactory 내부 의존 | 중간 | 분리 전 cross-reference 확인 필수 |
| summary-fallback 내부 의존 복잡도 높을 경우 | 중간 | 섹션 분석 후 판단, 분리 이득 없으면 skip |

---

## Task 4 — Cerebras Qwen 모델 deprecation 대응

**우선순위**: P1-deadline (2026-05-27, **약 27일 후**)

### 현황

| 항목 | 현재값 |
|------|--------|
| 사용 모델 | `qwen-3-235b-a22b-instruct-2507` |
| 설정 방식 | `CEREBRAS_MODEL_ID` env var (Cloud Run Secret Manager) |
| 코드 경로 | `getCerebrasModelId()` → `config-parser.ts` |
| 폴백 모델 | `CEREBRAS_FALLBACK_MODEL_IDS` env var (기본: `llama3.1-8b`) |

**장점**: env var 이미 파라미터화 완료 → 모델 교체 시 코드 변경 불필요.

### 2026-04-30 공식 문서/계정 smoke 재확인

공식 Cerebras Inference 문서 기준:
- Supported Models: Production 모델은 `gpt-oss-120b`, `llama3.1-8b`; `qwen-3-235b-a22b-instruct-2507`는 Preview 모델.
- Deprecations: 현재 공개 목록에는 `qwen-3-235b-a22b-instruct-2507` 직접 deprecation 공지는 없지만, Preview 모델은 production 의존 대상으로 부적절.
- Change Log: `qwen-3-235b-a22b-instruct-2507`는 2025-07-29 Preview support로 추가됨.

현재 계정 smoke (`node /tmp/openmanager-cerebras-models.mjs`, max_tokens=16):

| 모델 | 결과 | 판단 |
|------|------|------|
| `gpt-oss-120b` | `/v1/models`에는 표시, chat completions 404 | 현재 계정 runtime 후보 제외 유지 |
| `llama3.1-8b` | chat completions 200, `OK` | 현재 계정의 유일한 production Cerebras 후보 |
| `qwen-3-235b-a22b-instruct-2507` | 429 high traffic | 기본 runtime 후보에서 제거 필요 |
| `zai-glm-4.7` | `/v1/models`에는 표시, chat completions 404 | 현재 계정 runtime 후보 제외 |

### Task 4 계약 (Approved)

**목표 상태**:
- `DEFAULT_CEREBRAS_MODEL`은 `llama3.1-8b`.
- `getCerebrasRuntimeModelIds()`는 production smoke가 통과한 `llama3.1-8b`만 반환.
- Qwen policy는 이력/명시적 env override 감지용으로 유지하되 runtime 후보에서는 제외.
- `llama3.1-8b`는 production 모델이므로 Qwen deprecation date로 차단하지 않음.
- 16K/32K 이상 context가 필요한 Agent 경로는 `llama3.1-8b` capability mismatch로 Cerebras를 건너뛰고 기존 Groq/Mistral fallback으로 이동.
- `gpt-oss-120b`는 공식 production 모델이지만 현재 계정 chat completions 404이므로 excluded 유지.
- Cloud Run env는 코드 배포 후 `CEREBRAS_MODEL_ID=llama3.1-8b`, `CEREBRAS_FALLBACK_MODEL_IDS=` 기준으로 정렬.

### 액션 플랜

```
1. Cerebras 공식 채널 확인 (완료)
   - Supported Models / Deprecations / Change Log 기준으로 production vs preview 분리
   - 근거 URL: `https://cerebras-inference.mintlify.app/models/overview`, `https://cerebras-inference.mintlify.app/support/deprecation`, `https://cerebras-inference.mintlify.app/support/change-log`

2. 후계 모델 사전 smoke 테스트 (완료)
   - 현재 계정 smoke 결과 `llama3.1-8b`만 통과
   - `gpt-oss-120b`는 공식 production 모델이나 현재 계정 chat completions 404로 제외 유지

3. 코드 정책 정렬
   - provider model policy / metadata / quota / config parser 테스트를 production `llama3.1-8b` 기본값으로 갱신
   - Qwen 문자열은 deprecated/preview policy와 historical docs 범위에만 허용

4. Cloud Run env 교체
   - `CEREBRAS_MODEL_ID=llama3.1-8b`
   - `CEREBRAS_FALLBACK_MODEL_IDS=` 또는 미설정
   - Cloud Run revision 재배포 후 `/health`, `/providers`, AI sidebar smoke 확인
```

**데드라인**: 2026-05-20 — 배포 여유 7일 확보 기준.

### 리스크

| 리스크 | 대응 |
|--------|------|
| 후계 모델 API 호환성 문제 | smoke test 필수 → 문제 시 Groq-first 임시 운영 |
| deprecation 실제 날짜 변동 | Cerebras 공식 채널 2주 전 재확인 |

### 2026-04-30 구현 로그

- SDD 선행 테스트 커밋: `ccfd90933 test(spec): cerebras runtime model add failing policy specs`
- 코드 정책: `DEFAULT_CEREBRAS_MODEL=llama3.1-8b`, runtime 후보 `llama3.1-8b` 단일화, Qwen/GPT-OSS excluded metadata 유지.
- Capability routing: 16K/32K context 요구 경로는 8K Cerebras runtime을 건너뛰고 Groq/Mistral fallback으로 이동.
- 검증: AI Engine targeted 123/123, root job API targeted 15/15, model drift guard 1/1, AI Engine type-check, root type-check, `lint:changed`, `docs:lint:changed`, `test:quick` 통과.
- 배포 완료: `v8.11.76` tag pipeline `2491551446` success, Cloud Run revision `ai-engine-00391-qvf`.
- 운영 검증: Cloud Run env `CEREBRAS_MODEL_ID=llama3.1-8b`, `CEREBRAS_FALLBACK_MODEL_IDS` empty, `/health` version `8.11.76`, `/api/ai/providers` Cerebras model `llama3.1-8b`, `modelDrift=[]`.
- QA 기록: `QA-20260430-0385` targeted release-facing smoke 7/7 pass.

---

## 실행 순서

```
Task 4 (Cerebras 모델) ← 데드라인 있음, 2026-05-20 전 처리
Task 1 (approval 단순화) ← 완료 (2026-04-30)
Task 2 (quota-tracker 분리) ← 완료 (2026-05-01)
Task 3-A (orchestrator factory 분리) ← 완료 (2026-05-01)
Task 3-B.1 (summary payload adapter 분리) ← 완료 (2026-05-01)
Task 3-B.2 (summary metric builder 분리) ← 완료 (2026-05-01)
Task 3-B.3 (operational/status builder 분리) ← 완료 (2026-05-01)
```

## SDD 게이트

각 Task 구현 전:
1. 이 계획서 Status → Approved
2. `test(spec):` 커밋 선행 (Task 1, 2, 3 모두 해당)
3. Task 4는 코드 정책 정렬이 포함되어 SDD 선행 테스트 커밋 후 구현 커밋으로 진행
