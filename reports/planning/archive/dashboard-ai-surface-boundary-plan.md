> Owner: project
> Status: Completed
> Last reviewed: 2026-05-09

# Dashboard AI Surface Boundary Plan

- 상태: Completed
- 작성일: 2026-05-09
- TODO.md 연결: Backlog > Dashboard AI surface boundary 정렬

## 목표

서버 모니터링 화면과 AI Assistant 화면의 책임 경계를 다시 정렬한다.

OpenManager AI의 제품 서사는 "AI가 처음부터 모든 화면을 대체하는 AI 모니터링 제품"이 아니라, 사용자가 직접 만든 synthetic 서버 모니터링 제품에 AI Assistant / Agent 모듈을 붙인 포트폴리오형 산출물이다. 따라서 서버 카드, 서버 상세, 알림 행 같은 core monitoring surface는 독립적인 모니터링 제품처럼 동작해야 하고, AI 실행 기능은 전역 AI 사이드바와 `/dashboard/ai-assistant` 전체 페이지에 집중해야 한다.

## 상세 사유

### 1. 포트폴리오 서사 정합성

이 프로젝트는 회사 제품을 그대로 복제한 것이 아니라, 서버 모니터링 도메인을 직접 모조 구현한 뒤 그 위에 AI Assistant / Agent 기능을 탑재한 대회/포트폴리오 산출물이다. 사용자 제공 컨텍스트 기준으로 이 작업은 vibe coding 기반 대회 출품작이며 2등 결과가 있는 프로젝트다. 이 서사에서 중요한 것은 "기존 도메인 제품을 이해하고, 그 제품에 AI 모듈을 설계해 붙였다"는 점이다.

서버 카드나 알림 행마다 AI 버튼을 넣으면 제품 인상이 "모니터링 제품 + AI 모듈"이 아니라 "모든 모니터링 기능이 AI 버튼에 종속된 화면"으로 흐른다. 이는 포트폴리오의 핵심 메시지를 약하게 만든다.

### 2. Core monitoring 독립성

Dashboard, Server list, Server detail, Logs, Alerts, Topology는 AI 없이도 하나의 모니터링 제품으로 읽혀야 한다.

```
Core Monitoring
  ├─ 서버 목록과 카드
  ├─ 서버 상세 페이지
  ├─ 메트릭 그래프
  ├─ 로그/알림
  └─ 토폴로지

AI Module
  ├─ Header AI Assistant toggle
  ├─ AISidebarV4
  └─ /dashboard/ai-assistant
```

Core monitoring surface에는 상세/로그/알림/토폴로지 이동처럼 모니터링 제품 자체의 탐색 액션을 유지한다. AI 질의, Agent 실행, Reporter/Analyst 결과, evidence/artifact UX는 AI module surface 안에 둔다.

### 3. UX 집중도

서버 카드의 주된 목적은 18대 서버를 빠르게 스캔하는 것이다. 카드에는 상태, 메트릭 수치, sparkline, 로그/상세 진입이 중요하다. AI CTA는 경고/위험 서버에서 눈에 띄는 장점이 있지만, 카드의 시각 우선순위를 흐리고 "스캔"보다 "AI 실행"을 먼저 보이게 할 수 있다.

서버 상세 페이지는 모달보다 페이지가 맞다. 상세 페이지는 한 서버의 메트릭, 로그, 서비스, 네트워크를 깊게 조사하는 화면이므로 더 많은 수정 여지가 있다. 다만 그 수정은 AI 버튼 추가가 아니라 모니터링 제품다운 요약/탭/그래프/로그 흐름 강화여야 한다.

### 4. 비용/경계 원칙

AI 기능은 Cloud Run, provider quota, stream/job state, rate limit과 연결된다. Dashboard surface에 AI 실행 진입점을 넓히면 사용자가 의도치 않게 LLM 경로를 자주 실행할 수 있고, Free Tier 원칙과 QA 경계가 흐려진다. Header AI Assistant와 AI 전체 페이지는 명확한 opt-in surface이므로 비용/품질/QA 경계를 관리하기 쉽다.

### 5. 기존 완료 작업과의 관계

`reports/planning/archive/dashboard-server-detail-ux-plan.md`는 2026-05-09 완료 당시 서버 상세 헤더에 "AI에게 물어보기" 액션을 추가한 이력을 보존한다. 이 계획서는 그 완료 이력을 되돌려 쓰는 문서가 아니라, 제품 포지션 재정렬 후속 계획이다.

