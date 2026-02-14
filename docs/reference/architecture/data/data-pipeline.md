# 데이터 파이프라인 아키텍처

> **(data-pipeline-analysis + data-pipeline-comparison 병합)**
> Last verified: 2026-02-14 | Status: Active Canonical

---

## 1. Overview

Prometheus 데이터 생성 → OTel 전처리 → Vercel 대시보드 + Cloud Run AI Engine까지의 전체 흐름.

```
BUILD TIME                         RUNTIME (Vercel)                  CLOUD RUN
─────────────                      ────────────────                  ─────────
sync-hourly-data.ts                Static Import (번들 포함)          precomputed-state.ts
 → hour-XX.json (24개, SSOT)        → MetricsProvider (Singleton)     → 144슬롯 O(1) lookup
otel-precompute.ts                   ├ OTel Primary                   executeSupervisor()
 → resource-catalog.json             └ Prometheus Fallback             → Multi-Agent (4종)
 → otel hourly/hour-XX.json (24)   → API Routes → Dashboard UI
 → timeseries.json                 → MonitoringContext → AI 컨텍스트
```

**15개 한국 DC 서버** (6유형: web/app/db/cache/storage/lb, 서울 ICN + 부산 PUS)
결정론적 Mulberry32 PRNG (seed = hour×10000 + serverIdx×100 + minuteIdx)

---

## 2. Build-Time Generation

### Prometheus 데이터 (`scripts/data/sync-hourly-data.ts`)

- 24개 `hour-XX.json` 생성, 각 6 dataPoints (10분 간격, 총 144슬롯)
- 메트릭 10+개: cpu, memory, disk, network, load1/5, boot_time, procs, response_time, up
- **5개 장애 시나리오** (6단계: normal→pre→onset→peak→sustained→recovery)

| 시간 | 인시던트 | 연쇄 효과 |
|------|---------|----------|
| 02-03시 | DB 백업 I/O + 슬로우쿼리 | DB → API 타임아웃 |
| 07시 | 네트워크 패킷 로스 | Network → LB 과부하 → Web 지연 |
| 12시 | Redis OOM 메모리 누수 | Cache OOM → API 캐시 미스 |
| 21시 | API 요청 급증 | CPU spike → LB 큐잉 |

### OTel 전처리 (`scripts/data/otel-precompute.ts`)

Prometheus → OTel 변환 (ratio ÷100). 주요 매핑:

| Prometheus | OTel Standard | 변환 |
|-----------|---------------|------|
| `node_cpu_usage_percent` | `system.cpu.utilization` | ÷100 |
| `node_memory_usage_percent` | `system.memory.utilization` | ÷100 |
| `node_filesystem_usage_percent` | `system.filesystem.utilization` | ÷100 |
| `node_network_transmit_bytes_rate` | `system.network.io` | passthrough |
| `node_http_request_duration_milliseconds` | `http.server.request.duration` | ÷1000 (초) |

출력: `resource-catalog.json` (7.5KB) + `hourly/hour-XX.json` (24개, ~110KB/개) + `timeseries.json` (~107KB)

---

## 3. Runtime Data Loading (Vercel)

**Static Import**: Vercel Serverless는 런타임 fs 접근 불가 → JSON을 ES6 import로 번들에 포함.

**MetricsProvider** (Singleton SSOT, `src/services/metrics/MetricsProvider.ts`):
1. OTel Data (Primary) → `extractMetricsFromStandard()`
2. Prometheus hourly-data (Fallback) → `targetToServerMetrics()`
3. **4-레벨 캐시**: OTel data, OTel conversion, hourly data, server list

**KST 시간 매핑**: KST 19:30 → hour=19, slotIndex=3 → `hourly-data[19].dataPoints[3]`

**상태 판정**: `system-rules.json` 임계값에서 동적 산출 (critical: CPU/Mem/Disk ≥90, warning: ≥80)

**로그 생성**: `server-data-logs.ts` 4-pass (threshold→role→peer→healthy) + `loki-log-generator.ts` (Loki Push API)

---

## 4. AI Engine Consumption

### 컨텍스트 주입 경로

