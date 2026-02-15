# 자동 장애 보고서 & 이상탐지 개선 계획서

**작성일**: 2026-01-12
**버전**: v1.0
**대상 버전**: v5.87.0+

---

## 1. 현황 분석

### 1.1 자동 장애 보고서

| 항목 | 현재 상태 | 목표 상태 |
|------|----------|----------|
| **보고서 영속성** | 세션 저장 (새로고침 시 삭제) | Supabase 히스토리 UI 조회 |
| **SLA 추적** | MTTR만 DB에서 계산 | MTTR/MTTA 자동 계산 + 대시보드 표시 |
| **타임라인 시각화** | 데이터 있으나 UI 미구현 | 장애 진행 타임라인 컴포넌트 |

#### 현재 구현된 파일들
```
API:        src/app/api/ai/incident-report/route.ts
UI:         src/components/ai/pages/auto-report/
DB:         src/database/migrations/003_create_incident_reports_table.sql
AI Tools:   cloud-run/ai-engine/src/tools-ai-sdk/incident-report-tools.ts
```

### 1.2 이상탐지

| 항목 | 현재 상태 | 목표 상태 |
|------|----------|----------|
| **트렌드 그래프** | 예측값만 텍스트 표시 | 시계열 차트 (실제값 + 예측선) |
| **이상탐지 시각화** | 탐지 결과만 반환 | 이상 구간 하이라이트 차트 |
| **인터랙션** | 없음 | 시간 범위 선택, 줌/패닝 |

#### 현재 구현된 파일들
```
Backend:    cloud-run/ai-engine/src/lib/ai/monitoring/
Charts:     src/components/shared/MiniLineChart.tsx (미니 차트만)
Data:       src/services/metrics/MetricsProvider.ts
```

---

## 2. 개선 계획

### Phase 1: 장애 보고서 히스토리 UI (우선순위: 높음)

#### 2.1.1 히스토리 조회 페이지

**신규 파일**: `src/components/ai/pages/auto-report/IncidentHistoryPage.tsx`

```typescript
// 주요 기능
- 보고서 목록 테이블 (날짜, 제목, 심각도, 상태)
- 필터링: 기간, 심각도, 상태, 패턴
- 페이지네이션 (10개/페이지)
- 상세 보기 모달
```

**수정 파일**: `src/app/api/ai/incident-report/route.ts`
```typescript
// GET 엔드포인트 확장
GET /api/ai/incident-report?page=1&limit=10&severity=critical&status=open
GET /api/ai/incident-report/stats  // 통계 요약
```

#### 2.1.2 SLA 대시보드 위젯

**신규 파일**: `src/components/dashboard/SLAWidget.tsx`

```typescript
interface SLAWidgetProps {
  period: 'daily' | 'weekly' | 'monthly';
}

// 표시 항목
- 현재 가용률 (99.x%)
- 목표 SLA (99.9%)
- 남은 다운타임 예산
- MTTR 평균
- MTTA 평균 (신규)
```

**DB 수정**: MTTA 계산 함수 추가
```sql
-- 새 컬럼 추가
ALTER TABLE incident_reports ADD COLUMN acknowledged_at TIMESTAMP;

-- MTTA 계산 뷰 수정
CREATE OR REPLACE VIEW incident_statistics AS
SELECT
  ...
  AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60) as avg_mtta_minutes,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_mttr_hours
FROM incident_reports
WHERE acknowledged_at IS NOT NULL;
```

#### 2.1.3 타임라인 시각화 컴포넌트

**신규 파일**: `src/components/ai/pages/auto-report/IncidentTimeline.tsx`

```typescript
interface TimelineEvent {
  timestamp: string;
  event: string;
  severity: 'info' | 'warning' | 'critical';
  icon?: string;
}

// UI: 세로 타임라인 (Vertical Timeline)
// 라이브러리: 직접 구현 (Tailwind)
```

### Phase 2: 이상탐지 트렌드 차트 (우선순위: 높음)

#### 2.2.1 시계열 차트 컴포넌트

**신규 파일**: `src/components/charts/TimeSeriesChart.tsx`

```typescript
interface TimeSeriesChartProps {
  data: MetricDataPoint[];
  predictions?: PredictionDataPoint[];
  anomalies?: AnomalyDataPoint[];
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  timeRange: '1h' | '6h' | '24h' | '7d';
  showPrediction?: boolean;
  showAnomalies?: boolean;
}

// 기능
- 실제값 라인 (실선)
- 예측값 라인 (점선, 신뢰구간 밴드)
- 이상 구간 하이라이트 (빨간 영역)
- 임계값 라인 (warning/critical)
- 줌/패닝 (brush)
- 툴팁
```

**라이브러리**: Recharts (이미 설치됨)

```typescript
import {
  ComposedChart,
  Line,
  Area,
  XAxis, YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  Brush
} from 'recharts';
```

