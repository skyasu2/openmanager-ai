# Monitoring AI Data Source Plan

> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-30
> Tags: monitoring, ai-engine, otel, data-source, ai-tools, sdd

## 1. 배경

현재 OpenManager AI의 서버 모니터링 데이터는 `public/data/otel-data/`의 24시간 OTel JSON을 기준으로 동작한다. 데이터셋은 18대 서버, 10분 간격 144개 슬롯, 9개 메트릭과 로그를 포함하며, Vercel Dashboard와 Cloud Run AI Engine이 같은 파일 계층을 소비한다.

문제는 AI 어시스턴트의 Chat/Reporter/Analyst가 이 데이터를 "모니터링 제품의 데이터 소스"로 추상화하지 않고, 각 기능별 포맷/라우팅/요약 경로에서 부분적으로 소비한다는 점이다. 질의 기능은 최근 `queryAsOf` 슬롯 고정과 deterministic routing으로 많이 개선됐지만, Reporter/Analyst 및 향후 실제 서버 연결을 고려하면 데이터 소스 계약과 증거 기반 도구 계층이 먼저 필요하다.

이 계획서는 구현 착수 전 Draft다. 아래 계약이 Approved 되기 전에는 코드 구현을 시작하지 않는다.

## 2. 공식 문서 기반 비교 분석

### 2.1 실제 모니터링 제품의 수집/처리 범위

| 제품/스택 | 수집 방식 | 수집 데이터 | 처리/저장 방식 | 우리 프로젝트에 주는 시사점 |
|---|---|---|---|---|
| OpenTelemetry Collector | receiver/processor/exporter 파이프라인 | metrics, logs, traces | 수집, 변환, 필터링, 배치, 재시도, export | 실서버 연결의 기준 계약은 OTel 호환 adapter가 맞다. 단, 무료 티어에서는 상시 collector 운영이 아니라 adapter skeleton까지만 둔다. |
| Prometheus | scrape + labels + TSDB | time-series metrics | metric name + labels + timestamp 저장, PromQL 질의 | 현재 JSON은 Prometheus/OTel 계산 결과에 가깝다. AI 도구는 PromQL 흉내보다 snapshot/query 함수를 노출하는 편이 비용 대비 낫다. |
| Grafana Alloy | OTel Collector distribution | metrics, logs, traces, profiles | 하나의 collector에서 여러 signal을 수집해 backend로 전송 | 향후 collector를 붙일 때는 Alloy/OTel Collector를 교체 가능한 외부 수집기로 보되, 앱 내부에 collector 기능을 재구현하지 않는다. |
| Datadog Agent | host/container agent | host metrics, events, logs, traces, process data | agent check, integration, forwarder, backend 분석 | AI가 유용하려면 CPU/Memory/Disk뿐 아니라 process/log/event context를 같이 볼 수 있어야 한다. |
| Dynatrace OneAgent | host process set + auto instrumentation | OS metrics, process metrics, code-level service data, RUM, logs, network | topology/context 기반 entity model | 단일 server card보다 server/service/topology/evidence ref를 같이 묶는 구조가 필요하다. |
| Elastic Observability | Elastic Agent 또는 OTel | logs, metrics, traces, APM data | Elasticsearch/Kibana query, Lens, alert, ML/AI | 로그/메트릭/트레이스를 한 검색 계약에서 조회하고 AI가 function calling으로 필요한 데이터를 가져오는 모델이 적합하다. |
| Zabbix/Nagios 계열 | agent, SNMP, plugin, active/passive check | item/check result, host metrics, service status | trigger/problem/event 중심 | 무료 시연 범위에서는 고급 TSDB보다 "문제 조건, 증거, 조치" 계약이 더 중요하다. |

### 2.2 AI 어시스턴트/에이전트 동작 방식

