# NivoTimeSeriesChart UX 회귀 수정 계획

> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-08
> Canonical: reports/planning/archive/nivo-chart-ux-fix-plan.md
> Tags: charts,nivo,ux,bug-fix,frontend

## 배경

2026-05-07 recharts → Nivo 마이그레이션 완료 후 Production 화면 검증 결과,
`NivoTimeSeriesChart` (성능 분석 탭)에서 UX 회귀 3건 확인.

### 분석 근거

| 항목 | 확인 방법 |
|------|----------|
| 툴팁 미동작 | Playwright 화면 캡처 + 코드 grep |
| 이상 구간 비가시 | 코드 분석 (`resolvedAt ?? startTime` 패턴) |
| 예측선 없음 | useTimeSeriesMetrics hook 반환 스키마 추적 |

---

## 수정 대상 (범위 내)

### Bug 1 — 툴팁 미동작 (우선순위: P1)

**원인**: `NivoTimeSeriesChart.tsx`에서 `useMesh={true}`와 `enableSlices="x"`를 동시에 사용 중.
Nivo에서 둘은 상호 배타적이며 `sliceTooltip` prop은 `enableSlices` 모드에서만 동작한다.
`useMesh`가 켜져 있으면 mesh 이벤트 레이어가 slice 이벤트를 가로채 `sliceTooltip`이 호출되지 않는다.

**수정 파일**: `src/components/charts/NivoTimeSeriesChart.tsx`

```diff
- useMesh
+ // useMesh 제거 — enableSlices="x" + sliceTooltip과 상호 배타적
  enableSlices="x"
  sliceTooltip={...}
```

**검증**: 브라우저에서 차트 hover 시 슬라이스 툴팁(시간, 실제값%) 팝업 표시 확인.

---

### Bug 2 — 이상 구간(Anomaly) 하이라이트 비가시 (우선순위: P2)

**원인**: `useTimeSeriesMetrics.ts` anomaly 매핑에서
`endTime = alert.resolvedAt ?? startTime`을 사용한다.
아직 미해소된 이상(active anomaly)은 `resolvedAt`이 null이므로
`endTime === startTime` → `AnomalyLayer`의 rect `width = 0` → 화면에 보이지 않음.

추가로 `AnomalyLayer` 내 `xScale`이 타임스탬프 문자열을 직접 받는데,
xScale 도메인 범위 밖 값이면 `NaN`을 반환해 rect가 렌더 안 된다.

**수정 파일 1**: `src/hooks/useTimeSeriesMetrics.ts`

```diff
  const endTime = alert.resolvedAt ?? startTime;
+ // active anomaly는 최신 history timestamp를 endTime으로 사용해 point scale domain과 정렬
+ const endTime = alert.resolvedAt ?? latestHistoryTimestamp;
```

**수정 파일 2**: `src/components/charts/NivoTimeSeriesChart.tsx` — `createAnomalyLayer`

```diff
  const start = xScale(anomaly.startTime);
  const end = xScale(anomaly.endTime);
- const x = Math.min(start, end);
- const width = Math.max(Math.abs(end - start), 1);
+ // exact point domain에 없지만 범위 내부인 timestamp는 보간
+ // 범위 밖/invalid timestamp는 렌더 스킵
+ if (start === null || end === null) return null;
+ const x = Math.min(start, end);
+ const width = Math.max(Math.abs(end - start), 4); // 최소 4px 보장
```

**검증**: active alert 보유 서버(storage-nfs-dc1-01 등 Critical 서버)에서
차트 위에 주황/빨간 반투명 구간이 표시되는지 확인.

---

### 범위 밖 (이번 계획에서 제외)

| 항목 | 이유 |
|------|------|
| 예측선(CI 밴드) 미표시 | 새 서버 히스토리 스키마 응답에 `prediction` 필드 자체 없음. API 레벨 문제 — 렌더링 버그 아님. 별도 AI Engine 수정 필요. |
| Brush(줌/패닝) 복구 | 의도적 제거. 필요 시 별도 계획서로 분리. |

---

## 작업 목록

### Task 1: 툴팁 수정
- [x] `NivoTimeSeriesChart.tsx` — `useMesh` prop 제거
- [x] `NivoTimeSeriesChart.test.tsx` — 툴팁 노출 테스트 케이스 추가
  - `slice.points`에 실제값 포함 여부 assert
  - `data-testid="nivo-slice-tooltip"` 렌더 여부 확인