#### 2.2.2 이상탐지 결과 표시 통합

**수정 파일**: `src/components/dashboard/EnhancedServerModal.MetricsTab.tsx`

```typescript
// 기존: 단순 실시간 값만 표시
// 개선: TimeSeriesChart 통합 + 이상탐지 하이라이트

<TimeSeriesChart
  data={metricsHistory}
  predictions={trendPrediction}
  anomalies={detectedAnomalies}
  metric="cpu"
  timeRange="6h"
  showPrediction
  showAnomalies
/>
```

#### 2.2.3 API 확장

**수정 파일**: `src/app/api/ai/raw-metrics/route.ts`

```typescript
// 기존: 현재 메트릭만
// 확장: 히스토리 + 예측 + 이상탐지 결과

GET /api/ai/raw-metrics?serverId=xxx&range=6h&includePrediction=true&includeAnomalies=true

Response: {
  history: MetricDataPoint[],
  prediction: PredictionResult,
  anomalies: AnomalyResult[]
}
```

---

## 3. 파일 변경 목록

### 신규 파일

| 파일 | 설명 |
|------|------|
| `src/components/ai/pages/auto-report/IncidentHistoryPage.tsx` | 보고서 히스토리 페이지 |
| `src/components/ai/pages/auto-report/IncidentTimeline.tsx` | 타임라인 시각화 |
| `src/components/dashboard/SLAWidget.tsx` | SLA 대시보드 위젯 |
| `src/components/charts/TimeSeriesChart.tsx` | 시계열 차트 |
| `src/database/migrations/004_add_mtta_support.sql` | MTTA 컬럼 추가 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/app/api/ai/incident-report/route.ts` | 히스토리 조회, 통계 API |
| `src/app/api/ai/raw-metrics/route.ts` | 예측/이상탐지 데이터 포함 |
| `src/components/ai/pages/auto-report/AutoReportPage.tsx` | 히스토리 탭 추가 |
| `src/components/dashboard/EnhancedServerModal.MetricsTab.tsx` | 시계열 차트 통합 |
| `src/stores/useUnifiedAdminStore.ts` | 보고서 히스토리 상태 |

---

## 4. 구현 순서

```
Week 1: Phase 1 - 장애 보고서 개선
├─ Day 1-2: IncidentHistoryPage + API 확장
├─ Day 3: IncidentTimeline 컴포넌트
├─ Day 4: DB 마이그레이션 (MTTA)
└─ Day 5: SLAWidget + 통합 테스트

Week 2: Phase 2 - 이상탐지 시각화
├─ Day 1-2: TimeSeriesChart 컴포넌트
├─ Day 3: raw-metrics API 확장
├─ Day 4: EnhancedServerModal 통합
└─ Day 5: E2E 테스트 + 배포
```

---

## 5. 기술 상세

### 5.1 TimeSeriesChart 설계

```typescript
// src/components/charts/TimeSeriesChart.tsx

