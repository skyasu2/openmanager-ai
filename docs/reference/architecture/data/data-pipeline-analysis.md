# OpenManager AI - 모니터링 데이터 파이프라인 아키텍처 분석

**최종 업데이트**: 2026-02-12
**프로젝트 버전**: v8.0.0

---

Prometheus 데이터 생성 → OTel 전처리 → 프론트엔드 대시보드 + AI 어시스턴트까지의 전체 데이터 흐름을 분석한 문서.

---

## 전체 데이터 흐름도

```
┌─────────────────────────────────────────────────────────────────┐
│ BUILD TIME (npx tsx scripts/data/...)                            │
│                                                                  │
│  sync-hourly-data.ts ──→ src/data/hourly-data/hour-XX.json (24) │
│          │                     (Prometheus format, SSOT)         │
│          └──→ cloud-run/ai-engine/data/hourly-data/ (동기화)     │
│                                                                  │
│  otel-precompute.ts ──→ src/data/otel-processed/                │
│                          ├─ resource-catalog.json                │
│                          ├─ timeseries.json                      │
│                          └─ hourly/hour-XX.json (24)             │
└──────────────────────────────┬──────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│ RUNTIME (Vercel Next.js)                                         │
│                                                                  │
│  Static Imports (번들 포함, fs 접근 불필요)                        │
│  ├─ src/data/hourly-data/index.ts → getHourlyData(hour)          │
│  ├─ src/data/otel-processed/index.ts → getOTelHourlyData(hour)   │
│  └─ src/data/otel-metrics/index.ts → ExportMetricsServiceRequest │
│                               ↓                                  │
│  MetricsProvider (Singleton)                                     │
│  ├─ OTel (Primary) → extractMetricsFromStandard()                │
│  └─ Prometheus (Fallback) → targetToServerMetrics()              │
│                               ↓                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │ API Routes   │  │ MonitoringContext │  │ Log Generation     │  │
│  │ /api/servers │  │ → AlertManager   │  │ server-data-logs   │  │
│  │ /api/metrics │  │ → HealthCalc     │  │ loki-log-generator │  │
│  │ /api/dashboard│ │ → buildAIContext │  │                    │  │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬───────────┘  │
│         ↓                   ↓                     ↓              │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │ Dashboard UI │  │ AI Supervisor API│  │ LogsTab (3 views)  │  │
│  │ ServerCards  │  │ → Cloud Run proxy│  │ Syslog/Alerts/     │  │
│  │ Charts       │  │                  │  │ Streams(Loki)      │  │
│  └─────────────┘  └────────┬─────────┘  └────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLOUD RUN (AI Engine)                                            │
│                                                                  │
│  precomputed-state.ts → 144슬롯 O(1) lookup                     │
│  executeSupervisor() → Multi-Agent Orchestrator                  │
│  ├─ NLQ Agent (Cerebras) — 일반 모니터링 질의                     │
│  ├─ Analyst Agent (Groq) — 이상 탐지, 트렌드                     │
│  ├─ Reporter Agent (Groq) — 인시던트 분석                        │
│  └─ Advisor Agent (Mistral) — 트러블슈팅 가이드                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 1. 데이터 생성 (Prometheus)

### 파일: `scripts/data/sync-hourly-data.ts`

**15개 한국 DC 서버** (결정론적 시드 PRNG):

| 유형 | 서버 수 | 예시 ID |
|------|---------|---------|
| web | 3 | `web-nginx-icn-01`, `web-nginx-pus-01` |
| application | 3 | `api-was-icn-01`, `api-was-pus-01` |
| database | 3 | `db-mysql-icn-primary`, `db-mysql-pus-dr` |
| cache | 2 | `cache-redis-icn-01`, `cache-redis-icn-02` |
| storage | 2 | `storage-nfs-icn-01`, `storage-s3gw-pus-01` |
| loadbalancer | 2 | `lb-haproxy-icn-01`, `lb-haproxy-pus-01` |

**데이터 구조** (hour-XX.json):

```
hour-XX.json
├─ hour: 0-23
├─ scrapeConfig: { interval: "10m", source: "node-exporter" }
├─ dataPoints[6]: (00분, 10분, 20분, 30분, 40분, 50분)
│   └─ targets: Record<"serverId:9100", PrometheusTarget>
│       ├─ labels: { hostname, datacenter, server_type, os }
│       ├─ metrics: { cpu, memory, disk, network, load1, load5, ... }
│       ├─ nodeInfo: { cpu_cores, memory_bytes, disk_bytes }
│       └─ logs: string[]  (장애 시 생성)
└─ metadata: { version, serverCount, affectedServers }
```

**5개 장애 시나리오** (점진적 진행):

| 시간 | 인시던트 | 영향 서버 |
|------|---------|----------|
| 02-03시 | DB 백업 I/O 과부하 → 슬로우쿼리 | MySQL primary/replica, API-01 |
| 07시 | 네트워크 패킷 손실 → LB 과부하 | HAProxy, Nginx-01/02 |
| 12시 | Redis 메모리 누수 → OOM | Redis-01/02, API-01 |
| 21시 | API 요청 폭증 → CPU 과부하 | API-01/02, HAProxy |

진행 단계: `normal(0x)` → `pre(0.4x)` → `onset(0.6x)` → `peak(1.0x)` → `sustained(0.85x)` → `recovery(0.3x)`

---

## 2. OTel 전처리 파이프라인

### 파일: `scripts/data/otel-precompute.ts`

| 단계 | 입력 | 출력 | 크기 |
|------|------|------|------|
| 1. Resource Catalog | 첫 시간 targets | `resource-catalog.json` | 7.5KB |
| 2. Hourly OTel Files | 24개 hourly-data | `hourly/hour-XX.json` (24) | ~110KB/개 |
| 3. TimeSeries | 전체 24h | `timeseries.json` | ~107KB |
| 3b. Legacy TimeSeries | 위와 동일 | `public/processed-metrics/timeseries.json` | |

**Prometheus → OTel 메트릭 변환**:

| Prometheus (0-100%) | OTel Standard (0-1) | 변환 |
|------|------|------|
| `node_cpu_usage_percent` | `system.cpu.utilization` | `÷100` |
| `node_memory_usage_percent` | `system.memory.utilization` | `÷100` |
| `node_filesystem_usage_percent` | `system.filesystem.utilization` | `÷100` |
| `node_network_transmit_bytes_rate` | `system.network.io` | passthrough |
| `node_http_request_duration_ms` | `http.server.request.duration` | `÷1000` (초) |

---

## 3. 런타임 데이터 로딩

### Static Import 패턴 (Vercel 호환)

```typescript
// src/data/hourly-data/index.ts
import hour00 from './hour-00.json';
// ... 24 imports
const HOURLY_DATA_MAP: Record<number, HourlyData> = { 0: hour00, ... };

