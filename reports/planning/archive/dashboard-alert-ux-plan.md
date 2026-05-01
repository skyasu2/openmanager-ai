<!-- Owner: project -->
<!-- Status: Completed -->
<!-- Doc type: How-to -->
<!-- Last reviewed: 2026-05-01 -->

# Dashboard 알림 섹션 UX 개선 계획

- TODO.md 연결: Active > Dashboard Alert UX 개선

> 서버/로그 섹션 개선(`dashboard-server-log-ux-plan.md`)과 동일한 품질 수준으로 알림 섹션을 맞춤.

---

## 0. 현황 분석

### ActiveAlertsPanel (`ActiveAlertsModal.tsx`)

| 항목 | 현재 | 문제 |
|------|------|------|
| AlertRow border-left | 없음 | 서버 카드·로그와 달리 심각도 색상 테두리 없음 |
| 통계 바 위치 | 하단 footer | 클릭 필터 연동 없음 |
| 로그 크로스링크 | 없음 | 알림 서버에서 로그 페이지로 이동 불가 |
| 정렬 UI | 없음 (critical 우선 내부 로직만) | 사용자가 정렬 변경 불가 |

### AlertHistoryPanel (`alert-history/AlertHistoryModal.tsx`)

| 항목 | 현재 | 문제 |
|------|------|------|
| 영어/한국어 혼재 | "Alert History", "Severity:", "All/Critical/Warning", "State:", "Firing/Resolved", "Total", "Avg Res." | 로그/서버 섹션은 전부 한국어인데 알림만 영어 다수 |
| 통계 footer | 하단 StatCell (영어) | 클릭 필터 연동 없음 |
| 더 보기 | 버튼 클릭 방식 | 로그는 스크롤 자동 로드, 알림만 수동 버튼 |
| 알림 배지 | "critical", "warning" (소문자 영어) | "위험", "경고"로 한국어 통일 필요 |
| 상태 배지 | "firing", "resolved" (소문자 영어) | "발생중", "해결됨"으로 한국어 통일 필요 |
| 로그 크로스링크 | 없음 | 각 알림 행에서 해당 서버 로그로 이동 불가 |

---

## 1. 계약 (Contract)

- 개요 섹션(`SystemOverviewSection`, `DashboardSummary`) 수정 금지.
- 기존 `useAlertHistory` hook의 데이터 계약 유지.
- `AlertHistoryRow`의 `alert.state`, `alert.severity` 값은 그대로 유지 (UI 레이블만 번역).
- 라우트(`/dashboard/alerts`) 유지.

---

## 2. 설계

### 2-1. 한국어 통일 (AlertHistoryPanel)

| 영어 원문 | 한국어 변환 |
|-----------|------------|
| "Alert History" | "알림 이력" |
| "Severity:" | "심각도" |
| "All" | "전체" |
| "Critical" | "위험" |
| "Warning" | "경고" |
| "State:" | "상태" |
| "Firing" | "발생중" |
| "Resolved" | "해결됨" |
| "Total" | "전체" |
| "Avg Res." | "평균 해결" |
| 배지 "critical" | "위험" |
| 배지 "warning" | "경고" |
| 배지 "firing" | "발생중" |
| 배지 "resolved" | "해결됨" |

### 2-2. AlertRow border-left 추가 (ActiveAlertsPanel)

```tsx
// 현재: border-gray-200/80 만 있음
// 개선: severity별 border-left 추가
const severityBorderLeft = {
  critical: 'border-l-4 border-l-red-500',
  warning:  'border-l-4 border-l-amber-500',
};
```

### 2-3. 통계 클릭 필터 연동 (AlertHistoryPanel)

```
[전체 N] [위험 N] [경고 N] [발생중 N] [해결됨 N]
↑ 클릭 시 severity/state 필터 즉시 적용 (로그 섹션 StatCell 패턴 동일)
```

- StatCell에 `onClick` prop 추가 (이미 로그 섹션에서 구현됨, 동일 패턴)
- "위험" 클릭 → `severity = 'critical'` 토글
- "경고" 클릭 → `severity = 'warning'` 토글
- "발생중" 클릭 → `state = 'firing'` 토글
- "해결됨" 클릭 → `state = 'resolved'` 토글

### 2-4. 스크롤 자동 로드 (AlertHistoryPanel)

```
현재: "더 보기 (N건 남음)" 버튼 클릭
개선: 목록 하단 120px 도달 시 자동 로드 (LogExplorerPanel과 동일 패턴)
```

### 2-5. 로그 크로스링크

**ActiveAlertsPanel AlertRow**:
```
[위험] api-was-dc1-01  CPU = 92%  3분 경과  [📄 로그]
```
- `[📄 로그]` 버튼 → `router.push('/dashboard/logs?server=api-was-dc1-01')`

**AlertHistoryPanel AlertHistoryRow**:
```
[위험] api-was-dc1-01  cpu_usage = 92%  (threshold: 85%)  [발생중] 5m  [📄 로그]
```
- 동일하게 로그 크로스링크 버튼 추가

---

## 3. Task 목록

### Phase 1 — 한국어 통일 + border-left (P0, ~0.5일)

- [x] **A1**: AlertHistoryPanel 모든 영어 레이블 → 한국어 변환 (헤더, 필터칩, 통계 StatCell, 배지)
- [x] **A2**: ActiveAlertsPanel AlertRow에 `border-l-4` severity 컬러 추가
- [x] **A3**: AlertHistoryRow 배지 텍스트 한국어 변환 ("critical"→"위험", "firing"→"발생중" 등)

### Phase 2 — 인터랙션 개선 (P1, ~1일)

- [x] **A4**: AlertHistoryPanel 통계 StatCell 클릭 시 severity/state 필터 연동
- [x] **A5**: AlertHistoryPanel "더 보기" 버튼 → 스크롤 120px 자동 로드 전환

### Phase 3 — 크로스링크 (P2, ~0.5일)

- [x] **A6**: ActiveAlertsPanel AlertRow에 `[📄 로그]` 크로스링크 버튼 추가
- [x] **A7**: AlertHistoryPanel AlertHistoryRow에 `[📄 로그]` 크로스링크 버튼 추가

---

## 4. 변경 금지 범위

- `src/components/dashboard/SystemOverviewSection.tsx`
- `src/components/dashboard/DashboardSummary.tsx`
- `src/app/dashboard/page.tsx`
- `src/hooks/dashboard/useAlertHistory.ts` — 데이터 계약 유지 (UI 레이블만 변경)

---

## 5. 참조

- 서버/로그 개선 패턴: `reports/planning/archive/dashboard-server-log-ux-plan.md`
- 활성 알림: `src/components/dashboard/ActiveAlertsModal.tsx`
- 알림 이력: `src/components/dashboard/alert-history/AlertHistoryModal.tsx`
- 알림 이력 페이지: `src/app/dashboard/alerts/page.tsx`
- StatCell 클릭 패턴 참조: `src/components/dashboard/log-explorer/LogExplorerModal.tsx` (`handleLevelStatClick`)
- 스크롤 자동 로드 패턴 참조: `src/components/dashboard/log-explorer/LogExplorerModal.tsx` (`handleLogScroll`)
