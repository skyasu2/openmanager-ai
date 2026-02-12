# Prometheus 포맷 전환 전후 종합 비교 및 평가

**작성일**: 2026-02-12
**프로젝트 버전**: v8.0.0
**목적**: Custom JSON → Prometheus 포맷 전환이 대시보드, AI 어시스턴트, 시뮬레이션 품질에 미친 영향을 종합 평가

> **관련 문서** (본 문서와 상호 보완적):
> - `data-pipeline-analysis.md` — 현재 파이프라인 기술 상세 (flow diagram, 함수 시그니처)
> - `prometheus-comparison.md` — Prometheus best practice vs VIBE 스코어카드
> - `otel-pipeline-audit.md` — OTel 변환 파이프라인 감사

---

## 1. 타임라인 & 배경

```
2026-01-19  OLD Custom JSON 시스템 운용 시작 (fixed-24h-metrics.ts 기반)
     │
     │  ~2주간 Custom JSON 기반 운영
     │  • 15개 서버, 4개 메트릭, Math.random() 난수
     │  • fixed-24h-metrics.ts (258줄) — 하드코딩된 시나리오 데이터
     │
2026-02-04  ★ Prometheus 포맷 전환 (f5f36454a)
     │      feat(metrics): convert hourly-data to Prometheus format
     │      and add monitoring pipeline
     │
     │  ~1주간 Prometheus + 레거시 공존
     │  • hourly-data/*.json → Prometheus format
     │  • fixed-24h-metrics.ts → fallback으로 유지
     │  • sync-hourly-data.ts 신규 (918줄, PRNG 기반)
     │
2026-02-12  ★ OTel Standard 완전 전환 (3a205f9d8)
     │      refactor(vercel): migrate to OTel Standard Format
     │      and remove fixed-24h-metrics
     │
     ▼  현재: Prometheus Primary + OTel 2-tier 운용
```

---

## 2. 데이터 구조 비교 (Before vs After)

| 항목 | OLD (Custom JSON) | NEW (Prometheus + OTel) |
|------|-------------------|-------------------------|
| **포맷** | `servers: { id: { cpu, memory, ... } }` | `targets: { "id:9100": { metrics: { node_cpu_... } } }` |
| **메트릭 수** | 4개 (cpu, memory, disk, network) | 10+개 (+load1, load5, boot_time, procs, response_time, up) |
| **메트릭 범위** | 0-100% 직접 값 | Prometheus 0-100% → OTel 0-1 ratio |
| **서버 ID** | `web-nginx-icn-01` | `web-nginx-icn-01:9100` (Prometheus instance) |
| **라벨** | `type`, `location` (비표준) | `server_type`, `datacenter`, `hostname`, `job` (표준화) |
| **로그** | 서버 JSON에 내장 (구조화 객체) | 분리 — 4-pass 생성 + Loki Push API 형식 |
| **서비스 정보** | `services[]` 배열 포함 | 제거 (node-exporter 범위 밖) |
| **상태 필드** | `status: "online"` 직접 기록 | 임계값에서 동적 산출 (system-rules.json, 5개 우선순위 규칙) |
| **시나리오** | `_pattern: "DB 백업"` API 노출 | `_scenario` 내부 전용, API 미노출 |
| **난수 생성** | `Math.random()` (비결정적) | Mulberry32 시드 PRNG (seed = hour×10000 + serverIdx×100 + minuteIdx) |
| **시간 단위** | 6 dataPoints/hour (10분 간격) | 동일 6 dataPoints/hour (144 슬롯/24h) |
| **OTel 변환** | 없음 | Prometheus → OTel 10개 메트릭 매핑 (ratio ÷100) |
| **Fallback** | `fixed-24h-metrics.ts` (258줄 하드코딩) | OTel Primary → Prometheus Fallback (2-tier) |
| **파일 수** | 1개 (하드코딩 TS) | 24 JSON (hourly-data) + 24 JSON (otel) + resource-catalog + timeseries |
| **장애 시나리오** | 없거나 단순 패턴 | 5개 시나리오 × 6단계 진행 (normal→pre→onset→peak→sustained→recovery) |
| **서버 간 연쇄** | 없음 | DB 슬로우쿼리 → API 타임아웃, Redis OOM → API 에러 |

### Prometheus 메트릭 매핑 상세

