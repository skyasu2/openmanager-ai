# Monitoring Stack 비교 분석 — Prometheus & Grafana Cloud vs OpenManager AI

> Owner: platform-data
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-17
> Canonical: docs/reference/architecture/data/monitoring-stack-comparison.md
> Tags: prometheus,grafana,comparison,metrics,data-pipeline

**대상 버전**: OpenManager AI v8.0.0
**목적**: Prometheus/Grafana Cloud 대비 데이터 모델 및 파이프라인 비교

---

## 1. 종합 평가 (Scorecard)

| 영역 | 점수 | 요약 |
|------|:----:|------|
| Metric 네이밍 | ★★★☆☆ | `node_` prefix 사용하나 단위 규칙(`_seconds`, `_bytes`) 위반 |
| Label 구조 | ★★★★☆ | `instance:port`, `job` 표준 준수 + 유용한 custom label |
| 데이터 모델 | ★★☆☆☆ | counter/gauge 구분 없이 사전 계산된 % 값만 존재 |
| Scrape 설정 | ★★★☆☆ | 개념은 맞으나 10분 간격은 비표준 |
| Alert 임계값 | ★★★★☆ | 업계 표준과 유사 (warning=80%, critical=90%) |
| 아키텍처 패턴 | ★★☆☆☆ | Pull → Static JSON, PromQL 없음 |
| **종합** | **★★★☆☆** | **Prometheus "영감"을 잘 받았으나 본질적 차이 존재** |

---

## 2. Metric 네이밍 비교

Prometheus 표준: `[namespace]_[subsystem]_[name]_[unit]`
- 단위는 **기본 단위** 사용: `seconds` (not ms), `bytes` (not MB), `ratio` (not percent)
- Counter에는 `_total` 접미사 필수

| VIBE 메트릭 | 실제 node_exporter | 타입 | 차이점 |
|------------|-------------------|------|--------|
| `node_cpu_usage_percent` | `node_cpu_seconds_total` | counter | 이름/타입/단위 모두 다름. 실제는 `rate()`로 사용률 계산 |
| `node_memory_usage_percent` | `node_memory_MemAvailable_bytes` | gauge | 단위 다름. 실제는 bytes |
| `node_filesystem_usage_percent` | `node_filesystem_avail_bytes` | gauge | 단위 다름 |
| `node_network_transmit_bytes_rate` | `node_network_transmit_bytes_total` | counter | 타입 다름. 실제는 누적 counter |
| `node_load1/5`, `node_boot_time_seconds`, `node_procs_running`, `up` | 동일 | gauge | 완전 일치 |

**핵심 격차**: VIBE는 "PromQL 계산 결과"를 저장하고, Prometheus는 "원본 counter/gauge"를 저장한다.

> 매핑 코드: `src/services/metrics/metric-transformers.ts`

---

## 3. 데이터 파이프라인 비교

### 수집 (Collection)

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 에이전트 | Grafana Alloy (실제 설치) | 없음 (시뮬레이션) |
| 프로토콜 | Prometheus scrape, OTLP push | N/A (파일 기반) |
| 대상 | 실서버, 컨테이너, 클라우드 | 가상 15대 서버 (JSON) |
| 실시간 | 실시간 수집 | 사전 계산 (24시간 고정) |

### 전송 (Transmission)

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 프로토콜 | Prometheus Remote Write v2 | N/A (파일 로드) |
| 네트워크 | 인터넷 경유 (WAL 버퍼링) | 로컬/번들 (Zero Traffic) |
| 신뢰성 | WAL + 재전송 | Git 데이터 무결성 |

### 저장 (Storage)

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 메트릭 | Mimir (TSDB) → Object Storage | JSON 파일 (`public/data/otel-data`) |
| 로그 | Loki (Index+Chunks) | JSON 파일 + Supabase (RAG) |
| 트레이스 | Tempo (Object Storage) | 미지원 |
| 보관 | 13개월 (메트릭), 30일 (로그) | 무제한 (Git) |
| 비용 | 무료 한도 초과 시 과금 | $0 (GitHub Free) |

### 쿼리 (Query)

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 언어 | PromQL, LogQL | TypeScript 함수 |
| Ad-hoc | Grafana Explore | AI 챗봇 (NLQ) |

