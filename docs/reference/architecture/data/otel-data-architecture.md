# OTel 데이터 아키텍처

> OTel 전환 파이프라인과 데이터 계약을 설명하는 기준 문서
> Owner: platform-data
> Status: Active Canonical
> Doc type: Reference
> Last reviewed: 2026-02-17
> Canonical: docs/reference/architecture/data/otel-data-architecture.md
> Tags: otel,data,architecture,pipeline
>
> **(otel-pipeline-audit + observability-transition-readiness 병합)**
> Last verified: 2026-02-17

---

## 1. Overview

OpenTelemetry는 이 프로젝트에서 **"빌드 타임 시맨틱 변환 도구"**로 사용됩니다.

- 모든 관측성 데이터는 **synthetic** (AI 사전 생성 시나리오 JSON)
- `npm run data:fix`/`npm run data:verify` 스크립트로 OTel 데이터셋 품질을 유지
- 런타임 OTel SDK(`src/lib/otel/otel-sdk.ts`)는 기본 비활성화 (zero overhead, ConsoleExporter only)
- 외부 호출 없음, 비용 영향 없음 --- Free Tier 안전

이 구조가 가치를 갖는 이유:
- 무료 티어에서 비용 없이 재현 가능한 장애 패턴 제공
- Prometheus/OTel/Loki 데이터 계약을 코드에서 유지
- Provider 계층이 분리되어 실제 수집기로 교체 가능한 구조 확보

---

## 2. Data Flow

```
 런타임 SSOT (Externalized)
 public/data/otel-data/
 ├── resource-catalog.json
 ├── timeseries.json
 └── hourly/hour-{00..23}.json
                    │
    async fetch/fs loaders
 src/data/otel-data/index.ts
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
  Cloud Run deploy.sh      MetricsProvider (Vercel)
  (otel-data 복사)         (ensureDataLoaded)
  precomputed-state.ts     ┌→ 서버 카드 (Dashboard)
  1순위: otel-data         ├→ 서버 모달 (24h 차트)
  2순위: otel-processed    └→ AI 어시스턴트
```

**Tiered Data Access**: Vercel은 `public/data/otel-data`를 비동기 로더(fetch/fs)로 직접 소비하고, Cloud Run은 `otel-data` 1순위 + `otel-processed` 호환 폴백을 사용합니다.

**배포 동기화**: `cloud-run/ai-engine/deploy.sh`가 `public/data/otel-data` 파일을 Cloud Run 이미지(`data/otel-data`)로 복사하고, 하위 호환을 위해 `otel-processed/`도 함께 유지합니다.

---

## 3. Metrics Mapping (Prometheus → OTel)

| Legacy Prometheus 명칭 | OTel 시맨틱 (`otel-data`) | 단위 | 변환 |
|---|---|---|---|
| `node_cpu_usage_percent` | `system.cpu.utilization` | ratio 0-1 | /100 |
| `node_memory_usage_percent` | `system.memory.utilization` | ratio 0-1 | /100 |
| `node_filesystem_usage_percent` | `system.filesystem.utilization` | ratio 0-1 | /100 |
| `node_network_transmit_bytes_rate` | `system.network.utilization` | ratio 0-1 | /100 |
| `node_load1` / `node_load5` | `system.linux.cpu.load_1m` / `system.linux.cpu.load_5m` | load | x1 |
| `node_boot_time_seconds` | `system.uptime` | s | now-boot |
| `node_procs_running` | `system.processes.count` | count | x1 |
| `node_http_request_duration_milliseconds` | `http.server.request.duration` | s | /1000 |

> 매핑 정의: `src/services/metrics/metric-transformers.ts`

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
| `public/data/otel-data/` | 런타임 SSOT (OTel-native, externalized) |
| `src/data/otel-data/index.ts` | OTel 데이터 비동기 로더(fetch/fs) |
| `scripts/data/otel-fix.ts` | 데이터 보정 스크립트 |
| `scripts/data/otel-verify.ts` | 데이터 무결성 검증 스크립트 |
| `src/services/metrics/metric-transformers.ts` | Prometheus 명칭 ↔ OTel 시맨틱 매핑 로직 |
| `src/services/metrics/MetricsProvider.ts` | OTel 데이터 런타임 소비 (`ensureDataLoaded` 기반) |
| `cloud-run/ai-engine/src/data/precomputed-state.ts` | OTel 우선, `otel-processed` 폴백 (Cloud Run) |
| `src/lib/otel/otel-sdk.ts` | OTel SDK 스켈레톤 (비활성화) |

---

## Related

- [Data Architecture](./data-architecture.md)
- [Monitoring Stack Comparison](./monitoring-stack-comparison.md)
