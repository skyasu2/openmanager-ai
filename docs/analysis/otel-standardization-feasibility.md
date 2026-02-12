# OTel/Prometheus 데이터 포맷 표준화 개선 분석 (Feasibility Study)

> **작성일**: 2026-02-12
> **주제**: 현재 독자 규격인 Prometheus/OTel JSON 데이터를 실제 표준 포맷으로 변환 가능 여부 분석
> **결론**: **"가능함 (Feasible)"** 및 **"강력 추천 (Highly Recommended)"**

---

## 1. 개선 목표 (Target State)

현재 VIBE가 시뮬레이션용으로 사용하는 **커스텀 JSON 파일**들을, 실제 업계 표준인 **OTLP(OpenTelemetry Protocol) JSON**과 **Prometheus HTTP API 응답**으로 교체합니다.

| 데이터 종류 | 현재 (AS-IS) | 목표 (TO-BE) | 설명 |
|---|---|---|---|
| **OTel Metrics** | `metrics: [...]` (Flattened) | **`resourceMetrics: [...]`** (Hierarchical) | OTel Collector의 실제 Export 규격 준수 |
| **Prometheus** | `dataPoints: [...]` (Custom) | **`data: { resultType: "matrix", result: [...] }`** | Grafana가 직접 읽을 수 있는 표준 API 규격 |

---

## 2. 실현 가능성 분석 (Feasibility)

### ✅ 기술적 제약 사항 (Constraints) - 없음
*   **데이터 손실 없음**: 현재 VIBE 데이터(`hour-00.json`)는 이미 필요한 모든 정보(`timestamp`, `value`, `labels`)를 포함하고 있습니다. 단순히 **"그릇(Structure)"만 바꾸면 됩니다.**
*   **용량 증가 미미**: 계층 구조(`resource > scope > metric`)가 추가되지만, Gzip 압축 시 용량 차이는 무시할 수준입니다.

### 🏗️ 개선 작업 범위 (Scope of Work)

#### (1) OTel 데이터 변환 (`src/data/otel-processed`)
*   **작업**: `generate-otel.ts` 스크립트 수정
*   **내용**:
    *   기존: `metrics[]` 배열 생성
    *   변경: `resourceMetrics[]` 구조로 감싸고, `host.name` 같은 공통 속성을 `Resource` 레벨로 올림.
*   **난이도**: ⭐ (하) - 단순 구조 변경

#### (2) Prometheus 데이터 변환 (`src/data/hourly-data`)
*   **작업**: `MetricsProvider.ts` 내의 `getHourlyData` 로직 수정 또는 변환 어댑터 추가
*   **내용**:
    *   현재의 `dataPoints` 배열을 Prometheus의 `Matrix` 타입(`[timestamp, value]`)으로 변환.
*   **난이도**: ⭐⭐ (중) - 타임스탬프 포맷(ms -> sec) 및 구조 매핑 필요

---

## 3. 강력 추천 이유 (Why do this?)

이 개선을 진행하면 다음과 같은 **결정적인 이점**이 있습니다.

1.  **"진짜" 대시보드 연동 가능**:
    *   지금은 VIBE 전용 UI만 데이터를 읽을 수 있습니다.
    *   표준 포맷으로 바꾸면, 이 JSON 파일을 그대로 **Grafana Import** 하거나 **실제 Prometheus**에 `Remote Write` 할 수 있습니다.

2.  **AI 학습 데이터로서의 가치 상승**:
    *   AI가 "VIBE 전용 포맷"을 배우는 것이 아니라, "전 세계 공통 포맷"을 배우게 됩니다.
    *   VIBE에서 학습한 AI 모델을 그대로 떼어다가 실제 운영 서버에 붙여도 동작합니다. **(Real-World Portability)**

3.  **코드의 간결성**:
    *   `ServerDataTransformer.ts` 등에서 수행하던 복잡한 데이터 정규화 로직이 필요 없어집니다. (표준 포맷 자체가 정규화되어 있음)

---

## 4. 실행 계획 (Action Plan)

사용자 승인 시, 다음 순서로 즉시 진행할 수 있습니다.

1.  **Phase 1**: `src/types/otel-standard.ts` 등 **표준 타입 정의** 파일 생성 (OTLP 공식 스펙 기반)
2.  **Phase 2**: `scripts/transform-to-standard.ts` 컨버터 작성 (기존 데이터 → 표준 데이터 변환)
3.  **Phase 3**: `MetricsProvider`가 표준 데이터를 읽도록 로직 수정

---

## 5. 결론

**"당연히 해야 합니다."**

지금까지는 "시뮬레이션 구현"에 집중했다면, 이제는 "데이터 리얼리티"를 완성할 때입니다. 이 작업은 VIBE를 단순 시뮬레이터에서 **"오프라인 AIOps 연구 플랫폼"**으로 격상시키는 핵심 키가 될 것입니다.