즉, 과거 구현은 당시 UX 문제 해결로 유효했지만, 현재 제품 서사 기준에서는 per-entity AI CTA를 제거하거나 AI surface로 이동하는 것이 맞다.

## 문서 반영 상태 점검 (2026-05-09)

이번 boundary 재정렬은 신규 문서를 늘리는 대신 기존 설계/상태 문서에 연결해 반영한다.

| 문서 | 반영 상태 | 확인/보강 내용 |
|------|-----------|----------------|
| `reports/planning/TODO.md` | 반영됨 | Backlog에 `Dashboard AI surface boundary 정렬` 추가. #322 완료 이력의 per-entity AI CTA는 후속 제거/이동 대상으로 재분류. |
| `docs/design/05-ui-design.md` | 반영됨 | Core monitoring surface와 AI module surface를 분리하는 UI boundary 추가. 서버 카드 sparkline과 서버 상세 페이지를 monitoring UX로 유지하도록 명시. |
| `docs/reference/architecture/ai/ai-assistant-improvement-boundaries.md` | 반영됨 | "server card/detail/alert row에 AI 실행 CTA를 흩뿌리는 것"을 Not recommended로 분류. |
| `docs/llms.md` | 반영됨 | 외부/LLM 소비용 프로젝트 설명에 synthetic monitoring product + attached AI module 포지션 반영. |
| `docs/status.md` | 반영됨 | 현재 제품 성격과 핵심 사용자 흐름을 monitoring surface와 AI surface로 분리. |
| `docs/reference/architecture/system/system-architecture-current.md` | 반영됨 | 시스템 상위 설명에 monitoring product + AI Assistant module 경계 반영. |
| `docs/reference/architecture/data/otel-data-architecture.md` | 반영됨 | synthetic OTel data가 dashboard와 AI의 공통 근거지만 UI 실행 surface는 분리됨을 명시. |
| `docs/guides/testing/e2e-testing-guide.md` | 반영됨 | 서버 카드 클릭 기준을 상세 모달이 아니라 상세 페이지 이동으로 정정. |
| `reports/planning/archive/dashboard-server-detail-ux-plan.md` | 반영됨 | 완료 이력은 보존하되 AI CTA는 이 계획서의 제거/이동 대상으로 재분류. |

## 현재 코드 감사 결과 (2026-05-09)

### git HEAD 기준 (커밋 `5e9eafbb2`)

git HEAD에는 문서화한 목표와 맞지 않는 per-entity AI 진입점이 존재한다.

```text
git HEAD 기준 AI 진입점
  ├─ Dashboard overview Top 5 click -> AI prefill
  ├─ ServerDashboard -> ImprovedServerCard onAskAI 전달
  ├─ ImprovedServerCard warning/critical AI badge/button (AIInsightBadge)
  ├─ ServerDetailView "AI에게 물어보기" (onAskAI prop)
  ├─ ActiveAlertsPanel row "AI"
  └─ AlertHistoryPanel row "AI"
```

### 워킹 디렉토리 기준 (2026-05-09, 미커밋)

워킹 디렉토리에 **29개 미커밋 변경**이 있으며, per-entity AI CTA 제거 작업이 진행되었다. 현재 코드에서는 아래 항목이 이미 제거됨:

| 파일 | 변경 내용 |
|------|-----------|
| `ServerDetailView.tsx` | `onAskAI` prop, `canAskAI`, "AI에게 물어보기" 버튼 제거 |
| `DashboardRoutedContent.tsx` | `onAskAIAboutAlert`, `askAIAboutMonitoringAlert`, `askAIAboutServer` 제거 |
| `ImprovedServerCard.tsx` | `onAskAI`, `AIInsightBadge`, `handleAskAI` 제거 |
| `alert-ai-context.ts` + 테스트 | 파일 전체 삭제 |
| `ActiveAlertsModal.tsx`, `AlertHistoryModal.tsx` | alert row AI 버튼 제거 |
| `DashboardInteractiveShell.tsx` | AI prefill handler wiring 제거 |
| 관련 test 파일 6개 | AI CTA 기대값 제거/교체 |
| docs 파일 7개 | surface boundary 반영 |

