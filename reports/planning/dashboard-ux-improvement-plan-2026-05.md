# 대시보드 UX 개선 작업 계획서

> Owner: project
> Status: In Progress
> Doc type: Plan
> Last reviewed: 2026-05-21
> Tags: dashboard,ux,ai-sidebar,frontend

> 작성일: 2026-05-21
> 기준: 상용 서버 모니터링 업체(Datadog · New Relic · Grafana · Better Stack) 비교 분석 + AI 어시스턴트 사이드바 코드 분석
> 제약: 서버 카드 + 내부 스파크라인 그래프 유지 / 다크모드 미도입

---

## 배경 및 목적

두 가지 분석 결과를 통합한 종합 계획서다.

1. **대시보드 (서버 모니터링 뷰)**: 상용 업체 대비 UX 갭 — 검색·필터·알림 스트림·시간 제어 영역 열세
2. **AI 어시스턴트 사이드바/전체 페이지**: 코드 구조 분석 기반 — 색상 시스템 파편화, 기능 발견성 부족, 배너 혼잡

본 계획은 카드 레이아웃을 유지하면서 두 영역의 UX를 모두 개선한다.

---

## 범위 제약

| 항목 | 결정 |
|------|------|
| 서버 카드 그리드 | **유지** |
| 카드 내 CPU/MEM/DISK 스파크라인 | **유지** |
| 다크모드 | **미도입** |
| 카드 클릭 → 상세 페이지 라우팅 | **유지** |

---

## 현재 진행 상태 (2026-05-21)

Phase 1은 소규모 리팩터/copy/UI 톤 정리 범위로 완료했다. T-2-A 서버 검색, T-2-B 서버 카드 트렌드 인디케이터, T-2-C 서버 카드 가동률 표시, T-2-D 모바일 헤더 sub-bar 통합, T-3-A 알림 인시던트 인라인 피드, T-3-B 시간 범위 Quick Picker, T-3-C 정렬 세그먼트 버튼, T-4-A AI 사이드바 색상 시스템 통일을 반영했다. T-3-B는 기존 OTel timeseries tail slice와 서버 상세 API fallback range 파라미터를 재사용하며 신규 API/AI 계약은 만들지 않았다. T-3-C는 기존 client-side 정렬 키와 정렬 파이프라인을 유지하고 UI만 native select에서 세그먼트 버튼으로 교체했다. T-4-A는 사이드바 표면 className만 정렬하고 신규 API/AI 계약을 만들지 않았다. 로컬 브라우저 QA에서 dev 서버 stale bundle 오류와 compact 카드 delta 겹침을 확인해, dev 서버 재기동 검증과 2줄 메트릭 레이아웃으로 수정했다.

**완료 변경 계약**

| 영역 | 계약 |
|------|------|
| 디자인 토큰 | `DashboardSummary`와 `ImprovedServerCard`의 status gradient/ring/hover/accent class를 `src/styles/design-constants.ts` shared export로 사용 |
| 뷰 모드 | 내부 state 값은 `list/grid` 유지, 사용자 노출 레이블과 `aria-label`만 `목록/그리드`로 정렬 |
| 시스템 상태 카드 | 상태 텍스트와 액션 버튼만 표시하고, 이미 상태 카드에 있는 critical/warning/offline 중복 숫자 열은 제거 |
| 툴바/카운트 바 | 서버 목록 조작 영역은 기존 기능 유지, 시각 톤만 `white/neutral + backdrop blur`로 통일 |
| 서버 검색 | `server.name`, `server.id`, `server.hostname`, `server.location`, `server.ip` 기준 client-side 검색. 검색 중에는 unloaded page 확장을 시도하지 않고 현재 보유 서버 집합 안에서 정렬/더보기/empty state를 처리 |
| 메트릭 트렌드 | `MetricItem`에서 현재값과 최근 최대 5개 히스토리 평균을 비교해 `↑ +N%` / `↓ -N%` / `—` 표시. `withCurrentMetricPoint()`가 마지막 포인트를 현재값으로 정렬하므로 baseline 계산에서는 마지막 포인트를 제외. compact 카드에서는 값과 delta를 2줄로 분리해 텍스트 겹침을 방지 |
| 서버 가동률 | standard/detailed 서버 카드의 `SecondaryMetrics`에 `가동률 N.N% / 24h` 행을 표시. `uptimePercent`가 있으면 우선 사용하고, 없으면 기존 `uptime` 초/문자열을 24h 기준으로 환산. 유효 데이터가 없으면 `— / 24h` 표시. compact 카드에서는 숨김 |
| 모바일 헤더 | `lg` 미만에서 헤더 하단 sub-bar를 제거하고, primary row 안에 compact `RealTimeDisplay`를 인라인 표시. `SessionCountdown`은 모바일 헤더 직접 렌더에서 제거하고 기존 프로필 드롭다운 시스템 상태 섹션에서 확인 |
| 인시던트 피드 | overview 화면 서버 카드 영역 오른쪽에 `AlertFeedPanel`을 추가해 기존 `useMonitoringReport().data.firingAlerts`를 최대 5건 preview로 표시. `xl` 미만에서는 숨기고, row 클릭은 서버 상세 route로 이동 |
| 시간 범위 Quick Picker | `DashboardSummary` 전역 조작 영역에 `2h/6h/12h/24h` 세그먼트 컨트롤을 표시하고, `DashboardContent → ServerDashboard → ImprovedServerCard`로 선택 범위를 전달해 카드 스파크라인 history loader range를 즉시 갱신 |
| 정렬 세그먼트 | `ServerDashboard`의 native sort select를 제거하고 `상태/CPU/MEM/이름` 세그먼트 버튼으로 교체. 기존 `serverSortKey` 정렬 파이프라인과 검색 조합은 유지 |
| AI 사이드바 색상 시스템 | `AISidebarHeader`, `EnhancedAIChat`, `ChatInputArea`, 데스크톱 `AIAssistantIconPanel` 표면을 `white + gray-50/50 + subtle purple border/accent`로 통일. Brain/Bot 포인트 그라데이션은 유지하고 선택 기능 탭은 `bg-purple-600`으로 정렬 |
| 통계 업데이트 루프 방어 | `DashboardInteractiveShell`은 동일한 `DashboardStats`가 반복 전달되면 state update를 생략해 dev runtime maximum update depth 경고를 방지 |

