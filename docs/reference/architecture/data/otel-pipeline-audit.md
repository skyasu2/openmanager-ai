# OTel 데이터 파이프라인 점검 보고서

**작성일**: 2026-02-12
**대상 버전**: OpenManager VIBE v7.1.4

---

## 1. 핵심 요약

**OpenTelemetry는 이 프로젝트에서 "런타임 수집 도구"가 아닌 "빌드 타임 시맨틱 변환 도구"로 사용됩니다.**

- 실제 OTel SDK(`src/lib/otel/otel-sdk.ts`)는 기본 비활성화 상태 (zero overhead)
- OTel 데이터는 `npm run data:otel` 빌드 타임 스크립트로 생성
- 모든 데이터는 로컬 JSON 파일 — 외부 호출 없음, 비용 영향 없음

---

## 2. 전체 데이터 흐름도

```
┌──────────────────────────────────────────────────────────────┐
│  원본 (SSOT)                                                 │
│  src/data/hourly-data/hour-{00..23}.json                     │
│  (AI가 사전 생성한 시나리오 JSON, Prometheus 네이밍)          │
└──────────────────────────┬───────────────────────────────────┘
                           │
                 npm run data:otel
                 (빌드 타임 변환)
                           │
                           ▼
              ┌──────────────────────────┐
              │  OTel Processed          │
              │  src/data/otel-processed/│
              │  ├── resource-catalog    │
              │  ├── timeseries.json     │
              │  └── hourly/hour-XX.json │
              └─────┬──────────┬─────────┘
                    │          │
            deploy.sh 복사   import
                    │          │
                    ▼          ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Cloud Run AI Engine     │  │  MetricsProvider         │
│  precomputed-state.ts    │  │  (Vercel 런타임)         │
│  1순위: otel-processed   │  │  1순위: otel-processed   │
│  2순위: hourly-data      │  │  2순위: hourly-data      │
│  (Tiered Data Access)    │  │  3순위: fixed-24h-metrics│
└──────────────┬───────────┘  └──────────────┬───────────┘
               │                             │
               ▼                   ┌─────────┼─────────┐
          AI 어시스턴트            ▼         ▼         ▼
          (Cloud Run 측)       서버 카드  서버 모달  AI 어시스턴트
                               (Dashboard) (Detail)  (Vercel 측)
```

---

## 3. 소비자별 데이터 소스 매핑

| 소비자 | 진입점 | 사용 데이터 | OTel 경유? |
|--------|--------|------------|:---------:|
| **대시보드 서버 카드** | MetricsProvider | otel-processed (1순위) → hourly-data (2순위) | O |
| **서버 모달 (24h 차트)** | useFixed24hMetrics → UnifiedServerDataSource | MetricsProvider 동일 체인 | O |
| **AI 어시스턴트 (Vercel)** | MonitoringContext → MetricsProvider | MetricsProvider 동일 체인 | O |
| **AI 어시스턴트 (Cloud Run)** | precomputed-state.ts | otel-processed (1순위) → hourly-data (2순위) | O |
| **OTel SDK (런타임)** | src/lib/otel/otel-sdk.ts | ConsoleExporter, 기본 비활성화 | N/A |

---

## 4. Cloud Run AI Engine의 OTel Tiered Data Access

### 현재 동작 (v7.1.4+)

Cloud Run의 `precomputed-state.ts`는 **Tiered Data Access** 패턴을 사용합니다:

```
cloud-run/ai-engine/src/data/precomputed-state.ts

  Tier 1 (PRIMARY): otel-processed/hourly/hour-XX.json
    → loadOTelHourly() → otelSlotToRawServers() → buildSlot()

  Tier 2 (FALLBACK): hourly-data/hour-XX.json
    → loadHourlyJson() → targetToRawServer() → buildSlot()
```

Vercel의 MetricsProvider도 동일한 우선순위를 사용합니다:

```
src/services/metrics/MetricsProvider.ts
  → src/data/otel-processed/hourly/hour-XX.json (OTel format)
  → otelSlotToServerMetrics() 변환
```

### 배포 시 데이터 동기화

`deploy.sh`가 빌드 전에 OTel 데이터를 자동으로 복사합니다:

```bash
# deploy.sh 내부
cp src/data/otel-processed/resource-catalog.json → data/otel-processed/
cp src/data/otel-processed/hourly/*.json → data/otel-processed/hourly/
```

