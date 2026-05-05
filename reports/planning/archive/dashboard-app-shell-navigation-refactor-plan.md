> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-04-30
> Tags: dashboard,app-shell,navigation,modal,frontend,vercel-free-tier

# Dashboard App Shell Navigation Refactor Plan

- 상태: Completed
- 작성일: 2026-04-30
- TODO.md 연결: Active Tasks > Dashboard app shell + modal-to-route refactor

## 목표

현재 `/dashboard` 한 화면 안에서 버튼과 모달로 노출되는 주요 서버 모니터링 기능을 route 기반 앱 셸로 재구성한다. 데스크톱은 좌측 navigation rail/sidebar, 모바일은 메뉴 버튼으로 여는 navigation drawer를 사용하고, 기존 우측 AI sidebar는 컨텍스트 어시스턴트로 유지한다.

핵심 방향은 "모달을 없애기"가 아니라, 반복 사용·공유·딥링크가 필요한 기능을 페이지로 승격하고 모달은 확인/권한 안내/짧은 미리보기 같은 일시적 상호작용에만 남기는 것이다.

## 사전 분석 요약

| 영역 | 현재 상태 | 개선 판단 |
|------|-----------|-----------|
| `/dashboard/layout.tsx` | `children`만 반환하는 passthrough layout | 앱 셸을 넣을 구조적 위치가 비어 있음 |
| `/dashboard/page.tsx` | SSR에서 `getOTelDashboardData()`를 읽고 `DashboardClient`로 전달 | overview route의 데이터 흐름은 유지 가능 |
| `DashboardClientRuntime` | auth/permission 확인 후 `DashboardInteractiveShell` 렌더 | auth gate는 route 전체에 재사용 필요 |
| `DashboardInteractiveShell` | header, content, 우측 AI sidebar, session/logout, auto shutdown 관리 | 좌측 nav와 우측 AI sidebar를 함께 관리할 shell 후보 |
| `DashboardContent` | `ActiveAlertsModal`, `AlertHistoryModal`, `LogExplorerModal`, `TopologyModal` 상태 직접 보유 | page route로 이동할 전역 기능 4개가 한 컴포넌트에 결합 |
| `ServerDashboard` | 서버 카드 클릭 시 `EnhancedServerModal` 열기 | `/dashboard/servers/[serverId]` 상세 페이지로 승격 필요 |
| `SystemOverviewSection` | AI 권한 없을 때 top alert 클릭으로 `EnhancedServerModal` 별도 열기 | 서버 상세 진입점이 중복됨 |
| `/dashboard/ai-assistant` | 기존 `AIWorkspace` 단독 route 존재 | 좌측 nav 항목으로 연결하되, 우측 sidebar 컨텍스트는 유지 |

현재 모달/상세 기능 규모:

| 파일 | 줄 수 | 기능 |
|------|------:|------|
| `ActiveAlertsModal.tsx` | 172 | 현재 firing alert 목록, severity count, AI prefill |
| `AlertHistoryModal.tsx` | 448 | alert history 검색/필터/통계/AI prefill |
| `LogExplorerModal.tsx` | 425 | 24h OTel log 검색/필터/terminal view |
| `TopologyModal.tsx` | 164 | React Flow 기반 infra topology |
| `EnhancedServerModal.tsx` | 488 | 서버 상세 overview/metrics/logs/network tabs |

## 문제 정의

1. 주요 모니터링 기능이 URL을 갖지 않는다.
   - 활성 알림, 이력, 로그, 토폴로지는 버튼으로만 접근 가능하다.
   - 사용자가 특정 상태를 공유하거나 새로고침 후 같은 화면으로 복귀하기 어렵다.

2. 모달이 페이지 역할을 수행한다.
   - 400줄 이상 모달이 검색, 필터, 통계, 데이터 로딩, 오류 상태까지 모두 들고 있다.
   - 화면 높이를 강제로 제한하기 때문에 실제 운영 도구처럼 오래 보는 업무에 불리하다.

3. 서버 상세 진입점이 중복되어 있다.
   - `ServerDashboard`와 `SystemOverviewSection`이 각각 `EnhancedServerModal`을 연다.
   - 기존 `/dashboard?serverId=...` deep link도 모달 오픈에 묶여 있다.

4. 대시보드 기능 구조가 AI sidebar 중심 경험과 섞여 있다.
   - 우측 AI sidebar는 유지해야 하지만, 대시보드 기본 탐색은 좌측 앱 내비게이션이 맡는 편이 더 일반적인 운영 도구 구조다.