**검증**
- `npm run test:dom -- src/components/dashboard/DashboardSummary.test.tsx src/components/dashboard/ServerDashboard.test.tsx src/components/dashboard/ImprovedServerCard.test.tsx src/components/dashboard/DashboardContent.test.tsx` — PASS (4 files / 89 tests)
- `npm run type-check` — PASS
- `npm run lint` — PASS
- `npm run test:quick` — PASS
- `npm run test:dom -- src/components/dashboard/ServerDashboard.test.tsx` — PASS (1 file / 16 tests, T-2-A targeted)
- `npm run test:dom -- src/components/dashboard/ImprovedServerCard.test.tsx` — PASS (1 file / 57 tests, T-2-B/T-2-C targeted)
- `npm run test:dom -- src/components/dashboard/ImprovedServerCard.test.tsx src/hooks/useSafeServer.test.tsx` — PASS (2 files / 61 tests, T-2-C targeted)
- `npm run test:dom -- src/components/dashboard/DashboardHeader.test.tsx src/components/dashboard/RealTimeDisplay.test.tsx` — PASS (2 files / 4 tests, T-2-D targeted)
- `npm run test:dom -- src/components/dashboard/DashboardContent.test.tsx` — PASS (1 file / 11 tests, T-3-A targeted)
- `npm run test:dom -- src/components/dashboard/DashboardSummary.test.tsx src/components/dashboard/DashboardContent.test.tsx src/components/dashboard/ServerDashboard.test.tsx src/components/dashboard/ImprovedServerCard.test.tsx src/hooks/useServerMetrics.test.ts` — PASS (5 files / 106 tests, T-3-B targeted)
- `npm run test:dom -- src/components/dashboard/ServerDashboard.test.tsx` — PASS (1 file / 18 tests, T-3-C targeted)
- `npm run test:dom -- src/components/ai-sidebar/AISidebarHeader.test.tsx src/components/ai-sidebar/EnhancedAIChat.test.tsx src/components/ai-sidebar/ChatInputArea.test.tsx src/components/ai/AIAssistantIconPanel.test.tsx` — PASS (4 files / 30 tests, T-4-A targeted)
- Local Playwright/Next DevTools `/dashboard` targeted QA — PASS: 검색 필터/empty/복구, 그리드 카드 trend delta, 콘솔 warning/error 0, Next runtime errors 0

**Task 상태**
- [x] T-1-A: `statusGradients` 디자인 토큰 공유 파일 분리
- [x] T-1-B: 뷰 모드 레이블 수정
- [x] T-1-C: DashboardSummary 숫자 중복 제거
- [x] T-1-D: 툴바 스타일 통일
- [x] T-2-A: 서버 검색바 추가
- [x] T-2-B: 트렌드 방향 인디케이터 추가
- [x] T-2-C: 서버 카드 Uptime 표시 추가
- [x] T-2-D: 모바일 헤더 sub-bar 통합
- [x] T-3-A: 알림 인시던트 인라인 피드
- [x] T-3-B: 시간 범위 Quick Picker
- [x] T-3-C: 정렬 `<select>` → 세그먼트 버튼 교체
- [x] T-4-A: AI 사이드바 색상 시스템 통일
- [ ] T-4-B 이후: 별도 세부 계약/테스트 시나리오 확정 후 진행

## SDD 게이트 (Phase 2+ 착수 전)

Phase 2부터는 사용자-facing 신규 기능이므로 구현 전에 계약과 테스트 시나리오를 확정한다.

### T-2-A 서버 검색 계약 초안

| 항목 | 계약 |
|------|------|
| 검색 대상 | `server.name`, `server.id`, `server.hostname`, `server.location`, `server.ip` 텍스트 |
| 조합 방식 | 현재 표시 대상 서버 배열에 검색어 필터를 적용한 뒤 기존 정렬/visible rows/page-size 로직을 유지 |
| 상태 필터 관계 | Dashboard 상위 상태 필터가 전달한 서버 집합과 AND 조합으로 동작 |
| 빈 결과 | 전체 데이터 없음과 구분되는 검색 empty state 표시, 검색어 제거 시 전체 복구 |
| 비용/외부 호출 | 없음. client-side filter만 사용 |

### T-2-A 테스트 시나리오

- [x] 서버 이름 검색 시 해당 서버만 표시된다.
- [x] 위치 또는 IP 검색 시 해당 서버만 표시된다.
- [x] 검색어 제거 시 기존 목록/그리드 및 정렬 동작이 복구된다.
- [x] 검색 결과가 없으면 "검색 결과 없음" empty state를 표시한다.
- [x] 검색 필터와 status-priority/name/cpu/memory 정렬이 동시에 동작한다.

### T-2-B 트렌드 방향 인디케이터 계약