| 제품 | AI 동작 방식 | 공통 패턴 | 우리 프로젝트 적용 판단 |
|---|---|---|---|
| Datadog Bits AI SRE | alert 발생 시 가설 생성, 관련 telemetry 조회, data-based reasoning으로 RCA 지원 | 자율/반자율 조사 루프 + telemetry query + incident context | Cloud Run에서 제한된 tool loop를 지원하되, provider quota 때문에 기본은 deterministic pre-filter 후 1회 요약으로 제한한다. |
| New Relic AI | 자연어 질문을 해석하고 New Relic data platform에서 metrics/logs를 조회해 설명/차트 제공 | NLQ -> query -> analysis -> explanation | Chat/Reporter/Analyst 모두 같은 monitoring snapshot/query API를 쓰게 한다. |
| Dynatrace Davis AI | captured/ingested 정보와 causal topology 기반 root cause entity 식별 | entity topology + anomaly correlation + root-cause ranking | 실제 구현은 causal graph 전체가 아니라 tier/topology + risk signal ranking으로 축소한다. |
| Elastic AI Assistant | function calling으로 Elasticsearch/Kibana query 실행, data on screen/contextual prompt 활용 | LLM이 직접 추측하지 않고 function/tool 결과를 근거로 응답 | AI SDK tool schema에 `evidenceRefs`, `queryAsOf`, `sourceMode`를 강제한다. |
| Grafana AI/Sift/Assistant | anomaly/forecast/investigation/query generation | anomaly + investigation workflow + dashboard context | 현재 ML/forecast는 가볍게 유지하고, 도구 결과를 dashboard context와 맞추는 것이 우선이다. |

### 2.3 결론

베스트 프랙티스는 "도구 수 증가"가 아니라 "모니터링 도메인 데이터 계층 강화"다. 실제 제품들은 모두 수집 계층, 정규화/처리 계층, 질의/증거 계층, AI 요약 계층을 분리한다. OpenManager AI도 같은 형태로 가되, 무료 티어 제약 때문에 다음 원칙을 둔다.

- Vercel은 UI/BFF와 짧은 proxy만 담당한다.
- Cloud Run AI Engine이 monitoring intelligence backend 역할을 맡는다.
- 24시간 OTel JSON은 `JsonReplayMonitoringDataSource`로 유지한다.
- 실제 서버 연결은 같은 interface의 `LiveOTelMonitoringDataSource`로 확장 가능하게만 만든다.
- AI는 raw 데이터 전체를 매번 계산하지 않고, precomputed slot/cache/snapshot을 도구로 조회한다.
- Reporter/Analyst/Chat은 서로 다른 데이터 해석을 하지 않고 같은 `MonitoringSnapshot` 계약을 공유한다.

## 3. 문제 검토 기록

이 섹션은 계획 수립 전 검토한 현재 문제와 개선 필요 지점을 기록한다. 구현 중 세부 파일명은 바뀔 수 있지만, 아래 문제는 계약과 테스트로 해소되어야 한다.

### 3.1 기능별 현황

| 기능 | 현재 상태 | 확인된 문제 | 개선 방향 |
|---|---|---|---|
| Chat/질의 | 최근 `queryAsOf` 슬롯 고정, metric-aware routing, deterministic fallback 개선 완료 | 질의 경로 중심 개선이라 Reporter/Analyst와 공통 데이터 계약이 아니다 | `MonitoringSnapshot`을 Chat도 소비하게 해서 기능 간 데이터 해석 차이를 줄인다 |
| Intelligent Monitoring/Analyst | Vercel route가 `/api/ai/analyze-server`로 proxy. Cloud Run은 tool-only deterministic insight 중심 | 요청 schema가 `serverId` 중심이고 batch endpoint가 없다. Cloud Run 코드에도 `analyze-batch endpoint removed - not used by frontend` 주석이 있어 전체 시스템 분석을 단일 계약으로 받는 경로가 없다 | `POST /api/ai/monitoring/analyze-batch`를 새 계약으로 만들고, Vercel은 1회 proxy만 수행 |
| Incident Report/Reporter | Cloud Run `/incident-report`가 anomaly/trend/timeline tool 결과를 모은 뒤 Reporter Agent로 JSON 보고서 생성 | prompt에 tool 결과를 문자열 slice로 넣고, `queryAsOf`, `sourceMode`, `evidenceRefs`가 보고서 계약에 없다. direct `generateText` 경로는 provider quota/fallback 정책과 정렬 여부를 재검토해야 한다 | Reporter는 `buildIncidentTimeline` + `MonitoringSnapshot` + evidence refs를 입력으로 받고, LLM 실패 시 동일 구조의 deterministic report를 반환 |

### 3.2 구조적 문제

