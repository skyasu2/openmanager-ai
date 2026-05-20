> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-20
> Tags: ai-engine, routing, session-memory, rag

# AI 어시스턴트 개선 계획 (2026-05-20)

**근거**: 2026-05-20 설계적 분석 결과 도출. 총점 84/100 기준 미달 3개 영역.
분석 기준: source HEAD `63e736439` (`v8.11.184-40-g63e736439`), production baseline `v8.11.184`.

---

## 개선 항목 요약

| ID | 영역 | 현재 점수 | 목표 | 우선순위 |
|----|------|:---------:|:----:|:--------:|
| A2 | 세션 메모리 sessionId transport/동기화 | 6/10 | 9/10 | **P1** |
| A1 | intentFrame → getIntentCategory 연결 | 18/20 | 19/20 | P2 |
| A3 | KRL seed 주기 보강 | 11/15 | 12/15 | P3 |

---

## 2026-05-20 추가 재검증 결과

### A2 우선순위 상향 근거

AI SDK v6 `DefaultChatTransport` 기본 POST body는 `id`를 전송하지만 `sessionId` 필드는 자동 전송하지 않는다. 현재 Next route는 `sessionId`만 읽고 `id`를 세션 ID로 사용하지 않는다.

```
useAIChatCore.sessionId
  → useHybridAIQuery({ id: sessionId })
  → AI SDK POST body: { id, messages, ... }
  → /api/ai/supervisor/stream/v2 reads body.sessionId only
  → 없으면 request fallback session-id 생성
```

따라서 최초 스트림 요청에서 프론트 세션 ID와 Cloud Run `SessionMemoryService`의 Redis key가 분리될 수 있다. 또한 `useHybridAIQuery` 내부 `sessionIdRef`는 최초 렌더의 `initialSessionId`로 고정되므로, `useChatHistory.onSessionRestore`나 새 대화 생성 후에도 transport/session ref가 따라가지 않을 위험이 있다.

### A3 Supabase live 상태

2026-05-20 MCP + repository smoke 기준:

- `knowledge_base`: 60건, RLS enabled, `search_knowledge_text(text,integer,text)` 존재
- category: `command=25`, `troubleshooting=11`, `incident=9`, `best_practice=9`, `architecture=5`, `security=1`
- source: `command_vectors_migration=25`, `seed_script=30`, `imported=3`, `manual=2`
- 길이: 60/60건 모두 target band, 중복 title 0건
- `npm run supabase:rag:smoke`: 17/17 PASS (`security` category smoke 추가 후 재확인)
- `npm run rag:analyze`: RAG-GOV 전체 PASS

결론: Supabase/RAG는 현재 장애 상태가 아니다. 다만 `command` 비율이 25/60 = 41.7%로 정책 상한 42%에 거의 도달했고, `architecture=5`는 현재 target max다. 기존 계획의 hard max 80 상향 또는 `security +4`, `architecture +3` 직접 추가는 현 거버넌스와 충돌한다.

## A1: intentFrame → getIntentCategory 라우팅 연결

### 현황 진단

`routing-policy.ts:71~117` 기준:

```
selectExecutionMode()   → intentFrame P0.8+ 적용 ✅
getIntentCategory()     → regex primary, intentFrame 미반영 ❌
direct agent routing    → semantic intentFrame 적용 ✅
```

- Groq NLQ `/api/ai/nlq/extract-entities` 분류 비용은 지불
- Cloud Run direct routing은 이미 `intentFrame.intent`/`capabilityId`를 사용한다.
- 남은 gap은 single-agent 품질 retry, `prepareStep` tool policy, best-effort/general 판정 등 `getIntentCategory()` 기반 후속 정책 경로다.
- 결과: semantic intentFrame으로 올바른 direct route가 선택돼도, 후속 tool/RAG/web-search 정책에서 regex 기반 분류가 다시 우선될 수 있음

**핵심 파일**:
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts` (getIntentCategory L137~)
- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts` (DomainIntentFrame)
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/assistant-runtime-host.ts`

### 계약 (Contract)

```typescript
// getIntentCategory()에 intentFrame 파라미터 추가
export function getIntentCategory(
  query: string,
  intentFrame?: DomainIntentFrame
): IntentCategory;