| 항목 | 계약 |
|------|------|
| 기준 데이터 | `MetricItem`에 전달된 history의 마지막 포인트는 current 값으로 취급하고 baseline에서는 제외 |
| 비교 방식 | baseline의 최근 최대 5개 유효 숫자 평균과 current 값을 비교 |
| 표시 방식 | 상승 `↑ +N%`, 하락 `↓ -N%`, 변화 없음 또는 baseline 없음 `—` |
| 접근성 | 각 인디케이터는 `CPU 추세 상승 +20.0%` 같은 `aria-label`과 평균 대비 title을 제공 |
| 비용/외부 호출 | 없음. 기존 `metricsHistory` 배열만 사용 |

### T-2-B 테스트 시나리오

- [x] current 값이 최근 평균보다 높으면 수치 옆에 상승 delta를 표시한다.
- [x] current 값이 최근 평균보다 낮으면 수치 옆에 하락 delta를 표시한다.
- [x] current 값과 최근 평균 차이가 없으면 `—`를 표시한다.

### T-2-C 서버 카드 Uptime 표시 계약

| 항목 | 계약 |
|------|------|
| 우선 데이터 | `server.uptimePercent`가 유효 숫자이면 이를 0~100 범위로 clamp해 사용 |
| fallback 데이터 | `uptimePercent`가 없으면 숫자형 `server.uptime` 또는 파싱 가능한 uptime 문자열을 최근 24h 대비 가동 시간으로 환산 |
| 표시 방식 | standard/detailed 카드의 `SecondaryMetrics` 하단에 `가동률 N.N% / 24h` 표시 |
| 데이터 없음 | 유효한 `uptimePercent`와 파싱 가능한 `uptime`이 모두 없으면 `가동률 — / 24h` 표시 |
| compact variant | compact 카드에서는 uptime 표시를 숨겨 모바일/조밀 카드 높이를 유지 |
| 비용/외부 호출 | 없음. 기존 서버 객체 필드만 사용 |

### T-2-C 테스트 시나리오

- [x] explicit `uptimePercent`가 있으면 standard 카드에 `가동률 N.N% / 24h`를 표시한다.
- [x] `uptimePercent`가 없고 `uptime`이 24h 이상이면 `100.0% / 24h`를 표시한다.
- [x] 유효한 uptime 데이터가 없으면 `가동률 — / 24h`를 표시한다.
- [x] compact variant에서는 uptime 행을 렌더링하지 않는다.

### T-2-D 모바일 헤더 sub-bar 통합 계약

| 항목 | 계약 |
|------|------|
| 모바일 레이아웃 | `lg` 미만에서는 헤더 아래 별도 sub-bar를 렌더링하지 않고, 헤더 primary row 안에서 단일 줄을 유지 |
| 실시간 표시 | 모바일에서는 `RealTimeDisplay`를 compact variant로 헤더 primary row에 인라인 표시 |
| 세션 타이머 | 모바일 헤더 primary row에는 `SessionCountdown`을 렌더링하지 않는다. 세션 남은 시간은 기존 프로필 드롭다운의 시스템 상태 섹션에서 확인 |
| 데스크톱 유지 | `lg` 이상에서는 기존 중앙 영역의 `RealTimeDisplay` + `SessionCountdown` 표시를 유지 |
| 비용/외부 호출 | 없음. 클라이언트 렌더링 위치와 표시 variant만 변경 |

### T-2-D 테스트 시나리오

- [x] 데스크톱에서는 실시간 정보와 세션 카운트다운을 기존처럼 한 번씩 표시한다.
- [x] 모바일에서는 헤더 primary row 안에 compact `RealTimeDisplay`를 표시한다.
- [x] 모바일에서는 헤더 하단 sub-bar를 렌더링하지 않는다.
- [x] 모바일에서는 `SessionCountdown`을 헤더에 직접 렌더링하지 않는다.

### T-3-A 알림 인시던트 인라인 피드 계약

| 항목 | 계약 |
|------|------|
| 데이터 소스 | 기존 `useMonitoringReport().data.firingAlerts`를 재사용하고 신규 API 호출은 만들지 않는다 |
| 데스크톱 레이아웃 | overview 화면에서 서버 카드 영역 오른쪽에 `AlertFeedPanel`을 상시 표시한다 |
| 모바일/좁은 화면 | `xl` 미만에서는 인라인 피드를 접어 숨기고 기존 `/dashboard/alerts` route를 유지한다 |
| 정렬/표시 | critical 알림을 warning보다 우선하고, 같은 severity에서는 오래 진행 중인 알림을 먼저 표시한다 |
| 알림 클릭 | 알림 row 클릭 시 해당 서버 상세 `/dashboard/servers/{serverId}`로 이동한다 |
| 빈 상태 | firing 알림이 없으면 `모든 시스템 정상` empty state를 표시한다 |
| 비용/외부 호출 | 없음. 기존 monitoring report query 결과만 사용 |

### T-3-A 테스트 시나리오

- [x] overview 서버 목록이 있을 때 데스크톱 인라인 알림 피드를 렌더링한다.
- [x] firing alert row는 severity, 서버, 메트릭 값을 표시한다.
- [x] alert row 클릭 시 해당 서버 상세 route로 이동한다.
- [x] firing alert가 없으면 `모든 시스템 정상` empty state를 표시한다.

### T-3-B 시간 범위 Quick Picker 계약