| 문제 | 근거 | 위험 | 계획 반영 |
|---|---|---|---|
| Frontend 기대 기능과 backend 계약 불일치 | `src/app/api/ai/intelligent-monitoring/route.ts`는 action/serverId proxy이고, Cloud Run analytics route는 batch endpoint를 제거한 상태 | UI가 "전체 분석"을 기대해도 서버 단위/기능 단위 응답에 묶일 수 있음 | Task 5에서 Analyst batch 계약 복구 |
| Reporter/Analyst가 같은 데이터 소스를 공유하지 않음 | Analyst tools는 `getCurrentState()`/외부 서버 배열, Reporter pipeline도 별도 `getCurrentState()` 기반 초기 보고서 생성 | 같은 시간/슬롯의 dashboard와 AI 보고서가 서로 다른 근거처럼 보일 수 있음 | Task 2~3에서 `JsonReplayMonitoringDataSource`와 snapshot builder 도입 |
| 증거 계약이 retrieval evidence와 monitoring evidence로 분리됨 | RAG 쪽은 `evidenceCards`가 있으나, metric/log/topology evidence는 문자열 배열 또는 tool result 내부 구조에 머무름 | LLM이 보고서 문구를 만들 때 어떤 수치/로그/임계값을 근거로 삼았는지 UI가 검증하기 어려움 | `MonitoringEvidenceRef`를 새 공통 계약으로 정의 |
| LLM 중심 보고서 생성 경로의 비용/쿼터 위험 | Reporter route가 tool 결과 이후 `generateText`를 호출하며, Analyst 전체 분석은 과거 LLM fan-out 위험 때문에 tool-only로 바뀐 상태 | 무료 provider RPM/RPD와 Cloud Run 처리 시간이 기능별로 다시 흔들릴 수 있음 | deterministic-first, optional LLM narrative, quota gate 재사용을 Task 4~6에 포함 |
| 실서버 전환 경로가 데이터 계약으로 표현되지 않음 | 현재 기본은 24시간 OTel JSON replay이며 live source mode가 API 계약에 없다 | 실제 서버를 붙일 때 demo JSON 전용 로직을 여러 기능에서 다시 고쳐야 함 | `sourceMode: replay-json | live-otel`와 disabled live skeleton 도입 |
| Vercel 계산/팬아웃 부담 가능성 | 현재 Vercel route는 proxy와 cache를 담당하지만 action/server 단위 호출 구조 | 무료/Pro tier에서 서버 수 증가 시 요청 수와 active CPU가 쉽게 증가 | Vercel은 BFF, Cloud Run은 batch/snapshot backend로 역할 고정 |
| 테스트 게이트 부족 | 질의 경로 회귀 테스트는 강화됐지만 Reporter/Analyst snapshot/evidence 계약 테스트는 아직 없다 | 보고서/분석 기능 개선 중 QA 드리프트 재발 가능 | Task 0 failing contract tests와 T1~T10 시나리오 |

### 3.3 개선 작업 변경점

초기 생각은 "AI 도구를 더 추가"하는 방향이었지만, 문제 검토 결과 작업 순서를 바꾼다.

1. 먼저 데이터 소스와 snapshot/evidence 계약을 만든다.
2. 그 다음 Analyst batch와 Reporter grounding을 이 계약에 맞춘다.
3. 마지막에 live OTel adapter skeleton을 붙인다.

즉, 도구 추가는 목적이 아니라 계약 위에 얹히는 구현 세부사항으로 취급한다.

## 4. 현재 시스템과의 차이

| 영역 | 현재 | 목표 |
|---|---|---|
| 데이터 소스 | `public/data/otel-data/hourly/hour-XX.json` 직접/간접 로드 | `MonitoringDataSource` interface 뒤에 replay/live provider 배치 |
| 시간 정합성 | 질의 경로 중심으로 `queryAsOf` 개선 | Dashboard, Chat, Reporter, Analyst 전체가 같은 slot metadata 공유 |
| AI 도구 | 기능별 tool/context 혼재 | 공통 monitoring tools: snapshot, series, logs, risk, timeline |
| Analyst | 서버별 fan-out 또는 기능별 분석에 의존 | batch snapshot 기반 deterministic pre-filter 후 선택적 LLM 요약 |
| Reporter | 요약 로직 중심 | evidence refs + incident timeline + current risk summary |
| 실서버 전환 | JSON 경로가 사실상 고정 | `sourceMode: replay-json | live-otel` 계약으로 전환 가능 |
| 비용 | Vercel/Cloud Run 호출 분산 | Vercel 계산 억제, Cloud Run 캐시 기반 단일 batch 호출 |

## 5. 목표

