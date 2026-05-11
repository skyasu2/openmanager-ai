> Owner: project
> Status: Approved
> Last reviewed: 2026-05-11

# AI Assistant Semantic Intent Frame Plan

- 상태: Approved
- 작성일: 2026-05-11
- TODO.md 연결: Active Tasks > AI Assistant Semantic Intent Frame Phase 1

## 목표

자연어 질의 다양성을 정규식/NLP 패턴만으로 처리하려는 부담을 줄이고, 앞단 LLM을 답변 생성기가 아니라 semantic parser로 활용할 수 있는 최소 계약을 추가한다.

이번 단계는 대규모 런타임 재작성 없이 `entity-extractor -> clarification -> domain evidence` 사이에 optional `IntentFrame`을 도입해, 전체 서버 집계 질의가 서버 ID 부재만으로 차단되지 않도록 한다.

## 범위

- 포함:
  - Root App NLQ entity extraction 응답에 optional semantic intent frame 추가
  - clarification 판단에서 `scope=whole_fleet` / `intent=metric_peak` 힌트 우선 반영
  - monitoring peak evidence provider의 `24h`, `load1`, `load5` 표현 보강
  - 관련 deterministic unit/contract test 추가
- 제외:
  - provider 구현체 이름을 frontend/root app에 노출
  - 전체 AI routing/orchestrator 재작성
  - production Vercel live LLM 반복 QA
  - 새로운 임시 endpoint 추가

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/entity-extractor.ts`
- `src/app/api/ai/nlq/extract-entities/route.ts`
- `src/lib/ai/clarification-generator.ts`
- `cloud-run/ai-engine/src/domains/monitoring/peak-metric-evidence-provider.ts`
- 관련 테스트:
  - `src/lib/ai/entity-extractor.test.ts`
  - `src/lib/ai/clarification-generator.test.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.test.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `POST /api/ai/nlq/extract-entities` | `{ query: string }` | 기존 `server/metric/timeRange/confidence` + optional `intentFrame` | provider 실패 시 `{ confidence: 0 }` 유지 |
| `normalizeExtractedEntities` | unknown provider payload | sanitized `ExtractedEntities` | unknown enum/drop, confidence clamp |
| `generateClarification` | `query`, `classification`, optional entities/frame | `ClarificationRequest | null` | `scope=whole_fleet`이면 서버 ID 부재로 clarification 금지 |
| `monitoringPeakMetricEvidenceProvider.canHandle` | raw query | boolean | `24h/load1/peak` 표현도 peak metric intent로 처리 |

### `SemanticIntentFrame` 계약

```ts
interface SemanticIntentFrame {
  domain: 'monitoring' | 'unknown';
  intent:
    | 'metric_peak'
    | 'metric_current'
    | 'metric_trend'
    | 'server_health'
    | 'unknown';
  scope: 'whole_fleet' | 'server' | 'group' | 'unknown';
  targets: string[];
  metric:
    | 'cpu'
    | 'memory'
    | 'disk'
    | 'network'
    | 'load1'
    | 'load5'
    | 'unknown';
  timeWindow: 'current' | '1h' | '6h' | '24h' | '7d' | 'unknown';
  aggregation: 'peak' | 'max' | 'avg' | 'top_n' | 'summary' | 'unknown';
  topN?: number;
  ambiguity: 'low' | 'medium' | 'high';
  confidence: number;
}
```

### 테스트 시나리오 (구현 전 확정)

- [ ] `normalizeExtractedEntities`는 valid intent frame을 보존하고 unknown enum 값을 제거한다.
- [ ] `extractEntities`는 route 응답의 `intentFrame`을 client model에 전달한다.
- [ ] `generateClarification`은 `scope=whole_fleet`, `intent=metric_peak`, `metric=load1`, `timeWindow=24h`이면 서버명이 없어도 clarification을 반환하지 않는다.
- [ ] `generateClarification`은 `scope=server`인데 targets가 비어 있고 ambiguity가 높으면 서버 clarification을 유지한다.
- [ ] monitoring peak evidence provider는 `24h 기준 load1 peak가 언제였고 어떤 서버가 가장 영향을 줬어?`를 처리한다.

## Task 목록

- [ ] Task 0 — failing test 커밋: 위 테스트 시나리오를 구현 전 실패 상태로 추가
- [ ] Task 1 — semantic intent frame 타입/normalizer/API schema 확장
- [ ] Task 2 — clarification 판단에 intent frame 반영
- [ ] Task 3 — monitoring peak provider alias 보강
- [ ] Task 4 — 문서/TODO 정리 및 targeted 검증

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 (failing test) | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~3 | `feat(ai):` | ✅ | 변경 포함 시 release/tag에서 판단 | 변경 포함 시 release/tag에서 판단 |
| Task 4 | `docs:` 또는 구현 커밋 포함 | ✅ | ❌ | ❌ |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing test가 계약을 정확히 표현하는지 |
| 핵심 구현 Task 완료 후 | LLM 앞단이 provider 구현체를 알지 않는지, 수치 계산이 deterministic provider에 남아 있는지 |
| 전체 완료 후 | 비용/테스트 범위가 risk-based 원칙을 지키는지 |

## 완료 기준

- [ ] targeted root unit tests 통과
- [ ] targeted AI Engine unit tests 통과
- [ ] `git diff --check` 통과
- [ ] `entity-extractor`/clarification/provider 계약이 provider 이름 누출 없이 유지됨
- [ ] production live LLM QA는 release/tag 배포 후 별도 QA gate로 남김
