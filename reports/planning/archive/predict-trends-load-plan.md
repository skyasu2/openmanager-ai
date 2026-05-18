> Owner: project
> Status: Completed
> Last reviewed: 2026-05-19

# Predict Trends Load Plan

- 상태: Completed
- 작성일: 2026-05-19
- TODO.md 연결: Active Tasks > Analyst `predictTrends` load average metric 확장

## 목표
Analyst Agent의 `predictTrends` 도구가 `load1`/`load5` 메트릭을 단일 예측과 `all` 예측에 포함하도록 확장한다. load average는 percent 기반 메트릭이 아니므로 CPU/Memory/Disk/Network 임계값을 재사용하지 않고, 서버별 `cpuCores`를 기준으로 동적 임계값을 계산한다.

## 범위
- 포함: `predictTrends` input schema/type/currentMetrics/history/target metric 목록의 `load1`/`load5` 지원, `TrendPredictor.predictEnhanced`의 optional threshold override, 회귀 테스트.
- 제외: 전체 서버 fleet-level load peak 분석. 해당 경로는 기존 `peak-metric` 도메인 evidence가 담당한다.

## 계약 (Contract)

### 변경 대상 파일
- `cloud-run/ai-engine/src/config/status-thresholds.ts`
- `cloud-run/ai-engine/src/lib/ai/monitoring/TrendPredictor.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools-trend.ts`
- `cloud-run/ai-engine/src/tools-ai-sdk/analyst-tools.test.ts`

### Load 임계값
| 메트릭 | warning | critical | recovery |
|--------|---------|----------|----------|
| `load1`/`load5` | `cpuCores * 1.0` | `cpuCores * 1.5` | `cpuCores * 0.7` |

### 입출력 계약
| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `predictTrends.execute` | `metricType: "load1"` 또는 `"load5"` | `results.load1` 또는 `results.load5`와 load threshold breach/recovery metadata | `cpuCores` 부재/0 이하이면 해당 load 메트릭 생략 또는 단일 요청 실패 |
| `predictTrends.execute` | `metricType: "all"` | 기본 percent 메트릭과 함께 가능한 경우 `results.load1/load5` 포함 | load 해석 불가 시 percent 메트릭 결과는 유지 |

### 테스트 시나리오
- [x] load1 단일 예측은 injected `currentMetrics.load1`, `currentMetrics.cpuCores`, `history.load1`을 사용하고 `cpuCores` 기반 threshold override를 전달한다.
- [x] all 예측은 `cpuCores`가 있는 서버에서 `load1`/`load5`까지 predictor를 호출한다.

## Task 목록
- [x] Task 0 — failing test 추가
- [x] Task 1 — load threshold helper와 predictor override 구현
- [x] Task 2 — `predictTrends` load 지원 구현
- [x] Task 3 — 검증 및 TODO/plan 완료 처리

## 완료 기준
- [x] targeted analyst-tools tests 통과
- [x] AI Engine `type-check` 통과
- [x] AI Engine full test 통과
- [x] `git diff --check` 통과
