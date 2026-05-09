# UI/UX 개선 계획서 — v8.11.x 포스트 리팩토링 감사

> Owner: project
> Status: Completed
> Doc type: How-to
> Last reviewed: 2026-05-09
> Tags: ui,ux,dashboard,ai-sidebar,design

---

## 배경 및 목적

2026-05-09 Playwright MCP를 활용해 프로덕션(`openmanager-ai.vercel.app`) 전체 화면을 실제 클릭 흐름으로 점검함. 14개 스크린샷 기반 분석. 최근 분리 리팩토링(AI surface boundary, chart migration, AI 운영 대응 QA 확장) 이후 기능은 정상이나 UX 일관성·정보 밀도·인터랙션 피드백에서 개선 포인트 확인.

**분석 범위**:
- 랜딩 (`/`)
- 대시보드 개요 (`/dashboard`)
- 서버 목록 (`/dashboard/servers`)
- 서버 상세 `/dashboard/servers/cache-redis-dc1-01` (3탭)
- 알림 (`/dashboard/alerts`)
- 로그 (`/dashboard/logs`)
- 토폴로지 (`/dashboard/topology`)
- AI 사이드바 (4개 탭: Chat, Reporter, 이상감지/추세)
- AI 풀스크린 (`/dashboard/ai-assistant`)

---

## AI 기능 정상 동작 확인 결과

리팩토링 후 AI 응답 품질:

| 기능 | 상태 | 비고 |
|------|------|------|
| NLQ Agent (Chat) | ✅ 정상 | Groq→Cerebras→Mistral fallback 정상, 스트리밍 확인 |
| Reporter Agent | ✅ 정상 | 빈 상태 UI 정상, 보고서 생성 CTA 정상 |
| 이상감지/추세 | ✅ 정상 | 18개 서버 anomaly scan, 1 risk signal 감지 |
| A1 HAProxy 분析 | ✅ PASS | CPU per LB 수치 포함, 데이터 제한 솔직 공개 |
| A5 스토리지 임계치 | ✅ PASS | deterministic fallback 응답 확인 |
| C2 당직 체크리스트 | ✅ PASS | clarification 없이 빠른 경로 응답 |

---

## 개선 항목 (우선순위별)

### P1 — 핵심 UX 이슈 (릴리즈 전 권장)

#### P1-1. AI 사이드바 탭 전환 시 subtitle 미갱신
- **화면**: AI 사이드바 (전체 탭)
- **현상**: 탭 제목 아래 subtitle이 "AI Chat으로 시스템 질의"로 고정됨. Reporter 탭, 이상감지 탭으로 전환해도 변경 없음.
- **영향**: 사용자가 현재 어떤 AI 모드에 있는지 텍스트 단서 부족
- **수정**: `AISidebarHeader` (또는 탭 컨테이너)에서 activeTab 기준으로 subtitle 동적 렌더링
  ```
  chat      → "서버 상태·로그·메트릭을 자연어로 질의"
  reporter  → "장애·정기 보고서 자동 생성"
  anomaly   → "이상감지·추세 분析 실행"
  ```
- **파일**: `src/components/ai-sidebar/` 내 헤더/탭 컨테이너 컴포넌트
- **예상 공수**: ~1시간

#### P1-2. AI 풀스크린 System Context 패널 항상 표시로 좌측 공간 낭비
- **화면**: `/dashboard/ai-assistant`
- **현상**: 우측 "System Context" 패널(provider routing 정보)이 항상 펼쳐져 뷰포트의 ~35%를 차지함. 실제 채팅 영역이 좁아짐.
- **영향**: 채팅 집중도 저하; 정보 밀도 높은 컨텍스트 패널이 상시 노출되어 초보 사용자에게 혼란 가능
- **수정**:
  - 기본 접힘(collapsed) + 토글 버튼 방식 전환
  - 또는 우측 슬라이드오버 패널(drawer) 방식
  - 모바일에서는 완전 숨김
- **파일**: `src/app/dashboard/ai-assistant/` 또는 해당 레이아웃 컴포넌트
- **예상 공수**: ~2시간

#### P1-3. 서버 목록 페이지네이션 모호성
- **화면**: `/dashboard` 개요 vs `/dashboard/servers`
- **현상**:
  - 개요 카드: "18개 중 4개 표시" (상위 4개만)
  - 서버 목록: "12개 표시" (실제 18개 서버 존재, 나머지 6개 노출 경로 불명확)
  - "더 보기" 또는 페이지네이션 없이 잘리는 느낌