| 항목 | 계약 |
|------|------|
| 범위 옵션 | `2h`, `6h`, `12h`, `24h` 네 가지 고정 옵션만 노출한다 |
| 기본값 | 초기 선택은 기존 동작과 같은 `24h` |
| UI 위치 | `DashboardSummary` 상단 시스템 상태 카드의 전역 조작 영역에 세그먼트 버튼 그룹으로 표시한다 |
| 상태 소유 | `DashboardContent`가 선택 상태를 소유하고 `DashboardSummary` 변경 이벤트를 받아 갱신한다 |
| 히스토리 전달 | 선택된 범위는 `ServerDashboard`를 거쳐 모든 `ImprovedServerCard`의 `loadMetricsHistory(serverId, range)` 인자로 전달한다 |
| OTel 변환 | `useServerMetrics`는 `2h`, `6h`, `12h`, `24h`를 각각 `otelTimeSeriesToHistory(serverId, 2/6/12/24)`로 매핑한다 |
| 비용/외부 호출 | 신규 API 호출 없음. 기존 OTel timeseries tail slice와 기존 API fallback `range` 파라미터만 사용 |

### T-3-B 테스트 시나리오

- [x] Quick Picker는 `2h/6h/12h/24h` 옵션을 렌더링하고 활성 범위를 `aria-pressed`로 표시한다.
- [x] Quick Picker 변경 시 `DashboardContent`가 `ServerDashboard`에 선택 범위를 전달한다.
- [x] `ServerDashboard`는 선택 범위를 각 `ImprovedServerCard`에 전달한다.
- [x] `ImprovedServerCard`는 전달된 범위로 `loadMetricsHistory(serverId, range)`를 호출한다.
- [x] `useServerMetrics`는 `2h/12h`를 168h fallback이 아니라 실제 hour 값으로 OTel loader에 전달한다.

### T-3-C 정렬 세그먼트 버튼 계약

| 항목 | 계약 |
|------|------|
| 옵션 | 기존 정렬 키 `status`, `cpu`, `memory`, `name`을 유지하고 사용자 노출 라벨은 `상태`, `CPU`, `MEM`, `이름`으로 표시한다 |
| UI 형태 | native `<select>`를 제거하고 뷰 모드 토글과 같은 fieldset 기반 세그먼트 버튼 그룹으로 표시한다 |
| 기본값 | 초기 선택은 기존과 같은 `status` |
| 접근성 | 그룹 이름은 `서버 정렬`, 각 버튼은 `{라벨} 정렬` aria-label과 `aria-pressed` 상태를 제공한다 |
| 동작 | 버튼 클릭 시 기존 `serverSortKey` 정렬 파이프라인만 갱신하고 검색/상태 필터/visible row 계산은 유지한다 |
| 비용/외부 호출 | 없음. 클라이언트 정렬 UI만 변경한다 |

### T-3-C 테스트 시나리오

- [x] 정렬 UI는 `서버 정렬` 그룹과 `상태/CPU/MEM/이름` 세그먼트 버튼을 렌더링하고 native combobox를 렌더링하지 않는다.
- [x] 기본 상태 정렬 버튼은 `aria-pressed=true`로 표시된다.
- [x] CPU/이름 세그먼트 클릭 시 기존 정렬 순서가 바뀐다.
- [x] 검색 결과에도 세그먼트 정렬 기준을 적용한다.

### T-4-A AI 사이드바 색상 시스템 계약

| 항목 | 계약 |
|------|------|
| 헤더 표면 | `AISidebarHeader`는 그라데이션을 제거하고 `bg-white border-b border-purple-100` 톤을 사용한다 |
| 채팅 본체 | `EnhancedAIChat` 최상위 표면은 `bg-gray-50/50` 단일 톤을 사용하고 slate-blue 그라데이션을 사용하지 않는다 |
| 입력창 표면 | `ChatInputArea` 입력 영역 래퍼는 `bg-white border-t border-purple-100`으로 헤더의 subtle purple accent와 맞춘다 |
| 우측 아이콘 패널 | 데스크톱 `AIAssistantIconPanel`은 채팅 본체와 같은 `bg-gray-50/50` 및 `border-l border-gray-100`을 사용한다 |
| 포인트 색상 | Brain/Bot 아이콘 박스의 `from-purple-500 to-blue-600` 그라데이션은 유지한다 |
| 선택 탭 액센트 | 선택된 기능 탭과 선택 표시 bar는 `bg-purple-600` 계열을 사용하고 `bg-slate-900`을 사용하지 않는다 |
| 비용/외부 호출 | 없음. className 기반 UI 톤 정렬만 수행한다 |

### T-4-A 테스트 시나리오

- [x] 헤더는 `bg-white border-purple-100`을 사용하고 기존 purple-blue 배경 그라데이션을 렌더링하지 않는다.
- [x] Brain/Bot 아이콘 포인트 그라데이션은 유지된다.
- [x] 채팅 본체는 `bg-gray-50/50` 단일 표면을 사용하고 slate-blue 그라데이션을 렌더링하지 않는다.
- [x] 입력창 표면은 `bg-white border-purple-100`을 사용하고 `bg-white/80` translucent 톤을 렌더링하지 않는다.
- [x] 데스크톱 아이콘 패널은 `bg-gray-50/50 border-gray-100`을 사용하고 선택 탭은 purple accent로 표시된다.

---

## Phase 1 — 내부 코드 품질 정리 (무중단, 리스크 최소)

> 예상 소요: 0.5~1일 | 사용자 노출 변화: 없음

### T-1-A: `statusGradients` 디자인 토큰 공유 파일 분리

**문제**: 동일한 `statusGradients` 객체가 두 파일에 중복 정의됨
- `src/components/dashboard/DashboardSummary.tsx:52`
- `src/components/dashboard/ImprovedServerCard.tsx:38`

