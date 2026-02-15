# OTel 데이터 아키텍처

> OTel 전환 파이프라인과 데이터 계약을 설명하는 기준 문서
> Owner: platform-data
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-14
> Canonical: docs/reference/architecture/data/otel-data-architecture.md
> Tags: otel,data,architecture,pipeline
>
> **(otel-pipeline-audit + observability-transition-readiness 병합)**
> Last verified: 2026-02-14

---

## 1. Overview

OpenTelemetry는 이 프로젝트에서 **"빌드 타임 시맨틱 변환 도구"**로 사용됩니다.

- 모든 관측성 데이터는 **synthetic** (AI 사전 생성 시나리오 JSON)
- `npm run data:otel` 빌드 타임 스크립트가 Prometheus 네이밍을 OTel 시맨틱으로 변환
- 런타임 OTel SDK(`src/lib/otel/otel-sdk.ts`)는 기본 비활성화 (zero overhead, ConsoleExporter only)
- 외부 호출 없음, 비용 영향 없음 --- Free Tier 안전

이 구조가 가치를 갖는 이유:
- 무료 티어에서 비용 없이 재현 가능한 장애 패턴 제공
- Prometheus/OTel/Loki 데이터 계약을 코드에서 유지
- Provider 계층이 분리되어 실제 수집기로 교체 가능한 구조 확보

---

## 2. Data Flow

```
 원본 (SSOT)
 src/data/hourly-data/hour-{00..23}.json  (Prometheus 네이밍)
                    │
          npm run data:otel (빌드 타임 변환)
                    │
                    ▼
        src/data/otel-processed/
        ├── resource-catalog.json      (15 서버 OTel Resource)
        ├── timeseries.json            (24h 시계열)
        └── hourly/hour-{00..23}.json  (시간별 메트릭+로그+집계)
                    │
         ┌──────────┴──────────┐
    deploy.sh 복사          import
         │                     │
         ▼                     ▼
  Cloud Run AI Engine    MetricsProvider (Vercel)
  precomputed-state.ts   ┌→ 서버 카드 (Dashboard)
  1순위: otel-processed  ├→ 서버 모달 (24h 차트)
  2순위: hourly-data     └→ AI 어시스턴트
```

**Tiered Data Access**: Vercel과 Cloud Run 모두 `otel-processed` 1순위, `hourly-data` 폴백으로 동일 우선순위 사용. 데이터 불일치 없음.

**배포 동기화**: `deploy.sh`가 `otel-processed/` 파일을 Cloud Run 이미지에 복사 (~2.8MB, 512Mi 한도 내 충분).

---

## 3. Metrics Mapping (Prometheus → OTel)

| Prometheus (hourly-data) | OTel (otel-processed) | 단위 | 변환 |
|---|---|---|---|
| `node_cpu_usage_percent` | `system.cpu.utilization` | ratio 0-1 | /100 |
| `node_memory_usage_percent` | `system.memory.utilization` | ratio 0-1 | /100 |
| `node_filesystem_usage_percent` | `system.filesystem.utilization` | ratio 0-1 | /100 |
| `node_network_transmit_bytes_rate` | `system.network.io` | By/s | x1 |
| `node_load1` / `node_load5` | `system.linux.cpu.load_1m` / `system.linux.cpu.load_5m` | load | x1 |
| `node_boot_time_seconds` | `system.uptime` | s | now-boot |
| `node_procs_running` | `system.processes.count` | count | x1 |
| `node_http_request_duration_milliseconds` | `http.server.request.duration` | s | /1000 |

> 매핑 정의: `scripts/data/otel/prometheus-to-otel.ts`

---

## 4. Limitations & Non-Goals

**현재 범위 밖** (Explicit Non-Goals):
- 실서버 `node_exporter` scrape 연동
- OTel Collector OTLP push 수신
- Prometheus TSDB / `remote_write` 연동
- Loki `/loki/api/v1/push` 및 LogQL API 제공

**OTel SDK 런타임 상태**:

| 항목 | 상태 |
|---|---|
| 환경변수 | `ENABLE_OPENTELEMETRY` (기본 미설정 = 비활성화) |
| Exporter | ConsoleMetricExporter (stdout only) |
| OTLP 백엔드 | 없음 |
| Instrument Stubs | cpuGauge, memoryGauge 등 No-Op |

SDK는 프로덕션 모니터링용이 아닌 향후 확장 스켈레톤입니다.

**Guardrails**:
- `synthetic`/`derived` 출처 표기를 문서와 API 메타데이터에서 유지
- "실제 수집기 연동" 문구는 코드/엔드포인트 준비 전 사용 금지

---

## 5. Transition Gap Matrix (To-Be)

| 전환 항목 | 현재 상태 | 전환 시 작업 | 난이도 |
|---|---|---|---|
| Metrics Ingest | 파일 로드 | OTLP/Prometheus 수신 어댑터 추가, Provider 교체 | 중 |
| Time-Series Storage | JSON 번들 | TSDB (Prometheus/Mimir/Thanos) 연결 | 중 |
| Query Layer | 단순 내부 조회 | 표준 Prometheus Query API adapter | 중 |
| Log Ingest | Supabase CRUD + Loki 형식 생성 | Loki push/query API 연동 | 중 |
| Source Switching | 암묵적 코드 분기 | `SyntheticProvider`/`RealProvider` env 전환 명시 | 하 |

---

## 주요 파일 참조

| 파일 | 역할 |
|---|---|
| `src/data/hourly-data/hour-*.json` | 원본 SSOT (Prometheus 네이밍) |
| `src/data/otel-processed/` | OTel 변환 결과 (빌드 타임) |
| `scripts/data/otel-precompute.ts` | 변환 파이프라인 메인 |
| `scripts/data/otel/prometheus-to-otel.ts` | 메트릭 매핑 정의 |
| `src/services/metrics/MetricsProvider.ts` | OTel 데이터 런타임 소비 (Vercel) |
| `cloud-run/ai-engine/src/data/precomputed-state.ts` | OTel 우선, hourly-data 폴백 (Cloud Run) |
| `src/lib/otel/otel-sdk.ts` | OTel SDK 스켈레톤 (비활성화) |

---

## Related

- [Data Architecture](./data-architecture.md)
- [Prometheus Comparison](./prometheus-comparison.md)