| Prometheus (hourly-data) | OTel Standard | Internal Field | 단위 |
|--------------------------|---------------|----------------|------|
| `node_cpu_usage_percent` | `system.cpu.utilization` | `cpu` | % → ratio |
| `node_memory_usage_percent` | `system.memory.utilization` | `memory` | % → ratio |
| `node_filesystem_usage_percent` | `system.filesystem.utilization` | `disk` | % → ratio |
| `node_network_transmit_bytes_rate` | `system.network.io` | `network` | By/s (passthrough) |
| `node_load1` | `system.cpu.load_average.1m` | `loadAvg1` | — |
| `node_load5` | `system.cpu.load_average.5m` | `loadAvg5` | — |
| `node_http_request_duration_milliseconds` | `http.server.request.duration` | `responseTimeMs` | ms → s |
| `node_boot_time_seconds` | `system.uptime` | `bootTimeSeconds` | Unix s |
| `up` | `system.status` | `status` | 0\|1 |
| `node_procs_running` | `system.processes.count` | `procsRunning` | count |

---

## 3. 대시보드 데이터 소비 비교

### OLD 방식

```
fixed-24h-metrics.ts (258줄, 하드코딩)
  → useFixed24hMetrics() hook
  → 60 dataPoints 히스토리 축적 + 1분 보간
  → ServerCard에 직접 표시
```

- `server.status` 필드를 그대로 렌더링 (하드코딩된 상태)
- `server.services[]`에서 서비스 상태 표시 가능
- 로그는 JSON에 포함된 단순 객체 배열 사용
- Hook별 독립 데이터 로딩 → 컴포넌트 간 불일치 가능

### NEW 방식

```
hourly-data/*.json (Prometheus, 24개 파일)
  → Static Import (번들 포함, fs 불필요)
  → MetricsProvider (Singleton SSOT)
     ├─ OTel Primary → extractMetricsFromStandard()
     └─ Prometheus Fallback → targetToServerMetrics()
  → API Routes → Dashboard UI
```

- 상태는 `system-rules.json` 임계값에서 **동적 산출** (5개 우선순위 규칙)
  - critical: CPU ≥90 OR Memory ≥90 OR Disk ≥90 OR Network ≥85
  - warning: CPU ≥80 OR Memory ≥80 OR Disk ≥80 OR Network ≥70
- 서비스 정보 제거 → 순수 메트릭 중심 표시
- 로그는 `server-data-logs.ts` (4-pass 생성) + `loki-log-generator.ts` (Loki 형식, OTel trace 연동)

### 대시보드 소비 변화 평가

| 관점 | OLD | NEW | 개선도 |
|------|-----|-----|--------|
| 데이터 일관성 | Hook별 독립 로딩 | Singleton SSOT (MetricsProvider) | ★★★ |
| 상태 판정 | 하드코딩 (`status: "online"`) | 규칙 기반 (JSON 설정, 5개 우선순위) | ★★★ |
| 캐시 | 없음 | 4-level 캐시 (OTel data/conversion, hourly data, server list) | ★★☆ |
| 확장성 | 15서버 하드코딩 TS | JSON 기반 무제한 (서버 추가 = JSON 편집) | ★★★ |
| 로그 품질 | 단순 템플릿 | 4-pass 컨텍스트 인식 (threshold→role→peer→healthy) | ★★☆ |
| 시간 해상도 | 10분 간격 | 동일 10분, but 144 슬롯 O(1) lookup | ★★☆ |

---

## 4. AI 어시스턴트 데이터 활용 비교

### OLD 방식

```
fixed-24h-metrics.ts → getServer24hData()
  → 단순 메트릭 4개 (cpu/mem/disk/net) 추출
  → 텍스트 포맷팅 → LLM system 메시지
```

- 메트릭 4개만 AI에 제공 (cpu, memory, disk, network)
- 장애 시나리오 이름(`_pattern: "DB 백업"`)이 API 노출 → AI가 "답"을 미리 알 수 있음
- 트렌드 분석 불가 (PromQL 없음, 단일 시점 데이터)
- Cloud Run에서 별도 `fixed-24h-metrics.ts` (667줄) 유지 → Vercel/Cloud Run 데이터 불일치 위험
- 토큰 예산 비관리 → 불필요한 데이터까지 LLM에 전달

### NEW 방식

```
MetricsProvider → MonitoringContext.analyze()
  ├─ AlertManager.evaluate() → 활성 알림 (rules 기반)
  ├─ MetricsAggregator → 타입별 평균, Top-5 CPU
  └─ HealthCalculator → 점수/등급 (0-100, A-F)
  → getLLMContext() (~100 토큰, 압축된 리포트)
  → buildServerContextMessage() → system 메시지 (~150 토큰)
  → Cloud Run: precomputed-state.ts (144슬롯 O(1) lookup)
     ├─ getLLMContext() → 서버 현황 + 알림 + 트렌드
     └─ 24h 트렌드: avg/max CPU, Memory, Disk per server
```

