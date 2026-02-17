# ADR-003: PromQL vs JS Array Filtering — 데이터 쿼리 전략

> PromQL 엔진과 JS 필터링 병행 전략을 정리한 ADR
> Owner: platform-architecture
> Status: Active
> Doc type: Decision
> Last reviewed: 2026-02-17
> Canonical: docs/reference/architecture/decisions/adr-003-promql-vs-js-array-filtering.md
> Tags: adr,promql,query,metrics

**Date**: 2026-02-07
**Status**: Decided
**Context**: 프로젝트에 "PromQL: `rate(http_requests[5m])` 같은 복잡한 쿼리 언어 vs 클라이언트 필터링: 단순한 자바스크립트 배열 필터링으로 처리"라는 비교가 문서에 존재. 현재 구현의 적합성을 분석한다.
**Version**: v8.0.0 (재검증)

---

## 1. 현재 상태: "둘 다 있다"

프로젝트에는 **두 가지 접근법이 모두 구현**되어 있다:

### A. JS 배열 필터링 (실제 사용 중)

| 위치 | 패턴 | 용도 |
|------|------|------|
| `MetricsProvider.ts` (666줄) | `.filter()`, `.reduce()` x5, `.map()` x6 | 서버 상태 조회, 평균 계산, 알림 추출 |
| `servers-unified/route.ts` (527줄) | `.filter()` x3 + `.sort()` + `.slice()` + `.reduce()` | 검색, 정렬, 페이지네이션, 상태 요약 |
| `metrics/route.ts` (112줄) | `.map()` x3 | Prometheus 형식 응답 변환 |

> **참고**: `MetricsAggregator.ts`는 별도 파일로 존재하지 않음. 집계 로직은 `MetricsProvider.getSystemSummary()`에 `.reduce()` 체인으로 내장되어 있음.

### B. 경량 PromQL 엔진 (이미 구현됨)

| 위치 | 기능 |
|------|------|
| `src/lib/promql/promql-engine.ts` (467줄) | instant, label filter, aggregation, group by, comparison, rate |
| `src/app/api/metrics/route.ts` | PromQL API 엔드포인트 |

**지원 쿼리**: `node_cpu_usage_percent{server_type="web"}`, `avg(cpu) by (server_type)`, `up == 0`, `rate(cpu[1h])`

---

## 2. 결정: 현재 JS 배열 필터링이 최적

### 현재가 나은 이유 (5가지)

**1) 데이터 규모에 맞는 설계**

```
서버 15대 x 메트릭 10종 = 150개 값
→ Array.filter/reduce로 < 1ms 처리
→ PromQL 엔진 오버헤드가 오히려 비효율
```

**2) 사전 계산된 데이터 (Pre-computed)**

```json
// 현재: 이미 계산된 백분율
"node_cpu_usage_percent": 32

// 실제 Prometheus: 원시 counter → rate() 필요
"node_cpu_seconds_total": 123456.78
```

PromQL의 핵심 기능인 `rate(counter[5m])`가 불필요 — 데이터가 이미 `%`로 가공되어 있음.

**3) TSDB 없이 JSON 기반**

```
Prometheus TSDB: 수백만 time-series, 수십 TB
VIBE hourly-data: 24개 JSON 파일 + catalog/timeseries, 총 ~5.2MB
```

시계열 DB가 없는 환경에서 PromQL은 과잉 추상화.

**4) AI 컨텍스트 생성에 배열 조작이 자연스러움**

```typescript
// MetricsProvider.getSystemSummary() — AI에게 전달할 요약 생성
const avgCpu = allMetrics.reduce((sum, m) => sum + m.cpu, 0) / count;
const alerts = allMetrics
  .filter((s) => s.status === 'warning' || s.status === 'critical')
  .map((s) => ({ name: s.name, status: s.status }));
```

AI Agent가 소비하는 형태(텍스트 요약)를 만들 때 배열 조작이 더 직관적.

**5) Vercel Serverless 제약**

```
Serverless Function: 10초 maxDuration (Free Tier)
→ 무거운 쿼리 엔진은 cold start 페널티
→ 단순 배열 연산이 cold start에 유리
```

---

## 3. JS 배열 기반으로 커버하는 PromQL 등가 기능

현재 JS 배열 기반으로도 PromQL의 핵심 기능을 모두 커버:

| PromQL 기능 | JS 등가 구현 | 위치 |
|-------------|-------------|------|
| `avg(metric)` | `.reduce((sum, m) => sum + m.cpu, 0) / count` | MetricsProvider:563 |
| `count by (status)` | `.reduce((acc, m) => { acc[m.status]++; ... })` | MetricsProvider:552 |
| `metric{label="value"}` | `.filter(s => s.name.includes(search))` | servers-unified:250 |
| `topk(5, metric)` | `.sort((a,b) => b.cpu - a.cpu).slice(0, 5)` | servers-unified:260 |
| `up == 0` | `.filter(s => s.status === 'critical')` | MetricsProvider:604 |
| `metric > threshold` | `.filter(s => s.cpu >= threshold)` | MetricsProvider:604 |