export function getHourlyData(hour: number): HourlyData | null
export function getTargetsAtTime(hour: number, minute: number): Record<string, PrometheusTarget>
```

**이유**: Vercel Serverless는 런타임 fs 접근 불가 → 빌드 타임에 JSON을 번들에 포함

### MetricsProvider (Singleton SSOT)

**파일**: `src/services/metrics/MetricsProvider.ts`

```
데이터 로딩 우선순위:
1. OTel Data (Primary) → getOTelHourlyData(hour)
   └─ extractMetricsFromStandard() → ApiServerMetrics[]
2. Prometheus hourly-data (Fallback) → getBundledHourlyData(hour)
   └─ targetToServerMetrics() → ApiServerMetrics[]
```

**KST 시간 처리** (핵심):

```
KST 19:30 → minuteOfDay = 1170
           → hour = 19, minute = 30
           → slotIndex = 3 (30~39분 범위)
           → hourly-data[19].dataPoints[3].targets
```

**4-레벨 캐시**: OTel data, OTel conversion, hourly data, server list

---

## 4. 프론트엔드 대시보드

### API Routes → Dashboard

| 엔드포인트 | 소스 | 용도 |
|-----------|------|------|
| `GET /api/dashboard` | MetricsProvider → UnifiedServerDataSource | 대시보드 전체 (서버 목록 + 통계) |
| `GET /api/servers/all` | MetricsProvider.getAllServerMetrics() | 서버 카드 목록 (ISR 300s) |
| `GET /api/servers/[id]` | MetricsProvider.getServerMetrics(id) | 개별 서버 상세 |
| `GET /api/metrics` | MetricsProvider (PromQL 시뮬레이션) | 차트 데이터 |

### 주요 UI 컴포넌트

| 컴포넌트 | 데이터 소스 | 표시 |
|---------|-----------|------|
| `DashboardSummary` | useServerStats(servers) | 상태 카드 (online/warning/critical/offline) |
| `ServerCard` / `ImprovedServerCard` | /api/servers/all | 서버별 CPU/Memory/Disk/Network + 상태 |
| `EnhancedServerModal.MetricsTab` | /api/servers/[id] | 게이지 차트 (cpu, memory, disk, network) |
| `EnhancedServerModal.LogsTab` | generateServerLogs() + generateLokiLogs() | 3뷰: Syslog, Alerts, Streams(Loki) |

### 로그 생성 (런타임)

```
server-data-logs.ts: generateServerLogs(metrics, serverId)
├─ 1st Pass: 메트릭 임계값 (cpu>90 → kernel throttle)
├─ 2nd Pass: 서버 역할 컨텍스트 (api+cpu>80 → nginx upstream timeout)
├─ 3rd Pass: 피어 상태 (upstream unhealthy → timeout 로그)
└─ 4th Pass: 정상 상태 (systemd, cron, health check 로그)

loki-log-generator.ts: generateLokiLogs(metrics, serverId, ctx)
└─ syslog → Loki Push API 형식 (labels + timestampNs + line)
```

---

## 5. AI 어시스턴트 데이터 참조

### 컨텍스트 주입 경로

```
MetricsProvider.getAllServerMetrics()
  ↓