**현재 남은 작업**: 없음. Task 0~6 구현/검증/QA 기록은 완료됐고, 커밋은 사용자 명시 요청 전까지 미실행으로 판단을 고정함.

```text
유지해야 하는 AI 진입점 (변경 없음)
  ├─ DashboardHeader 전역 AI 어시스턴트 버튼
  ├─ AISidebarV4
  └─ /dashboard/ai-assistant
```

이 계획은 그 구현을 즉시 되돌리기보다, 어떤 부분을 유지하고 어떤 부분을 선택적으로 제거할지 기준을 고정한다. 테스트도 일부는 이미 "AI CTA가 없어야 한다" 기대값으로 교체됨.

## 최근 7일 변경 재분류

최근 7일 변경을 현재 목표 기준으로 재분류하면 다음과 같다.

| 변경 | 평가 | 후속 판단 |
|------|------|-----------|
| `feat(dashboard): improve server detail UX` (`5e9eafbb2`, 2026-05-09) | 부분 유지, 부분 수정 | 서버 상세 페이지화, 상태 배지, 중복 metric grid 제거는 유지. 상세 헤더 `AI에게 물어보기`와 카드/알림 AI CTA wiring은 현재 목표와 충돌하므로 제거 대상. |
| `feat(dashboard): fix responsive layout overflow` (`45ec6295f`, 2026-05-08) | 유지 | 와이드 화면 과확장 방지와 grid 조정은 monitoring UX 개선이며 AI boundary와 충돌하지 않음. |
| `feat: migrate dashboard charts to nivo and svg` (`40232fb84`, 2026-05-07) | 유지 | 서버 카드 sparkline을 제거하지 않고 SVG/Nivo 기반으로 보존한 작업이므로 현재 목표와 부합. |
| `feat: remove ai-feedback feature` (`9bbab22f1`, 2026-05-07) | 유지 | AI feedback UI 제거는 AI surface 정리에 부합하며 core monitoring 기능 회귀로 보지 않음. |
| Sentry/dead code cleanup (`73a092ee7`, `13929a0c1`) | 유지 | 관측/unused cleanup이며 서버 모니터링 core UI 목표와 직접 충돌 없음. 단, 삭제된 파일이 dashboard route 계약을 대체하지 않았는지는 구현 QA에서 확인. |
| AI Assistant artifact/runtime 고도화 작업들 | 유지 | AI module surface 내부 개선으로 분류. Dashboard core surface에 AI 실행 버튼을 늘리는 근거로 사용하지 않음. |

## 선택적 복구 및 참조 기준

이 작업은 `git revert`나 파일 단위 전체 복구가 아니다. 최근 변경 중 제품 목표와 맞는 부분은 유지하고, surface boundary와 충돌하는 부분만 제거한다.

```text
복구 전략
  1. 이전 커밋 전체로 되돌리지 않는다.
  2. good change와 drift change를 분리한다.
  3. 서버 상세 페이지 형식은 유지한다.
  4. per-entity AI CTA와 관련 wiring/test expectation만 제거한다.
  5. 제거 후 AI sidebar/full page 경로가 살아 있는지 별도 검증한다.
```

이전 모델/커밋을 참조할 때는 아래 기준을 사용한다.

```bash
# AI CTA가 상세 페이지에 들어가기 전 상태 참고
git show 5e9eafbb2^:src/components/dashboard/ServerDetailView.tsx

# 상태 배지/페이지 개선이 들어간 현재 상세 페이지 참고
git show 5e9eafbb2:src/components/dashboard/ServerDetailView.tsx

# chart migration 이후 sparkline 유지 방식 참고
git show 40232fb84:src/components/dashboard/ImprovedServerCard.parts.tsx
```

보존할 것과 제거할 것은 다음처럼 구분한다.