// intentFrame.intent/capabilityId (P0.75+) → IntentCategory 매핑
// intentFrame 없거나 confidence 낮으면 기존 regex fallback 유지
```

IntentCategory ↔ semantic frame 매핑:
| intent/capabilityId 신호 | IntentCategory |
|--------------------------|---------------|
| `metric_current`, `metric_peak`, `server_health` | `metrics` / `serverGroup` |
| `anomaly_detection`, `anomaly_prediction`, `capacity_forecast`, `failure_risk`, `metric_trend` | `anomaly` / `prediction` |
| `root_cause`, `log_analysis`, `incident_report` | `rca` / `logs` |
| `ops_advice`, `advisor`, `runbook` | `advisor` |

### 테스트 시나리오

```typescript
// test(spec): intentFrame → getIntentCategory routing signal
describe('getIntentCategory with intentFrame', () => {
  it('intentFrame anomaly_detection + P0.9 → anomaly (regex match 없어도)')
  it('intentFrame ops_advice + P0.8 → advisor 우선')
  it('intentFrame P0.7 미만 → regex fallback 유지')
  it('intentFrame undefined → 기존 동작 동일')
})
```

### 구현 범위

- [x] T1: 기존 `DomainIntentFrame.intent`/`capabilityId` 값과 `orchestrator-direct-routing.ts` semantic mapping 재사용 여부 확인
- [x] T2: `getIntentCategory()` 시그니처 확장 + semantic frame→category 매핑
- [x] T3: `supervisor-single-agent*.ts`에서 normalized intentFrame을 `getIntentCategory`/`createPrepareStep` 정책 경로에 전달
- [x] T4: `AssistantRuntimePrepareStepOptions`에 intentFrame 옵션 추가
- [x] T5: 회귀 테스트 — regex fallback 경로 기존 동작 보존 확인

**예상 공수**: 2~3시간 (Codex 위임 가능)
**영향 범위**: Cloud Run AI Engine only (Vercel 변경 없음)

**완료 검증 (2026-05-20)**:
- targeted: `routing-policy.test.ts` — 77 PASS
- targeted: `supervisor-domain-wiring.contract.test.ts` — 13 PASS
- AI Engine: `type-check`, full `npm run test` — 136 files / 1354 tests PASS

---

## A2: 세션 메모리 sessionId transport/동기화

### 현황 진단

`session-memory.ts` (71줄) 구조는 올바름:
- Redis TTL 1시간, 최근 20 메시지 유지
- `getHistory()` / `saveHistory()` / `getToolCache()` 분리

**확인된 문제 후보**:
1. `useChatSession.ts`는 `localStorage` 기반 30분 TTL을 사용한다. 새로고침 연속성은 있지만 같은 브라우저의 다른 탭도 같은 sessionId를 공유할 수 있어 목표 상태와 다르다.
2. AI SDK `useChat({ id })`는 기본 POST body에 `id`를 넣는다. 현재 `/api/ai/supervisor/stream/v2`는 `body.sessionId`만 읽으므로 최초 POST에서 프론트 sessionId가 Cloud Run으로 전달되지 않을 수 있다.
3. `useHybridAIQuery`의 내부 `sessionIdRef`는 최초 `initialSessionId`로 고정된다. `useChatHistory.onSessionRestore` 또는 `handleNewSession()`으로 외부 sessionId가 바뀌어도 transport id/async queue id가 갱신되지 않을 수 있다.

**핵심 파일**:
- `src/hooks/ai/useAIChatCore.ts` (sessionId 생성 위치 확인 필요)
- `src/hooks/ai/core/useChatSession.ts`
- `src/hooks/ai/useHybridAIQuery.ts`
- `src/hooks/ai/core/createHybridChatTransport.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/session-memory.ts`
- `src/app/api/ai/supervisor/route.ts` (sessionId transport 확인 필요)
- `src/app/api/ai/supervisor/stream/v2/route.ts` (primary transport)

### 목표 상태

```
사용자 세션 = { tabId + userId(or guestPin) }
→ 같은 탭 내 새로고침 → 같은 sessionId (히스토리 연속)
→ 다른 탭 → 다른 sessionId (독립 대화)
→ 로그아웃 재로그인 → 새 sessionId (보안)
→ Vercel primary stream POST → Cloud Run request.sessionId 동일
```

### 테스트 시나리오

```typescript
// test(spec): sessionId continuity
describe('sessionId strategy', () => {
  it('같은 탭 새로고침 → sessionId 동일')
  it('다른 탭 → sessionId 다름')
  it('AI SDK initial POST body에 sessionId를 명시적으로 포함')
  it('history restore/new session 후 useHybridAIQuery transport sessionId도 갱신')
  it('Vercel stream/v2 route가 sessionId를 Cloud Run body로 전달')
  it('sessionId 없으면 대화 이력 없이 시작 (graceful)')
})
```

### 구현 범위

- [x] T1: `useChatSession.ts` 저장소를 `sessionStorage` 기반 탭-고유 ID로 전환
- [x] T2: `createHybridChatTransport`/`useHybridAIQuery`에서 primary POST body에 `sessionId` 명시
- [x] T3: `useHybridAIQuery` 내부 session ref를 prop 변경에 동기화
- [x] T4: `stream/v2/route.ts` 테스트에 AI SDK 기본 `id`와 명시 `sessionId` 케이스 추가
- [x] T5: Cloud Run `SessionMemoryService.getHistory/saveHistory` graceful empty/write-fail 동작 유지 확인

**예상 공수**: 2~4시간 (계약 테스트 포함)
**영향 범위**: Vercel 프론트엔드 + Cloud Run (transport 계층)

**완료 검증 (2026-05-20)**:
- targeted DOM: `createHybridChatTransport.test.ts`, `useChatSession.test.ts` — 12 PASS
- targeted Node: supervisor stream/legacy/schema tests — 70 PASS
- root: `type-check`, `lint`, `test:quick`, `test:contract` PASS

---

## A3: KRL seed 주기 보강

### 현황 진단

```
현재 KB: 60건 (2026-05-20 live 기준)
카테고리: architecture=5, command=25, incident=9, best_practice=9, troubleshooting=11, security=1
hard max: 64건 (초과 시 governance FAIL)
```

- 2026-05-20 live 기준 `troubleshooting=11` 포함, 총 60건 유지
- `security` 1건 — 현 정책 target 1~2 범위 안이지만 보강 여지는 있음
- `architecture` 5건 — 현 정책 target max 도달
- `command` 25건 — 현 정책 target max 도달, 전체 비율 41.7%로 `MAX_COMMAND_DOC_RATIO=42%`에 근접
- 이전 seed 10건 추가 시 64 초과로 롤백한 이력 있음 (2026-05-15)
- smoke/analyze 모두 PASS이므로 현재 Supabase KB는 즉시 수정 대상이 아님

### 목표 상태

```
기본 원칙: HARD_MAX_TOTAL_DOCS=64 유지, target total 60 유지
추가가 필요하면 replacement-only 또는 policy/test 선행 변경

