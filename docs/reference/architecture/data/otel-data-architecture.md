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

## 2.5 데이터셋 구조 (Synthetic)

### 개요

| 항목 | 값 |
|------|-----|
| 서버 수 | 15대 |
| 시간 범위 | 24시간 (hour-00 ~ hour-23) |
| 슬롯 간격 | 10분 (6 슬롯/시간, 144 슬롯/일) |
| 메트릭 종류 | 9개 |
| 기준 날짜 | 2026-02-14 (KST) |
| 생성 시각 | 2026-02-15T03:56:41.821Z |

### 파일 구조

```
public/data/otel-data/
├── resource-catalog.json    # 15대 서버 메타데이터 (OTel Resource Attributes)
├── timeseries.json          # 24h 집계 시계열 (144 timestamps × 15 servers × 9 metrics)
└── hourly/
    └── hour-{00..23}.json   # 시간별 상세 (6 slots, metrics + logs)
```

### 15대 서버 인벤토리

| Tier | Server ID | Role | AZ | CPU | Memory | Disk |
|------|-----------|------|----|-----|--------|------|
| LB | lb-haproxy-dc1-01 | loadbalancer | AZ1 | 4 | 8GB | 50GB |
| LB | lb-haproxy-dc1-02 | loadbalancer | AZ3 | 4 | 8GB | 50GB |
| Web | web-nginx-dc1-01 | web | AZ1 | 4 | 8GB | 100GB |
| Web | web-nginx-dc1-02 | web | AZ2 | 4 | 8GB | 100GB |
| Web | web-nginx-dc1-03 | web | AZ3 | 4 | 8GB | 100GB |
| API | api-was-dc1-01 | application | AZ1 | 8 | 16GB | 200GB |
| API | api-was-dc1-02 | application | AZ2 | 8 | 16GB | 200GB |
| API | api-was-dc1-03 | application | AZ3 | 8 | 16GB | 200GB |
| DB | db-mysql-dc1-primary | database | AZ1 | 16 | 64GB | 1TB |
| DB | db-mysql-dc1-replica | database | AZ2 | 16 | 64GB | 1TB |
| DB | db-mysql-dc1-backup | database | AZ3 | 16 | 64GB | 1TB |
| Cache | cache-redis-dc1-01 | cache | AZ1 | 4 | 32GB | 50GB |
| Cache | cache-redis-dc1-02 | cache | AZ2 | 4 | 32GB | 50GB |
| Storage | storage-nfs-dc1-01 | storage | AZ1 | 4 | 16GB | 5TB |
| Storage | storage-s3gw-dc1-01 | storage | AZ3 | 2 | 8GB | 200GB |

### 서비스 토폴로지 (OnPrem DC1)

```
LB(2) → Web(3) → API(3) → DB(MySQL 3) + Cache(Redis 2) → Storage(2)

┌───────────── Load Balancer ──────────────┐
│ HAProxy-01 (AZ1) ─── HAProxy-02 (AZ3)   │
└──────┬──────────────────────┬────────────┘
       ▼                      ▼
┌───────────── Web Tier (Nginx) ───────────┐
│ Nginx-01(AZ1)  Nginx-02(AZ2)  Nginx-03  │
└──────┬──────────────────────┬────────────┘
       ▼ Reverse Proxy        ▼
┌───────────── API Tier (WAS) ─────────────┐
│ WAS-01(AZ1)  WAS-02(AZ2)  WAS-03(AZ3)   │
└──┬──────┬───────────┬───────┬────────────┘
   ▼      ▼           ▼       ▼
┌─ Data ──┐    ┌─ Cache ─┐  ┌─ Storage ──┐
│ MySQL×3 │    │ Redis×2 │  │ NFS + S3GW │
│ P/R/S   │    │ M/R     │  │            │
└─────────┘    └─────────┘  └────────────┘
```

- 가용영역: AZ1, AZ2, AZ3 (각 tier 분산)
- DB: Primary(AZ1) → Replica(AZ2) + Standby(AZ3) 비동기 복제
- 대시보드 표시: `TopologyModal.tsx` → `architecture-diagrams.data.ts`

### 9개 메트릭

