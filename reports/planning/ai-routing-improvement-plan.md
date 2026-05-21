> Owner: project
> Status: Draft
> Last reviewed: 2026-05-21

# AI 라우팅 아키텍처 개선 계획

- 상태: Draft
- 작성일: 2026-05-21
- TODO.md 연결: Active Tasks > AI 라우팅 아키텍처 개선
- 배경: 기존 설계 분석에서 식별된 신뢰 경계·중복·책임 분산 문제 해소

---

## 컨텍스트

현재 AI 라우팅 흐름:

```
클라이언트
  ├─ classifyQuery()                  # 키워드 매칭 (로컬)
  ├─ shouldExtractSemanticIntentFrame()  # 패턴 매칭 (로컬)
  └─ [조건부] POST /api/ai/nlq/extract-entities
       └─ Groq Llama 4 Scout → intentFrame { intent, confidence }

Vercel BFF (/api/ai/supervisor)
  └─ Auth / Cache / Rate-limit → Cloud Run 프록시 (intentFrame 포함)

Cloud Run (orchestrator-direct-routing.ts)
  └─ intentFrame.confidence ≥ 0.8 → 에이전트 결정론적 선택
```

---

## 개선 항목

### P1 — Cloud Run intent 화이트리스트 검증 (보안)

**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-semantic-metadata.ts`  
**파일**: `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`

**문제**:  
`normalizeSupervisorIntentFrame()`이 `intent` 필드를 `readString()`으로만 검증 — 어떤 문자열이든 통과.  
`resolveSemanticFrameAgent()`의 `capabilityId.includes('incident_report')` 패턴은 prefix injection에 취약.

**변경**:

```typescript
// supervisor-semantic-metadata.ts 상단에 추가
const VALID_DOMAIN_INTENTS = new Set([
  'metric_peak', 'metric_current', 'metric_trend',
  'anomaly_detection', 'anomaly_prediction', 'capacity_forecast',
  'failure_risk', 'server_health', 'root_cause',
  'incident_report', 'ops_advice', 'log_analysis', 'unknown',
]);

const VALID_DOMAIN_IDS = new Set(['openmanager-monitoring']);

// normalizeSupervisorIntentFrame 내부:
if (!VALID_DOMAIN_INTENTS.has(intent)) return undefined;
if (domainId && !VALID_DOMAIN_IDS.has(domainId)) return undefined;
const clampedConfidence = Math.max(0, Math.min(100, confidence));
```

```typescript
// orchestrator-direct-routing.ts — includes → exact match
// Before
semanticKey.includes('incident_report')
// After
semanticKey === 'incident_report' || semanticKey === 'monitoring.incident_report'
```

**검증**: AI Engine targeted Vitest, `type-check`

---

### P2 — `getOffDomainGuardrail` 이중 호출 제거 (중복 코드)

**파일**: `src/lib/ai/query-classifier.ts`

**문제**:  
`useQueryExecution.ts`가 `getOffDomainGuardrail()`을 먼저 호출해 조기 종료하지만,  
이후 호출되는 `classifyQuery()` 내부에서도 동일 함수를 다시 호출.

**변경**:  
`classifyQuery()`에서 `getOffDomainGuardrail()` 호출 및 `off-domain` 분기 제거.  
`useQueryExecution`의 조기 종료가 유일한 오프도메인 게이트임을 명확히.

```typescript
// query-classifier.ts — 제거 대상
// const offDomainGuardrail = getOffDomainGuardrail(query);
// if (offDomainGuardrail) { return { intent: 'off-domain', ... }; }
```

**검증**: `query-classifier` 관련 Vitest, `type-check`, `lint`

---

### P3 — clarification·routing 트리거 분리 (아키텍처)

**파일**: `src/hooks/ai/core/useQueryExecution.ts`

**문제**:  
엔티티 추출(Groq, ~200ms)이 두 가지 다른 목적으로 단일 조건에 묶임:
- `shouldExtractSemanticIntentFrame()` → Cloud Run 에이전트 선택 힌트
- `generateClarification()` 결과 있음 → 사용자에게 명확화 질문

두 목적이 섞여 있어 명확화 불필요한 복잡 쿼리도 Groq를 호출하고,  
라우팅 힌트 불필요한 단순 쿼리도 엔티티를 추출하는 경우 발생.

**변경**:

```typescript
// 목적을 명시적으로 분리
const needsRoutingHint = shouldExtractSemanticIntentFrame(query);
const needsClarificationCheck = !!generateClarification(query, classification);

if (needsRoutingHint || needsClarificationCheck) {
  const entities = await extractEntitiesCached(query);

  // 라우팅 힌트 — Cloud Run으로 전달
  if (needsRoutingHint && entities.intentFrame) {
    refs.semanticIntentFrame.current = entities.intentFrame;
  }

  // 명확화 — 유효 엔티티 있으면 skip, 없으면 질문 표시
  if (needsClarificationCheck) {
    const hasEntities =
      entities.server !== undefined ||
      entities.metric !== undefined ||
      entities.intentFrame !== undefined;
    if (!hasEntities) {
      // clarification 표시 로직
    }
  }
}
```

**검증**: `useQueryExecution` 관련 Vitest, 통합 smoke

---

### P4 — `classifyQuery().intent` 필드 범위 명확화 (기술 부채)

**파일**: `src/lib/ai/query-classifier.ts`

**문제**:  
`intent: 'monitoring' | 'analysis' | 'general' | 'off-domain'` 필드가  
Cloud Run의 `intentFrame.intent`(`'anomaly_detection'` 등)와 이름이 동일해 혼동 유발.  
실제로는 로컬 clarification 판단용으로만 사용되며 Cloud Run으로 전달되지 않음.

**변경**:

```typescript
export interface QueryClassification {
  complexity: number;
  /** @internal Cloud Run으로 전달되지 않음. clarification + complexity 판단 전용 */
  localIntent: 'general' | 'monitoring' | 'analysis' | 'off-domain';
  reasoning: string;
  confidence: number;
  isOffDomain?: boolean;
  offDomainCategory?: OffDomainGuardCategory;
}
```

`intent` → `localIntent` 리네임 후 참조 전체 교체.

**검증**: `type-check`, 참조처(`clarification-generator.ts`, `useQueryExecution.ts`) 컴파일

---

## 실행 순서

```
P1 (Cloud Run whitelist)  →  P2 (off-domain dedup)  →  P4 (rename)  →  P3 (trigger split)
  보안 우선                    단순 제거                  타입 정렬          구조 개선
```

P1·P2·P4는 각각 독립 커밋.  
P3는 `useQueryExecution` 변경 범위가 크므로 SDD 선행 커밋 후 구현.

---

## 검증 게이트 (전체)

```bash
npm run type-check
npm run lint
npm run test:quick
npm run test:contract
```

AI Engine 변경(P1) 시 추가:
```bash
# cloud-run/ai-engine 디렉토리 기준
npx tsc --noEmit
npx vitest run
```