security 보강은 현 정책상 최대 +1만 직접 허용 가능
architecture 보강은 이미 max=5이므로 기존 항목 개선/교체 우선
```

### 구현 범위

- [x] T1: live Supabase KB/RPC 상태 확인
- [x] T2: `npm run supabase:rag:smoke` 확인 — 16/16 PASS
- [x] T3: `npm run rag:analyze` 확인 — RAG-GOV 전체 PASS
- [x] T4: security 보강 필요성 판단 — 현재 `security=1`은 정책 범위 안이며 직접 seed 추가는 보류. 대신 `search_knowledge_text:category-security` live smoke를 추가해 기존 보안 문서 검색 회귀를 고정
- [x] T5: architecture 보강 판단 — `architecture=5`가 현 target max이므로 신규 추가 없음. topology/OTel SSOT smoke와 `rag:analyze` coverage guard로 기존 5건 유지 확인
- [x] T6: hard max 80 상향 보류 — `HARD_MAX_TOTAL_DOCS=64`, target 60 정책 유지. 별도 policy/test 변경 없이 상향하지 않음

**예상 공수**: 1~2시간
**영향 범위**: Supabase KB 테이블 only (코드 변경 없음)

**완료 검증 (2026-05-20)**:
- live smoke: `npm run supabase:rag:smoke` — 17/17 PASS
- live governance: `cd cloud-run/ai-engine && npm run rag:analyze` — 60 docs, command 25/60=41.7%, category coverage 전체 PASS
- DB write: 없음. 현재 corpus는 목표치 안에 있으므로 replacement-only seed도 불필요

---

## 실행 순서

```
A2 (P1, 계약 결함 후보)
  → test(spec): sessionId transport/restore failing tests 커밋
  → feat: primary stream POST sessionId 명시 + ref 동기화
  → root type-check + test:quick + relevant stream route tests 통과

A1 (P2, Codex 위임 가능)
  → test(spec): intentFrame routing 커밋
  → feat: getIntentCategory intentFrame 후속 정책 연결 커밋
  → AI Engine type-check + full test 통과

A3 (P3, 완료 / 현재 write 보류)
  → replacement-only seed 불필요로 판단
  → security category smoke 추가
  → supabase:rag:smoke + rag:analyze PASS
```

**병렬 가능**: A1 테스트 설계와 A2 구현 설계는 병렬 가능.
**A3 전제**: A1/A2 완료 후 KB 검색 품질 기준선 재측정. 현재 Supabase 쓰기 작업은 보류.