- **영향**: 일부 서버가 관리 UI에서 숨겨져 있다는 인식 → 신뢰 저하
- **수정**:
  - 서버 목록 페이지에 "모든 서버 보기 (18/18)" 레이블 또는 명시적 페이지네이션 추가
  - 개요 카드의 "18개 중 4개" → "상위 알림 서버 4개" 등 레이블 명확화
- **파일**: `src/components/dashboard/` 서버 목록 관련 컴포넌트
- **예상 공수**: ~1.5시간

---

### P2 — 개선 권장 (다음 마일스톤)

#### P2-1. 서버 카드 이름 잘림 (name truncation)
- **화면**: `/dashboard/servers` 컴팩트 카드 그리드
- **현상**: `cache-redis-dc1-01` 같은 긴 서버명이 카드 크기에 맞춰 잘려서 `…`으로 표시
- **수정**:
  - 카드 hover 시 전체 이름 tooltip 표시
  - 또는 카드 너비 확장 + 2줄 허용(line-clamp-2)
- **파일**: `src/components/dashboard/` 서버 카드 컴포넌트
- **예상 공수**: ~30분

#### P2-2. 이상감지/추세 탭 입력 필드 목적 불명확
- **화면**: AI 사이드바 → 이상감지/추세 탭
- **현상**: 탭 하단에 텍스트 입력 필드가 있으나 placeholder 텍스트만 보임. 이 탭은 자동 분析 기능인데 입력 창의 역할이 모호함.
- **수정**:
  - 입력 창 위에 "분析 대상 서버 범위 지정 (선택)" 같은 레이블 추가
  - 또는 입력 창 숨김 + 자동 실행 UX로 단순화
- **파일**: AI 사이드바 이상감지 탭 컴포넌트
- **예상 공수**: ~30분

#### P2-3. 토폴로지 페이지 컨트롤 부재
- **화면**: `/dashboard/topology`
- **현상**: 전문적인 네트워크 다이어그램은 렌더링되나 줌인/줌아웃, 필터(레이어별/타입별), 검색 컨트롤이 UI에 없음.
- **영향**: 18개 서버 → 추후 서버 증가 시 가독성 급락
- **수정**:
  - 줌 컨트롤 버튼(+/-/리셋) 추가
  - 서버 타입별 필터 칩(web/cache/db/lb) 추가
- **파일**: `src/components/dashboard/topology/` 또는 `/dashboard/topology` 페이지
- **예상 공수**: ~3~4시간 (D3/Recharts 다이어그램 연동 복잡도 따라 변동)

#### P2-4. AI 풀스크린 탭 레이블 중복
- **화면**: `/dashboard/ai-assistant`
- **현상**: 탭 레이블이 "AI Chat / NLQ Agent" 형태로 역할을 2개 나열. 사용자에게 에이전트 내부 구현 명(NLQ Agent)이 노출됨.
- **수정**:
  - 사용자 친화적 레이블만 표시: "AI Chat", "보고서", "이상감지"
  - 에이전트 내부명(NLQ Agent, Reporter Agent)은 툴팁 또는 about 패널로 이동
- **파일**: AI 풀스크린 탭 컴포넌트
- **예상 공수**: ~1시간

#### P2-5. 서버 상세 성능 분析 탭 서브모드 시각 계층 불명확
- **화면**: 서버 상세 → 성능 분析 탭
- **현상**: "기본 / 분析 / 일시정지" 3개 버튼이 한 줄에 나열되나 현재 활성 모드 강조가 약함. "일시정지"가 파괴적 액션처럼 보이지 않아 클릭 전 효과 예측 어려움.
- **수정**:
  - 활성 버튼에 강한 배경/테두리 강조
  - "일시정지"를 아이콘 버튼(⏸)으로 변경해 모드 선택과 액션을 시각적으로 분리
- **파일**: 서버 상세 성능 탭 컴포넌트
- **예상 공수**: ~1시간

---

### P3 — 폴리시 (백로그)

#### P3-1. 랜딩 Feature 카드 설명 추상적
- **화면**: `/` 랜딩
- **현상**: Feature 카드 4개의 설명이 마케팅 문구로 구성돼 있어 실제 기능 범위 전달 미흡
- **수정**: "15개 서버 × 24h OTel 데이터 실시간 집계", "5종 AI 에이전트 자연어 질의" 같은 구체적 수치 포함
- **예상 공수**: 카피 수정만 ~30분