### 시각화 & 알림

| 항목 | Grafana Cloud | OpenManager AI |
|------|--------------|----------------|
| 대시보드 | Grafana Panel | React 컴포넌트 (Recharts) |
| 알림 | Grafana Alerting (Slack, PagerDuty) | JSON 규칙 (system-rules.json) + UI 모달 |
| 상태 관리 | 서버 사이드 (Alertmanager) | 클라이언트 사이드 (Zustand) |

---

## 4. Alert 임계값 비교

| 리소스 | VIBE warning | VIBE critical | Prometheus 권장 warning | Prometheus 권장 critical |
|--------|:-----------:|:------------:|:---------------------:|:----------------------:|
| CPU | 80% | 90% | 80% (10분 지속) | 95% (5분 지속) |
| Memory | 80% | 90% | 90% 사용 (2분) | OOM Kill 감지 |
| Disk | 80% | 90% | 24h 내 풀 예측 | 90% 사용 |
| Network | 70% | 85% | 80% 대역폭 | 95% 대역폭 |

VIBE의 `system-rules.json`에 Prometheus `for` 지속시간 개념 반영 완료.

---

## 5. 아키텍처 다이어그램

### Grafana Cloud Pipeline

```
실제 서버 (Node Exporter)
    │ Prometheus scrape / OTLP push
    ▼
Grafana Alloy (수집 + 변환)
    │ Remote Write v2 (WAL)
    ▼
Grafana Cloud LGTM (Mimir + Loki + Tempo)
    │ PromQL / LogQL
    ▼
Grafana Dashboard
```

### OpenManager AI Pipeline

```
scripts/data/otel-fix.ts (Build-Time 생성)
    │ npm run data:fix
    ▼
public/data/otel-data/ (Runtime SSOT, Git 관리)
    ├──→ Vercel: MetricsProvider (async fetch)
    └──→ Cloud Run: precomputed-state (fs.readFileSync)
              │
              ▼
         React Dashboard (Recharts) + AI Chat (NLQ)
```

---

## 6. Free Tier 비교

### Grafana Cloud Free Tier

| 항목 | 무료 한도 | 보관 기간 |
|------|----------|----------|
| Active Metrics Series | 10,000개 | 13개월 |
| 로그 | 50 GB/월 | 30일 |
| 트레이스 | 50 GB/월 | 30일 |
| 사용자 | 3명 | - |

### OpenManager AI

| 항목 | 비용 | 제한 |
|------|------|------|
| Vercel Pro | $20/월 | 유일한 유료 서비스 |
| Cloud Run | Free Tier | 50hr vCPU/월 |
| 데이터 | $0 | Git 저장소 |

---

## 7. 결론

| 관점 | Grafana Cloud | OpenManager AI |
|------|:------------:|:--------------:|
| 프로덕션 모니터링 | **적합** | 부적합 |
| PoC/데모 | 과잉 | **적합** |
| 교육 목적 | 학습 곡선 높음 | **적합** (Prometheus 매핑 제공) |
| 비용 | 초과 시 과금 | **₩0 운영** |
| AI 통합 | 별도 설정 필요 | **내장 (NLQ → 메트릭)** |

**OpenManager AI는 Prometheus/Grafana의 외형(naming, label, alert)을 충실히 모방하되, 내부 동작(counter→rate, TSDB, PromQL)은 의도적으로 생략한 교육용/데모용 아키텍처.**

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `public/data/otel-data/hourly/hour-*.json` | OTel-native 시간별 JSON (24개) |
| `src/services/metrics/metric-transformers.ts` | Prometheus ↔ OTel 매핑 |
| `src/services/metrics/MetricsProvider.ts` | 데이터 변환 & 캐싱 |
| `src/config/rules/system-rules.json` | Alert 임계값 SSOT |

## 관련 문서

- [데이터 아키텍처 (SSOT)](./data-architecture.md)
- [OTel 데이터 아키텍처](./otel-data-architecture.md)
- [ADR-003: PromQL vs JS Array Filtering](../decisions/adr-003-promql-vs-js-array-filtering.md)

---

_Last Updated: 2026-02-17_