| 구분 | 항목 | 판단 |
|------|------|------|
| 보존 | 서버 카드 CPU/MEM/DISK sparkline | core monitoring scan UX이므로 반드시 유지 |
| 보존 | 서버 카드 클릭 -> `/dashboard/servers/[serverId]` | 상세 페이지 전환은 현재 목표와 부합 |
| 보존 | 서버 상세 페이지 방식 | 모달보다 URL/공간/검증 측면에서 유리하므로 유지 |
| 보존 | 서버 상세 상태 배지, Live toggle, metrics/logs/services/network | AI 없이도 읽히는 monitoring detail 구성 요소 |
| 제거 | 서버 카드 AI badge/button | 카드 스캔 우선순위를 흐리고 AI 종속 인상을 만듦 |
| 제거 | 서버 상세 헤더 `AI에게 물어보기` | 상세 페이지를 AI 실행 surface처럼 보이게 함 |
| 제거 | 알림 row `AI` 버튼 | 알림/로그 탐색 surface를 AI 실행 surface로 바꿈 |
| 제거 | overview Top 5 click -> AI prefill | Top alert click은 서버 상세/알림/로그 탐색으로 남기는 것이 맞음 |
| 교체 | 기존 AI CTA 기대 테스트 | "없어야 함" 계약과 전역 AI 유지 계약으로 교체 |

## 범위

### 포함

- 서버 카드의 sparkline 그래프와 핵심 메트릭은 유지한다.
- 서버 카드/서버 상세/알림/개요 영역의 per-entity AI CTA 제거 또는 비노출.
- Header의 전역 AI Assistant 버튼 유지.
- `/dashboard/ai-assistant` 전체 페이지 유지.
- `AISidebarV4`, `AIWorkspace`, `EnhancedAIChat`, `AnalysisBasisBadge`, artifact/evidence UI 유지.
- `ServerDetailView`는 모달 대체 페이지로 유지하고, 모니터링 상세 화면으로 강화한다.
- 문서와 테스트 가이드에서 "상세 모달" 잔여 표현을 "상세 페이지" 기준으로 정리한다.

### 제외

- AI runtime, agent routing, provider policy 변경.
- Cloud Run AI Engine 계약 변경.
- OTel 데이터 계약 변경.
- 새로운 route 추가.
- 서버 상세 페이지를 다시 모달로 되돌리는 작업.
- 서버 카드 sparkline 제거.

## 계약 (Contract)

### 변경 대상 파일

| 영역 | 파일 | 변경 의도 |
|------|------|----------|
| Dashboard overview | `src/components/dashboard/SystemOverviewSection.tsx` | Top alert click은 서버 상세/알림/로그 탐색으로 유지하고 AI prefill 호출 제거 |
| Dashboard content wiring | `src/components/dashboard/DashboardContent.tsx` | `onAskAIAboutAlert` props 전달 제거 또는 core monitoring surface 미사용으로 축소 |
| Routed content wiring | `src/components/dashboard/DashboardRoutedContent.tsx` | 서버/상세/알림 panel에 AI 분석 props 전달 제거 |
| Shell wiring | `src/app/dashboard/DashboardInteractiveShell.tsx` | Header AI sidebar toggle은 유지하되 dashboard row/card prefill 핸들러 제거 |
| Server list | `src/components/dashboard/ServerDashboard.tsx` | 서버 카드 `onAskAI` 전달 제거, 로그/상세 진입 유지 |
| Server card | `src/components/dashboard/ImprovedServerCard.tsx` | sparkline 유지, AI badge/action 제거, 시각 노이즈 최소 조정 |
| Server detail | `src/components/dashboard/ServerDetailView.tsx` | `AI에게 물어보기` 버튼 제거, 상세 페이지 요약/메트릭/로그 흐름 강화 |
| Alerts | `src/components/dashboard/ActiveAlertsModal.tsx`, `src/components/dashboard/alert-history/AlertHistoryModal.tsx` | 알림 row의 AI 분석 버튼 제거, 알림/로그/서버 상세 탐색 유지 |
| Tests | 관련 `*.test.tsx` | per-entity AI CTA 기대값 제거, 상세/로그/알림 탐색 기대값으로 교체 |

### 화면 계약

| 화면 | 허용 AI 진입 | 금지 AI 진입 |
|------|-------------|-------------|
| Dashboard header | 전역 `AI 어시스턴트` 버튼 | 없음 |
| `/dashboard` overview | Header/sidebar를 통한 전역 AI만 | Top alert row별 AI 분석 버튼 |
| `/dashboard/servers` | Header/sidebar를 통한 전역 AI만 | 서버 카드별 AI badge/button |
| `/dashboard/servers/[serverId]` | Header/sidebar를 통한 전역 AI만 | 상세 헤더의 "AI에게 물어보기" |
| `/dashboard/alerts` | Header/sidebar를 통한 전역 AI만 | 알림 행별 AI 분석 버튼 |
| `/dashboard/logs` | Header/sidebar를 통한 전역 AI만 | 로그 행별 AI 분석 버튼 |
| `/dashboard/ai-assistant` | AI 전체 페이지 기능 전체 허용 | 해당 없음 |