---

## 4. PromQL 엔진의 현재 역할

`src/lib/promql/promql-engine.ts`는 이미 존재하며 **내부 데이터 처리 전용**으로 설계됨:

- `/api/metrics` 엔드포인트에서 Prometheus 호환 응답 형식 제공 (Grafana 연동 대비)
- 향후 실제 Prometheus 연결 시 HTTP API adapter로 교체 가능

**결론**: 이 엔진은 "확장 가능성을 위한 준비"이지, 현재 필수 컴포넌트가 아님.

---

## 5. 전환 조건 (조건부)

다음 상황이 발생할 때만 PromQL 엔진 강화를 고려:

| 조건 | 현재 | 전환 시점 |
|------|------|----------|
| 서버 수 | 15대 | **100대 이상** |
| 데이터 소스 | 정적 JSON | **실제 Prometheus 서버 연동** |
| 메트릭 유형 | Pre-computed % | **Raw counter (rate 필요)** |
| 쿼리 주체 | AI Agent (내부) | **사용자 직접 PromQL 입력** |
| 시계열 범위 | 24시간 순환 | **수개월 히스토리** |

현재 이 조건 중 **해당하는 것이 없으므로**, 개선 불필요.

---

## 6. 실제 데이터 처리 흐름 (확인됨)

### 메인 파이프라인

```
hourly-data/*.json
  → MetricsProvider.getAllServerMetrics()
    → .map() : target → ServerMetrics 변환
    → .reduce() : 평균 CPU/Memory/Disk/Network 계산
    → .filter() : warning/critical 알림 추출
```

### API 응답 파이프라인

```
servers-unified/route.ts:
  → .map() : ServerMetrics → EnhancedServerMetrics 확장
  → .filter() : 검색어 매칭
  → .sort() : 다중 필드 정렬 (방향 제어)
  → .slice() : 페이지네이션
  → .reduce() : 상태 요약 (healthy/warning/critical 카운트)
```

### PromQL 호환 파이프라인 (대기 중)

```
metrics/route.ts:
  → MetricsProvider.getAllServerMetrics()
  → .map() : Prometheus JSON 형식 변환
  → { metric: {__name__, instance, job}, value: [timestamp, "값"] }
```

---

## 7. 최종 판정

| 항목 | 평가 |
|------|------|
| **현재 접근법** | 적합 — 15대 서버, 사전 계산 데이터, Serverless 환경에 최적 |
| **PromQL 엔진** | 이미 구현됨, 확장 대비 완료 (467줄) |
| **개선 필요성** | 없음 — 현재 규모에 과잉 최적화 위험 |
| **확장 경로** | 서버 100대+ 또는 실제 Prometheus 연동 시 엔진 활성화 |

### 아키텍처 강점

1. **SSOT 유지**: OTel 데이터셋(`public/data/otel-data`) → MetricsProvider(비동기 로더) → 모든 소비자
2. **2중 구조**: JS 배열(실사용) + PromQL 엔진(확장 대비) 공존
3. **AI 최적화**: 배열 조작 → 텍스트 요약 → LLM 컨텍스트 (토큰 효율)
4. **DoS 방어**: PromQL 엔진에 쿼리 길이/라벨 수 제한 내장
5. **Prometheus 호환**: 메트릭 네이밍, 라벨 구조 표준 준수 → 향후 실서비스 전환 용이

---

## 핵심 파일 참조

| 파일 | 역할 | 줄 수 |
|------|------|:-----:|
| `src/services/metrics/MetricsProvider.ts` | 데이터 변환, 집계, 캐싱 (Singleton) | 666 |
| `src/app/api/servers-unified/route.ts` | 검색/정렬/페이지네이션 API | 527 |
| `src/lib/promql/promql-engine.ts` | 경량 PromQL 엔진 (확장 대비) | 467 |
| `src/app/api/metrics/route.ts` | Prometheus 호환 엔드포인트 | 112 |
| `public/data/otel-data/hourly/hour-*.json` | OTel-native 시간별 데이터 (24개) | — |

## 관련 문서

- [ADR-001: Unified AI Engine Cache](../../../archived/decisions/adr-001-unified-ai-engine-cache-and-providers.md)
- [ADR-002: Server Card Rendering Strategy](adr-002-server-card-rendering-strategy.md)
- [Monitoring Stack 비교](../data/monitoring-stack-comparison.md)

---

_분석 기준: v8.0.0, 2026-02-17_
