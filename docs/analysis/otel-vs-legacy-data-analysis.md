# OpenTelemetry (OTel) 데이터 vs 레거시 데이터 비교 분석

> **작성일**: 2026-02-12
> **대상**: OpenManager AI v7.1.5 Data Architecture
> **목적**: OTel 데이터 도입에 따른 데이터 구조 변화 및 장점 분석

---

## 1. 데이터 포맷 비교 (Data Format Comparison)

| 특징 | **1. Fixed Data (Legacy)** | **2. Prometheus (Transitional)** | **3. OpenTelemetry (Current Standard)** |
|---|---|---|---|
| **파일 위치** | `src/data/fixed-24h-metrics.ts` | `src/data/hourly-data/*.json` | `src/data/otel-processed/hourly/*.json` |
| **데이터 구조** | Simple TS Object | Node Exporter JSON | **OTLP Resource Metrics** |
| **메트릭 명명** | `cpu`, `memory` | `node_cpu_usage_percent` | **`system.cpu.utilization`** |
| **값의 범위** | 0 ~ 100 (Integer) | 0 ~ 100 (Integer) | **0.0 ~ 1.0 (Float)** |
| **메타데이터** | Code-level 정의 | `labels` 객체 | **`attributes` + `resource` 계층** |
| **타임스탬프** | `minuteOfDay` (0~1430) | `timestampMs` (Epoch MS) | **`startTimeUnixNano` (Epoch Nano)** |

---

## 2. 주요 차이점 상세 분석

### 2.1 네이밍 규칙 (Semantic Conventions)
가장 큰 변화는 메트릭의 이름이 **벤더 중립적(Vendor-Neutral)**인 OTel 표준으로 변경된 점입니다.

- **Legacy**: `node_cpu_usage_percent` (Prometheus/NodeExporter 종속적)
- **OTel**: `system.cpu.utilization` (표준 규약)
    - 예: `uptime` -> `system.uptime`
    - 예: `disk` -> `system.filesystem.utilization`

### 2.2 정밀도 (Precision) 및 단위
OTel 데이터는 **원시 데이터(Raw Data)**에 더 가깝게 설계되었습니다.

- **변화**: 퍼센트(%) 단위(0-100)에서 비율(Ratio) 단위(0.0-1.0)로 변경되었습니다.
- **이점**:
    - `0.32` (OTel) vs `32` (Legacy)
    - 미세한 리소스 변화(예: 0.1% 단위)를 더 정확하게 표현 가능합니다.
    - AI 분석 시 정규화(Normalization) 과정이 불필요합니다 (이미 0~1 범위).

### 2.3 데이터 구조 (Hierarchical Structure)
OTel 포맷은 데이터를 **시간 슬롯(Slot)** 기반으로 구조화하여 대용량 처리에 최적화되었습니다.

```json
// OTel Structure
"slots": [
  {
    "startTimeUnixNano": 1770130800000000000,
    "metrics": [
      {
        "name": "system.cpu.utilization",
        "dataPoints": [ ... ]
      }
    ]
  }
]
```

반면, 기존 방식은 특정 시점의 **스냅샷(Snapshot)** 방식이었습니다.
```json
// Legacy Structure
"dataPoints": [
  {
    "timestampMs": 1770130800000,
    "targets": { ... }
  }
]
```

### 2.4 메타데이터 (Attributes vs Labels)
- **OTel Attributes**: 데이터 포인트마다 유연하게 태그를 붙일 수 있는 구조 (`host.name`, `cloud.region` 등)
- **의의**: 클라우드 네이티브 환경(Cloud Run, K8s) 정보를 표준화된 키값으로 포함할 수 있어 AIOps 분석 시 **Dimension** 이 풍부해집니다.

---

## 3. 마이그레이션 이점 (Why OTel?)

1.  **AI 모델 친화적**: 0.0~1.0의 Normalized된 데이터는 AI 모델 학습 및 추론에 더 적합합니다.
2.  **표준 호환성**: 추후 실제 운영 환경(Production) 데이터를 가져올 때 변환 비용이 "0"에 수렴합니다.
3.  **확장성**: 사용자 정의 메트릭이나 복잡한 계층(예: Pod > Container > Process) 구조를 표현하기 용이합니다.

---

## 4. 결론

VIBE의 데이터 전략은 **"사람이 읽기 쉬운 데이터(Legacy)"**에서 **"기계와 시스템이 처리하기 최적화된 데이터(OTel)"**로 진화했습니다. 이는 단순 모니터링을 넘어 **AIOps 자동화** 및 **지능형 관제**를 위한 필수적인 기반 공사였습니다.