### 유지해야 하는 동작

- 서버 카드 클릭은 `/dashboard/servers/[serverId]` 상세 페이지로 이동한다.
- 서버 카드의 CPU/MEM/DISK sparkline은 유지한다.
- 서버 상세 페이지는 overview/metrics/logs 탭 구조를 유지한다.
- AI 사이드바와 전체 AI 페이지는 기존 selectedFunction, stream/job, artifact/evidence 렌더링을 유지한다.
- Dashboard와 AI는 같은 OTel/MonitoringDataSource 근거를 사용하되, 실행 UI surface는 분리한다.

### 테스트 시나리오 (구현 전 확정)

- [ ] 서버 카드: warning/critical 서버에서도 AI 분석 버튼이 없고, sparkline과 로그/상세 진입은 유지된다.
- [x] 서버 상세: 헤더에 상태 배지와 Live toggle은 유지되지만 "AI에게 물어보기" 버튼은 없다.
- [ ] 알림 화면: 활성/이력 알림 row에 AI 분석 버튼은 없고, 서버/로그/알림 탐색은 유지된다.
- [ ] Header: `/dashboard/*`에서 전역 `AI 어시스턴트` 버튼은 AI 페이지를 제외하고 유지된다.
- [ ] AI 전체 페이지: `/dashboard/ai-assistant`의 Chat/Reporter/Analyst 기능은 유지된다.
- [ ] AI 사이드바: Header 버튼으로 열리고 기존 stream/job/evidence 흐름이 유지된다.

## Task 목록

> 계약 섹션이 완성되어 2026-05-09 구현 착수 상태로 전환했다. Task 0은 테스트 기대값을 먼저 새 boundary 계약으로 교체한 뒤 구현을 진행한다.

- [x] Task -1 — 문서/계획 반영: 제품 포지션, 현재 코드 감사 결과, 최근 7일 변경 재분류, 선택적 복구 기준 문서화
- [x] Task 0 — failing/regression spec 추가: core monitoring surface에 per-entity AI CTA가 노출되지 않는 계약 고정
  - 교체 대상: 기존 "AI CTA가 렌더링/호출되어야 한다" 테스트를 "core monitoring surface에는 AI CTA가 없어야 한다" 테스트로 변경
  - 유지 대상: Header AI Assistant, AISidebarV4, `/dashboard/ai-assistant` 렌더링/실행 계약
- [x] Task 1 — dashboard overview/server list/detail의 AI CTA wiring 제거
  - 제거 대상: `DashboardContent`/`DashboardRoutedContent`에서 server card/detail/overview로 전달되는 AI prefill handler
  - 유지 대상: Header AI sidebar toggle과 AI page route
- [x] Task 2 — active alerts/history alerts의 AI 분석 버튼 제거 및 탐색 UX 유지
  - 제거 대상: active/history alert row의 `AI` 버튼과 관련 props
  - 유지 대상: alert row의 로그 이동, 서버/알림 필터 탐색
- [x] **Task 2.5 — 미커밋 변경 검증/커밋 판단**
  - Task 0~2와 Task 4~5의 구현이 워킹 디렉토리에 완료됨 (29개 미커밋 파일)
  - 검증 상태(2026-05-09 재확인): targeted Dashboard DOM suite, `npm run type-check`, `npm run lint`, `npm run test:quick`, `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` 모두 통과
  - 커밋 판단: 명시적인 커밋 요청 전에는 미실행. 요청 시 커밋 prefix는 `refactor(dashboard): remove per-entity AI CTAs` 또는 분리 커밋
  - `3xl:grid-cols-4` 확인 결과: `src/app/globals.css`와 `src/styles/globals.css`에 `--breakpoint-3xl: 1920px`가 정의되어 Tailwind v4 CSS 변수 방식 기준으로 유효. `ServerDashboard.test.tsx`에서 class contract도 보호하므로 교체 불필요.
