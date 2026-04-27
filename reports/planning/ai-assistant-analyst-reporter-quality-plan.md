> Owner: project
> Status: Draft
> Doc type: Plan
> Last reviewed: 2026-04-27
> Canonical: reports/planning/ai-assistant-analyst-reporter-quality-plan.md
> Tags: ai, qa, analyst, reporter, observability, production-qa

# AI Assistant Analyst/Reporter Quality Plan

- 상태: Draft
- 작성일: 2026-04-27
- TODO.md 연결: Active Tasks > AI Assistant Analyst/Reporter quality improvement
- 기준 QA: `QA-20260427-0351`, `QA-20260427-0352`

## 목표

Vercel production + Playwright MCP QA에서 확인된 AI assistant 품질 차이를 개선한다.

- Analyst의 "주요 이슈"와 "상승 추세 경고"를 운영자가 바로 판단할 수 있는 형태로 정리한다.
- Reporter는 이미 생성/상세/상태 보존이 정상 동작하므로, 접힌 카드에서도 원인·영향·다음 조치를 빠르게 읽을 수 있게 보강한다.
- AI Chat은 현재 실측 응답이 데이터 기반으로 통과했으므로, 회귀 방지 smoke 기준만 명시한다.

## 배경

2026-04-27 production QA에서 아래 결과를 확인했다.

- AI Chat: `cache-redis-dc1-01`, memory 86%, 조치 권고를 포함한 데이터 기반 응답을 반환했다.
- Reporter: `Redis 서버 메모리 과부하 경고` 보고서를 생성했고 root cause, confidence, affected server, system summary가 정상 표시됐다.
- Analyst: 전체 분석 18건 API 호출은 모두 200이고 결과도 렌더링됐지만, `CPU 69% → --`와 같은 예측값 부재 표시 및 `storage-nfs-dc1-02 - CPU 24%` 같은 낮은 값의 주요 이슈 노출이 설명 없이 보였다.

## 웹 비교 기준

| 기준 | 공식 기준 | 이번 작업 반영 |
|------|----------|----------------|
| Google SRE Monitoring | 알림/이슈는 긴급하고 조치 가능하며 사용자 영향 가능성이 있어야 한다. 원인과 증상을 구분하고 false positive를 줄인다. <https://sre.google/sre-book/monitoring-distributed-systems/> | Analyst 주요 이슈는 severity, threshold distance, confidence, 조치 가능성을 기준으로 정렬·필터링한다. |
| AWS CloudWatch Anomaly Detection | 과거 데이터 기반 expected range/band를 만들고 실제 값이 band 밖인지 보여준다. <https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Anomaly_Detection.html> | 낮은 CPU 같은 이상 항목은 정상 범위/기준/신뢰도 설명 없이는 "주요 이슈"로 올리지 않는다. |
| Datadog Anomaly Monitor | anomaly band, trigger window, recovery window, seasonality, false alarm 방지를 다룬다. <https://docs.datadoghq.com/monitors/types/anomaly/> | 단발성/저신뢰/저영향 anomaly는 주요 이슈에서 제외하거나 "참고 관측"으로 낮춘다. |
| Datadog Watchdog Alerts | 각 anomaly에 what happened, possible impact, root cause를 제공한다. <https://docs.datadoghq.com/watchdog/alerts/> | Analyst row에 "왜 이슈인지"와 "권장 조치"를 짧게 추가한다. |
| SRE/Post Incident | incident report는 summary, impact, timeline, root cause, action items를 포함한다. <https://sre.google/sre-book/postmortem-culture/>, <https://docs.datadoghq.com/incident_response/incident_management/post_incident/> | Reporter 접힌 카드에 다음 조치 1개와 영향 요약을 노출한다. 상세 구조는 유지한다. |
| OpenTelemetry Signals | metrics, logs, traces 같은 signals를 함께 관찰해 시스템 동작을 이해한다. <https://opentelemetry.io/docs/concepts/signals/> | QA에서는 dashboard 수치, AI 응답, Reporter/Analyst 결과를 같은 OTel 슬롯 기준으로 확인한다. |

## 범위

### 포함

