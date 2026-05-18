> Owner: project
> Status: Completed
> Last reviewed: 2026-05-19

# Predict Trends Network Plan

- 상태: Completed
- 작성일: 2026-05-19
- TODO.md 연결: Active Tasks > Analyst `predictTrends` network metric 확장

## 목표
Analyst Agent의 `predictTrends` 도구가 `network` 메트릭을 단일 예측과 `all` 예측에 포함하도록 확장한다. `network`는 이미 `STATUS_THRESHOLDS`와 precomputed 서버 스냅샷에 존재하므로, 새 알고리즘 없이 기존 TrendPredictor 경로에 편입한다.

## 범위
- 포함: `predictTrends` input schema/type/currentMetrics/history/target metric 목록의 `network` 지원, 회귀 테스트.
- 제외: `load1/load5` 예측. load는 percent threshold가 아니며 cpuCores 기반 threshold 설계가 필요하므로 별도 작업으로 분리한다.

## 계약 (Contract)

### 변경 대상 파일
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools-trend.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools.test.ts`

### 입출력 계약
| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `predictTrends.execute` | `metricType: "network"` | `results.network`와 network threshold breach/recovery metadata | 서버 미존재 시 기존 실패 응답 |
| `predictTrends.execute` | `metricType: "all"` | `results.cpu/memory/disk/network` 모두 포함 | history 누락 시 precomputed fallback |

### 테스트 시나리오
- [x] network 단일 예측은 injected `currentMetrics.network`와 `history.network`를 사용한다.
- [x] all 예측은 network까지 포함해 predictor를 호출한다.

## Task 목록
- [x] Task 0 — failing test 추가
- [x] Task 1 — `predictTrends` network 지원 구현
- [x] Task 2 — 검증 및 TODO/plan 완료 처리

## 완료 기준
- [x] targeted analyst-tools tests 통과
- [x] AI Engine `type-check` 통과
- [x] AI Engine full test 통과
- [x] `git diff --check` 통과
