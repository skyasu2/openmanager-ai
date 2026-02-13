# Prometheus 마이그레이션 Changelog

> Status: Historical
> Current canonical docs: `docs/README.md`, `docs/reference/README.md`
> Note: 본 문서는 작성 시점 기준 분석/리뷰 기록입니다.

> **작성일**: 2026-02-06
> **범위**: 2026-02-04 ~ 2026-02-06 (3일간 마이그레이션)
> **목적**: 파일 단위 변경 인벤토리 (추가/삭제/변경 목록)

---

## 1. 개요

Custom JSON → Prometheus 호환 형식으로의 데이터 마이그레이션. 24시간 시나리오 데이터(72개 JSON), 모니터링 파이프라인, PromQL 엔진을 도입하고, 레거시 서비스 3개를 제거했다.

### 핵심 커밋 타임라인

| 날짜 | 커밋 | 유형 | 설명 |
|------|------|------|------|
| 02-04 | `f5f36454a` | feat | hourly-data Prometheus 형식 변환 + 모니터링 파이프라인 추가 |
| 02-04 | `a6407ab0c` | feat | uPlot 차트, PromQL 엔진, pre-compute 파이프라인 |
| 02-04 | `dcd8d5410` | refactor | 테스트 추가, 파이프라인 헬퍼 분리, null guard |
| 02-05 | `aac001a96` | refactor | dead code 제거, deprecated API 삭제, 임계값 SSOT 통합 |
| 02-05 | `1fccdf298` | fix | 하드코딩 값 → Prometheus 데이터 사용 |
| 02-06 | `4be396b03` | refactor | 전체 API route에서 getMockSystem → MetricsProvider 교체 |
| 02-06 | `85277fa8a` | security | PromQL 쿼리 길이/복잡도 제한 추가 |

**총 관련 커밋**: 14개 (전체 48개 중) | **변경 규모**: ~387,000줄 (삽입+삭제)

---

## 2. 데이터 형식 변경

| 항목 | Before (Custom JSON) | After (Prometheus) |
|------|---------------------|-------------------|
| 메트릭 수 | 4개 (cpu, memory, disk, network) | 10개 (node_exporter 호환) |
| 상태 판정 | JSON 내 `status` 필드 | `up` 메트릭 (0\|1) + 실시간 계산 |
| 가동시간 | 하드코딩 | `node_boot_time_seconds` 기반 |
| 하드웨어 메타 | 없음 | labels (cpu_cores, memory_total 등) |
| 파일 크기 | ~90KB/파일 | ~93KB/파일 (+2.9%) |

**신규 메트릭**: `node_load1`, `node_load5`, `node_boot_time_seconds`, `node_procs_running`, `up`, `node_http_request_duration_milliseconds`