```
MetricsProvider → MonitoringContext.analyze()
  ├ AlertManager.evaluate() → 활성 알림
  ├ MetricsAggregator → 타입별 평균, Top-5 CPU
  └ HealthCalculator → 점수/등급 (0-100, A-F)
→ getLLMContext() (~100 토큰) → buildServerContextMessage() → system 메시지
→ Cloud Run: precomputed-state.ts (144슬롯 O(1) lookup)
  → executeSupervisor() → NLQ(Cerebras) / Analyst(Groq) / Reporter(Groq) / Advisor(Mistral)
```

**Supervisor 흐름**: Vercel `/api/ai/supervisor` → prompt injection 탐지 + 컨텍스트 주입 + 4턴 이상 42% 압축 → Cloud Run 프록시

---

## 5. Before/After Comparison

```
                         OLD (Custom JSON)   NEW (Prometheus+OTel)   개선률
─────────────────────────────────────────────────────────────────────────
데이터 표준 준수           독자 포맷            Prometheus + OTel      +++
메트릭 풍부도              4개                 10+개                  ×2.5
데이터 재현성              Math.random()       Mulberry32 PRNG        +++
장애 시나리오              없음/단순           5개 × 6단계 진행        +++
AI 컨텍스트 품질           단순 4개 값          종합 리포트 + 트렌드    +++
토큰 효율성                비관리              ~150 토큰 + 42% 압축    ++
데이터 일관성              Vercel/CR 별도 TS    SSOT 단일 파이프라인    +++
런타임 성능                매번 파싱            O(1) 캐시 lookup        ++
상태 판정                  하드코딩 문자열      규칙 기반 동적 산출      +++
─────────────────────────────────────────────────────────────────────────
종합 점수                  4/10                8.5/10                 +112%
```

**전환 타임라인**: Custom JSON (2026-01-19) → Prometheus 전환 (2026-02-04) → OTel 완전 전환 (2026-02-12)

---

## 6. Known Gaps & Roadmap

### 기술적 갭

| 갭 | 영향 | 완화 방법 |
|----|------|----------|
| Vercel/Cloud Run 슬롯 ±1 차이 | AI가 10분 전 데이터 참조 가능 | 양쪽 동일 KST 계산 |
| OTel 반올림 (±0.05%) | 임계값 경계 오차 | 사실상 마진 존재 |
| 알림 히스토리 메모리 기반 (50건) | 장기 트렌드 분석 불가 | PromQL rate + 24h 요약 보완 |
| Resource Catalog 정적 | 서버 추가 시 핫 리로드 불가 | Prometheus fallback 동적 확보 |
| 100% 합성 로그 | AI가 비실제 패턴 참조 가능 | 4-pass 메트릭-로그 일관성 검증 |
| scrape 간격 10분 (표준 15초-1분) | 짧은 spike 감지 불가 | 시뮬레이션 특성상 허용 |

### 로드맵

- **단기**: 서버 다운(`up=0`) 시나리오, 5번째 장애 시나리오 (Disk full) 추가
- **중기**: 시간대별 트래픽 패턴 (출근/점심/퇴근), 로그 연쇄 강화
- **장기**: 히스토그램 메트릭 (p50/p95/p99), counter 리셋 시뮬레이션

---

### 핵심 파일 맵

| 레이어 | 파일 |
|--------|------|
| 데이터 생성 | `scripts/data/sync-hourly-data.ts` |
| OTel 전처리 | `scripts/data/otel-precompute.ts` |
| 데이터 원본 (SSOT) | `src/data/hourly-data/hour-XX.json` (24개) |
| 메트릭 SSOT | `src/services/metrics/MetricsProvider.ts` |
| 모니터링 분석 | `src/services/monitoring/MonitoringContext.ts` |
| AI 컨텍스트 | `src/app/api/ai/supervisor/server-context.ts` |
| Supervisor API | `src/app/api/ai/supervisor/route.ts` |
| AI Engine | `cloud-run/ai-engine/src/data/precomputed-state.ts` |

**See Also**: `data-architecture.md` | `otel-data-architecture.md` | `../system/system-architecture-current.md`