#### P3-2. 헤더 세션 타이머 가시성
- **화면**: 대시보드 전체 헤더
- **현상**: "27:42 남음" 세션 타이머가 헤더 우측에 위치하나 배경 컬러와 대비가 낮아 눈에 잘 안 띔. 세션 만료 30초 전 경고 UX 없음.
- **수정**: 5분 미만 시 타이머 색상 → 노랑/빨강 전환 + subtle 진동 애니메이션
- **예상 공수**: ~1시간

#### P3-3. Reporter 탭 — 공백 상태(empty state) 개선
- **화면**: AI 사이드바 → Reporter 탭
- **현상**: "보고서가 없습니다" + 아이콘은 있으나 "어떤 보고서를 만들 수 있는지" 예시 없음
- **수정**: 2~3개 빠른 시작 프롬프트 칩 추가 ("장애 보고서", "정기 운영 보고서", "이상감지 요약")
- **예상 공수**: ~1.5시간

#### P3-4. 알림 페이지 — 필터 상태 유지
- **화면**: `/dashboard/alerts`
- **현상**: 알림 필터(심각도, 서버 등) 적용 후 다른 페이지 이동 시 필터 초기화됨
- **수정**: URL 쿼리 파라미터로 필터 상태 영속화 (`?severity=critical&server=cache-redis-dc1-01`)
- **예상 공수**: ~2시간

---

## Task 목록

### Phase 1 — P1 이슈 수정 (즉시 착수 가능)

- [x] **Task 1**: AI 사이드바 subtitle 동적 갱신 구현 (`P1-1`)
- [x] **Task 2**: AI 풀스크린 System Context 패널 기본 접힘 처리 (`P1-2`)
- [x] **Task 3**: 서버 목록 페이지네이션/카운트 레이블 명확화 (`P1-3`)

### Phase 2 — P2 이슈 수정

- [x] **Task 4**: 서버 카드 이름 tooltip 추가 (`P2-1`)
- [x] **Task 5**: 이상감지 탭 입력 필드 레이블 추가 (`P2-2`)
- [x] **Task 6**: 토폴로지 줌/필터 컨트롤 추가 (`P2-3`)
- [x] **Task 7**: AI 풀스크린 탭 레이블 사용자 친화적 개선 (`P2-4`)
- [x] **Task 8**: 성능 분析 탭 서브모드 시각 계층 개선 (`P2-5`)

### Phase 3 — P3 폴리시 (백로그)

- [x] **Task 9**: 랜딩 Feature 카드 카피 구체화 (`P3-1`)
- [x] **Task 10**: 헤더 세션 타이머 만료 경고 UX (`P3-2`)
- [x] **Task 11**: Reporter 빠른 시작 프롬프트 칩 (`P3-3`)
- [x] **Task 12**: 알림 페이지 필터 URL 영속화 (`P3-4`)

---

## 검증 계획

각 Task 완료 후:
1. `npm run type-check` + `npm run lint` 통과
2. `npm run test:quick` 통과
3. Playwright MCP로 해당 화면 스크린샷 재확인
4. `npm run qa:record` — targeted run으로 기록

### 검증 기록

- 2026-05-09 — P1 Task 1~3 구현 완료
  - `npx vitest run src/components/ai-sidebar/AISidebarHeader.test.tsx src/components/ai/AIWorkspace.test.tsx src/components/dashboard/ServerDashboard.test.tsx`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - Playwright MCP 화면 재확인은 Claude Code가 Playwright 세션을 점유 중인 상태라 이번 Codex 턴에서는 생략
- 2026-05-09 — P2 Task 4, 5, 7, 8 구현 완료
  - 서버 카드 긴 이름 `title` 제공
  - 이상감지/추세 분석 대상 선택 필드 설명 추가
  - AI 풀스크린 기능 탭에서 내부 에이전트명 대신 사용자 작업명 노출
  - 성능 분석 서브모드 활성 상태/실시간 제어 접근성 보강
  - 서버 목록 "모든 서버 보기" 레이블은 다음 클릭으로 실제 전체 서버가 표시될 때만 노출되도록 회귀 테스트 추가
  - `npx vitest run src/components/dashboard/ImprovedServerCard.test.tsx src/components/ai/pages/IntelligentMonitoringPage.test.tsx src/components/ai/AIWorkspace.test.tsx src/components/dashboard/EnhancedServerModal.MetricsTab.test.tsx src/components/ai-sidebar/AISidebarHeader.test.tsx src/components/dashboard/ServerDashboard.test.tsx`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - `npm run docs:budget`
  - `npm run docs:ai-consistency`
  - `git diff --check`
