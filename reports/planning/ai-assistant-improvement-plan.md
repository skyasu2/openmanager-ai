> Owner: project
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-05-20
> Tags: ai-engine, routing, session-memory, rag

# AI 어시스턴트 개선 계획 (2026-05-20)

**근거**: 2026-05-20 설계적 분석 결과 도출. 총점 84/100 기준 미달 3개 영역.
HEAD 기준: v8.11.184 / `4774c1c01` 이후.

---

## 개선 항목 요약

| ID | 영역 | 현재 점수 | 목표 | 우선순위 |
|----|------|:---------:|:----:|:--------:|
| A1 | intentFrame → getIntentCategory 연결 | 18/20 | 19/20 | **P1** |
| A2 | 세션 메모리 sessionId 전략 검토 | 8/10 | 9/10 | P2 |
| A3 | KRL seed 주기 보강 | 11/15 | 12/15 | P3 |

---

## A1: intentFrame → getIntentCategory 라우팅 연결

### 현황 진단

`routing-policy.ts:71~117` 기준:

```
selectExecutionMode()   → intentFrame P0.8+ 적용 ✅
getIntentCategory()     → regex primary, intentFrame 미반영 ❌
```

- Groq NLQ `/api/ai/nlq/extract-entities` 분류 비용은 지불
- Cloud Run `getIntentCategory()`는 여전히 regex로 에이전트 선택
- 결과: intentFrame 신뢰도가 높아도 잘못된 에이전트가 선택될 수 있음

**핵심 파일**:
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts` (getIntentCategory L137~)
- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts` (DomainIntentFrame)
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`

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

- [ ] T1: 기존 `DomainIntentFrame.intent`/`capabilityId` 값과 `orchestrator-direct-routing.ts` semantic mapping 재사용 여부 확인
- [ ] T2: `getIntentCategory()` 시그니처 확장 + semantic frame→category 매핑
- [ ] T3: `orchestrator-direct-routing.ts`에서 intentFrame 전달
- [ ] T4: 회귀 테스트 — regex fallback 경로 기존 동작 보존 확인

**예상 공수**: 2~3시간 (Codex 위임 가능)
**영향 범위**: Cloud Run AI Engine only (Vercel 변경 없음)

---

## A2: 세션 메모리 sessionId 전략 검토

### 현황 진단

`session-memory.ts` (71줄) 구조는 올바름:
- Redis TTL 1시간, 최근 20 메시지 유지
- `getHistory()` / `saveHistory()` / `getToolCache()` 분리

**불명확한 부분**:
1. 프론트엔드 `useAIChatCore.ts`에서 sessionId를 어떻게 생성하는가
2. 동일 사용자의 다른 브라우저 창이 sessionId를 공유하는가
3. 페이지 새로고침 후 sessionId 연속성 여부

**핵심 파일**:
- `src/hooks/ai/useAIChatCore.ts` (sessionId 생성 위치 확인 필요)
- `cloud-run/ai-engine/src/services/ai-sdk/session-memory.ts`
- `src/app/api/ai/supervisor/route.ts` (sessionId transport 확인 필요)

### 목표 상태

```
사용자 세션 = { tabId + userId(or guestPin) }
→ 같은 탭 내 새로고침 → 같은 sessionId (히스토리 연속)
→ 다른 탭 → 다른 sessionId (독립 대화)
→ 로그아웃 재로그인 → 새 sessionId (보안)
```

### 테스트 시나리오

```typescript
// test(spec): sessionId continuity
describe('sessionId strategy', () => {
  it('같은 탭 새로고침 → sessionId 동일')
  it('다른 탭 → sessionId 다름')
  it('sessionId 없으면 대화 이력 없이 시작 (graceful)')
})
```

### 구현 범위

- [ ] T1: `useAIChatCore.ts` sessionId 생성 로직 현황 파악 (코드 읽기)
- [ ] T2: 전략 불일치 시 `sessionStorage` 기반 탭-고유 ID로 교체
- [ ] T3: `supervisor/route.ts` sessionId 수신→SessionMemory 호출 연결 확인
- [ ] T4: 히스토리 조회 실패 시 graceful empty 보장 (이미 구현됐는지 확인)

**예상 공수**: 1~2시간 (현황 파악 포함)
**영향 범위**: Vercel 프론트엔드 + Cloud Run (transport 계층)

---

## A3: KRL seed 주기 보강

### 현황 진단

```
현재 KB: 60건 (2026-05-15 live 기준)
카테고리: architecture=5, command=25, incident=9, best_practice=9, security=1
hard max: 64건 (초과 시 governance FAIL)
```

- `security` 1건 — 운영 실무 기준으로 현저히 부족
- `architecture` 5건 — 실제 배포 토폴로지 문서 대비 얕음
- 이전 seed 10건 추가 시 64 초과로 롤백한 이력 있음 (2026-05-15)

### 목표 상태

```
hard max를 80으로 상향하거나, 저품질 command 항목 교체 방식으로
security +4, architecture +3 추가 (총 60→67건 범위)
```

### 구현 범위

- [ ] T1: hard max 상향 타당성 검토 (`governance.ts` 기준 확인)
- [ ] T2: 기존 command 항목 중 중복/저품질 3~5건 정리
- [ ] T3: security 시나리오 4건 seed 추가 (접근 제어, 비정상 요청, 임계 경고)
- [ ] T4: architecture 시나리오 3건 추가 (Vercel+Cloud Run 하이브리드 구조)
- [ ] T5: `npm run supabase:rag:smoke` 재확인

**예상 공수**: 1~2시간
**영향 범위**: Supabase KB 테이블 only (코드 변경 없음)

---

## 실행 순서

```
A1 (P1, Codex 위임 가능)
  → test(spec): intentFrame routing 커밋
  → feat: getIntentCategory intentFrame 연결 커밋
  → AI Engine type-check + full test 통과
  → tag push → GitLab pipeline 확인

A2 (P2, 현황 파악 선행)
  → useAIChatCore.ts sessionId 코드 읽기
  → 문제 있으면 수정, 없으면 T3 transport만 확인
  → root type-check + test:quick 통과

A3 (P3, 사용자 확인 후)
  → governance hard max 검토
  → seed SQL 준비 → supabase:rag:smoke PASS
```

**병렬 가능**: A2 T1(코드 읽기)은 A1과 병렬로 진행 가능.
**A3 전제**: A1 완료 후 KB 검색 품질 기준선 재측정.