MonitoringContext.analyze()
  ├─ AlertManager.evaluate() → 활성 알림 목록
  ├─ MetricsAggregator.aggregate() → 평균, 상위 서버
  └─ HealthCalculator.calculate() → 건강 점수/등급 (A-F)
  ↓
MonitoringContext.getLLMContext() → ~100 토큰 텍스트
  ↓
buildServerContextMessage() (server-context.ts)
  ↓
{ role: 'system', content: '[Monitoring Report - 14:30 KST]\n...' }
```

**AI에 주입되는 컨텍스트 예시** (~100 토큰):

```
[Monitoring Report - 14:30 KST]
System Health: 75/100 (B)
Scrape: node-exporter | 15 targets, 13 UP

Active Alerts (3):
- db-mysql-icn-primary:9100 cpu=95% [CRITICAL]
- api-was-icn-01:9100 memory=82% [WARNING]
- cache-redis-icn-01:9100 memory=89% [WARNING]

By Type: web(3) avg CPU 32% | database(3) avg CPU 65% | cache(2) avg CPU 28%
Top CPU: db-mysql-icn-primary:9100(95%), api-was-icn-01:9100(68%)
```

### Supervisor API → Cloud Run 흐름

1. **Vercel** (`/api/ai/supervisor/route.ts`):
   - 요청 검증 + prompt injection 탐지
   - `buildServerContextMessage()` → 모니터링 컨텍스트 system 메시지로 주입
   - 4턴 이상이면 컨텍스트 압축 (최근 3개 유지)
   - Cloud Run으로 프록시

2. **Cloud Run** (`cloud-run/ai-engine/src/routes/supervisor.ts`):
   - `executeSupervisor()` → Multi-Agent Orchestrator
   - `precomputed-state.ts` → 144슬롯 O(1) lookup (10분 간격)
   - 에이전트 라우팅: NLQ(Cerebras) / Analyst(Groq) / Reporter(Groq) / Advisor(Mistral)

3. **프론트엔드** (`src/hooks/ai/useHybridAIQuery.ts`):
   - 복잡도 기반 라우팅: 단순(≤20) → useChat, 복잡(>45) → Job Queue
   - 스트리밍 응답 → `useAISidebarStore.messages` 저장

---

## 핵심 설계 결정 요약

| 결정 | 이유 | 구현 |
|------|------|------|
| **결정론적 데이터** | 재현 가능한 테스트/AI 학습 | Mulberry32 시드 PRNG |
| **Static JSON Import** | Vercel Serverless fs 접근 불가 | ES6 import → 빌드 번들 |
| **10분 슬롯 단위** | Prometheus scrape interval 표준 | 6 dataPoints/hour |
| **OTel Primary + Prometheus Fallback** | OTel 표준 준수 + 안정성 | MetricsProvider 2-tier |
| **Singleton MetricsProvider** | 일관된 데이터 + 캐시 효율 | getInstance() 패턴 |
| **~100 토큰 AI 컨텍스트** | 토큰 비용 최소화 | getLLMContext() 압축 |
| **Pre-computed 144 슬롯** | Cloud Run O(1) 응답 | precomputed-state.ts |

---

## 핵심 파일 맵

| 레이어 | 파일 | 역할 |
|--------|------|------|
| **생성** | `scripts/data/sync-hourly-data.ts` | Prometheus 데이터 생성 (15서버, 24시간) |
| **OTel 전처리** | `scripts/data/otel-precompute.ts` | Prometheus → OTel 변환 |
| **전처리 헬퍼** | `scripts/data/pipeline-helpers.ts` | 공통 변환 유틸리티 |
| **데이터 원본** | `src/data/hourly-data/hour-XX.json` (24) | Prometheus format SSOT |
| **데이터 로더** | `src/data/hourly-data/index.ts` | Static import, getHourlyData() |
| **OTel 로더** | `src/data/otel-processed/index.ts` | OTel 데이터 로더 |
| **메트릭 SSOT** | `src/services/metrics/MetricsProvider.ts` | Singleton, 2-tier fallback |
| **모니터링 분석** | `src/services/monitoring/MonitoringContext.ts` | Alert + Health + Aggregation |
| **로그 생성** | `src/services/server-data/server-data-logs.ts` | 4-pass 컨텍스트 로그 |
| **Loki 변환** | `src/services/server-data/loki-log-generator.ts` | Loki Push API 형식 |
| **AI 컨텍스트** | `src/app/api/ai/supervisor/server-context.ts` | ~100 토큰 LLM 컨텍스트 |
| **Supervisor API** | `src/app/api/ai/supervisor/route.ts` | Cloud Run 프록시 |
| **대시보드 API** | `src/app/api/dashboard/route.ts` | UnifiedServerDataSource |
| **AI Engine** | `cloud-run/ai-engine/src/data/precomputed-state.ts` | 144슬롯 O(1) lookup |

---

**See Also**:
- 데이터 아키텍처 개요: `data-architecture.md`
- OTel 파이프라인 감사: `otel-pipeline-audit.md`
- 시스템 아키텍처: `../system/system-architecture-current.md`