- 2026-05-09 — P2 Task 6 구현 완료
  - 토폴로지 타입 필터 칩 추가: 전체/LB/Web/API/DB/Cache/Storage
  - React Flow 캔버스에 opt-in 명시적 줌 툴바 추가: 확대/축소/화면 맞춤
  - 기본 React Flow 컨트롤은 토폴로지 화면에서 숨기고, 미니맵은 유지
  - `npx vitest run src/components/dashboard/TopologyModal.test.tsx src/components/dashboard/dashboard-modal-theme-contract.test.tsx src/components/shared/ReactFlowDiagram.test.tsx`
  - `npm run type-check`
  - `npm run lint`
  - `npm run test:quick`
  - `npm run docs:budget`
  - `npm run docs:ai-consistency`
  - `git diff --check`
- 2026-05-09 — P3 Task 11 구현 완료
  - Reporter 빈 상태에 빠른 시작 칩 추가: 장애 보고서, 정기 운영 보고서, 이상감지 요약
  - 빠른 시작 칩 클릭 시 기존 incident-report API 요청에 `query/category/severity` 힌트 포함
  - `npx vitest run src/components/ai/pages/AutoReportPage.test.tsx`
- 2026-05-09 — P3 Task 9 구현 완료
  - 랜딩 Feature 카드 설명에 18대 서버, 24시간 OTel, 무료 티어 실행 경계, 144 슬롯 시계열, GitLab CI 배포 게이트 등 구체 수치/운영 범위 반영
  - Recharts 제거 후 현재 차트 스택인 Nivo Line + SVG Sparkline + uPlot 문구로 정정
  - `npx vitest run src/data/feature-cards.data.test.ts src/components/home/FeatureCardsGrid.test.tsx`
- 2026-05-09 — P3 Task 10 구현 완료
  - 헤더 세션 타이머를 정상/5분 이하/30초 이하 상태로 분리
  - 5분 이하 amber 경고, 30초 이하 red/ring/animate-wiggle 만료 임박 표시와 접근성 라벨 추가
  - `npx vitest run src/components/dashboard/SessionCountdown.test.tsx src/components/dashboard/DashboardHeader.test.tsx`
- 2026-05-09 — P3 Task 12 구현 완료
  - 알림 이력 필터를 URL query로 영속화: `severity`, `state`, `server`, `range`, `q`
  - 기존 `/dashboard/alerts?server=...` deep link와 legacy `serverId` query 수용 유지
  - `npx vitest run src/components/dashboard/alert-history/AlertHistoryModal.test.tsx src/components/dashboard/DashboardRoutedContent.test.tsx`
- 2026-05-09 — UI/UX P1/P2/P3 closure QA 완료
  - `QA-20260509-0436`: local targeted closure QA, checks 7/7 PASS, pending 0
  - Evidence: `reports/qa/evidence/qa-20260509-ui-ux-alert-filter-url.png`, `qa-20260509-ui-ux-topology-controls.png`, `qa-20260509-ui-ux-ai-workspace.png`, `qa-20260509-ui-ux-landing-copy.png`
  - `npx playwright test tests/e2e/dashboard-alerts-logs.spec.ts --grep "Alert History: 필터"`
  - `npx playwright test tmp/playwright/ui-ux-closure.spec.ts`

---

## 참조 스크린샷

| 파일 | 화면 |
|------|------|
| `qa-screenshots/01-landing.png` | 랜딩 |
| `qa-screenshots/02-dashboard-overview.png` | 대시보드 개요 |
| `qa-screenshots/03-servers-list.png` | 서버 목록 |
| `qa-screenshots/04-server-detail.png` | 서버 상세 헤더 |
| `qa-screenshots/05-alerts.png` | 알림 |
| `qa-screenshots/06-logs.png` | 로그 |
| `qa-screenshots/07-topology.png` | 토폴로지 |
| `qa-screenshots/08-ai-sidebar.png` | AI 사이드바 Chat 탭 |
| `qa-screenshots/09-ai-reporter.png` | AI 사이드바 Reporter 탭 |
| `qa-screenshots/10-ai-anomaly.png` | AI 사이드바 이상감지 탭 |
| `qa-screenshots/11-ai-fullscreen.png` | AI 풀스크린 |
| `qa-screenshots/12-server-detail-tab1.png` | 서버 상세 종합 상황 탭 |
| `qa-screenshots/13-server-detail-tab2-performance.png` | 서버 상세 성능 분析 탭 |
| `qa-screenshots/14-server-detail-tab3-logs-network.png` | 서버 상세 로그 & 네트워크 탭 |