> 상세 스키마 비교 → [prometheus-migration-improvements.md](./prometheus-migration-improvements.md#2-데이터-스키마-비교)

---

## 3. 신규 도입 파일

### 3.1 프로덕션 코드 (9개, 1,751줄)

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `src/lib/promql/promql-engine.ts` | 466 | PromQL 파서 + 쿼리 실행 엔진 |
| `src/services/monitoring/AlertManager.ts` | 152 | 임계값 기반 알림 생성/에스컬레이션 |
| `src/services/monitoring/HealthCalculator.ts` | 86 | 집계 메트릭 → 서버 건강 상태 계산 |
| `src/services/monitoring/MetricsAggregator.ts` | 131 | 원시 Prometheus 메트릭 집계 |
| `src/services/monitoring/MonitoringContext.ts` | 244 | 모니터링 파이프라인 중앙 조율 |
| `src/components/charts/uplot/UPlotTimeSeries.tsx` | 238 | µPlot 시계열 차트 컴포넌트 |
| `src/types/processed-metrics.ts` | 95 | 처리된 메트릭 타입 정의 |
| `src/utils/prometheus-to-uplot.ts` | 94 | Prometheus → µPlot 데이터 변환 |
| `scripts/data/precompute-metrics.ts` | 245 | 빌드 시 메트릭 사전 계산 스크립트 |

### 3.2 테스트 코드 (5개, 1,933줄)

| 파일 | 줄 수 | 대상 |
|------|------:|------|
| `src/lib/promql/promql-engine.test.ts` | 757 | PromQL 파서, 평가기, 엣지케이스 |
| `src/services/monitoring/monitoring-pipeline.test.ts` | 566 | 모니터링 파이프라인 통합 |
| `src/services/metrics/cycle-engine.test.ts` | 257 | 24시간 주기 경계 감지, 보간 |
| `src/services/metrics/MetricsProvider.edge-cases.test.ts` | 180 | 누락 데이터, 장애, 이상치 |
| `src/services/metrics/MetricsProvider.time-comparison.test.ts` | 173 | 시간대 비교 (현재 vs 과거) |

### 3.3 데이터 파일

| 경로 | 파일 수 | 용량 |
|------|--------:|-----:|
| `src/data/hourly-data/hour-00.json` ~ `hour-23.json` | 24 | 2.3MB |
| `public/hourly-data/hour-00.json` ~ `hour-23.json` | 24 | 2.3MB |
| `cloud-run/ai-engine/data/hourly-data/` | 24 | 2.3MB |
| `src/data/hourly-data/index.ts` | 1 | 191줄 |
| `src/data/hourly-data/hourly-data-schema.test.ts` | 1 | 178줄 |

### 3.4 설정 파일

| 파일 | 줄 수 | 역할 |
|------|------:|------|
| `src/config/rules/system-rules.json` | 141 | 임계값 SSOT (경고/위험 기준) |
| `src/config/rules/loader.ts` | 382 | JSON 폴백 + Supabase 규칙 로더 |

---

## 4. 제거/폐기 목록

### 4.1 삭제된 서비스 파일 (3개)

| 파일 | 사유 |
|------|------|
| `src/services/ScalingSimulationEngine.ts` | Prometheus 기반 모니터링으로 대체 |
| `src/services/simulationEngine.ts` | 레거시 시뮬레이션 엔진 제거 |
| `src/services/unified-data-service.ts` | 새 모니터링 서비스로 대체 |

### 4.2 삭제된 테스트/기타 (4개)

| 파일 | 사유 |
|------|------|
| `tests/ai-sidebar/MemoryManagement.test.ts` | 대상 코드 제거에 따른 정리 |
| `tests/api/servers.integration.test.ts` | API 구조 변경으로 재작성 |
| `tests/manual/test-curve-validation.ts` | 수동 테스트 코드 정리 |
| `tests/manual/test-mock-data.ts` | 수동 테스트 코드 정리 |

### 4.3 제거된 코드 패턴

| 패턴 | 설명 |
|------|------|
| `getMockSystem()` | 모든 API route에서 제거, MetricsProvider로 교체 |
| `mockServerData` | 하드코딩 mock 데이터 참조 제거 |
| `scenario-loader.ts` | 시나리오 로더 삭제 (데이터 직접 접근으로 전환) |

---

## 5. 변경된 기존 파일

### 5.1 핵심 서비스

| 파일 | 줄 수 | 변경 내용 |
|------|------:|----------|
| `src/services/metrics/MetricsProvider.ts` | 665 | cycle-engine 통합, Prometheus 파싱 추가, 싱글톤 리팩토링 |
| `src/services/data/UnifiedServerDataSource.ts` | 397 | 새 모니터링 파이프라인 연동 |
| `src/services/metrics/cycle-engine.ts` | 285 | 24시간 주기 보간 엔진 (대규모 수정) |
| `src/data/fixed-24h-metrics.ts` | - | 폴백 데이터 유지, Prometheus 형식과 호환되도록 조정 |

### 5.2 API Routes (7개 마이그레이션)

| Route | 변경 내용 |
|-------|----------|
| `src/app/api/servers/next/route.ts` | getMockSystem → MetricsProvider |
| `src/app/api/servers/all/route.ts` | getMockSystem → UnifiedServerDataSource |
| `src/app/api/servers-unified/route.ts` | MetricsProvider + UnifiedServerDataSource 이중 사용 |
| `src/app/api/metrics/route.ts` | PromQL 호환 POST API 추가 |
| `src/app/api/metrics/current/route.ts` | UnifiedServerDataSource (30s 캐시) |
| `src/app/api/dashboard/route.ts` | UnifiedServerDataSource + getServerMetricsFromUnifiedSource |
| `src/app/api/cache/route.ts` | unified-cache + MetricsProvider |

### 5.3 UI 컴포넌트 (영향 최소)

프론트엔드는 `ServerMetrics` 인터페이스 유지로 **시각적/기능적 변경 없음**. 내부 데이터소스만 교체.

---

## 6. API 엔드포인트 데이터소스 변경

| 엔드포인트 | Before | After | 캐시 |
|-----------|--------|-------|------|
| `/api/servers/all` | getMockSystem | UnifiedServerDataSource | ISR 5분 |
| `/api/servers/[id]` | getMockSystem | MetricsProvider | - |
| `/api/servers/next` | getMockSystem | MetricsProvider | - |
| `/api/servers-unified` | getMockSystem | MetricsProvider + UnifiedServerDataSource | - |
| `/api/metrics` | 없음 (신규) | MetricsProvider (PromQL) | - |
| `/api/metrics/current` | getMockSystem | UnifiedServerDataSource | CDN 30s |
| `/api/dashboard` | getMockSystem | UnifiedServerDataSource | CDN 30s |
| `/api/cache` | 직접 캐시 | unified-cache + MetricsProvider | - |
| `/api/ai/raw-metrics` | 없음 (신규) | hourly-data 직접 읽기 | 10분 폴백 |
| `/api/ai/supervisor` | Cloud Run | Cloud Run (변경 없음) | session 기반 |
| `/api/health` | 개별 체크 | Supabase + Cache + Cloud Run | 60s |

**검증**: `getMockSystem` 또는 `mockServerData` 잔존 사용처 = **0개**

---

## 7. 임계값/규칙 통합

### SSOT: `src/config/rules/system-rules.json`

```
cpu/memory/disk  → warning: 80%, critical: 90%
network          → warning: 70%, critical: 85%
responseTime     → warning: 2000ms, critical: 5000ms
```

### 소비처

| 소비자 | 접근 방식 |
|--------|----------|
| Dashboard (MetricsProvider) | `RulesLoader.getInstance()` → JSON 폴백 |
| AI Engine (Cloud Run) | `precomputed-state.ts`에 임베드 |
| 모니터링 파이프라인 | AlertManager → RulesLoader |
| API Routes (전체) | MetricsProvider 경유 |

### 보안 제한 (commit `85277fa8a`)

| 항목 | 제한값 |
|------|--------|
| PromQL 쿼리 길이 | 512자 |
| label matcher 수 | 10개 |
| RegExp 패턴 | 검증 후 실행 |

---

## 8. 관련 문서

| 문서 | 초점 | 본 문서와의 관계 |
|------|------|-----------------|
| [prometheus-migration-improvements.md](./prometheus-migration-improvements.md) | Before/After 기술 분석, 성능 비교 | 스키마 상세 → 해당 문서 참조 |
| [prometheus-implementation-analysis.md](./prometheus-implementation-analysis.md) | 구현 완료 검증, 체크리스트 | 검증 결과 → 해당 문서 참조 |
| [dashboard-vs-ai-data-flow.md](./dashboard-vs-ai-data-flow.md) | Dashboard ↔ AI 데이터 일관성 | 데이터 흐름 상세 → 해당 문서 참조 |

---

_Last Updated: 2026-02-06_
