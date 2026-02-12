# Chart & Graph Architecture Analysis

> OpenManager AI v7.1 차트/그래프 현황 분석 문서
> Last Updated: 2026-02-06

---

## 1. 차트 라이브러리 (package.json)

| 라이브러리 | 버전 | 용도 | 렌더링 |
|-----------|------|------|--------|
| **Recharts** | ^3.6.0 | 풍부한 인터랙션 (예측, 이상치, Brush) | SVG |
| **uPlot** | ^1.6.32 | 고성능 시계열 (Grafana급, 10,000+ 포인트) | Canvas |
| `@xyflow/react` | ^12.10.0 | 노드 기반 플로우 다이어그램 | SVG |
| `@dagrejs/dagre` | ^1.1.8 | 그래프 레이아웃 엔진 | - |

> Canvas 기반: uPlot만. 나머지는 모두 SVG 기반.

---

## 2. 차트 컴포넌트 인벤토리 (13개 파일)

### 2.1 핵심 차트 컴포넌트 (4개)

| 파일 | 라이브러리 | 차트 타입 | 기능 |
|------|-----------|----------|------|
| `src/components/charts/TimeSeriesChart.tsx` | Recharts | Line+Area (Composed) | 예측선, 이상치 영역, 임계값, Brush 줌 |
| `src/components/charts/RealtimeChart.tsx` | uPlot (래퍼) | 시계열 Line | pre-computed JSON 로드 → UPlotTimeSeries 위임 |
| `src/components/charts/uplot/UPlotTimeSeries.tsx` | uPlot | 시계열 Line | 다크모드, auto-resize, 드래그 줌 |
| `src/components/shared/MiniLineChart.tsx` | Recharts (AreaChart) | Sparkline/Area | 서버카드용 미니 차트 (100x30px) |

### 2.2 SVG 직접 구현 (3개)

| 파일 | 시각화 타입 | SVG 요소 |
|------|-----------|----------|
| `src/components/shared/UnifiedCircularGauge.tsx` | 원형 게이지 | `<circle>`, gradient, filter (3D 효과) |
| `src/components/shared/Sparkline.tsx` | 스파크라인 (레거시) | `<polyline>`, `<polygon>` |
| `src/components/dashboard/EnhancedServerModal.components.tsx` | 실시간 영역 차트 | `<polygon>`, `<polyline>`, grid lines |

### 2.3 인프라 (3개)

| 파일 | 역할 |
|------|------|
| `src/components/error/ChartErrorBoundary.tsx` | 차트 렌더링 에러 잡기 + 재시도 UI |
| `__mocks__/recharts.tsx` | Vitest용 Recharts 경량 스텁 |
| `src/types/recharts.d.ts` | Recharts 타입 확장 |

---

## 3. 차트가 사용되는 위치

| 화면 | 컴포넌트 | 사용 차트 | 데이터 소스 |
|------|---------|----------|------------|
| 서버 카드 (대시보드) | `ImprovedServerCard.tsx` | MiniLineChart | `useFixed24hMetrics` 훅 |
| 서버 모달 - Overview | `EnhancedServerModal.OverviewTab` | UnifiedCircularGauge (3D) | ServerMetrics |
| 서버 모달 - Metrics | `EnhancedServerModal.MetricsTab` | TimeSeriesChart + RealtimeChart | `useTimeSeriesMetrics` 훅 |
| 서버 모달 - Network | `EnhancedServerModal.NetworkTab` | RealtimeChart | 네트워크 메트릭 |
| 서버 상세 | `ServerDetailMetrics.tsx` | UnifiedCircularGauge | ServerMetrics |

---

## 4. 데이터 파이프라인

### 4.1 전체 흐름

```
[빌드 타임]
  public/hourly-data/hour-XX.json (24개, Prometheus 형식)
      |  precompute-metrics.ts
      v
  public/processed-metrics/
    ├── timeseries.json (32KB, 15서버 x 144타임스탬프)
    ├── hourly/hour-XX.json (24개, 각 ~5KB)
    └── metadata.json (7KB)

[런타임 - 정적 파일]
  RealtimeChart → fetch('/processed-metrics/timeseries.json')
      |  prometheus-to-uplot.ts 변환
      v
  uPlot 렌더링

[런타임 - API]
  TimeSeriesChart → useTimeSeriesMetrics 훅
      |  fetch('/api/ai/raw-metrics')
      v
  합성 시계열 생성 (히스토리 + 예측 + 이상치)
      |
      v
  Recharts 렌더링
```

### 4.2 핵심 파일

| 파일 | 역할 |
|------|------|
| `scripts/data/precompute-metrics.ts` (245줄) | 빌드 시 hourly-data → processed-metrics 변환 |
| `src/utils/prometheus-to-uplot.ts` (94줄) | Prometheus → uPlot `AlignedData` 변환 (3개 함수) |
| `src/types/processed-metrics.ts` (95줄) | PrecomputedTimeSeries, PrecomputedHourly 타입 |
| `src/hooks/useTimeSeriesMetrics.ts` | API 기반 시계열 데이터 훅 (예측/이상치 포함) |
| `src/hooks/useFixed24hMetrics.ts` | 고정 24h 데이터 훅 (서버카드 미니차트용) |
| `src/constants/chart-colors.ts` | 메트릭별 색상 (CPU=빨강, Memory=파랑, Disk=보라, Network=초록) |

### 4.3 데이터 구조

**uPlot용 (PrecomputedTimeSeries)**:

```typescript
{
  serverIds: string[],
  timestamps: number[],
  metrics: { cpu: number[][], memory: number[][], ... }
}
// → prometheus-to-uplot.ts → [timestamps[], values[]]
```

**Recharts용 (TimeSeriesData)**:

```typescript
{
  history: [{ timestamp, value }],
  prediction?: [{ timestamp, predicted, upper, lower }],
  anomalies?: [{ startTime, endTime, severity }]
}
```

---

## 5. 라이브러리 역할 분담

| 기준 | Recharts | uPlot | SVG 직접 |
|------|----------|-------|---------|
| 사용처 | TimeSeriesChart, MiniLineChart | RealtimeChart | 게이지, 스파크라인 |
| 데이터 규모 | 중간 (~수백 포인트) | 대량 (1,000+ 포인트) | 소량 (~24 포인트) |
| 인터랙션 | Brush 줌, 커스텀 툴팁, 예측 밴드 | 드래그 줌 | 호버 효과 |
| 렌더링 | SVG | Canvas | SVG |
| 성능 | 보통 | Grafana급 | 최고 (최소 DOM) |

---

## 6. 요약

- **총 차트 관련 파일**: 13개
- **차트 라이브러리**: Recharts (풍부한 기능) + uPlot (고성능) 이중 구조
- **SVG 직접 구현**: 게이지, 스파크라인, 모달 내 실시간 차트
- **데이터 파이프라인**: 빌드 시 사전 계산(정적 JSON) + 런타임 API(합성 시계열) 이중 경로
- **Canvas 사용**: uPlot만 (나머지 전부 SVG)