## 범위

### 포함

- `/dashboard` 하위 app shell 도입.
- 데스크톱 좌측 navigation rail/sidebar 도입.
- 모바일 menu button + navigation drawer 도입.
- 전역 모달 기능의 page route 승격:
  - `/dashboard/alerts`
  - `/dashboard/logs`
  - `/dashboard/topology`
- 서버 목록/상세 route 도입:
  - `/dashboard/servers`
  - `/dashboard/servers/[serverId]`
- 기존 `/dashboard?serverId=...` deep link 호환.
- 기존 모달 내부 UI를 panel/view 컴포넌트로 추출해 page와 modal wrapper가 재사용 가능하게 정리.
- 우측 AI sidebar와 `queryAsOfDataSlot` 전달 유지.
- Vercel 무료 티어 원칙에 맞게 추가 polling, LLM 호출, background compute를 만들지 않음.

### 제외

- Cloud Run AI Engine 변경.
- OTel 데이터 생성기 또는 `public/data/otel-data` 형식 변경.
- Supabase schema 변경.
- 서버 모니터링 수집 주기 변경.
- AI Reporter/Analyst 백엔드 개선 추가.
- 랜딩페이지와 `/main` 화면 변경.
- 대시보드 색상 체계 전면 재디자인.

## 설계 원칙

- 앱 첫 화면은 운영 도구여야 하며, 랜딩/마케팅 화면으로 바꾸지 않는다.
- 좌측 nav는 좁고 예측 가능하게 유지한다. 장식 카드나 큰 hero section은 만들지 않는다.
- 기존 우측 AI sidebar는 "현재 화면을 이해하는 보조 패널"로 유지한다.
- 모달 제거는 단계적으로 진행한다. 먼저 content를 추출하고, route page가 안정화된 뒤 wrapper를 얇게 만들거나 제거한다.
- 데이터는 현재 SSOT를 유지한다.
  - Vercel: `src/lib/dashboard/server-data`, `src/services/metrics/MetricsProvider`, `/api/servers-unified`, `/api/monitoring/report`
  - AI Engine: 이미 연결된 monitoring data source와 `queryAsOf` 계약
- route 전환은 client navigation으로 처리하되, 같은 OTel slot/React Query cache를 재사용해 불필요한 API fan-out을 만들지 않는다.

## 권장 Route 구조

| Route | 화면 역할 | 기존 기능 출처 |
|------|-----------|----------------|
| `/dashboard` | Overview: summary, system resource, top alerts compact, 핵심 서버 요약 | `DashboardContent`, `DashboardSummary`, `SystemOverviewSection` |
| `/dashboard/servers` | 서버 목록, 상태 필터, pagination/page size | `ServerDashboard` |
| `/dashboard/servers/[serverId]` | 서버 상세 overview/metrics/logs/network | `EnhancedServerModal` |
| `/dashboard/alerts` | 활성 알림 + 알림 이력, severity/state/server/time/keyword 필터 | `ActiveAlertsModal`, `AlertHistoryModal` |
| `/dashboard/logs` | 24h OTel log explorer | `LogExplorerModal` |
| `/dashboard/topology` | infra topology map | `TopologyModal` |
| `/dashboard/ai-assistant` | 기존 AI workspace route | existing |

`/dashboard/reports`는 이번 범위에서 보류한다. Reporter는 현재 AI sidebar/workspace의 기능 탭으로 동작하고, 이번 작업의 직접 대상은 "대시보드 모달 기능"이기 때문이다. 필요하면 후속 plan에서 Reporter를 독립 route로 승격한다.

## 계약 (Contract)

> 계약 섹션 확정 완료. 구현은 Task 0 failing test 커밋 이후 진행한다.

### 변경 대상 파일

예상 변경 대상:

- `src/app/dashboard/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/DashboardClientRuntime.tsx`
- `src/app/dashboard/DashboardInteractiveShell.tsx`
- `src/app/dashboard/DashboardClient.tsx`
- `src/components/dashboard/DashboardContent.tsx`
- `src/components/dashboard/DashboardSummary.tsx`
- `src/components/dashboard/ServerDashboard.tsx`
- `src/components/dashboard/SystemOverviewSection.tsx`
- `src/components/dashboard/ActiveAlertsModal.tsx`
- `src/components/dashboard/alert-history/AlertHistoryModal.tsx`
- `src/components/dashboard/log-explorer/LogExplorerModal.tsx`
- `src/components/dashboard/TopologyModal.tsx`
- `src/components/dashboard/EnhancedServerModal.tsx`
- 신규 예상:
  - `src/app/dashboard/servers/page.tsx`
  - `src/app/dashboard/servers/[serverId]/page.tsx`
  - `src/app/dashboard/alerts/page.tsx`
  - `src/app/dashboard/logs/page.tsx`
  - `src/app/dashboard/topology/page.tsx`
  - `src/components/dashboard/shell/DashboardAppShell.tsx`
  - `src/components/dashboard/shell/DashboardNavigation.tsx`
  - `src/components/dashboard/shell/dashboard-navigation.config.ts`
  - `src/components/dashboard/panels/ActiveAlertsPanel.tsx`
  - `src/components/dashboard/panels/AlertHistoryPanel.tsx`
  - `src/components/dashboard/panels/LogExplorerPanel.tsx`
  - `src/components/dashboard/panels/TopologyView.tsx`
  - `src/components/dashboard/panels/ServerDetailView.tsx`

### 변경 금지/주의 파일

- `src/app/page.tsx`
- `src/app/main/**`
- `src/components/landing/**`
- `public/data/otel-data/**`
- `cloud-run/ai-engine/**`

### URL 계약

| URL | 기대 동작 | 호환성 |
|-----|-----------|--------|
| `/dashboard` | overview 표시, 좌측 nav active=overview | 기존 진입 유지 |
| `/dashboard/servers` | 서버 목록 표시 | 기존 `ServerDashboard` 기능 유지 |
| `/dashboard/servers/[serverId]` | 해당 서버 상세 표시, 없는 ID는 not-found/empty state | 기존 모달 상세를 page로 승격 |
| `/dashboard?serverId=<id>` | `/dashboard/servers/<id>`로 client/server redirect 또는 호환 focus 처리 | `ReportCard` 기존 링크 보호 |
| `/dashboard/alerts` | 활성 알림과 이력 표시 | 기존 활성 알림/이력 모달 기능 통합 |
| `/dashboard/logs` | 로그 탐색기 표시 | 기존 log explorer 모달 기능 유지 |
| `/dashboard/topology` | topology view 표시 | 기존 topology 모달 기능 유지 |
| `/dashboard/ai-assistant` | 기존 AI workspace 표시 | 기존 route 유지 |

### UI 계약

| 화면 | 입력/트리거 | 기대 출력 |
|------|-------------|-----------|
| Desktop shell | `/dashboard*` 진입 | 좌측 nav, 상단 header, 본문 scroll 영역, 우측 AI sidebar가 겹치지 않음 |
| Mobile shell | menu button 클릭 | nav drawer가 열리고 focus/ESC/닫기 동작이 가능 |
| Summary actions | 알림/이력/로그/토폴로지 버튼 클릭 | 모달 대신 대응 route로 이동 |
| Server card | 카드 클릭 | `/dashboard/servers/[serverId]`로 이동 |
| Top alert row | AI 권한 없음 또는 상세 보기 진입 | 서버 상세 route로 이동 |
| Right AI sidebar | 현재 route 어디서든 열기 | 기존 selected function, prefill, `queryAsOfDataSlot` 유지 |

### 데이터 계약

| 데이터 | 유지 기준 |
|--------|-----------|
| OTel slot | overview, alerts, logs, topology, server detail 모두 같은 KST 10분 slot 기준을 사용 |
| Monitoring report | `/api/monitoring/report` shape 변경 없음 |
| Log explorer | `/api/servers-unified?action=logs` shape 변경 없음 |
| Server metrics | `useServerMetrics()`의 OTel timeseries 우선 로딩 유지 |
| AI sidebar | Cloud Run/LLM 호출은 사용자가 AI 기능을 실행할 때만 발생 |

## 테스트 시나리오 (구현 전 확정)

Task 0에서 아래 테스트를 먼저 failing state로 추가한다.