### Task 2: 이상 구간 수정
- [x] `useTimeSeriesMetrics.ts` — active anomaly endTime fallback 수정
- [x] `NivoTimeSeriesChart.tsx` — `createAnomalyLayer` NaN 가드 + 최소 width 4px
- [x] `NivoTimeSeriesChart.test.tsx` — 기존 anomaly layer 테스트에 active anomaly 케이스 추가
  - `resolvedAt: null` 케이스에서 rect가 렌더되는지 assert
  - xScale 범위 밖 anomaly에서 렌더 스킵(null 반환) assert
  - point scale domain 내부의 비정확 timestamp 보간 assert

### Task 3: 검증
- [x] targeted Vitest: `src/components/charts/NivoTimeSeriesChart.test.tsx`, `src/hooks/useTimeSeriesMetrics.test.ts` 통과
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] Playwright: 성능 분석 탭 시각 QA
  - storage-nfs-dc1-01 DISK 차트 hover → 툴팁 팝업 표시 확인
  - active alert 보유 서버 차트 → 이상 구간 하이라이트 rect 표시 확인
  - 2026-05-08 local attempt: WSL2 `/mnt/d` 환경에서 Storybook/Next dev/build가 SIGBUS로 중단되어 시각 QA 미실행. Non-counting QA 기록: [QA-20260508-0421](../../qa/runs/2026/qa-run-QA-20260508-0421.json). Linux ext4 경로 또는 CI/preview 환경에서 재시도 필요.
  - 2026-05-08 retry: `next dev -p 3000 -H 127.0.0.1` Turbopack은 `/dashboard` preflight에서 connection reset 후 종료, `--webpack` fallback도 request 중 port 3000 listener가 사라져 Playwright 단계 진입 실패. Non-counting QA 기록: [QA-20260508-0422](../../qa/runs/2026/qa-run-QA-20260508-0422.json). 안정적인 ext4/CI/preview runtime에서 재시도 필요.
  - 2026-05-08 local runtime workaround: `node_modules`를 ext4 경로 symlink로 분리하고 `next dev --webpack`을 기본 dev 경로로 고정. `src/data/otel-data/index.ts`의 서버 전용 `node:*` dynamic import에 `webpackIgnore`를 적용해 webpack client build의 `UnhandledSchemeError`를 제거. `/dashboard` preflight HTTP 200 확인. Non-counting QA 기록: [QA-20260508-0423](../../qa/runs/2026/qa-run-QA-20260508-0423.json). 실제 Playwright hover/하이라이트 시각 QA는 아직 미실행.
  - 2026-05-08 visual QA closure: local webpack dev에서 storage-nfs-dc1-01 DISK hover tooltip 표시를 확인. 현재 storage-nfs-dc1-01 local data는 `alerts: []`라 anomaly 직접 대상이 아니므로, 동일 Nivo chart 경로에서 active alert가 있는 cache-redis-dc1-01 MEMORY anomaly rect(폭 4px)를 확인. Counting targeted QA 기록: [QA-20260508-0424](../../qa/runs/2026/qa-run-QA-20260508-0424.json).

---

## 계약 (SDD)

### 테스트 시나리오

```typescript
// Bug 1 — 툴팁
describe('NivoTimeSeriesChart tooltip', () => {
  it('sliceTooltip renders when slice contains a point', () => {
    // 툴팁 컴포넌트가 slice.points 데이터로 렌더되는지
  });
});

// Bug 2 — active anomaly 하이라이트
describe('createAnomalyLayer', () => {
  it('renders rect for active anomaly (resolvedAt=null)', () => {
    // endTime이 최신 history timestamp로 fallback → rect width > 0
  });
  it('skips rect when xScale returns NaN', () => {
    // 범위 밖 anomaly → null 반환, rect 없음
  });
  it('interpolates timestamp inside point-scale domain', () => {
    // 데이터 포인트 사이 timestamp도 하이라이트 위치/폭 계산
  });
});
```

---

## 수정 규모 결과

| 파일 | 변경 줄 |
|------|---------|
| `NivoTimeSeriesChart.tsx` | anomaly xScale 보간, 최소폭 4px, tooltip mesh 충돌 제거 |
| `useTimeSeriesMetrics.ts` | nullable alert timestamp 허용, active alert endTime fallback 수정 |
| `NivoTimeSeriesChart.test.tsx` | useMesh 제거, tooltip, anomaly 최소폭/보간/범위 밖 skip 검증 |
| `useTimeSeriesMetrics.ts` test | `resolvedAt: null` active alert 정규화 검증 |

남은 작업: 없음.