**작업**:
1. `src/styles/design-constants.ts` (또는 `src/styles/dashboard-tokens.ts`)에 `statusGradients` 통합
2. 두 파일에서 import로 교체
3. `ringColors`, `hoverShadowClasses`, `statusAccentBorderClasses` 도 동일 파일로 이전

**완료 기준**: `grep -r "statusGradients" src/` 결과가 1개 파일만 나옴

---

### T-1-B: 뷰 모드 레이블 수정

**문제**: "촘촘히/넓게" 레이블이 표준 모니터링 UX 관행과 다름
- `src/components/dashboard/ServerDashboard.tsx:444,455`

**작업**:
- "촘촘히" → "목록" (List icon 유지)
- "넓게" → "그리드" (LayoutGrid icon 유지)

**완료 기준**: 버튼 텍스트 변경, 스크린리더 `aria-label` 동기화

---

### T-1-C: DashboardSummary 숫자 중복 제거

**문제**: 시스템 상태 카드 우측에 critical/warning/offline 수치가 표시되지만 (`DashboardSummary.tsx:427-459`), 이미 개별 상태 카드에 동일 수치가 존재하여 정보 중복

**작업**:
- 시스템 상태 카드 우측 숫자 열 제거
- 확보된 공간에 액션 버튼 그룹을 보다 크고 명확하게 배치

**완료 기준**: 시스템 상태 카드가 "상태 텍스트 + 액션 버튼"만 표시

---

### T-1-D: 툴바 스타일 통일

**문제**: 서버 뷰 툴바(`ServerDashboard.tsx:431`) 가 `bg-white border-gray-200` 플레인 스타일로 대시보드 나머지 `backdrop-blur-md bg-white/80` 유리모피즘과 불일치

**작업**:
- 툴바 컨테이너에 `bg-white/80 backdrop-blur-sm` 적용
- 서버 카운트 정보 바 배경을 파란색에서 중립 톤으로 변경 (툴바와 시각 분리)

**완료 기준**: 툴바가 카드 섹션과 시각적으로 이어지는 느낌

---

## Phase 2 — 핵심 UX 갭 보완 (사용자 노출 변화 있음)

> 예상 소요: 2~3일 | 리스크: 낮음~중간

### T-2-A: 서버 검색바 추가 ⭐ 최우선

**근거**: 상용 업체 대비 가장 큰 UX 갭. Datadog/New Relic 모두 상단 검색바가 항상 노출됨.

**위치**: `ServerDashboard.tsx` 툴바 위 또는 툴바 왼쪽

**작업**:
```
[🔍 서버 이름, IP, 위치 검색...] [목록/그리드] [정렬▼]
```
1. `ServerDashboard.tsx`에 `searchQuery` 상태 추가
2. `validatedServers` → `filteredServers` → `sortedServers` 파이프 추가: `server.name`, `server.id`, `server.hostname`, `server.location`, `server.ip` 기준 필터
3. 검색 입력창 컴포넌트. 현재 18대 서버 규모에서는 debounce 없이 즉시 필터링해 UI 반응성과 테스트 결정성을 우선한다.
4. 검색 결과 없을 때 empty state 메시지

**완료 기준**:
- 서버 이름 타이핑 시 실시간 필터링
- 검색어 지우면 전체 복구
- 현재 상태 필터(online/warning 등)와 AND 조합으로 동작

---

### T-2-B: 트렌드 방향 인디케이터 추가

**근거**: Datadog/New Relic은 `CPU: 67% ↑ +8%` 형태로 트렌드를 즉각 인지 가능.
현재 스파크라인이 있으나 텍스트 delta 없음.

**위치**: `ImprovedServerCard.parts.tsx` — MetricItem 컴포넌트

**작업**:
1. `metricsHistory` 배열에서 마지막 N개 평균과 현재값 비교
2. delta 계산: `current - avg(last5points)`
3. `↑ +5%` / `↓ -3%` / `—` 인디케이터를 MetricItem 수치 옆에 추가
4. 색상: 상승은 상태에 따라 (CPU 상승 = 나쁨 → 빨강, 일반 시 회색)

**완료 기준**: 각 메트릭 수치 우측에 트렌드 화살표 + delta % 표시

---

### T-2-C: 서버 카드 Uptime 표시 추가

**근거**: Better Stack · Site24x7 등은 서버별 가동률이 핵심 KPI. 현재 카드에 미노출.

**위치**: `ImprovedServerCard.tsx` — 카드 하단 SecondaryMetrics 영역

**작업**:
1. `Server` 타입에 `uptimePercent?: number` 확인 (없으면 OTel 데이터에서 계산)
2. `SecondaryMetrics` 하단에 `가동률 99.8% / 24h` 한 줄 추가
3. compact variant에서는 숨김 처리

**완료 기준**: 서버 카드 하단에 가동률 % 노출 (데이터 없으면 `—`)

---

### T-2-D: 모바일 헤더 sub-bar 통합

**문제**: 모바일에서 헤더 아래 별도 바로 RealTimeDisplay + SessionCountdown이 렌더링되어 스크롤 영역 감소 (`DashboardHeader.tsx:190-198`)

**작업**:
1. 모바일 sub-bar 제거
2. RealTimeDisplay를 헤더 내 컴팩트 버전으로 인라인 통합
3. SessionCountdown은 프로필 버튼 tooltip 또는 드롭다운으로 이전

**완료 기준**: 모바일에서 헤더가 단일 줄로 구성, sub-bar 없음