- [x] 시나리오 1: dashboard shell navigation — `/dashboard`에서 좌측 nav가 보이고 `개요/서버/알림/로그/토폴로지/AI 어시스턴트` 항목이 route와 연결된다.
- [x] 시나리오 2: right AI sidebar preservation — 새 shell에서도 AI sidebar open/close와 `queryAsOfDataSlot` 전달이 유지된다.
- [x] 시나리오 3: summary route actions — `DashboardSummary`의 알림/이력/로그/토폴로지 액션이 modal state 대신 route navigation으로 이어진다.
- [x] 시나리오 4: alerts page parity — `/dashboard/alerts`에서 활성 알림 count, 이력 검색, severity/state/server/time 필터가 기존 모달과 동등하게 동작한다.
- [x] 시나리오 5: logs page parity — `/dashboard/logs`에서 keyword/level/source/server 필터, reset, retry, terminal list가 기존 모달과 동등하게 동작한다.
- [x] 시나리오 6: topology page parity — `/dashboard/topology`에서 React Flow topology가 표시되고 기존 노드/레이어/edge summary가 유지된다.
- [x] 시나리오 7: server detail route — `/dashboard/servers/[serverId]`에서 overview/metrics/logs 탭이 표시되고 새로고침 가능한 URL로 동작한다.
- [x] 시나리오 8: legacy deep link compatibility — `/dashboard?serverId=<id>`가 기존처럼 서버 상세를 보여주거나 새 route로 안전하게 이동한다.
- [x] 시나리오 9: mobile navigation — 좁은 viewport에서 menu button, drawer open/close, active route 표시가 동작하고 본문과 AI sidebar가 겹치지 않는다.

## Task 목록

> 구현 착수 전 Status를 Approved로 올리고, Task 0 failing test 커밋을 먼저 만든다.

- [x] Task 0 — failing test 추가
  - 완료 기준: 위 테스트 시나리오 중 route/shell/parity 핵심 테스트가 현재 코드에서 실패한다.
  - 커밋 메시지: `test(spec): dashboard app shell add failing tests before implementation`

- [x] Task 1 — Dashboard app shell foundation
  - 완료 기준: auth/session/auto-shutdown/right AI sidebar를 보존하면서 좌측 nav desktop rail과 mobile drawer가 추가된다.
  - 주요 검토: `DashboardClientRuntime`과 `DashboardInteractiveShell` 책임 분리, route children 구조.

- [x] Task 2 — Modal content를 page-ready panel로 추출
  - 완료 기준: `ActiveAlertsPanel`, `AlertHistoryPanel`, `LogExplorerPanel`, `TopologyView`, `ServerDetailView`가 modal shell 없이 렌더 가능하다.
  - 기존 modal 컴포넌트는 필요 시 wrapper로 유지한다.

- [x] Task 3 — Route pages 추가
  - 완료 기준: `/dashboard/servers`, `/dashboard/servers/[serverId]`, `/dashboard/alerts`, `/dashboard/logs`, `/dashboard/topology`가 직접 접근/새로고침 가능하다.
  - 기존 `/dashboard/ai-assistant`는 nav에 연결하되 동작을 바꾸지 않는다.

- [x] Task 4 — 기존 overview의 modal trigger 제거/전환
  - 완료 기준: `DashboardContent`, `ServerDashboard`, `SystemOverviewSection`의 page 역할 모달 상태가 route navigation으로 대체된다.
  - `AILoginRequiredModal` 같은 권한 안내 모달은 유지한다.

- [x] Task 5 — Legacy link compatibility
  - 완료 기준: `ReportCard`의 `/dashboard?serverId=...` 링크와 기존 테스트가 깨지지 않거나 새 `/dashboard/servers/[id]` 링크로 안전하게 전환된다.

- [x] Task 6 — Free-tier and bundle side-effect guard
  - 완료 기준: route 추가가 추가 LLM 호출, background polling 증가, Cloud Run 호출 증가를 만들지 않음을 테스트/리뷰로 확인한다.
  - 대형 React Flow/terminal/detail view는 route chunk 또는 dynamic import로 유지한다.

- [x] Task 7 — QA and documentation
  - 완료 기준: targeted component tests, route tests, dashboard E2E smoke, type-check/lint/test:quick 통과 후 TODO/plan 상태를 갱신한다.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1 | `feat:` | ✅ | ❌ | ✅ |
| Task 2 | `refactor:` | ✅ | ❌ | ✅ |
| Task 3 | `feat:` | ✅ | ❌ | ✅ |
| Task 4 | `refactor:` | ✅ | ❌ | ✅ |
| Task 5 | `fix:` 또는 `refactor:` | ✅ | ❌ | ✅ |
| Task 6~7 | `test:`/`docs:` | ✅ | ❌ | 필요 시 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing tests가 route/app-shell 계약을 과도하게 고정하지 않는지 |
| Task 1 완료 후 | auth/session/auto-shutdown/right AI sidebar 회귀 여부 |
| Task 2~3 완료 후 | modal content 추출의 상태 보존, 직접 URL 접근, 새로고침 안정성 |
| Task 4~5 완료 후 | 기존 사용자 진입점과 deep link 호환성 |
| 전체 완료 후 | Vercel free-tier compute 증가 여부, mobile layout, accessibility, QA 기록 |