`Dockerfile`이 해당 데이터를 이미지에 포함합니다:

```dockerfile
COPY data/otel-processed/ ./data/otel-processed/
```

### 데이터 불일치 여부

**불일치 없음**. Vercel과 Cloud Run 모두 동일한 OTel 변환 데이터를 1순위로 사용합니다.
이전보다 변환 경로가 통일되어 일관성이 향상되었습니다.

### 이미지 크기 영향

otel-processed 데이터 추가: ~2.8MB (resource-catalog + 24 hourly files)
기존 hourly-data ~2.3MB와 합쳐 총 ~5MB — 512Mi 메모리 한도 내 충분합니다.

---

## 5. OTel SDK 런타임 상태

| 항목 | 상태 |
|------|------|
| 환경변수 | `ENABLE_OPENTELEMETRY` (기본 미설정 = 비활성화) |
| Exporter | ConsoleMetricExporter (stdout 출력만) |
| OTLP 백엔드 | 없음 |
| Instrument Stubs | cpuGauge, memoryGauge 등 No-Op |
| 런타임 오버헤드 | **Zero** (즉시 return) |

**결론**: OTel SDK는 프로덕션 모니터링용이 아닌, 향후 확장을 위한 스켈레톤 코드입니다.

---

## 6. Prometheus → OTel 메트릭 매핑

| Prometheus (hourly-data) | OTel (otel-processed) | 단위 | 변환 |
|--------------------------|----------------------|------|------|
| `node_cpu_usage_percent` | `system.cpu.utilization` | ratio (0-1) | / 100 |
| `node_memory_usage_percent` | `system.memory.utilization` | ratio (0-1) | / 100 |
| `node_filesystem_usage_percent` | `system.filesystem.utilization` | ratio (0-1) | / 100 |
| `node_network_transmit_bytes_rate` | `system.network.io` | By/s | x 1 |
| `up` | `system.status` | 1 (boolean) | x 1 |
| `node_load1` | `system.cpu.load_average.1m` | load | x 1 |
| `node_load5` | `system.cpu.load_average.5m` | load | x 1 |
| `node_boot_time_seconds` | `system.uptime` | s | now - boot |
| `node_procs_running` | `system.processes.count` | count | x 1 |
| `node_http_request_duration_milliseconds` | `http.server.request.duration` | s | / 1000 |

> 매핑 정의: `scripts/data/otel/prometheus-to-otel.ts`

---

## 7. 빌드 타임 파이프라인 명령어

```bash
# OTel 변환만 실행
npm run data:otel
# → scripts/data/otel-precompute.ts 실행
# → src/data/otel-processed/ 에 27개 파일 생성

# 원본 데이터 동기화 + OTel 변환
npm run data:all
# → npm run data:sync && npm run data:otel

# 출력 파일 구조
src/data/otel-processed/
├── resource-catalog.json         # 15 서버 OTel Resource 속성
├── timeseries.json               # 24h 시계열 (OTel + legacy 이름)
└── hourly/hour-{00..23}.json     # 시간별 OTel 메트릭 + 로그 + 집계
```

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/data/hourly-data/hour-*.json` | 원본 SSOT (Prometheus 네이밍) |
| `src/data/otel-processed/` | OTel 변환 결과 (빌드 타임 생성) |
| `scripts/data/otel-precompute.ts` | 변환 파이프라인 메인 |
| `scripts/data/otel/prometheus-to-otel.ts` | 메트릭 매핑 정의 |
| `scripts/data/otel/otel-resource-builder.ts` | OTel Resource 빌더 |
| `scripts/data/otel/otel-log-processor.ts` | 로그 변환 |
| `src/services/metrics/MetricsProvider.ts` | OTel 데이터 런타임 소비 (Vercel) |
| `cloud-run/ai-engine/src/data/precomputed-state.ts` | OTel 우선, hourly-data 폴백 (Cloud Run) |
| `cloud-run/ai-engine/src/types/otel-metrics.ts` | Cloud Run용 OTel 타입 정의 |
| `src/lib/otel/otel-sdk.ts` | OTel SDK 스켈레톤 (기본 비활성화) |
| `src/data/fixed-24h-metrics.ts` | 최후 폴백 데이터 |

---

## 관련 문서

- [데이터 아키텍처](./data-architecture.md)
- [Prometheus 비교 분석](./prometheus-comparison.md)