- [x] Task 3 — 서버 상세 페이지를 모니터링 상세 화면으로 보강
  - 완료 기준:
    - 헤더: 상태 배지 + Live/Paused toggle + 서버명/타입/위치. AI 없이도 핵심 context 전달.
    - 탭 구조: 종합 상황(overview) / 성능 분석(metrics) / 로그 & 네트워크 — 현행 유지.
    - 탭 콘텐츠: `EnhancedServerModal.*` 탭 컴포넌트를 재사용하되 외부 card wrapper의 `rounded-lg border shadow-sm` 중첩을 줄여 "modal 안에 modal" 느낌 제거. full-width section 구조로 보정.
    - AI 없이도 메트릭 수치 + 로그 + 네트워크 테이블이 주요 정보로 읽혀야 함.
  - 참조: `5e9eafbb2`의 상태 배지 유지. `ServerModalTabNav` 탭 nav는 현행 유지.
  - 범위 외: 탭 컴포넌트 전체 재작성, EnhancedServerModal.* 이름 변경 (이름은 내부 구현 세부사항으로 남김).
  - 구현 결과: 헤더 하단에 `서버 운영 요약`을 추가해 현재 병목 메트릭, 실행 서비스 수, 알림/경고 로그 수, 네트워크 상태를 AI 없이 즉시 확인하도록 보강.
- [x] Task 4 — 서버 카드 그리드/시각 노이즈 조정
  - 완료 기준: sparkline 유지, grid mode에 xl 브레이크포인트 추가 (과도한 가로 확장 방지).
  - 워킹 디렉토리에서 `xl:grid-cols-3 3xl:grid-cols-4` 추가됨 — Task 2.5 커밋 시 포함.
  - 참고: pulse animation은 이미 warning/critical 조건(`needsAttention`)에서만 적용됨. 추가 수정 불필요.
- [x] Task 5 — 문서/테스트 가이드에서 AI surface boundary와 상세 페이지 기준 반영
- [x] Task 6 — targeted QA 기록
  - 기록: `QA-20260509-0433`
  - 범위: local deterministic targeted QA. Dashboard core monitoring surface의 AI CTA 제거, 서버 카드 sparkline/상세/로그 유지, 서버 상세 운영 요약, 알림 row 로그 이동, overview Top 5 상세 이동 계약을 테스트/검증 결과로 기록.

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~4 | `refactor:` 또는 `fix:` | ✅ | ❌ | frontend 변경 시 |
| Task 5 | `docs:` | 선택 | ❌ | ❌ |
| Task 6 | `test:` 또는 `docs:` | ✅ | ❌ | 배포 검증 시 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | AI CTA 제거 계약이 "전역 AI Assistant는 유지" 조건을 깨지 않는지 |
| Task 1~2 완료 후 | Dashboard에서 per-entity AI prefill 경로가 제거됐는지 |
| Task 3~4 완료 후 | 서버 상세/서버 카드가 AI 없이도 모니터링 제품으로 충분히 동작하는지 |
| 전체 완료 후 | AI sidebar/full page 회귀, dashboard 탐색 회귀, docs 일관성 |

## 완료 기준

- [x] core monitoring surface에 per-entity AI CTA가 없다.
- [x] Header AI Assistant와 `/dashboard/ai-assistant`는 유지된다.
- [x] 서버 카드 sparkline은 유지된다.
- [x] 서버 상세 페이지는 모달 대체 페이지로 더 명확한 모니터링 상세 화면이 된다.
- [x] 기존 AI CTA 렌더링 기대 테스트가 새 surface boundary 계약으로 교체된다.
- [x] 최근 7일 변경 중 유지/제거/교체 판단이 위 "최근 7일 변경 재분류"와 일치한다.
- [x] `npm run type-check`, `npm run lint`, `npm run test:quick` 통과.
- [x] 변경 범위가 AI surface에 영향을 주면 AI sidebar/full page targeted QA를 기록한다.
- [x] 문서 검증: `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check` 통과.

## 관련 문서

- `docs/design/05-ui-design.md`
- `docs/reference/architecture/ai/ai-assistant-improvement-boundaries.md`
- `docs/llms.md`
- `docs/status.md`
- `docs/reference/architecture/system/system-architecture-current.md`
- `docs/reference/architecture/data/otel-data-architecture.md`
- `docs/guides/testing/e2e-testing-guide.md`
- `reports/planning/archive/dashboard-server-detail-ux-plan.md`

---

_Last Updated: 2026-05-09 — Task 0~6 및 Task 2.5 검증/커밋 판단 완료, plan completed_