- Analyst 전체 시스템 요약 생성 로직 정리
- Analyst 주요 이슈 정렬/필터링/설명 강화
- Analyst 예측값 부재 표시 개선
- Reporter 접힌 카드의 원인·영향·다음 조치 요약 강화
- 관련 unit/contract test 및 production Playwright MCP QA 기록

### 제외

- Cloud Run AI Engine 모델/provider 교체
- 신규 외부 관측 서비스 연동
- 추가 LLM 호출 또는 Reporter pipeline 단계 증가
- OTel synthetic data shape 변경
- 대시보드 전체 레이아웃 리디자인

## 계약 (Contract)

> Status를 Approved로 올리기 전에 이 섹션을 확정한다. 구현은 Approved 이후 failing test부터 시작한다.

### 변경 대상 파일

- `src/components/ai/pages/IntelligentMonitoringPage.tsx`
- `src/components/ai/analysis/SystemSummarySection.tsx`
- `src/components/ai/analysis/TrendCard.tsx`
- `src/components/ai/analysis/utils.ts`
- `src/types/intelligent-monitoring.types.ts`
- `src/components/ai/pages/auto-report/ReportCard.tsx`
- `src/components/ai/analysis/TrendFormatting.test.tsx`
- 신규 후보: `src/components/ai/analysis/system-summary.ts`
- 신규 후보: `src/components/ai/analysis/system-summary.test.ts`
- 신규/수정 후보: `src/components/ai/pages/auto-report/ReportCard.test.tsx`

### Analyst 요약 계약

| 항목 | 입력 | 출력/표시 | 에러/누락 처리 |
|------|------|-----------|----------------|
| 주요 이슈 생성 | `ServerAnalysisResult[]` anomaly results | severity, confidence, threshold distance, current value 기준으로 정렬된 `topIssues` | low severity + threshold 근거 없음 + confidence 낮음이면 주요 이슈 제외 |
| 주요 이슈 설명 | `MetricAnomalyResult.threshold`, `confidence`, `currentValue` | "상한 초과", "하한 이탈", "평소 범위 이탈", "신뢰도 N%" 중 최소 1개 표시 | 기준값이 없으면 "기준 정보 부족"으로 표시하고 주요 이슈 승격 금지 |
| 예측 표시 | `MetricTrendResult.currentValue`, `predictedValue`, `thresholdBreach` | finite predicted value이면 `현재 → 예측`; 값이 없으면 `현재 · 예측값 없음` | `NaN`, `undefined`, `null`은 `--` 화살표 비교로 렌더링하지 않음 |
| 예측 우선순위 | increasing trend, threshold breach, change percent | 임계 도달 예측 > 큰 변화율 > 높은 confidence 순 | `changePercent <= 5`이고 임계 도달 메시지 없으면 요약 경고 제외 |

### Reporter 카드 계약

| 항목 | 입력 | 출력/표시 | 에러/누락 처리 |
|------|------|-----------|----------------|
| 접힌 카드 요약 | `IncidentReport.description`, `recommendations[0]`, `systemSummary`, `affectedServers` | 제목 아래에 원인/영향/다음 조치 1개를 짧게 표시 | recommendations가 없으면 기존 description만 유지 |
| 상세 섹션 | `recommendations`, `timeline`, `postmortem`, `relatedServers` | 현재 상세 기능 유지 | 데이터가 없으면 기존 fallback 유지 |
| 비용 | 기존 report response | 추가 API/LLM 호출 없음 | API 호출 증가 금지 |

### 테스트 시나리오 (구현 전 확정)

- [ ] T0: `predictedValue = NaN` 또는 `undefined`이면 Analyst summary와 TrendCard에 `→ --`가 렌더링되지 않는다.
- [ ] T1: prediction value가 없고 threshold message만 있으면 `예측값 없음`과 threshold message가 함께 표시된다.
- [ ] T2: low severity CPU 24% anomaly는 threshold/confidence 설명이 없으면 `주요 이슈`에 오르지 않는다.
- [ ] T3: medium/high anomaly는 severity 우선순위와 threshold distance 기준으로 상위에 정렬된다.
- [ ] T4: 주요 이슈 row는 metric, current value, 기준/신뢰도/이유 중 최소 하나를 표시한다.
- [ ] T5: Reporter 접힌 카드에서 첫 번째 권장 조치가 있으면 다음 조치 요약으로 보인다.
- [ ] T6: Reporter 상세 열기/닫기와 Activity hide/show 후 reports cache 보존은 유지된다.
- [ ] T7: production Playwright MCP QA에서 AI Chat, Reporter, Analyst 모두 console error 없이 통과한다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [ ] Task 0 - failing test 커밋
  - 완료 기준: T0~T6의 실패 테스트가 구현 변경 전에 추가된다.
  - 커밋 메시지: `test(spec): add AI assistant Analyst/Reporter quality specs`