**AI 시스템 메시지 구조 (NEW)**:
```
[Monitoring Report - YYYY-MM-DD HH:MM:SS KST]
System Health: {score}/100 ({grade})
Scrape: node-exporter | {total} targets, {online} UP

Active Alerts ({count}):
- {instance} {metric}={value}% [{severity}, firing {minutes}m]

By Type: {type}({count}) avg CPU {avg}% | ...
Top CPU: {instance}({value}%), ...

[OTel Resource Context]
Schema: OpenTelemetry Semantic Conventions v1.27
Hosts: {count} ({type:count}, ...)

## 24시간 서버 트렌드 요약
- {serverId} ({type}): CPU avg/max, Mem avg/max, Disk avg/max
```

### AI 활용 변화 평가

| 관점 | OLD | NEW | 개선도 |
|------|-----|-----|--------|
| 메트릭 풍부도 | 4개 | 10+개 + 알림 + 건강점수(A-F) | ★★★ |
| 토큰 효율 | 비관리 | ~150 토큰/요청, 4+턴 시 42% 압축 | ★★★ |
| 답 유출 방지 | 시나리오명 노출 (`_pattern`) | 비노출 (`_scenario` 내부 전용) | ★★★ |
| 데이터 일관성 | Vercel/CloudRun 별도 TS 파일 | 동일 SSOT (hourly-data JSON) | ★★★ |
| 트렌드 분석 | 불가 | PromQL rate(1h) + 24h avg/max | ★★☆ |
| Cloud Run 성능 | 매번 TS 파싱/평가 | 144슬롯 O(1) lookup (precomputed) | ★★★ |
| 알림 정보 | 없음 | severity별 정렬, firing 지속시간 포함 | ★★★ |
| 서버 메타데이터 | 없음 | OTel Resource Catalog (type, zone, spec) | ★★☆ |

---

## 5. 시뮬레이션 데이터 적절성 평가

### 강점 (8.5/10)

| 항목 | 상세 |
|------|------|
| **결정론적 재현** | Mulberry32 PRNG (seed = hour×10000 + serverIdx×100 + minuteIdx) → 동일 입력 = 동일 출력 |
| **서버 다양성** | 15개 한국 DC 서버 (6유형: web, app, db, cache, storage, lb), 서울(ICN)+부산(PUS) AZ |
| **장애 시나리오** | 5개 시나리오 × 6단계 진행 (normal→pre→onset→peak→sustained→recovery) |
| **연쇄 장애** | DB 슬로우쿼리 → API 타임아웃, Redis OOM → API 에러, Network loss → LB 과부하 |
| **하드웨어 스펙** | 실제 규격 반영 (web: 4코어/8GB, db: 16코어/64GB, app: 8코어/16GB) |
| **로그 리얼리즘** | 서버 유형별 소스 (MySQL/Redis/nginx/HAProxy), 4-pass 컨텍스트 인식 생성 |
| **응답 시간 증폭** | critical 시 base의 ×20 증폭 (cache 20ms→400ms, app 150ms→3000ms) |
| **Phase 보간** | 6단계 multiplier (0→0.4→0.6→1.0→0.85→0.3) → 자연스러운 장애 곡선 |

### 장애 시나리오 상세

| 시간대 | 시나리오 | 영향 서버 | 연쇄 효과 |
|--------|----------|----------|----------|
| 02-03시 | DB 백업 I/O + 슬로우쿼리 | MySQL primary/replica, API-01 | DB I/O → API 타임아웃 |
| 07시 | 네트워크 패킷 로스 | HAProxy, Nginx-01/02 | Network → LB 과부하 → Web 응답지연 |
| 12시 | Redis OOM 메모리 누수 | Redis-01/02, API-01 | Cache OOM → API 캐시 미스 → 응답 폭주 |
| 21시 | API 요청 급증 | API-01/02, HAProxy | 트래픽 폭주 → CPU spike → LB 큐잉 |

### 약점 & 개선 기회

| 한계 | 현재 상태 | 권장 개선 | 우선순위 |
|------|----------|----------|---------|
| 서버 다운 없음 | 모든 서버 항상 `up=1` | `up=0` + offline 시나리오 추가 | 중 |
| 히스토그램 부재 | p95 단일값만 (`node_http_request_duration_milliseconds`) | p50/p95/p99 percentile 분포 | 낮 |
| 메모리 누수 진행 | 슬롯 단위 phase 전환 (즉시) | 시간 경과에 따른 점진적 메모리 증가 곡선 | 중 |
| 로그 연쇄 부재 | DB↛API 로그 직접 연동 없음 (peer pass 있으나 제한적) | 업스트림 장애 시 다운스트림 로그 자동 생성 강화 | 중 |
| 정상 시간 단조로움 | baseline ±5% 고정 (seededRandom 변동) | 시간대별 트래픽 패턴 (출근/점심/퇴근 부하 곡선) | 낮 |
| counter 리셋 없음 | 카운터 단조증가만 (`node_boot_time_seconds` 고정) | OOM restart 후 카운터 초기화 + boot_time 갱신 | 낮 |
| 5번째 시나리오 미정 | 4개 시나리오만 정의 (5번째 슬롯 비어있음) | Disk full / Storage failover 시나리오 추가 | 낮 |