---

## Phase 3 — 중요 기능 추가 (설계 필요)

> 예상 소요: 3~5일 | 리스크: 중간

### T-3-A: 알림 인시던트 인라인 피드

**근거**: 현재 알림은 모달 진입 방식. New Relic처럼 대시보드 내 우측 또는 하단에 상시 스트림이 있어야 "지금 무슨 일이 일어나는지" 즉각 파악 가능.

**제안 레이아웃**:
```
[서버 카드 그리드 영역 (좌 75%)] | [알림 피드 (우 25%)]
                                    ─────────────────
                                    🔴 13:24 web-01
                                       CPU spike 94%
                                    ─────────────────
                                    ⚠️ 13:20 db-02
                                       MEM 87%
```

**작업**:
1. `DashboardContent.tsx`에 `AlertFeedPanel` 컴포넌트 추가
2. `ActiveAlertsModal` 데이터를 인라인 피드로 재사용
3. 알림 항목 클릭 → 해당 서버 상세로 라우팅
4. 알림 없을 때: "모든 시스템 정상" empty state

**완료 기준**: 데스크탑에서 대시보드 우측에 알림 피드 상시 노출, 모바일에서는 접힘

---

### T-3-B: 시간 범위 Quick Picker

**근거**: 상용 업체 전체 공통 패턴. OTel slot 개념을 사용자 친화적으로 번역.

**제안 위치**: DashboardSummary 상단 우측

```
[2h] [6h] [12h] [24h]
     ↑ 현재 선택
```

**작업**:
1. `DashboardContent.tsx`에 `timeRange` 상태 추가 (`'2h' | '6h' | '12h' | '24h'`)
2. 상태 변경 → OTel 데이터 로더에 슬롯 범위 전달
3. 서버 카드 스파크라인의 히스토리 데이터 범위 연동
4. DashboardSummary에 시간 범위 버튼 그룹 추가

**완료 기준**: 시간 범위 변경 시 카드 내 스파크라인 히스토리 범위 즉시 반영

---

### T-3-C: 정렬 `<select>` → 세그먼트 버튼 교체

**문제**: native `<select>` 가 커스텀 디자인 시스템과 어색하게 혼재

**작업**:
- `ServerDashboard.tsx:472` `<select>` 제거
- 정렬 옵션 버튼 그룹으로 교체: `[상태] [CPU] [MEM] [이름]`
- 선택된 정렬 키 시각적 활성 표시

**완료 기준**: 정렬 UI가 뷰 모드 토글과 동일한 스타일 시스템 사용

---

## Phase 4 — AI 어시스턴트 사이드바 핵심 개선

> 예상 소요: 1~2일 | 리스크: 낮음~중간
> 분석 기준: `AISidebarV4.tsx`, `AISidebarHeader.tsx`, `EnhancedAIChat.tsx`, `ChatInputArea.tsx`, `AIAssistantIconPanel.tsx` 코드 직접 분석

### T-4-A: AI 사이드바 색상 시스템 통일 ⭐ 최우선

**문제**: 동일 사이드바 안에 4개 색상 무드 공존 — 시각적 통일감 없음

| 영역 | 현재 | 파일 |
|------|------|------|
| 헤더 | `from-purple-50 to-blue-50` | `AISidebarHeader.tsx:49` |
| 채팅 본체 | `from-slate-50 to-blue-50` | `EnhancedAIChat.tsx:215` |
| 입력창 | `bg-white/80` | `ChatInputArea.tsx:179` |
| 우측 아이콘 패널 | `bg-white border-l border-gray-200` | `AIAssistantIconPanel.tsx:217` |

**작업**:
1. `white + subtle purple accent` 단일 톤으로 통일
   - 헤더: `bg-white border-b border-purple-100` (그라데이션 제거)
   - 채팅 본체: `bg-gray-50/50` (slate-blue 그라데이션 제거)
   - 아이콘 패널: 채팅 본체와 동일 배경 + `border-l border-gray-100`
2. Brain 아이콘 박스: `from-purple-500 to-blue-600` 유지 (포인트 색상)
3. 선택된 기능 탭 액센트: `bg-purple-600` (현재 `bg-slate-900` → 보라색으로 교체)

**완료 기준**: 사이드바 열었을 때 배경이 단일 톤으로 인식됨

---

### T-4-B: 기능 탭 헤더 수평 탭으로 이전

**문제**: 우측 세로 아이콘 패널(`w-16~20`)이 가장자리에 묻혀 발견성 낮음
- `AIAssistantIconPanel.tsx:216-218` — `h-12 w-12` 아이콘 3개, 레이블 없음
- "AI 기능" 텍스트가 `text-xs text-gray-600`으로 거의 인식 안 됨

**작업**:
1. 우측 `AIAssistantIconPanel` (데스크탑 세로 탭) 제거
2. `AISidebarHeader.tsx` 하단에 수평 탭 바 추가
   ```
   [💬 AI Chat] [📄 자동 보고서] [🖥️ 이상감지]
   ```
3. 선택된 탭: `border-b-2 border-purple-600 text-purple-700`
4. 비선택 탭: `text-gray-500 hover:text-gray-700`
5. 모바일 수평 스크롤 탭 유지 (기존 `isMobile` 분기 재활용)

**완료 기준**: 탭 레이블 항상 노출, 기능 전환 즉각 인지 가능

---

### T-4-C: 배너 스택 → 우선순위 단일 배너 시스템

**문제**: `EnhancedAIChat.tsx:261-418` — 메시지 영역과 입력창 사이에 최대 7개 배너 동시 표시 가능

