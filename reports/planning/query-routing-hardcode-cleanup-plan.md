# Query Routing Hardcode Cleanup Plan

Status: Completed
Owner: project
Created: 2026-04-29

## Problem

`orchestrator-query-intent.ts` 도입으로 deterministic 응답 라우팅은 구조적 의도 분류 기반으로 개선됐으나,
동일한 환경 종속적 패턴이 다른 곳에도 남아 있다.

세 가지 문제 지점:

1. `DIRECT_SERVER_ID_PATTERN` — OTel resource-catalog의 실제 서버 ID를 정규식에 하드코딩
2. `lib/query-type-classifier.ts` — `orchestrator-query-intent.ts`와 개념이 완전히 중복되는 별도 분류기
3. `supervisor-routing.ts` METRIC_RANKING / CURRENT_METRIC_VALUE 패턴 — 새 intent 분류기와 부분 중복

## Contract

### Task 1: DIRECT_SERVER_ID_PATTERN → 동적 서버 ID 감지

**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`

**현재 (hardcoded)**:
```typescript
// line 331
const DIRECT_SERVER_ID_PATTERN =
  /\b(?:lb-haproxy|web-nginx|api-was|db-mysql|cache-redis|storage-(?:nfs|s3gw))-dc1-(?:\d{2}|primary|replica|backup)\b/i;
```

**수정 방향**: 상수 정규식 제거 → 런타임에 resource catalog에서 서버 ID 목록을 읽어 패턴을 동적으로 생성.

`precomputed-state-core.ts`에 이미 `getResourceCatalog()` 함수가 있고, `resource-catalog.json`의 `resources` 키는 서버 ID를 key로 갖는 객체(`{ 'web-nginx-dc1-01': {...}, ... }`)임.

구현 방식:
```typescript
// supervisor-routing.ts에 추가할 함수
function buildServerIdPattern(): RegExp {
  // lazy init — 파일 최상위 const 대신 함수 호출로 지연 평가
  // getResourceCatalog()가 null이면 범용 fallback 패턴 사용
  try {
    const catalog = getResourceCatalog();
    if (catalog?.resources) {
      const ids = Object.keys(catalog.resources);
      if (ids.length > 0) {
        const escaped = ids.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return new RegExp(`\\b(${escaped.join('|')})\\b`, 'i');
      }
    }
  } catch { /* fallback 허용 */ }
  // fallback: 공통 서버 명명 패턴 (환경 무관)
  return /\b[a-z][-a-z0-9]*-(?:dc|zone|region|prod|staging)\d*[-a-z0-9]*\b/i;
}

let _serverIdPattern: RegExp | null = null;
function getServerIdPattern(): RegExp {
  return (_serverIdPattern ??= buildServerIdPattern());
}
```

사용처 2곳(`shouldForceRealtimeServerMetricTool`, `shouldForceMetricRankingTool`)에서
`DIRECT_SERVER_ID_PATTERN` → `getServerIdPattern()` 로 교체.

**import 추가 필요**: `getResourceCatalog` from `../../data/precomputed-state-core`

---

### Task 2: query-type-classifier.ts 제거 → orchestrator-query-intent.ts 통합

**파일**:
- 삭제: `cloud-run/ai-engine/src/lib/query-type-classifier.ts`
- 수정: `cloud-run/ai-engine/src/services/ai-sdk/agents/config/instructions/nlq.ts`

**현재 구조**:
`classifyQueryType(query)` → `'STATUS_SUMMARY' | 'RANK_QUERY' | 'THRESHOLD_QUERY' | 'SIMPLE_LOOKUP'`

**`getNlqInstructions(query)`** 내부에서만 사용. switch로 query type에 따라 NLQ 프롬프트 지시문을 조합함.

**수정 방향**: `QueryType` → `QueryIntent` 매핑으로 교체.

```typescript
// nlq.ts 수정
import { classifyQueryIntent } from '../../../../../services/ai-sdk/agents/orchestrator-query-intent';