---

## 6. 남아있는 기술적 갭

| 갭 | 설명 | 영향 | 현재 완화 방법 |
|----|------|------|---------------|
| **시간 동기화** | Vercel vs Cloud Run 슬롯 ±1 차이 가능 (KST 계산 시점 차이) | AI 응답이 10분 전 데이터 참조 가능 | 양쪽 동일 KST 계산 (`(utcMinutes + 540) % 1440`) |
| **OTel 정밀도** | `Math.round(asDouble * 1000) / 10` 반올림 | 79.95% vs 80% 임계값 경계 오차 | 임계값에 사실상 ~0.05% 마진 존재 |
| **알림 히스토리** | 메모리 기반 (50건 제한, AlertManager) | 장기 트렌드 분석 불가 | PromQL rate(1h) + 24h 트렌드 요약으로 보완 |
| **Resource Catalog** | 정적 (빌드 시 1회 생성, `resource-catalog.json`) | 서버 추가/제거 시 핫 리로드 불가 | Prometheus hourly-data fallback으로 서버 목록 동적 확보 |
| **로그 합성** | 100% 생성 데이터 (실제 로그 아님) | AI가 존재하지 않는 에러 패턴 참조 가능 | 4-pass 검증으로 메트릭-로그 일관성 확보 |
| **counter/gauge 미구분** | Prometheus에서 모든 메트릭이 사전 계산된 gauge | 실제 Prometheus의 counter→rate() 패턴 학습 불가 | 교육 목적으로는 충분, production에서는 한계 |
| **scrape 간격** | 10분 (Prometheus 표준 15초-1분 대비 매우 긺) | 짧은 spike 감지 불가 | 시뮬레이션 데이터 특성상 문제 없음 (실제 환경에서는 개선 필요) |

---

## 7. 종합 평가

### 스코어카드

```
                         OLD (Custom)    NEW (Prometheus+OTel)    개선률
───────────────────────────────────────────────────────────────────────
데이터 표준 준수           ✗ 독자 포맷      ✓ Prometheus + OTel     +++
메트릭 풍부도              4개              10+개                   ×2.5
데이터 재현성              ✗ Math.random    ✓ Mulberry32 PRNG       +++
장애 시나리오              없음/단순        5개 × 6단계 진행         +++
AI 컨텍스트 품질           단순 4개 값      종합 리포트 + 트렌드     +++
토큰 효율성                비관리           ~150 토큰 + 42% 압축     ++
데이터 일관성              Vercel/CR 별도   SSOT 단일 파이프라인     +++
런타임 성능                매번 파싱        O(1) 캐시 lookup         ++
확장성                    15서버 하드코딩   JSON 기반 무제한         +++
로그 시스템                내장 단순 템플릿  4-pass + Loki 분리       ++
상태 판정                  하드코딩 문자열  규칙 기반 동적 산출       +++
서버 메타데이터            type/location만  OTel 시맨틱 컨벤션 준수   ++
───────────────────────────────────────────────────────────────────────
종합 점수                  4/10             8.5/10                  +112%
```

### 핵심 아키텍처 결정 요약

| 결정 | 이유 | 결과 |
|------|------|------|
| Mulberry32 PRNG 도입 | 테스트/디버그 재현성 확보 | 동일 seed → 동일 데이터, CI 안정성 |
| Static Import (fs 미사용) | Vercel Serverless 런타임 제약 | 24개 JSON 번들 포함, 빌드 시 확정 |
| 2-Tier Fallback (OTel→Prometheus) | OTel 전환 중 안정성 보장 | OTel 파이프라인 장애 시에도 Prometheus 데이터 제공 |
| 144-슬롯 Pre-compute | Cloud Run AI Engine 지연시간 최소화 | O(1) lookup, 런타임 집계 불필요 |
| 시나리오명 API 비노출 | AI 답 유출 방지 | 순수 메트릭 기반 분석 유도 |
| 4-pass 로그 생성 | 메트릭-로그 일관성 | threshold→role→peer→healthy 순차 검증 |

### 향후 로드맵

1. **단기**: 서버 다운(`up=0`) 시나리오 추가, 5번째 장애 시나리오 정의
2. **중기**: 시간대별 트래픽 패턴 (출근/점심/퇴근), 로그 연쇄 강화
3. **장기**: 히스토그램 메트릭 (p50/p95/p99), counter 리셋 시뮬레이션

---

_Last Updated: 2026-02-12_