1. `MonitoringDataSource` 공통 interface를 정의한다.
2. 기존 24시간 OTel JSON을 `JsonReplayMonitoringDataSource`로 감싼다.
3. `MonitoringSnapshot`을 Chat/Reporter/Analyst가 공유하는 계약으로 만든다.
4. Cloud Run에 deterministic monitoring tools를 추가한다.
5. Analyst/Reporter가 같은 snapshot과 evidence refs를 사용하게 한다.
6. 실제 서버 연결을 위한 `LiveOTelMonitoringDataSource` skeleton과 env switch를 준비한다.
7. Vercel에서 반복 계산과 다중 fan-out을 줄이고 Cloud Run batch endpoint를 사용한다.

## 6. 하지 않을 것

- Prometheus, Mimir, Loki, Tempo, Elasticsearch를 새로 운영하지 않는다.
- Render를 다시 연결하지 않는다.
- 상시 실행 collector/agent를 기본 배포에 포함하지 않는다.
- 무료 티어 시연 단계에서 장기 저장 TSDB를 만들지 않는다.
- LLM이 직접 raw JSON 전체를 읽어 판단하게 하지 않는다.
- CI/로컬 기본 테스트에서 실 LLM 또는 외부 telemetry backend를 호출하지 않는다.

## 7. 계약 초안

### 7.1 Source mode

```ts
type MonitoringSourceMode = 'replay-json' | 'live-otel';
```

- `replay-json`: 현재 24시간 OTel JSON. 기본값.
- `live-otel`: 실제 collector/backend 연동. 초기 구현은 disabled skeleton.

### 7.2 Data source interface

```ts
interface MonitoringDataSource {
  readonly mode: MonitoringSourceMode;
  getSnapshot(input: MonitoringSnapshotInput): Promise<MonitoringSnapshot>;
  getMetricSeries(input: MonitoringMetricSeriesInput): Promise<MonitoringMetricSeries>;
  getRelatedLogs(input: MonitoringLogQueryInput): Promise<MonitoringLogResult>;
  rankRiskSignals(input: MonitoringRiskInput): Promise<MonitoringRiskSignal[]>;
  buildIncidentTimeline(input: MonitoringTimelineInput): Promise<MonitoringIncidentTimeline>;
}
```

### 7.3 Snapshot contract

```ts
interface MonitoringSnapshot {
  sourceMode: MonitoringSourceMode;
  queryAsOf: string;
  slot: {
    hour: number;
    slotInHour: number;
    startTime: string;
    endTime: string;
  };
  servers: MonitoringServerState[];
  topology: MonitoringTopologySummary;
  riskSignals: MonitoringRiskSignal[];
  evidenceRefs: MonitoringEvidenceRef[];
  dataFreshness: {
    generatedAt: string | null;
    sourceUpdatedAt: string | null;
    stale: boolean;
  };
}
```

### 7.4 Evidence ref

```ts
interface MonitoringEvidenceRef {
  id: string;
  kind: 'metric' | 'log' | 'topology' | 'rule' | 'prediction';
  serverId?: string;
  metric?: string;
  timeRange: { from: string; to: string };
  summary: string;
  value?: number | string;
  threshold?: number;
  severity: 'info' | 'warning' | 'critical';
}
```

### 7.5 Cloud Run endpoints/tools

| 계약 | 용도 | LLM 호출 |
|---|---|---|
| `POST /api/ai/monitoring/snapshot` | dashboard/AI 공통 deterministic snapshot | 없음 |
| `POST /api/ai/monitoring/analyze-batch` | Analyst batch: snapshot + deterministic risk summary + optional LLM narrative | 기본 없음, 옵션 |
| `getMonitoringSnapshot` tool | Chat/Reporter/Analyst 공통 현재 상태 조회 | tool result |
| `getMetricSeries` tool | 특정 서버/메트릭 24h 시계열 조회 | tool result |
| `getRelatedLogs` tool | 시간 범위/서버별 로그 조회 | tool result |
| `rankRiskSignals` tool | 위험 서버/지표 정렬 | tool result |
| `buildIncidentTimeline` tool | Reporter incident timeline 구성 | tool result |

### 7.6 Error contract

```ts
type MonitoringErrorCode =
  | 'DATA_SOURCE_UNAVAILABLE'
  | 'SLOT_NOT_FOUND'
  | 'SERVER_NOT_FOUND'
  | 'METRIC_NOT_FOUND'
  | 'LIVE_SOURCE_DISABLED'
  | 'SNAPSHOT_STALE';
```

