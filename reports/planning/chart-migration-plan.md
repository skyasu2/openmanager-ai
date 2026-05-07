# Chart Migration Plan: Recharts → SVG Sparkline + Nivo

> Owner: project
> Status: Approved
> Doc type: How-to
> Last reviewed: 2026-05-07
> Canonical: reports/planning/chart-migration-plan.md
> Tags: charts,recharts,nivo,refactoring,frontend

## 배경

서버 모니터링 대시보드에서 Recharts(7.7MB node_modules)를 2개 컴포넌트에만 사용 중.
사용 규모 대비 번들 부담이 크고, 모니터링 특화 기능(Canvas 렌더, 실시간 성능, 정밀 커스터마이징)이 부족.

### 현재 Recharts 사용 현황

| 컴포넌트 | 위치 | 사용 Recharts API | 사용처 |
|---------|------|------------------|--------|
| `MiniLineChart` | `src/components/shared/MiniLineChart.tsx` | `AreaChart`, `Area`, `Tooltip`, `YAxis` | `ImprovedServerCard.parts.tsx` — 서버 카드 스파크라인 (72×40px) |
| `TimeSeriesChart` | `src/components/charts/TimeSeriesChart.tsx` | `ComposedChart`, `Line`, `Area`, `ReferenceArea`, `ReferenceLine`, `Brush`, `Tooltip`, `XAxis`, `YAxis`, `Legend`, `ResponsiveContainer` | `EnhancedServerModal.MetricsTab.tsx` — 서버 상세 모달 차트 |

---

## 마이그레이션 전략

### Part 1: MiniLineChart → 순수 SVG Sparkline

**이유**: 72×40px 스파크라인에 Recharts 전체 스택은 오버킬. 순수 SVG path 그리기로 동일 결과, 번들 크기 0 추가.

**구현 방식**:
- `data[]` → 0~100 범위 Y 정규화 → `polyline points` 또는 `path d` 계산
- 색상, 채우기(Area), strokeWidth Props 유지 (기존 Props API 호환)
- 애니메이션: CSS `stroke-dasharray` 애니메이션으로 대체 (optional)
- 툴팁: `title` 엘리먼트 또는 간단한 hover div

**제거 가능**: `MiniLineChart` 마이그레이션 완료 후 `AreaChart`, `Area`, `YAxis` import 제거.

---

### Part 2: TimeSeriesChart → Nivo Line

**이유**: 복잡한 다중 레이어(실제값 + 예측 + 이상 구간 + 임계값 + Brush)가 필요한 전문 차트. Nivo는 SVG 기반, React 네이티브, 커스터마이징 자유도 최고.

**Nivo 선택 근거**:
| 항목 | Recharts | **Nivo** | ECharts |
|------|----------|---------|---------|
| 번들(tree-shaking) | ~350KB | **~120KB (line 모듈만)** | ~1MB |
| SVG/Canvas | SVG | **SVG** | Canvas |
| 이상 구간 하이라이트 | `ReferenceArea` (제한적) | **레이어 자유 삽입** | 복잡 |
| 임계값 라인 | `ReferenceLine` | **markers 또는 레이어** | 복잡 |
| 신뢰구간 밴드 | Area 이중 사용 (해킹) | **`areaBaselineValue` + 레이어** | 별도 |
| 테마 연동 | 수동 | **Tailwind CSS 변수 주입 가능** | 별도 |
| TypeScript | ✅ | ✅ | ✅ |

**설치**:
```bash
npm install @nivo/line @nivo/core
```

**마이그레이션 매핑**:

| 현재 (Recharts) | 대상 (Nivo) |
|----------------|------------|
| `ComposedChart` + `Line` | `ResponsiveLine` |
| `Area` (신뢰구간 밴드) | custom layer — `areaLayer` |
| `ReferenceArea` (이상 구간) | custom layer — `markersLayer` |
| `ReferenceLine` (임계값) | `markers` prop |
| `Brush` | `Nivo SliceTooltip` + 별도 range selector |
| `Tooltip` | `tooltip` prop + custom component |
| `XAxis`/`YAxis` | `axisBottom`/`axisLeft` |
| `Legend` | `legends` prop |
| `ResponsiveContainer` | `ResponsiveLine` 자체 포함 |