```
현재 가능한 동시 배너:
ClarificationDialog / StreamingWarmupIndicator / JobProgressIndicator /
AgentStatusIndicator / ColdStartErrorBanner / 세션한도 배너 / 세션경고 배너 / 대기열
```

**우선순위 정책**:
```
1순위: ColdStartErrorBanner (에러 — 즉각 조치 필요)
2순위: StreamingWarmupIndicator (대기 중 — 사용자 행동 불가)
3순위: JobProgressIndicator (진행률 — 작업 중)
4순위: AgentStatusIndicator (상태 — 정보성)
5순위: 세션 한도/경고 (안내 — 낮은 긴급도)
```

**작업**:
1. `EnhancedAIChat.tsx`에 `activeBannerPriority` 계산 로직 추가
2. 동시에 하나의 배너만 렌더링되도록 조건부 렌더링 리팩터링
3. 대기열(`queuedQueries`)은 배너 시스템 밖에 유지 (성격 다름)
4. 세션 경고는 입력창 하단 힌트 영역으로 강등 (배너 아님)

**완료 기준**: 어떤 상태 조합에서도 배너 1개만 표시

---

### T-4-D: 입력창 도구 직접 노출

**문제**: 파일첨부·웹검색이 `+` 팝오버 뒤에 숨겨져 있어 발견성 낮음

**현재**:
```
[+팝오버] [텍스트 입력창 .......] [■중단] [→전송]
```

**개선 후**:
```
[📎파일] [🌐웹] [텍스트 입력창 ...........] [■] [→]
```

**작업**:
- `ChatInputArea.tsx:307-315` — `+` 버튼 제거
- 파일첨부 아이콘 버튼 (`📎`) 직접 노출 — `Paperclip` 아이콘
- 웹검색 토글 버튼 (`🌐`) 직접 노출 — 활성 시 `text-blue-600 bg-blue-50`
- 분석모드(thinking) 만 팝오버로 유지 (사용 빈도 낮음)
- 기존 `activeToolCount` 배지는 버튼 활성 스타일로 대체

**완료 기준**: 파일첨부·웹검색 버튼이 항상 보이고 현재 상태 즉각 인지 가능

---

### T-4-E: 입력창 하단 힌트 영역 정리

**문제**: `ChatInputArea.tsx:513-567` — `text-xs text-gray-400` 텍스트 5-6개 동시 표시

```
현재: [대화 12/20] [입력 234/10,000자] [곧 한도 도달] [1/3 파일] [서버 운영 중심] | [Enter로 전송, Shift+Enter로 줄바꿈]
```

**작업**:
- 기본 상태: 우측 단축키 힌트만 표시 (`Shift+Enter로 줄바꿈`)
- 경고 조건에서만 세션 카운터 노출: `sessionState.isWarning` or `isLimitReached`
- 입력 길이 카운터: `inputLength >= CHAT_INPUT_WARNING_LENGTH` 시만 노출
- `"서버 운영 중심"` 텍스트 제거 (맥락 중복)

**완료 기준**: 기본 상태에서 하단 힌트 1줄, 경고 시 필요한 항목만 추가 표시

---

### T-4-F: 헤더 버튼 레이아웃 정리

**문제**: `AISidebarHeader.tsx:79-113` — 헤더 우측 버튼 4개 + CloudRunStatus 혼재

```
현재: [CloudRunStatus] [전체화면 텍스트버튼] [+새대화] [✕닫기]
```

**작업**:
- `[전체화면]` 텍스트 버튼 → 아이콘만 (`Maximize2`, 레이블 제거)
- `[+새대화]` 와 `[✕닫기]` 사이 `gap-2` → `gap-3` (실수 클릭 방지)
- `CloudRunStatusIndicator` → 헤더 서브텍스트 (`AI_SIDEBAR_SUBTITLES`) 옆 인라인으로 이동
- 최종 우측 레이아웃: `[⛶] [+] [✕]` (3버튼)

**완료 기준**: 헤더 우측이 아이콘 3개로 정리, CloudRunStatus가 타이틀 영역에 통합

---

## Phase 5 — AI 어시스턴트 고도화 (설계 필요)

> 예상 소요: 3~5일 | 리스크: 중간~높음

### T-5-A: 전체 페이지 2단 레이아웃

**문제**: `/dashboard/ai-assistant` 가 사이드바를 전체 화면에 배치한 수준 — 넓은 화면 활용 안 됨

**목표 레이아웃**:
```
┌──────────────────────────────┬──────────────────────┐
│                              │  서버 컨텍스트 패널   │
│    AI 대화 (max-w-3xl 중앙)   │  ─────────────────  │
│                              │  현재 대화 중인 서버  │
│                              │  메트릭 미니 요약     │
│    [메시지 스크롤 영역]        │  ─────────────────  │
│                              │  관련 서버 링크       │
│    [입력창]                   │                      │
└──────────────────────────────┴──────────────────────┘
```

**작업**:
1. `src/app/dashboard/ai-assistant/layout.tsx` 수정
2. 우측 `ContextPanel` 컴포넌트 신규 작성
   - 대화에서 언급된 서버 ID 추출 → 메트릭 미니 카드 표시
   - 빈 상태: "대화 시작 후 관련 서버가 여기 표시됩니다"
3. 반응형: `lg:` 이하에서 우측 패널 숨김 (사이드바와 동일 단일 컬럼)
4. 사이드바 → 전체 페이지 전환 시 메시지 히스토리 유지 (기존 `useAIChatCore` 세션 재활용)

