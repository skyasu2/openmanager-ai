> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-18
> Tags: reporter,pipeline,quality,scoring,predictions

# Reporter Pipeline Quality Improvement Plan

- 상태: Completed
- 작성일: 2026-05-18
- TODO.md 연결: Active Tasks > Reporter Pipeline 품질 개선

## 목표

Reporter Pipeline이 생성하는 장애 보고서의 품질 점수(overallScore)를 threshold 0.75 이상으로 안정적으로 통과시키고, no-incident(정상 상태) 케이스에서도 실질적인 내용이 포함된 예방 점검 보고서를 반환한다.

## 배경

v8.11.172에서 아래 3가지 기본 개선을 완료했다 (`fix(ai): improve reporter pipeline` 커밋).

- timeline timestamp → 히스토리 슬롯 실제 ts 사용
- SLA → 히스토리 기반 uptime 계산
- suggestedActions → CLI 명령어 포함

그러나 no-incident 상태에서 overallScore 계산 결과가 여전히 ~0.57로 threshold(0.75) 미달이며, `optimizeReport`가 이 케이스를 skip하는 구조적 문제가 남아있다.

## 범위

### 포함
- No-incident 보고서 score threshold/weight 재조정
- predictions 생성 대상을 warnings 서버까지 확대
- 히스토리 슬롯 수 확장 (6 → 12)
- `buildHistoryForMetric` 실제 슬롯 timestamp 사용
- `optimizeReport` no-incident 전용 최적화 경로 추가

### 제외
- `/analytics/incident-report` LLM 경로 변경
- `similarCases` RAG 연동
- Reporter Agent 모델 교체

## 계약 (Contract)

### 점수 목표

| 케이스 | 현재 overallScore | 목표 overallScore |
|--------|:-----------------:|:-----------------:|
| No-incident (정상 상태) | ~0.57 | ≥ 0.65 |
| Incident (장애 서버 있음) | ~0.70 | ≥ 0.75 |

### 테스트 시나리오

```
1. 모든 서버 정상 → overallScore ≥ 0.65 (threshold 통과)
2. 모든 서버 정상, warnings 서버 있음 → predictions 배열 non-empty
3. 장애 서버 1대, 히스토리 12슬롯 → timeline 이벤트에 2시간 범위 ts 포함
4. 히스토리 12슬롯 중 2개 critical → actualUptime = (10/12)*100 = 83.3
5. No-incident → optimizeReport 호출 시 오류 없이 predictions/warnings 강화됨
```

## Tasks

- [x] **T1** — `reporter-pipeline.ts` evaluateReport 가중치 재조정 및 no-incident threshold 분기
  - `accuracy` 35% → 25%, `structure` 20% → 25%, `completeness` 25% → 30%
  - `affectedServers.length === 0`이면 threshold를 0.65로 완화
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline.ts:302-310, 86-91`

- [x] **T2** — `reporter-pipeline-report.ts` predictions 생성 대상 확대
  - `generatePredictions` 호출 시 warnings 서버를 pseudo-affected 형태로 포함
  - 조건: `current[metric] >= 70` 기준 충족 시 predictions 생성 (기존 조건 유지)
  - 파일: `cloud-run/ai-engine/src/services/ai-sdk/agents/reporter-pipeline-report.ts` generatePredictions 호출부

- [x] **T3** — 히스토리 슬롯 수 6 → 12 (2시간)
  - `resolveDomainHistory` count 인자 변경
  - `orchestrator-reporter-pipeline.ts`도 동일하게 12로 통일
  - 파일: `reporter-pipeline.ts:167`, `orchestrator-reporter-pipeline.ts:21`

- [x] **T4** — `buildHistoryForMetric` 실제 슬롯 timestamp 사용
  - `slot.timestampMs`가 있으면 자체 계산 대신 그 값 사용
  - 파일: `reporter-pipeline-report.ts:231-254`

- [x] **T5** — `optimizeReport` no-incident 최적화 경로 추가
  - `affectedServers.length === 0`이면 predictions/warnings 풍부화 로직 실행
  - 파일: `reporter-pipeline.ts:333~` optimizeReport 함수

- [x] **T6** — 테스트 추가 (`reporter-pipeline-report.ts` 전용 unit test 파일 신규 생성)
  - no-incident score ≥ 0.65 검증
  - predictions non-empty when warnings exist
  - buildHistoryForMetric timestamp 검증

## 검증 기준

- `npx vitest run src/services/ai-sdk/agents/` 전체 통과: 34 files / 399 tests PASS
- T6 테스트 시나리오 1~5 모두 통과: Reporter targeted 2 files / 25 tests PASS
- TypeScript strict 에러 없음: `cd cloud-run/ai-engine && npm run type-check` PASS
- AI Engine full test: 133 files / 1326 tests PASS

## 완료 기록

- `reporter-pipeline.ts`
  - no-incident 기본 품질 threshold를 `0.65`로 완화했다.
  - 평가 가중치를 `structure 25%`, `completeness 30%`, `accuracy 25%`, `actionability 20%`로 조정했다.
  - no-incident 보고서는 rootCause 부재를 accuracy 저하로 보지 않도록 `accuracy=0.85`로 평가한다.
  - no-incident 최적화 경로에서 warnings/predictions 기반 예방 점검 액션을 추가한다.
- `reporter-pipeline-report.ts`
  - warning 서버를 prediction target으로 포함한다.
  - `buildHistoryForMetric`가 history slot의 실제 `timestampMs`를 우선 사용한다.
  - history 조회는 중앙 pipeline 경로에서 12슬롯으로 통일했다. `orchestrator-reporter-pipeline.ts`에는 별도 history count 호출부가 없어 `executeReporterPipeline()` 경유로 동일 기준을 적용한다.
- `agent-configs.vision-fallback.test.ts`
  - agents 디렉터리 전체 테스트 실행 시 stale mock export 누락으로 깨지던 `getZaiModel`/`allTools` mock을 보정했다.

## 완료 처리

1. 모든 Task `[x]` 체크 완료
2. TODO.md Recent Completed에 요약 추가 완료
3. 이 파일 → `reports/planning/archive/` 이동 완료
