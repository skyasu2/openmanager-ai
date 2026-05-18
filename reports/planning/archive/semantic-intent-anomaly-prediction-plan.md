> Owner: project
> Status: Completed
> Last reviewed: 2026-05-19

# Semantic Intent Anomaly Prediction Plan

- 상태: Completed
- 작성일: 2026-05-19
- TODO.md 연결: Active Tasks > Vercel NLQ semantic intent 확장

## 목표
Vercel NLQ LLM이 자연어 질의를 Cloud Run으로 넘기기 전에 이상 탐지와 예측 의도를 더 명확한 `intentFrame` 계약으로 표현한다. Cloud Run은 이 값을 힌트로 검증해 Analyst 라우팅에 반영하고, confidence/ambiguity가 낮으면 기존 regex fallback을 유지한다.

## 범위
- 포함: Vercel `/api/ai/nlq/extract-entities` semantic intent enum, entity normalizer, Cloud Run direct semantic routing, mode selection, 테스트 계약.
- 제외: 실제 LLM provider 변경, 실 LLM smoke, `predictTrends`의 network/load 예측 알고리즘 확장, UI 문구 변경.

## 계약 (Contract)

### 변경 대상 파일
- `src/lib/ai/entity-extractor.ts`
- `src/app/api/ai/nlq/extract-entities/route.ts`
- `src/lib/ai/semantic-intent-frame.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-direct-routing.ts`
- `cloud-run/ai-engine/src/domains/monitoring/routing-policy.ts`
- 관련 테스트 파일

### 입출력 계약
| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `POST /api/ai/nlq/extract-entities` | 자연어 질의 | `intentFrame.intent`에 `anomaly_detection`, `anomaly_prediction`, `capacity_forecast`, `failure_risk` 허용 | provider 실패 시 기존 `confidence: 0` fallback |
| `toDomainIntentFrame` | `SemanticIntentFrame` | `capabilityId`를 `monitoring.anomaly_detection`, `monitoring.anomaly_prediction`, `monitoring.capacity_forecast`, `monitoring.failure_risk`로 매핑 | low confidence/high ambiguity/unknown은 기존 reason code |
| `resolveDirectRoutingTarget` | `DomainIntentFrame` | 신규 anomaly/prediction capability는 `Analyst Agent` | confidence < 0.8이면 pre-filter fallback |
| `selectExecutionMode` | query + intentFrame | 신규 anomaly/prediction intent의 `executionMode: multi`는 multi 유지 | intentFrame 불충분 시 기존 regex fallback |

### 테스트 시나리오 (구현 전 확정)
- [ ] `"이상 탐지해줘"` semantic frame은 `anomaly_detection`을 허용하고 Analyst로 라우팅한다.
- [ ] `"디스크 고갈 예측해줘"` semantic frame은 `capacity_forecast`를 허용하고 Analyst로 라우팅한다.
- [ ] `"장애 날 것 같은 서버 있어?"` semantic frame은 `failure_risk`를 허용하고 Analyst로 라우팅한다.
- [ ] low confidence 신규 intent는 기존 pre-filter fallback을 유지한다.
- [ ] 기존 `metric_trend`, `server_health`, `metric_peak` 계약은 유지한다.

## Task 목록
- [x] Task 0 — failing test 추가: 신규 semantic intent enum/매핑/라우팅 기대값 고정
- [x] Task 1 — Vercel entity extractor schema/prompt/normalizer 확장
- [x] Task 2 — Cloud Run direct routing/mode 테스트 정렬
- [x] Task 3 — type/test 검증 및 TODO/plan 완료 처리

## 완료 기준
- [x] 신규 semantic intent 테스트 통과
- [x] root 관련 테스트 통과
- [x] AI Engine 관련 테스트 통과
- [x] `git diff --check` 통과
