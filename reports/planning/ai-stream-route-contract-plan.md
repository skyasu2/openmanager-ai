> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-04-17
> Tags: ai-assistant,streaming,cloud-run,vercel,route-contract,architecture

# AI Stream Route Contract & Legacy Path Consolidation Plan

- 상태: **Phase 1 완료 (2026-04-16), Residual Slice Approved (2026-04-17)**
- 작성일: 2026-04-16
- TODO.md 연결: Active Tasks > `AI Stream Route Contract - multi-agent provider fallback visibility`
- 목표: Vercel API routes와 Cloud Run supervisor endpoints의 역할을 다시 명확히 정의하고, 현재 primary streaming path와 legacy plain/json path의 계약을 정리해 유지보수 복잡도와 stale 판단을 줄인다.

## 0. Best Practice Baseline

- AI SDK 공식 가이드 기준으로 **최종 응답 전체를 설명하는 사실**은 `message metadata`에, **실시간으로 변하는 상태/진행 상황**은 stream `data parts` 또는 상위 `agent_status` 이벤트에 실어야 한다.
- 따라서 provider retry, handoff 진행 중, fallback 전환 중 같은 **transient runtime state**는 `done.metadata`에 누적시키기보다 스트림 이벤트로 즉시 노출하는 쪽이 맞다.
- 반대로 최종 provider/model/usage/ttfb 같은 값은 완료 시점 metadata에 남겨야 한다.
- stream 경로의 timeout/abort는 SDK timeout과 상위 수동 guard가 모순 없이 맞물려야 하며, stale 설명은 코드와 같은 날짜에 정리해야 drift가 줄어든다.

## 1. 배경

- 현재 AI assistant 경로는 `legacy plain/json`, `legacy SSE`, `primary UIMessageStream v2`가 동시에 공존한다.
  - Vercel legacy route: [src/app/api/ai/supervisor/route.ts](/mnt/d/dev/openmanager-ai/src/app/api/ai/supervisor/route.ts)
  - Vercel primary v2 route: [src/app/api/ai/supervisor/stream/v2/route.ts](/mnt/d/dev/openmanager-ai/src/app/api/ai/supervisor/stream/v2/route.ts)
  - Cloud Run supervisor routes: [cloud-run/ai-engine/src/routes/supervisor.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/supervisor.ts)
- 이 구조 자체는 기능적으로 동작하지만, 최근 아키텍처 평가처럼 `현재 메인 경로가 무엇인지`, `스트리밍이 실제로 어디에서 처리되는지`, `캐시/검증/보안이 어느 층에 있는지`를 잘못 읽기 쉬운 상태다.
- 특히 아래 혼선이 반복된다.
  - `/api/ai/supervisor` legacy route를 현재 primary route처럼 이해
  - `complexity score <= 45`를 실제 mode switching 기준처럼 이해
  - Vercel layer를 단순 proxy라고 축소 이해
  - v2 stream path와 legacy cache path를 동일 비용 구조로 평가

## 2. 현재 구조 요약

### 2.1 프론트 기본 경로

- 프론트 기본 AI transport는 `DefaultChatTransport` 기반 custom wrapper다.
  - [src/hooks/ai/core/createHybridChatTransport.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/core/createHybridChatTransport.ts)
- 기본 API endpoint는 `/api/ai/supervisor/stream/v2`다.
  - [src/hooks/ai/useHybridAIQuery.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/useHybridAIQuery.ts:210)

### 2.2 Vercel route 역할

| 경로 | 현재 역할 | 비고 |
|------|-----------|------|
| `/api/ai/supervisor` | legacy plain text / JSON route | cache, validation, sanitization, Cloud Run plain proxy |
| `/api/ai/supervisor/stream/v2` | current primary native stream route | auth, rate limit, loose validation, normalized message shaping, resumable stream, Cloud Run v2 proxy, fallback stream |

### 2.3 Cloud Run route 역할

| 경로 | 형식 | 현재 역할 |
|------|------|-----------|
| `/api/ai/supervisor` | JSON | non-streaming result |
| `/api/ai/supervisor/stream` | SSE | legacy streaming |
| `/api/ai/supervisor/stream/v2` | UIMessageStream | current native streaming |