모든 오류 응답에는 `sourceMode`, `queryAsOf`, `requestId`, `recoverable`을 포함한다.

## 8. 구현 계획

### Task 0. SDD 승인 및 failing contract tests

- 이 Draft의 계약 섹션을 검토해 Approved로 변경한다.
- 구현 전 failing tests를 먼저 추가한다.
- 커밋 메시지: `test(spec): monitoring data source add failing tests before implementation`

### Task 1. 타입/계약 정의

- `cloud-run/ai-engine/src/services/monitoring/` 또는 기존 data service 경계에 계약 타입을 추가한다.
- frontend shared type이 필요하면 `src/types/`에 API 응답 타입을 최소로 둔다.
- `sourceMode`, `queryAsOf`, `slot`, `evidenceRefs`는 필수 필드로 둔다.

### Task 2. JsonReplayMonitoringDataSource

- 기존 `precomputed-state-core.ts`와 `otel-metrics.ts`를 재사용한다.
- 새 구현은 raw JSON parsing을 복제하지 않는다.
- 24개 hourly file preload/cache를 유지한다.
- dashboard와 AI가 같은 slot 계산을 쓰는지 테스트한다.

### Task 3. Snapshot builder와 risk signal

- 18대 서버 상태를 한 번에 snapshot으로 빌드한다.
- CPU/Memory/Disk/Network 임계값은 `system-rules.json` SSOT를 그대로 사용한다.
- risk signal에는 metric value, threshold, trend, related log count, topology tier를 포함한다.
- result size cap을 둬 LLM context 폭증을 막는다.

### Task 4. Monitoring tools 추가

- AI SDK tool schema에 `inputSchema`와 structured result를 명확히 둔다.
- 기본 tool 호출은 deterministic data fetch만 수행한다.
- multi-step tool loop는 `stopWhen`/step cap을 적용하고, quota admission gate 이후에만 LLM 단계로 진입한다.
- tool result에는 항상 `evidenceRefs`를 포함한다.

### Task 5. Analyst batch 경로 정리

- Vercel Analyst UI가 서버별 반복 호출 대신 Cloud Run batch endpoint를 사용하도록 전환한다.
- batch 결과는 `summary`, `riskSignals`, `servers`, `evidenceRefs`, `sourceMode`, `queryAsOf`를 반환한다.
- 실 LLM 실패/비활성 상태에서도 deterministic summary를 표시한다.

### Task 6. Reporter grounding

- Reporter는 snapshot과 incident timeline 도구를 사용한다.
- 응답에는 주요 위험 서버, 영향 범위, 관련 로그, 다음 조치를 evidence refs로 묶는다.
- 모델이 근거 없는 일반론을 쓰면 deterministic fallback으로 대체한다.

### Task 7. Live OTel skeleton

- `LiveOTelMonitoringDataSource`는 interface만 구현하고 기본 disabled 상태로 둔다.
- env 예: `MONITORING_SOURCE_MODE=replay-json`, `LIVE_OTEL_ENDPOINT`.
- live mode가 켜졌지만 endpoint가 없으면 `LIVE_SOURCE_DISABLED`로 명시 실패한다.
- 실제 OTLP receiver/collector 운영은 별도 plan으로 분리한다.

### Task 8. QA/문서/운영 가드

- `reports/qa` 기록 대상은 기능 구현 이후 QA에서만 추가한다.
- Free Tier 영향 분석을 release note에 남긴다.
- `docs/reference/architecture/data/otel-data-architecture.md`는 구현 완료 후 "replay/live provider" 구조로 갱신한다.

## 9. 테스트 시나리오

| ID | 시나리오 | 기대 결과 |
|---|---|---|
| T1 | `replay-json` snapshot 요청 | 18대 서버, slot metadata, riskSignals, evidenceRefs 반환 |
| T2 | 동일 `queryAsOf`로 dashboard/AI snapshot 비교 | hour/slot/server metric 값 일치 |
| T3 | 존재하지 않는 serverId metric series 요청 | `SERVER_NOT_FOUND`, `recoverable: true` |
| T4 | 존재하지 않는 metric 요청 | `METRIC_NOT_FOUND` |
| T5 | Analyst batch 요청 | Vercel은 Cloud Run에 1회 proxy, 서버별 fan-out 없음 |
| T6 | LLM disabled/quota exhausted | deterministic summary 반환, 500으로 실패하지 않음 |
| T7 | Reporter timeline 요청 | related logs와 metric evidence가 시간순으로 묶임 |
| T8 | `live-otel` mode + endpoint 미설정 | `LIVE_SOURCE_DISABLED` 명시 오류 |
| T9 | tool result size cap 초과 | top risk N개 + truncation metadata 반환 |
| T10 | CI 환경 | 실 LLM/외부 backend 호출 없이 mock/deterministic test 통과 |