- [ ] Task 1 - Analyst summary builder 분리 및 정렬 계약 구현
  - 완료 기준: `createSummary`의 issue/prediction 계산을 pure helper로 분리하고, severity/confidence/threshold 기반 ranking을 적용한다.

- [ ] Task 2 - Analyst UI 표시 개선
  - 완료 기준: `→ --`가 사라지고, 예측값 부재/기준 정보 부족/신뢰도/이유가 명확히 표시된다.

- [ ] Task 3 - Reporter 접힌 카드 요약 개선
  - 완료 기준: 추가 API 호출 없이 원인·영향·다음 조치 1개가 접힌 카드에서 확인된다.

- [ ] Task 4 - deterministic 검증
  - 완료 기준: 관련 Vitest, `npm run type-check`, `npm run lint:changed` 또는 동등한 changed-scope lint가 통과한다.

- [ ] Task 5 - production QA 및 기록
  - 완료 기준: Vercel production + Playwright MCP에서 guest login, AI Chat, Reporter, Analyst targeted QA를 수행하고 `npm run qa:record`, `npm run qa:status`, `npm run qa:evidence:audit`를 기록한다.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 없음 | 없음 |
| Task 1 | `refactor:` 또는 `fix:` | 선택 | 없음 | frontend 변경 시 필요 |
| Task 2 | `fix:` | 선택 | 없음 | 필요 |
| Task 3 | `fix:` | 선택 | 없음 | 필요 |
| Task 4 | `test:` | 선택 | 없음 | 없음 |
| Task 5 | `test(qa):` 또는 reports only | 선택 | 없음 | 이미 배포된 build 기준 QA |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 QA에서 관측된 문제를 정확히 표현하는지 |
| Task 1 완료 후 | ranking/filtering이 false positive를 줄이면서 warning/critical을 숨기지 않는지 |
| Task 2 완료 후 | `--` fallback 제거가 NaN 방어를 약화시키지 않는지 |
| Task 3 완료 후 | Reporter 정보 밀도가 높아졌지만 카드가 과밀해지지 않았는지 |
| 전체 완료 후 | 실환경 QA, Vercel usage, QA tracker/evidence audit 결과 |

## 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| low severity anomaly를 숨겨 실제 조기 신호를 놓칠 수 있음 | 주요 이슈에서는 제외하되 상세 분석 카드에는 유지한다. |
| 타입 확장이 Cloud Run 응답 계약과 섞일 수 있음 | API 원본 타입은 유지하고 frontend summary 타입만 확장한다. |
| Reporter 카드가 과밀해질 수 있음 | 접힌 카드는 최대 2줄 요약으로 제한하고 상세 섹션은 기존 구조를 유지한다. |
| production QA가 LLM 비결정성 때문에 흔들릴 수 있음 | exact text가 아니라 서버 ID, metric, status, console/network 상태 중심으로 판정한다. |
| 추가 LLM 호출로 무료 티어 비용이 증가할 수 있음 | 이번 plan은 frontend aggregation/rendering 개선만 허용한다. |

## 완료 기준

- [ ] T0~T7 테스트/QA 시나리오 통과
- [ ] `npm run type-check` 통과
- [ ] 변경 범위 lint 통과
- [ ] production Playwright MCP QA 기록 추가
- [ ] Vercel usage 점검에서 unexpected billed usage 없음
- [ ] `reports/qa/qa-tracker.json` 및 `QA_STATUS.md` 최신화
- [ ] TODO.md Recent Completed로 이동 후 plan Status `Completed`, archive 이동

## 현재 결정

- 구현 착수 전 사용자 확인을 위해 Status는 `Draft`로 유지한다.
- 구현 방향은 Cloud Run/LLM 변경이 아니라 frontend summary contract와 UI rendering 개선이다.
- 첫 구현 단계는 failing test 추가다.