### 2.4 실제 mode switching 기준

- 복잡도 레벨 라벨은 `simple / moderate / complex / very_complex`지만, 프론트의 `streaming vs job-queue` 전환 기준은 config threshold다.
  - threshold default: `19`
  - [src/config/ai-proxy/config-schema.ts](/mnt/d/dev/openmanager-ai/src/config/ai-proxy/config-schema.ts:19)
  - [src/hooks/ai/core/useQueryExecution.ts](/mnt/d/dev/openmanager-ai/src/hooks/ai/core/useQueryExecution.ts)
- 따라서 `<=45 / >45`는 설명용 라벨에 가깝고, 실제 mode switch 판단으로 문서화하면 drift가 생긴다.

## 3. 문제 정의

### 3.1 계약 분산

- primary route와 legacy route가 함께 남아 있어, 현재 제품 계약이 코드만 읽고도 한 번에 이해되지 않는다.

### 3.2 stale comment / stale doc drift

- legacy route 기준 설명이 current primary path 설명처럼 재사용된다.
- complexity threshold 관련 설명도 라벨과 실제 라우팅 기준이 섞여 있다.

### 3.3 비용/성능 평가 오해

- legacy cache path와 v2 resumable stream path의 특성이 다름에도 하나의 비용 구조로 묶여 평가된다.
- 결과적으로 개선 우선순위가 실제 문제보다 빗나갈 수 있다.

### 3.4 provider retry visibility gap

- single-agent 경로는 provider fallback 시 `agent_status`를 내보내지만, multi-agent의 `executeAgentStream()`은 provider retry가 발생해도 로그만 남기고 스트림 상태 이벤트를 보내지 않는다.
- 그 결과 실제로는 provider fallback이 일어나도 사용자/운영자 화면에서는 단순 지연처럼 보인다.
- 이 문제는 라우팅 계약이나 최종 metadata shape보다 먼저, **runtime state visibility 계약**으로 해결하는 편이 맞다.

## 4. 목표 상태

### A. primary path가 문서와 코드에서 모두 명확함

- `current primary`: `/api/ai/supervisor/stream/v2`
- `legacy support`: `/api/ai/supervisor`, `/api/ai/supervisor/stream`

### B. route별 계약이 명확함

- 어떤 경로가
  - cache 중심인지
  - resumable stream 중심인지
  - fallback stream을 생성하는지
  - strict validation인지 loose validation인지
  명확히 드러나야 한다.

### C. stale 설명 제거

- complexity threshold
- primary route
- streaming semantics
- Vercel layer responsibility
  에 대한 stale comment/doc를 current code 기준으로 맞춘다.

### D. multi-agent retry visibility가 single-agent와 일관됨

- multi-agent provider retry도 single-agent와 동일하게 `agent_status`로 즉시 노출된다.
- 이 이벤트는 최종 metadata를 오염시키지 않고, transient 상태만 전달한다.
- retry 성공 후 최종 `done.metadata`는 기존과 동일한 안정 계약을 유지한다.

## 5. 구현 전략

### Phase 1 — 계약 정리 문서화 ✅ 완료 (2026-04-16)

1. [x] current primary path(`/stream/v2`)와 legacy path(`/api/ai/supervisor`) 표준 용어 정의 → `frontend-backend-comparison.md §2.3-A` 반영
2. [x] complexity threshold vs label 차이 정리 → `useHybridAIQuery.ts` JSDoc + `frontend-backend-comparison.md` 표 수정
3. [x] route별 역할표 → `frontend-backend-comparison.md §2.3` 반영
4. [x] stale comment 수정 → `useHybridAIQuery.ts` 라우팅 전략 주석 교정

### Phase 2 — 코드 주석/아키텍처 메모 정리

1. stale comment 수정
2. misleading architecture note 수정
3. route-level JSDoc 정렬

### Phase 3 — legacy 경로 재평가

1. `/api/ai/supervisor`가 아직 필요한 caller가 있는지 확인
2. `/stream` legacy SSE consumer가 남아 있는지 확인
3. 사용처가 사실상 없으면 deprecation 경고 또는 축소 계획 수립