## 10. 무료 티어 영향

| 항목 | 영향 |
|---|---|
| Vercel | 반복 계산/fan-out 감소. UI/BFF와 짧은 proxy 중심으로 유지. |
| Cloud Run | snapshot build는 24시간 JSON cache 기반. 요청당 CPU는 증가 가능하지만 maxScale=1/concurrency 기반으로 제어 가능. |
| Storage | 새 TSDB 없음. 기존 JSON bundle 재사용. |
| Network | replay-json 기본값에서는 외부 telemetry traffic 없음. |
| LLM quota | deterministic pre-filter 후 필요할 때만 요약. 기존 provider quota gate와 연동 필요. |

## 11. 승인 기준

- Contract 섹션이 Approved 상태로 합의된다.
- Chat/Reporter/Analyst가 같은 `MonitoringSnapshot`을 사용할 수 있다.
- Vercel이 모니터링 계산 backend 역할을 하지 않는다.
- replay-json 시연 데이터와 live-otel 확장 경로가 같은 interface에 있다.
- 실제 구현 전 failing tests가 먼저 커밋된다.

## 12. 공식 자료

- OpenTelemetry Collector: https://opentelemetry.io/docs/collector/
- Prometheus overview: https://prometheus.io/docs/introduction/overview/
- Grafana Alloy: https://grafana.com/docs/alloy/latest/introduction/
- Datadog Agent: https://docs.datadoghq.com/getting_started/agent/
- Datadog Bits AI SRE: https://docs.datadoghq.com/bits_ai/bits_ai_sre/
- New Relic AI: https://docs.newrelic.com/docs/agentic-ai/new-relic-ai/
- Dynatrace OneAgent: https://docs.dynatrace.com/docs/platform/oneagent/how-one-agent-works
- Dynatrace root cause analysis: https://docs.dynatrace.com/docs/dynatrace-intelligence/root-cause-analysis
- Elastic AI Assistant for Observability: https://www.elastic.co/docs/solutions/observability/ai/observability-ai-assistant
- AI SDK tool calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling

## 13. 구현 결과 (2026-04-30)

- `MonitoringDataSource` 계약과 `JsonReplayMonitoringDataSource`/`LiveOtelMonitoringDataSource` skeleton 추가.
- Cloud Run `/api/ai/monitoring/snapshot`, `/api/ai/monitoring/analyze-batch` endpoint 추가.
- AI SDK monitoring tools 추가: `getMonitoringSnapshot`, `getMetricSeries`, `getRelatedLogs`, `rankRiskSignals`, `buildMonitoringIncidentTimeline`.
- Vercel Intelligent Monitoring 전체 분석을 서버별 fan-out에서 batch proxy 1회 호출로 전환.
- Reporter route에 monitoring snapshot/timeline grounding을 연결하고 결과에 `sourceMode`, `queryAsOf`, `evidenceRefs`, `monitoringTimeline` 포함.
- Side-effect review 후 Vercel cache key에 `sourceMode`/`queryAsOf` slot을 포함하고, Analyst/Reporter page와 fullscreen handoff가 dashboard `queryAsOfDataSlot`을 요청에 전달하도록 보강.
- Metric series/log/timeline 조회가 requested `queryAsOf`와 `from`/`to` 범위를 반영하도록 보강.
- `docs/reference/architecture/data/otel-data-architecture.md`에 replay/live provider 구조 반영.

검증:
- `cloud-run/ai-engine npm test -- src/routes/analytics.test.ts src/services/monitoring/monitoring-data-source.test.ts src/tools-ai-sdk/analyst-tools.test.ts`
- `npx vitest run --config config/testing/vitest.config.node.ts src/app/api/ai/intelligent-monitoring/route.test.ts`
- `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai/pages/IntelligentMonitoringPage.test.tsx`
- `cloud-run/ai-engine npm run type-check`
- `npm run type-check`
- `npm run lint`
- `npm run test:quick`
- `npm run test:contract`
