# Prometheus Best Practice vs OpenManager VIBE 비교 분석

> **작성일**: 2026-02-06
> **대상 버전**: OpenManager VIBE v7.1.0
> **목적**: VIBE의 Prometheus 스타일 데이터 모델이 실제 베스트 프랙티스와 얼마나 유사한지 평가

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

### 2.1 실제 node_exporter 네이밍 규칙

Prometheus 표준: `[namespace]_[subsystem]_[name]_[unit]`
- 단위는 **기본 단위** 사용: `seconds` (not ms), `bytes` (not MB), `ratio` (not percent)
- Counter에는 `_total` 접미사 필수

### 2.2 항목별 비교

| VIBE 메트릭 | 실제 node_exporter | 타입 | 차이점 |
|------------|-------------------|------|--------|
| `node_cpu_usage_percent` | `node_cpu_seconds_total` | counter | **이름/타입/단위 모두 다름**. 실제는 모드별 누적 초, `rate()`로 사용률 계산 |
| `node_memory_usage_percent` | `node_memory_MemAvailable_bytes` | gauge | **단위 다름**. 실제는 bytes, `1 - avail/total`로 비율 계산 |
| `node_filesystem_usage_percent` | `node_filesystem_avail_bytes` | gauge | **단위 다름**. 실제는 bytes + `mountpoint`,`fstype` label |
| `node_network_transmit_bytes_rate` | `node_network_transmit_bytes_total` | counter | **타입 다름**. 실제는 누적 counter, `rate()`로 속도 계산 |
| `node_load1` | `node_load1` | gauge | **동일** |
| `node_load5` | `node_load5` | gauge | **동일** |
| `node_boot_time_seconds` | `node_boot_time_seconds` | gauge | **동일** |
| `node_procs_running` | `node_procs_running` | gauge | **동일** |
| `node_http_request_duration_milliseconds` | (비표준) | — | **존재하지 않음**. node_exporter는 HTTP 메트릭 미제공 |
| `up` (0\|1) | `up` | gauge | **동일** |

### 2.3 핵심 격차

**VIBE는 "PromQL 계산 결과"를 저장하고, Prometheus는 "원본 counter/gauge"를 저장한다.**

```
실제 Prometheus 흐름:
  node_cpu_seconds_total{mode="idle"} = 123456.78  (counter, 계속 증가)
    → PromQL: rate(...[5m])  → 0.32  (초당 idle CPU 시간)
    → 100 - (... * 100)     → 68%   (CPU 사용률)

VIBE 흐름:
  node_cpu_usage_percent = 68  (이미 계산된 최종 값)
```

> 이 격차를 교육적으로 해소하기 위해 `PROMETHEUS_METRIC_REFERENCE` 매핑을 추가함.
> → `src/data/hourly-data/index.ts`

---

## 3. Label 구조 비교

### 3.1 자동 레이블 (표준 준수 여부)

| Label | Prometheus 표준 | VIBE | 평가 |
|-------|---------------|------|------|
| `instance` | `host:port` 자동 부여 | `web-nginx-icn-01:9100` | 완벽 |
| `job` | `job_name` 설정에서 | `node-exporter` | 완벽 |

### 3.2 Custom 레이블

| VIBE Label | Prometheus 관행 | 평가 |
|-----------|----------------|------|
| `hostname` (FQDN) | 보통 `instance`에서 추출 | 중복이나 편의성 OK |
| `datacenter` | 표준 custom label | 완벽 |
| `environment` | 표준 custom label | 완벽 |
| `server_type` | 비표준 (보통 `role` 또는 `tier`) | 이름만 다름 |
| `os`, `os_version` | `node_uname_info` metric label로 제공 | 위치만 다름 |

### 3.3 누락된 표준 요소

실제 node_exporter에 있으나 VIBE에 없는 것:
- `node_uname_info{sysname, release, version, machine, nodename, domainname}`
- Filesystem label: `device`, `mountpoint`, `fstype`
- Network label: `device` (eth0, lo 등)
- CPU label: `cpu` (코어 번호), `mode` (idle, user, system...)

---

## 4. 데이터 모델 비교

### 4.1 아키텍처 패턴

| 항목 | Prometheus 표준 | VIBE |
|------|---------------|------|
| 수집 방식 | **Pull** (서버가 target에서 가져옴) | **Static** (빌드 시 JSON 번들) |
| 저장소 | TSDB (시계열 DB) | 24개 JSON 파일 (메모리) |
| 쿼리 언어 | PromQL | 없음 (직접 매핑) |
| 갱신 주기 | 15초 (권장) | 10분 (고정) |
| 데이터 보존 | 15일 기본 | 24시간 순환 |
| Counter 지원 | rate, increase 계산 가능 | 누적값 없음 |

### 4.2 VIBE의 설계 의도와 타당성

VIBE는 **데모/교육용 시뮬레이션 플랫폼**으로, 이 설계는 의도적 선택:

| VIBE의 선택 | 이유 | 타당한가? |
|------------|------|:--------:|
| 사전 계산된 % | PromQL 엔진 불필요 | O |
| 10분 간격 | hourly-data 파일 크기 제약 | O |
| JSON 번들 | Vercel Serverless (fs 없음) | O |
| 24시간 순환 | 시나리오 기반 데모 | O |

---

## 5. Scrape 설정 비교