### Phase 4 — observability / caching 설명 정리

1. v2는 resumable stream 중심
2. legacy plain route는 cache 중심
3. 이 차이를 docs/status or architecture notes에 반영

### Phase 5 — multi-agent provider fallback visibility (Residual Slice, 2026-04-17)

1. `executeAgentStream()` provider retry 분기에서 `agent_status` 이벤트를 표준화한다.
2. 최종 `done.metadata`에는 transient retry 이력을 새로 밀어 넣지 않는다.
3. 기존 single-agent fallback 문구와 톤을 맞추되, multi-agent agent label을 유지한다.
4. provider retry contract를 failing test로 먼저 고정한다.

## 6. Contract

### Approved Slice

- 범위: `cloud-run/ai-engine` multi-agent stream path의 provider retry visibility만 다룬다.
- 포함 파일:
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
- 제외:
  - warning threshold 재조정
  - multi-agent TTFB per-provider 세분화
  - final `done.metadata` schema 확장
  - Vercel/frontend hydration 변경

### Behavioral Contract

1. 첫 provider가 빈 응답 또는 `No output generated`로 실패하고 다음 provider로 재시도할 때, 스트림은 재시도 전에 `agent_status` 이벤트를 방출해야 한다.
2. `agent_status`는 transient visibility 용도이며, 기존 `done.metadata` shape를 변경하지 않는다.
3. retry 후 다음 provider가 정상 응답하면 기존처럼 `text_delta`와 `done`이 이어져야 한다.
4. 모든 provider가 실패하는 최종 fallback 경로는 이번 slice에서 의미를 바꾸지 않는다.

### Test Scenarios

1. first provider `No output generated` -> `agent_status` -> second provider success
2. first provider empty response -> `agent_status` -> second provider success
3. 기존 `usage.totalTokens` 계약이 유지되는지 회귀 확인

## 7. 개선 필요성 평가

### 높은 이유

- 현재 문제는 성능보다 `계약 혼선`에 가깝다.
- 잘못된 구조 이해는 잘못된 개선 우선순위로 이어진다.
- 예:
  - 이미 기본 스트리밍이 동작하는데 `streaming부터 구현해야 한다`는 잘못된 결론
  - 현재 threshold를 `45`로 오인해 job queue 정책을 잘못 다룸

### 하지 않았을 때 비용

- 문서/분석 drift 반복
- 잘못된 성능 개선 과제 생성
- QA/운영 판단 지연

## 8. 범위

### 포함

- current primary vs legacy route 계약 정리
- stale comment/doc correction
- route responsibility matrix
- complexity threshold 설명 correction
- multi-agent provider retry visibility contract

### 제외

- stream engine 자체 리라이트
- cache architecture redesign
- job queue policy redesign
- reasoning/depth mode 구현
- retry history를 최종 metadata에 영구 저장하는 구조 변경

## 9. 검증 계획

- 로컬 코드 검토
  - `src/app/api/ai/supervisor/**`
  - `cloud-run/ai-engine/src/routes/supervisor.ts`
  - `src/hooks/ai/useHybridAIQuery.ts`
  - `src/hooks/ai/core/createHybridChatTransport.ts`
  - `src/hooks/ai/core/useQueryExecution.ts`
  - `src/config/ai-proxy/config-schema.ts`
- 문서 검증
  - `bash scripts/docs/lint-changed.sh`
- 필요 시 후속 smoke
  - stream/v2 path 기준 계약 테스트 존재 여부 재검토
- 잔여 slice 검증
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
  - `cd cloud-run/ai-engine && npm run type-check`
  - `cd cloud-run/ai-engine && npm run test`

## 10. 종료 조건

- primary route가 `/stream/v2`임이 문서/주석/설명에서 일관된다.
- legacy route와 primary route의 역할 차이가 명확하다.
- complexity threshold 설명이 current code와 일치한다.
- 아키텍처 평가 시 더 이상 `/api/ai/supervisor` legacy path를 현재 메인 경로로 오인하지 않는다.
- multi-agent provider retry가 stream 중 즉시 관측 가능하다.