**완료 기준**: 데스크탑(`lg:`) 이상에서 2단 레이아웃, 모바일에서 단일 컬럼

---

### T-5-B: 메시지 버블 시각 구분 강화

**문제**: 사용자·AI 메시지가 동일 배경 위에서 경계 흐릿

**작업**:
1. 사용자 메시지: 우측 정렬 + `bg-slate-100 rounded-2xl rounded-tr-sm` 버블
2. AI 응답: 좌측 정렬 + `Brain` 아이콘 (현재 `Bot` → `Brain`으로 교체) + 배경 없음
3. 스트리밍 중: 타이핑 커서 `•••` 애니메이션 (CSS `animate-pulse` 3 dot)
4. 메시지 타임스탬프: hover 시만 표시 (`opacity-0 group-hover:opacity-100`)

**완료 기준**: 사용자/AI 메시지 구분이 색상 + 정렬 + 아이콘 3가지로 명확

---

## Phase 6 — 대시보드 선택적 개선 (백로그)

> 우선순위 낮음, 별도 기획 필요

| ID | 항목 | 근거 |
|----|------|------|
| T-6-A | 헥사고날 Host Map 뷰 (Topology) | Datadog 스타일 인프라 공간 시각화. 현재 `TopologyModal.tsx`가 있으나 메인 뷰 미통합 |
| T-6-B | 서버 카드 고정 높이 → min-h 전환 | `h-[192px]` 고정 → `min-h-[192px]` 자동 확장 |
| T-6-C | 더 보기 버튼 fade-out 오버레이 패턴 | 카드 그리드 하단 점진적 페이드 + "더 보기" 오버레이 |
| T-6-D | 키보드 Tab 네비게이션 경로 정비 | 카드 간 Tab 순서 명확화, focus ring 강화 |
| T-6-E | 상태 없을 때 카드 축소 표시 | critical=0, warning=0일 때 해당 상태 카드 최소화 |
| T-6-F | 사이드바→전체 전환 애니메이션 | 헤더 전체화면 클릭 시 공유 레이아웃 전환 (View Transition API) |

---

## 작업 순서 및 의존성

```
Phase 1 (병렬 가능)
  T-1-A ──→ T-1-B, T-1-C, T-1-D (독립)

Phase 2 (Phase 1 완료 후)
  T-2-A (검색바)    ← 독립
  T-2-B (트렌드)    ← T-1-A 완료 필요 (token 공유)
  T-2-C (Uptime)   ← 독립
  T-2-D (헤더)     ← 독립

Phase 3 (Phase 2 완료 후)
  T-3-A (알림피드)  ← T-2-A 완료 후 (필터 시스템 재사용)
  T-3-B (시간범위)  ← T-2-B 완료 후 (히스토리 범위 연동)
  T-3-C (정렬버튼)  ← T-1-D 완료 후 (스타일 시스템)

Phase 4 (대시보드와 독립, 병렬 진행 가능)
  T-4-A (색상통일)  ← 독립 ⭐ 먼저
  T-4-B (탭이전)    ← T-4-A 완료 후 (색상 기준 확립)
  T-4-C (배너정리)  ← 독립
  T-4-D (도구노출)  ← 독립
  T-4-E (힌트정리)  ← 독립
  T-4-F (헤더정리)  ← T-4-B 완료 후 (탭 레이아웃 확정)

Phase 5 (Phase 4 완료 후)
  T-5-A (전체 2단)  ← T-4-A, T-4-B 완료 필요
  T-5-B (버블강화)  ← T-4-A 완료 후 (색상 기준)
```

---

## 예상 총 일정

| Phase | 영역 | 소요 | 비고 |
|-------|------|------|------|
| Phase 1 | 대시보드 코드 정리 | 0.5일 | 무중단 |
| Phase 2 | 대시보드 핵심 UX | 2~3일 | 검색·트렌드·Uptime |
| Phase 3 | 대시보드 기능 추가 | 3~5일 | 알림피드·시간범위 |
| Phase 4 | AI 사이드바 핵심 | 1~2일 | 색상·탭·배너·입력 |
| Phase 5 | AI 사이드바 고도화 | 3~5일 | 전체 레이아웃 |
| **합계** | — | **9.5~15.5일** | Phase 6 제외 |

---

## 성공 지표

| 영역 | 지표 | 현재 | 목표 |
|------|------|------|------|
| 대시보드 | 서버 이름 검색 | 불가 | 200ms 내 필터링 |
| 대시보드 | 알림 인지 경로 | 모달 2-depth | 대시보드 1-depth |
| 대시보드 | 메트릭 트렌드 파악 | 스파크라인 육안 | 텍스트 delta 즉각 확인 |
| 대시보드 | 카드 정보 밀도 | Uptime 없음 | Uptime % 인라인 표시 |
| AI 사이드바 | 기능 탭 발견성 | 우측 숨겨진 아이콘 | 헤더 탭 레이블 상시 노출 |
| AI 사이드바 | 배너 최대 동시 표시 | 최대 7개 | 최대 1개 |
| AI 사이드바 | 도구 접근 depth | + 팝오버 2단계 | 직접 버튼 1단계 |
| AI 사이드바 | 색상 무드 수 | 4개 혼재 | 1개 통일 |

---

_대시보드: Datadog Docs, New Relic Docs, Grafana Labs, Better Stack (2025-2026)_
_AI 사이드바: AISidebarV4.tsx, AISidebarHeader.tsx, EnhancedAIChat.tsx, ChatInputArea.tsx, AIAssistantIconPanel.tsx 직접 코드 분석_