| 메트릭 | 단위 | 타입 |
|--------|------|------|
| `system.cpu.utilization` | ratio 0-1 | gauge |
| `system.memory.utilization` | ratio 0-1 | gauge |
| `system.filesystem.utilization` | ratio 0-1 | gauge |
| `system.network.io` | By (bytes/sec) | gauge |
| `system.linux.cpu.load_1m` | load | gauge |
| `system.linux.cpu.load_5m` | load | gauge |
| `system.uptime` | seconds | gauge |
| `system.process.count` | count | gauge |
| `http.server.request.duration` | seconds | gauge |

> `system.network.io` 값은 bytes/sec 단위입니다. 소비 코드에서 `normalizeNetworkUtilizationPercent()` 함수가 1Gbps(125MB/s) 기준으로 utilization %로 변환합니다.

### hourly JSON 슬롯 구조 (hour-XX.json)

```json
{
  "schemaVersion": "1.0.0",
  "hour": 0,
  "scope": { "name": "openmanager-ai-otel-pipeline", "version": "1.0.0" },
  "slots": [
    {
      "startTimeUnixNano": 1770994800000000000,
      "endTimeUnixNano": 1770995400000000000,
      "metrics": [
        {
          "name": "system.cpu.utilization",
          "unit": "1",
          "type": "gauge",
          "dataPoints": [
            { "asDouble": 0.32, "attributes": { "host.name": "web-nginx-dc1-01.openmanager.kr" } }
          ]
        }
      ],
      "logs": [
        {
          "timeUnixNano": 1770994800000000000,
          "severityNumber": 9,
          "severityText": "INFO",
          "body": "Server started successfully",
          "attributes": { "log.source": "nginx" },
          "resource": "web-nginx-dc1-01"
        }
      ]
    }
  ]
}
```

---

## 3. Metrics Mapping (Prometheus → OTel)

| Legacy Prometheus 명칭 | OTel 시맨틱 (`otel-data`) | 단위 | 변환 |
|---|---|---|---|
| `node_cpu_usage_percent` | `system.cpu.utilization` | ratio 0-1 | /100 |
| `node_memory_usage_percent` | `system.memory.utilization` | ratio 0-1 | /100 |
| `node_filesystem_usage_percent` | `system.filesystem.utilization` | ratio 0-1 | /100 |
| `node_network_transmit_bytes_rate` | `system.network.io` | By | bytes/sec |
| `node_load1` / `node_load5` | `system.linux.cpu.load_1m` / `system.linux.cpu.load_5m` | load | x1 |
| `node_boot_time_seconds` | `system.uptime` | s | now-boot |
| `node_procs_running` | `system.process.count` | count | x1 |
| `node_http_request_duration_milliseconds` | `http.server.request.duration` | s | /1000 |

> 매핑 정의: `src/services/metrics/metric-transformers.ts`

---

## 3.5 OTel Semantic Conventions 준수 현황

> 기준: [OTel Semantic Conventions v1.27+](https://opentelemetry.io/docs/specs/semconv/)

### Resource Attributes

| 속성 | 현재 값 | OTel 표준 | 판정 |
|------|---------|-----------|:----:|
| `deployment.environment.name` | "production" | 표준 (v1.27+ renamed) | OK |
| `host.name`, `host.id`, `host.arch` | 사용 중 | 표준 | OK |
| `os.type`, `os.description` | 사용 중 | 표준 | OK |
| `cloud.region`, `cloud.availability_zone` | 사용 중 | 표준 | OK |
| `server.role` | Custom | 비표준 (프로젝트 전용 확장) | 유지 |
| `host.cpu.count` | Custom | 비표준 (표준은 `system.cpu.logical.count` 메트릭) | 유지 |
| `host.memory.size` | Custom | 비표준 (표준은 `system.memory.limit` 메트릭) | 유지 |
| `host.disk.size` | Custom | 비표준 (표준은 `system.filesystem.limit` 메트릭) | 유지 |

### Metrics

| 메트릭 | OTel 표준 | 판정 |
|--------|-----------|:----:|
| `system.cpu.utilization` | 표준 | OK |
| `system.memory.utilization` | 표준 | OK |
| `system.filesystem.utilization` | 표준 | OK |
| `system.network.io` | 표준 (값은 bytes/sec, 소비 코드에서 utilization %로 변환) | OK |
| `system.linux.cpu.load_1m` / `load_5m` | 표준 (실험적) | OK |
| `system.uptime` | 표준 | OK |
| `system.process.count` | 표준 | OK |
| `http.server.request.duration` | 표준 | OK |

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