export function getNlqInstructions(query: string): string {
  const { intent } = classifyQueryIntent(query);

  switch (intent) {
    case 'data-filter':
      return `${NLQ_BASE_INSTRUCTIONS}\n\n${NLQ_THRESHOLD_CONTEXT}`;
    case 'data-ranking':
      return `${NLQ_BASE_INSTRUCTIONS}\n\n${NLQ_RANK_CONTEXT}`;
    case 'data-lookup':
      return `${NLQ_BASE_INSTRUCTIONS}\n\n${NLQ_STATUS_SUMMARY_CONTEXT}`;
    default:
      return NLQ_BASE_INSTRUCTIONS;
  }
}
```

`isQueryType()` 가드와 `QueryType` 타입도 더 이상 필요 없으므로 제거.
`query-type-classifier.ts` 파일 전체 삭제.

---

### Task 3: supervisor-routing.ts 중복 패턴 정리

**파일**: `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`

`METRIC_RANKING_PATTERNS`와 `CURRENT_METRIC_VALUE_PATTERNS`는 intent 분류기의
`RANKING_SIGNALS`, `THRESHOLD_FILTER_SIGNALS`와 의미상 겹침.
단, 이 두 패턴은 `shouldForceRealtimeServerMetricTool`, `shouldForceMetricRankingTool`에서
**tool 강제 호출 여부**를 결정하는 용도로 쓰이므로 완전 제거는 부적절.

**수정 방향**: 패턴 자체를 삭제하지 않고, `orchestrator-query-intent.ts`의 helper를 활용해 중복 로직을 위임.

```typescript
import { classifyQueryIntent } from '../../agents/orchestrator-query-intent';

function shouldForceMetricRankingTool(query: string): boolean {
  const { intent } = classifyQueryIntent(query);
  if (intent !== 'data-ranking') return false;
  // 시계열 쿼리는 현재 값이 아니므로 강제 안 함
  return !NON_CURRENT_METRIC_PATTERNS.test(query);
}
```

`METRIC_RANKING_PATTERNS`, `RANKABLE_METRIC_PATTERNS` 상수 제거 (의존성 없어지면).
`CURRENT_METRIC_VALUE_PATTERNS`, `NON_CURRENT_METRIC_PATTERNS`는 유지 (시계열 구분용으로 여전히 필요).

---

## 주의사항

- `getResourceCatalog()`는 동기 함수이나 파일 읽기를 포함할 수 있음 → lazy init 패턴으로 최초 1회만 실행
- `query-type-classifier.ts` 삭제 전 `knip` 또는 grep으로 다른 import 여부 재확인 필수
- Task 3에서 `shouldForceWebSearch`, `shouldForceKnowledgeBaseTool` 등 나머지 함수는 수정 범위 밖

## Verification

```bash
cd cloud-run/ai-engine

# 타입 검사
npx tsc --noEmit

# 삭제된 파일 import 잔재 확인
grep -r "query-type-classifier" src/

# 하드코딩된 서버 이름 잔재 확인
grep -r "lb-haproxy\|web-nginx\|api-was\|db-mysql\|cache-redis" src/ --include="*.ts" | grep -v ".test.ts"

# 테스트
npx vitest run src/services/ai-sdk/ src/lib/
```

## Completion Notes

- `DIRECT_SERVER_ID_PATTERN` hardcode를 제거하고 `resource-catalog.json` 기반 lazy server ID pattern으로 교체.
- `query-type-classifier.ts`와 전용 테스트를 제거하고 NLQ instruction layering을 `classifyQueryIntent()` 기반으로 통합.
- `shouldForceMetricRankingTool()`이 중복 regex 대신 `classifyQueryIntent()`의 `data-ranking` 결과를 사용.
- Deterministic formatter는 `cpu/memory/disk/network/status` metric-aware filter/ranking을 지원하고, `filterServers` empty result도 0건 답변으로 포맷.
- Vercel QA에서 발견한 제목/골격만 있는 tool-grounded 응답은 `LOW_INFORMATION_RESPONSE`로 감지해 summarization fallback을 추가 전송하도록 보강.
- 검증:
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-summary-fallback.test.ts`
  - `cd cloud-run/ai-engine && npx vitest run src/routes/jobs.test.ts src/tools-ai-sdk/server-metrics.test.ts src/services/ai-sdk/agents/orchestrator-routing.test.ts`
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/config/instructions/nlq.test.ts src/services/ai-sdk/supervisor-routing.test.ts`
  - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
  - `cd cloud-run/ai-engine && npm run type-check`
  - `cd cloud-run/ai-engine && npm test`
  - `npm run lint:changed`