## 완료 검증

- `npx vitest run --config config/testing/vitest.config.dom.ts src/app/dashboard/DashboardInteractiveShell.test.tsx src/components/dashboard/DashboardContent.test.tsx src/components/dashboard/ServerDashboard.test.tsx src/app/dashboard/dashboard-route-contract.test.ts` → 18/18 pass
- `npx vitest run --config config/testing/vitest.config.dom.ts src/components/dashboard/ActiveAlertsModal.test.tsx src/components/dashboard/alert-history/AlertHistoryModal.test.tsx src/components/dashboard/log-explorer/LogExplorerModal.test.tsx src/components/dashboard/dashboard-modal-theme-contract.test.tsx src/components/dashboard/SystemOverviewSection.test.tsx src/components/dashboard/DashboardSummary.test.tsx` → 22/22 pass
- `PLAYWRIGHT_SKIP_SERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3100 PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-server-cards.spec.ts tests/e2e/dashboard-alerts-logs.spec.ts --config playwright.config.ts` → 12/12 pass
- `npm run type-check` → pass
- `npm run test:quick` → pass
- `npm run lint` → pass (`reports/qa/qa-tracker.json` size info only)
- `npm run build` → pass
- `git diff --check` → pass

## 사이드 이펙트 검토

- Cloud Run AI Engine, OTel 데이터 형식, Supabase schema 변경 없음.
- `/api/monitoring/report`, `/api/servers-unified`, `useServerMetrics()` 기존 데이터 계약 유지.
- 좌측 navigation 추가는 client route 전환만 수행하며 LLM 호출, background polling, Cloud Run fan-out을 늘리지 않음.
- Alert/Log/Topology/AI workspace는 route별 dynamic import 또는 기존 lazy boundary를 유지해 overview 초기 렌더 부담을 억제.
- 기존 `/dashboard?serverId=<id>` deep link는 `/dashboard/servers/<id>` redirect로 호환.

## 사이드 이펙트 분석

| 위험 | 가능 영향 | 완화책 |
|------|-----------|--------|
| layout/auth 책임 이동 | dashboard 접근 권한 확인 회귀 | 기존 `DashboardClientRuntime` 테스트를 shell route까지 확장 |
| route별 data load 반복 | Vercel server function 실행 증가 | 정적 OTel load 유지, React Query stale/gc 정책 재사용, background polling 추가 금지 |
| React Flow/topology chunk 증가 | initial dashboard bundle 증가 | topology route에서만 dynamic import |
| server detail modal 제거 | 기존 keyboard/focus modal 테스트 실패 | page 접근성 테스트로 대체하고 wrapper 유지 구간을 둠 |
| `/dashboard?serverId=` 변경 | Reporter card link 회귀 | compatibility redirect/test 추가 |
| 우측 AI sidebar와 좌측 nav 공존 | desktop/mobile overlap | shell grid/flex contract test와 Playwright viewport smoke 추가 |
| alert/log 필터 URL 미동기화 | 새로고침 시 필터 초기화 | 1차는 기능 parity 우선, query param filter persistence는 후속 또는 Task 3 범위 내 선택 |

## 완료 기준

- [ ] Status `Approved` 이후 Task 0 failing test 커밋이 존재한다.
- [ ] 좌측 nav desktop rail/sidebar와 mobile drawer가 동작한다.
- [ ] `/dashboard/alerts`, `/dashboard/logs`, `/dashboard/topology`, `/dashboard/servers`, `/dashboard/servers/[serverId]`가 직접 접근 가능하다.
- [ ] 기존 overview 기능이 route navigation으로 이어진다.
- [ ] 기존 `/dashboard?serverId=...` 링크가 깨지지 않는다.
- [ ] 우측 AI sidebar와 `queryAsOfDataSlot` 계약이 유지된다.
- [ ] Cloud Run/LLM 호출 증가가 없다.
- [ ] `npm run type-check` 통과.
- [ ] `npm run lint` 또는 `npm run lint:changed` 통과.
- [ ] `npm run test:quick` 통과.
- [ ] 관련 targeted Vitest와 dashboard E2E smoke 통과.
- [ ] TODO.md와 plan 상태가 구현 결과에 맞게 갱신된다.

## 현재 결론

이번 작업은 단순 UI 이동이 아니라 대시보드 정보 구조 변경이다. 따라서 바로 구현하지 않고 Draft plan으로 두고, 구현 착수 시 `Approved` 전환 후 failing tests부터 커밋한다.