import { memo, useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ReferenceLine, ReferenceArea, Brush,
  ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';

interface MetricDataPoint {
  timestamp: string;
  value: number;
}

interface PredictionDataPoint {
  timestamp: string;
  predicted: number;
  upper: number;  // 95% CI
  lower: number;
}

interface AnomalyDataPoint {
  startTime: string;
  endTime: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface TimeSeriesChartProps {
  data: MetricDataPoint[];
  predictions?: PredictionDataPoint[];
  anomalies?: AnomalyDataPoint[];
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  timeRange: '1h' | '6h' | '24h' | '7d';
  thresholds?: { warning: number; critical: number };
  height?: number;
}

const THRESHOLD_DEFAULTS = {
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 85, critical: 95 },
  network: { warning: 70, critical: 85 },
};

export const TimeSeriesChart = memo(function TimeSeriesChart({
  data,
  predictions,
  anomalies,
  metric,
  timeRange,
  thresholds,
  height = 300,
}: TimeSeriesChartProps) {
  const effectiveThresholds = thresholds ?? THRESHOLD_DEFAULTS[metric];

  const combinedData = useMemo(() => {
    // Merge actual + prediction data
    const merged = [...data];
    if (predictions) {
      predictions.forEach(p => {
        const existing = merged.find(d => d.timestamp === p.timestamp);
        if (existing) {
          Object.assign(existing, p);
        } else {
          merged.push({ timestamp: p.timestamp, value: undefined, ...p });
        }
      });
    }
    return merged.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [data, predictions]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={combinedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="timestamp"
          tickFormatter={(t) => format(new Date(t), 'HH:mm')}
        />
        <YAxis domain={[0, 100]} />
        <Tooltip
          labelFormatter={(t) => format(new Date(t), 'yyyy-MM-dd HH:mm:ss')}
        />

        {/* 임계값 라인 */}
        <ReferenceLine y={effectiveThresholds.warning} stroke="#f59e0b" strokeDasharray="3 3" />
        <ReferenceLine y={effectiveThresholds.critical} stroke="#ef4444" strokeDasharray="3 3" />

        {/* 이상 구간 하이라이트 */}
        {anomalies?.map((anomaly, i) => (
          <ReferenceArea
            key={i}
            x1={anomaly.startTime}
            x2={anomaly.endTime}
            fill={anomaly.severity === 'critical' ? '#ef444433' : '#f59e0b33'}
          />
        ))}

        {/* 예측 신뢰구간 */}
        {predictions && (
          <Area
            dataKey="upper"
            stackId="ci"
            stroke="none"
            fill="#3b82f633"
          />
        )}

        {/* 실제값 라인 */}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="실제값"
        />

        {/* 예측값 라인 */}
        {predictions && (
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="예측값"
          />
        )}

        {/* 시간 범위 선택 */}
        <Brush dataKey="timestamp" height={30} stroke="#8884d8" />
      </ComposedChart>
    </ResponsiveContainer>
  );
});
```

### 5.2 SLA 계산 로직

```typescript
// src/lib/sla/calculator.ts

interface SLAMetrics {
  period: 'daily' | 'weekly' | 'monthly';
  targetUptime: number;          // 99.9
  actualUptime: number;          // 실제 가용률
  totalMinutes: number;          // 기간 총 분
  downtimeMinutes: number;       // 다운타임 분
  remainingBudget: number;       // 남은 예산 (분)
  mttr: number;                  // 평균 복구 시간 (분)
  mtta: number;                  // 평균 인지 시간 (분)
  incidentCount: number;         // 장애 건수
  slaViolation: boolean;
}

const PERIOD_MINUTES = {
  daily: 1440,
  weekly: 10080,
  monthly: 43800,
};

export async function calculateSLAMetrics(
  period: 'daily' | 'weekly' | 'monthly',
  targetUptime = 99.9
): Promise<SLAMetrics> {
  const totalMinutes = PERIOD_MINUTES[period];
  const maxDowntime = totalMinutes * (1 - targetUptime / 100);

  // Supabase에서 데이터 조회
  const { data: stats } = await supabase
    .from('incident_statistics')
    .select('*')
    .eq('period', period)
    .single();

  const downtimeMinutes = stats?.total_downtime_minutes ?? 0;
  const actualUptime = ((totalMinutes - downtimeMinutes) / totalMinutes) * 100;

  return {
    period,
    targetUptime,
    actualUptime,
    totalMinutes,
    downtimeMinutes,
    remainingBudget: Math.max(0, maxDowntime - downtimeMinutes),
    mttr: stats?.avg_mttr_minutes ?? 0,
    mtta: stats?.avg_mtta_minutes ?? 0,
    incidentCount: stats?.incident_count ?? 0,
    slaViolation: actualUptime < targetUptime,
  };
}
```

---

## 6. 테스트 계획

### Unit Tests
```typescript
// tests/components/TimeSeriesChart.test.tsx
- 데이터 렌더링 검증
- 예측 라인 표시 검증
- 이상 구간 하이라이트 검증
- 임계값 라인 표시 검증

// tests/lib/sla-calculator.test.ts
- SLA 계산 정확도
- MTTR/MTTA 계산
- 경계값 테스트
```

### E2E Tests
```typescript
// tests/e2e/incident-history.spec.ts
- 히스토리 페이지 접근
- 필터링 동작
- 상세 보기 모달

// tests/e2e/metrics-chart.spec.ts
- 차트 렌더링
- 시간 범위 변경
- 툴팁 표시
```

---

## 7. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| 대량 히스토리 데이터 | 성능 저하 | 페이지네이션 + 인덱스 최적화 |
| 차트 렌더링 성능 | UI 버벅임 | 데이터 다운샘플링 (1000포인트 제한) |
| MTTA 데이터 없음 | 불완전한 SLA | acknowledged_at 수동 입력 UI 추가 |

---

## 8. 완료 기준

- [x] 장애 보고서 히스토리 UI에서 과거 보고서 조회 가능 ✅ (2026-01-12)
- [x] SLA 위젯에서 MTTR/MTTA 표시 ✅ (2026-01-12)
- [x] 타임라인 시각화 컴포넌트 동작 ✅ (2026-01-12)
- [x] 시계열 차트에서 실제값 + 예측값 + 이상 구간 표시 ✅ (2026-01-12)
- [x] Unit 테스트 추가 ✅ (2026-01-12)
  - TimeSeriesChart.test.tsx
  - useTimeSeriesMetrics.test.ts
  - SLAWidget.test.tsx
- [ ] E2E 테스트 통과 (추후 진행)
- [ ] 성능 기준: 차트 렌더링 < 500ms (추후 측정)

---

_작성: Claude Opus 4.5_