### 5.1 scrapeConfig

| 설정 | Prometheus 권장 | VIBE |
|------|---------------|------|
| `scrape_interval` | **15초** | 10분 |
| `evaluation_interval` | scrape_interval과 동일 | 10분 |
| `scrape_timeout` | interval의 80-90% | 없음 |

### 5.2 서비스 디스커버리

| 방식 | Prometheus 표준 | VIBE |
|------|---------------|------|
| Static Config | `static_configs.targets` | targets 객체 키로 사용 |
| File SD | `file_sd_configs` | 없음 |
| Kubernetes SD | `kubernetes_sd_configs` | 없음 |
| Consul SD | `consul_sd_configs` | 없음 |
| Relabel | `relabel_configs` | 없음 |

---

## 6. Alert 임계값 비교

| 리소스 | VIBE warning | VIBE critical | Prometheus 권장 warning | Prometheus 권장 critical |
|--------|:-----------:|:------------:|:---------------------:|:----------------------:|
| CPU | 80% | 90% | 80% (10분 지속) | 95% (5분 지속) |
| Memory | 80% | 90% | 90% 사용 (2분) | OOM Kill 감지 |
| Disk | 80% | 90% | 24h 내 풀 예측 | 90% 사용 |
| Network | 70% | 85% | 80% 대역폭 | 95% 대역폭 |

**평가**: VIBE 임계값은 업계 표준과 매우 유사.
다만 Prometheus는 `for` 지속시간 조건이 핵심인데, VIBE에도 `for` 필드를 추가하여 이 개념을 반영함.
→ `src/config/rules/system-rules.json`

---

## 7. 잘한 점 (Best Practice 준수)

1. **`instance:port` 포맷** — Prometheus 표준 그대로
2. **`job: "node-exporter"`** — 정확한 job naming
3. **`up` 메타 메트릭** — 서버 alive 상태 표준 표현
4. **`node_load1/5`**, **`node_procs_running`**, **`node_boot_time_seconds`** — 이름 동일
5. **Custom label 활용** — `datacenter`, `environment` 표준 관행
6. **NodeInfo 분리** — 정적 하드웨어 정보를 별도 객체로 관리 (Prometheus `_info` metric 패턴 유사)
7. **JSON 기반 Rules** — Prometheus alerting rules YAML과 구조적으로 유사
8. **상태 판정 우선순위** — statusRules의 priority 기반 판정은 Prometheus alerting의 severity 체계와 유사

---

## 8. 개선 사항 (이번 작업에서 반영됨)

### 8.1 PromQL 원본 참조 매핑 추가

각 VIBE 메트릭이 실제 Prometheus에서 어떤 원본 메트릭과 PromQL 식에 해당하는지 `PROMETHEUS_METRIC_REFERENCE` 매핑으로 기록.

```typescript
// src/data/hourly-data/index.ts
import { PROMETHEUS_METRIC_REFERENCE } from '@/data/hourly-data';

const ref = PROMETHEUS_METRIC_REFERENCE['node_cpu_usage_percent'];
// ref.realMetric      → "node_cpu_seconds_total"
// ref.promqlExpression → "100 - (avg by(instance)(rate(...))*100)"
// ref.metricType       → "counter"
// ref.baseUnit         → "seconds (cumulative)"
```

### 8.2 `for` 지속시간 개념 추가

`system-rules.json`의 statusRules에 Prometheus alerting의 `for` 개념 추가:

```json
{
  "name": "critical_cpu_memory",
  "condition": "CPU >= critical AND Memory >= critical",
  "resultStatus": "critical",
  "priority": 1,
  "for": "5m"
}
```

`ServerStatusRule` 타입 정의도 함께 업데이트.

---

## 9. 결론

**OpenManager VIBE는 Prometheus의 "외형(naming, label, structure)"을 충실히 모방하되, "내부 동작(counter→rate, TSDB, PromQL)"은 의도적으로 생략한 교육용/데모용 아키텍처.**

| 관점 | 평가 |
|------|------|
| 포트폴리오/데모 목적 | **충분히 적합** — Prometheus를 이해하고 있음을 보여줌 |
| 실서비스 모니터링 | 부적합 — counter, PromQL, 실시간 scrape 필요 |
| 교육 목적 | **개선됨** — `PROMETHEUS_METRIC_REFERENCE` 매핑으로 원본 참조 가능 |

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `public/hourly-data/hour-*.json` | Prometheus 스타일 JSON (24개) |
| `src/data/hourly-data/index.ts` | 타입 정의 + `PROMETHEUS_METRIC_REFERENCE` 매핑 |
| `src/services/metrics/MetricsProvider.ts` | 데이터 변환 & 캐싱 |
| `src/config/rules/system-rules.json` | Alert 임계값 + `for` 지속시간 (SSOT) |
| `src/config/rules/types.ts` | `ServerStatusRule` 타입 (for 필드 포함) |
| `src/config/rules/loader.ts` | 상태 판정 로직 + AI 요약 생성 |
| `src/services/data/UnifiedServerDataSource.ts` | Server 타입 변환 |
| `src/services/server-data/server-data-loader.ts` | Scenario 데이터 로더 |

## 관련 문서

- [ADR-003: PromQL vs JS Array Filtering](../decisions/adr-003-promql-vs-js-array-filtering.md) — 쿼리 전략 적합성 분석