---

## 작업 범위

### Task 1: SVG Sparkline 구현 (MiniLineChart 교체)
- [ ] `src/components/shared/SvgSparkline.tsx` 신규 작성
  - Props: `data: number[]`, `width`, `height`, `color`, `fill`, `strokeWidth`, `showTooltip`, `disableAnimation`, `showLabels` (기존 MiniLineChart와 동일)
  - 구현: SVG `path` d 계산 (`M`, `L` 명령), 채우기 `area path` 계산
  - 테스트: `SvgSparkline.test.tsx`
- [ ] `ImprovedServerCard.parts.tsx` — import를 `SvgSparkline`으로 교체
- [ ] `MiniLineChart.tsx` 삭제 (테스트, stories 포함)
- [ ] `recharts.d.ts` 삭제 여부 확인 (TimeSeriesChart 마이그레이션 후)

### Task 2: Nivo Line 설치 및 TimeSeriesChart 교체
- [ ] `npm install @nivo/line @nivo/core`
- [ ] `src/components/charts/NivoTimeSeriesChart.tsx` 작성
  - Props API: 기존 `TimeSeriesChartProps`와 동일하게 유지
  - 기능: 실제값 라인, 예측값 라인(점선), 신뢰구간 밴드, 이상 구간 하이라이트, 임계값 라인, 툴팁
  - Brush 제거 또는 범위 슬라이더로 대체 (Nivo 미지원)
- [ ] `EnhancedServerModal.MetricsTab.tsx` — import 교체
- [ ] `TimeSeriesChart.tsx` 삭제 (테스트 포함, 단 `ChartErrorBoundary` 유지)
- [ ] `recharts` 패키지 `npm uninstall recharts`

### Task 3: 검증
- [ ] `type-check` 통과
- [ ] `test:quick` 통과 (테스트 업데이트 포함)
- [ ] `knip:ci` — recharts 잔재 미사용 exports 없음 확인
- [ ] Storybook: MiniLineChart stories → SvgSparkline stories 갱신

---

## 완료 기준

- [ ] `recharts` dependency package.json에서 제거됨
- [ ] `@nivo/line`, `@nivo/core` 추가됨
- [ ] `SvgSparkline` 신규 컴포넌트 — 기존 MiniLineChart Props 호환
- [ ] `NivoTimeSeriesChart` — 기존 TimeSeriesChart 기능 동등 이상
- [ ] 번들 크기 측정: recharts 제거 후 First Load JS 감소 확인 (`npm run build` 후 출력)
- [ ] `type-check`, `lint`, `test:quick`, `knip:ci` 전부 통과

---

## Codex 위임 프롬프트

```
Task: recharts를 두 단계로 교체한다.

Step 1 — SvgSparkline (MiniLineChart 교체):
- src/components/shared/SvgSparkline.tsx 작성 (순수 SVG, React 컴포넌트)
- Props: data: number[], width=100, height=30, color='#3b82f6', strokeWidth=2, fill=false, showTooltip=false, disableAnimation=true, showLabels=false
- data[] → [0,100] Y 정규화 → SVG polyline/path 계산
- fill=true면 area path도 그림 (fillOpacity 0.15)
- showTooltip=true면 hover 시 값 표시 (간단한 title 또는 div 오버레이)
- src/components/shared/SvgSparkline.test.tsx 작성
- ImprovedServerCard.parts.tsx import를 SvgSparkline으로 교체
- MiniLineChart.tsx, MiniLineChart.test.tsx, MiniLineChart.stories.tsx 삭제

Step 2 — Nivo TimeSeriesChart:
- npm install @nivo/line @nivo/core
- src/components/charts/NivoTimeSeriesChart.tsx 작성
- 기존 TimeSeriesChartProps 동일 Props API 유지
- ResponsiveLine 사용, 예측선(점선), 임계값(markers), 이상 구간(custom layer)
- EnhancedServerModal.MetricsTab.tsx import 교체
- TimeSeriesChart.tsx, TimeSeriesChart.test.tsx 삭제 (ChartErrorBoundary.tsx는 유지)
- npm uninstall recharts

검증: npm run type-check && npm run test:quick && npm run knip:ci
```
