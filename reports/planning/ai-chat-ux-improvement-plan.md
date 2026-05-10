> Owner: project
> Status: Implemented (local QA)
> Doc type: How-to
> Last reviewed: 2026-05-10
> Tags: ai-chat, ux, codex

# AI 채팅 UI/UX 개선 계획

## 배경

2026-05-10 Playwright MCP로 Vercel Production(`openmanager-ai.vercel.app/dashboard/ai-assistant`)에서  
AI 채팅 기능(AI Chat, 장애 보고서, 이상감지/추세, 컨텍스트 패널, 도구 메뉴)을 직접 탐색·조작하며  
UI/UX를 평가한 결과를 바탕으로 작성. QA 연계: `QA-20260510-0463`.

## ⚠️ 작업 전 전체 페이지 점검 필수

> **작업 착수 전 아래 항목을 전체 페이지/컴포넌트 범위로 먼저 확인할 것.**  
> 개선 대상이 AI Chat 전용 컴포넌트가 아닌 공용 컴포넌트에 있을 수 있고,  
> 동일 패턴의 문제가 다른 페이지(Dashboard, 서버, 알림, 로그, 토폴로지)에도 존재할 수 있다.

| 점검 항목 | 확인 범위 |
|----------|---------|
| 코드 블록 마크다운 렌더러 | `src/components/ai/` 전체, 공용 마크다운 렌더러 |
| `aria-label` 미설정 버튼 | 전체 페이지 (`npm run lint` + a11y audit) |
| 빈 상태(empty state) CTA | Dashboard, 알림, 로그, 이상감지 등 모든 빈 상태 화면 |
| 응답 시간 원시 숫자 노출 | AI Chat 이외 다른 영역 포함 여부 |

---

## 작업 담당

**Codex** 담당. Claude는 계획 설계·리뷰만 수행.

## 목표

AI Chat 전체화면과 사이드바의 핵심 사용 흐름에서 코드 블록, 빈 상태, 접근성, 대화 한도, 도구 메뉴 위치 문제를 정리한다.

이번 작업은 UI/UX 개선이지만 AI 응답 렌더링, artifact workspace, 보고서/이상감지 탭과 맞물려 있으므로 공용 컴포넌트 회귀를 반드시 확인한다.

## 범위

- 포함:
  - AI Chat 메시지/마크다운/코드블록 렌더링
  - AI Chat 전체화면 빈 상태와 예시 쿼리
  - 이상감지/추세 탭 진입 UX
  - 장애 보고서 빈 상태 CTA
  - 복사 버튼 접근성
  - 응답 시간/심층 분석/replay pack/도구 메뉴/상세 분석 링크/전체화면 버튼의 마이크로 UX
- 제외:
  - AI 라우팅, provider fallback, Cloud Run agent 동작 변경
  - 신규 artifact kind 추가
  - 운영 스크립트/Slack/runbook artifact 생성
  - broad dashboard redesign

## 계약 (Contract)

### 변경 대상 파일

Task 0에서 실제 파일명을 확정한다. 예상 범위:

- `src/components/ai/**`
- `src/components/ai-sidebar/**`
- `src/app/dashboard/ai-assistant/**`
- `src/lib/ai/chat-artifacts/**`
- 관련 테스트:
  - AI message/markdown renderer tests
  - artifact card/workspace tests
  - AI workspace/sidebar integration tests
  - accessibility label tests

### UI 입력/출력 계약

| 표면 | 입력/상태 | 기대 출력 |
|------|-----------|-----------|
| 코드 블록 | bash fenced code에 `$()`, `{}`, `if` 포함 | 코드 블록이 중간에서 잘리지 않고 copy button이 동작 |
| 빈 AI Chat | 메시지 0개 | 예시 쿼리 칩 3~4개 표시, 클릭 시 전송 |
| 대화 카운터 | 40/50 이상 | 한도 임박 시각 상태와 tooltip 표시 |
| 대화 카운터 | 50/50 | 입력 하단에 새 대화 안내 표시 |
| Reporter 빈 상태 | 보고서 0개 | 보고서 생성 CTA가 명확히 표시 |
| 복사 버튼 | 메시지/코드 copy action | 맥락 있는 `aria-label` 제공 |
| 도구 메뉴 | `+` 버튼 클릭 | 입력창 기준 팝업 표시, 직전 메시지를 가리지 않음 |

### 회귀 금지 계약

- 기존 `incident-report`, `monitoring-analysis`, `server-snapshot` artifact card 렌더링을 깨지 않는다.
- AI 응답 본문에서 raw tool JSON 노출 방지 정책을 약화하지 않는다.
- 코드블록 렌더링 수정이 일반 markdown link/list/table 렌더링을 깨지 않는다.
- AI Chat 사이드바와 전체화면의 메시지 표시 parity를 유지한다.
- 실 LLM 호출 없이 가능한 컴포넌트/계약 테스트를 우선한다.

---

## 태스크 목록

> Status가 Approved이므로 구현 착수 가능. 구현 전 Task 0에서 실제 파일 경로와 중복 패턴을 확정하고 회귀 테스트를 먼저 추가한다.

### ✅ Task 0 — 영향 범위와 failing tests 확정

- [x] 마크다운 렌더러, 복사 버튼, 빈 상태, 응답 시간 표기 사용처를 전체 검색
- [x] B1 코드블록 잘림 회귀 테스트 추가
- [x] M1 복사 버튼 aria-label 테스트 추가
- [x] I2/I3/I4 중 구현 대상 컴포넌트별 최소 테스트 위치 확정
- [x] AI Chat UI/UX 작업과 `ai-assistant-ops-artifact-plan.md`의 renderer 변경 충돌 가능 파일 목록 기록
  - 확인 파일: `MarkdownRenderer.tsx`, `utils/markdown-parser.tsx`, `AIWorkspaceMessage.tsx`, `SidebarMessage.tsx`, `MessageActions.tsx`, `CodeExecutionBlock.tsx`, `ChatMessageList.tsx`, `ChatInputArea.tsx`, `AutoReportPage.tsx`, `ArtifactWorkspacePanel.tsx`
  - 충돌 가능: ops artifact 계획도 markdown/message renderer를 건드릴 수 있으므로 `MarkdownRenderer.tsx`, `utils/markdown-parser.tsx`, `AIWorkspaceMessage.tsx`, `SidebarMessage.tsx` 변경 시 재확인 필요

### 🔴 B — 버그 수정 (즉시)

- [x] **B1** `코드 블록 렌더링 잘림`
  - 현상: bash 스크립트 응답에서 `$()` 문법 포함 시 코드 블록이 `if` 이후 잘림
  - 원인 추정: 마크다운 파서가 코드 펜스 내 `$()` 또는 `{...}` 를 MDX/JSX 문법으로 오파싱
  - 위치: `src/components/ai/` 내 마크다운 렌더러 컴포넌트 (정확한 파일은 grep 확인)
  - 작업:
    1. `grep -r "ReactMarkdown\|remark\|rehype\|marked\|marked-" src/components/ai/` 로 렌더러 특정
    2. 코드 펜스(`\`\`\``) 내부에서 `$`, `{`, `}` 가 이스케이프 없이 파싱되는지 확인
    3. `rehype-raw` 또는 커스텀 코드 블록 컴포넌트에서 raw string 처리 보강
    4. bash / shell 스크립트 포함 응답으로 회귀 테스트 추가
  - **착수 전**: 전체 마크다운 렌더러 사용처 파악 (다른 페이지에도 동일 컴포넌트가 쓰이는지)

---

### 🟡 I — 중요 개선

- [x] **I1** `이상감지/추세 탭 — 진입 시 자동 분석`
  - 현상: 탭 클릭 후 빈 화면만 표시, 수동으로 "전체 분석" 버튼을 눌러야 결과 노출
  - 제안: 탭 마운트 시 마지막 분석 결과를 캐시(SWR/React Query staleTime) 또는  
    탭 포커스 시 자동 분석 트리거 (`useEffect` on tab activation)
  - 위치: `src/components/ai-sidebar/` 또는 `src/app/dashboard/ai-assistant/`
  - 구현: `AIContentArea`가 Analyst 탭 visible 상태를 전달하고, `IntelligentMonitoringPage`가 visible 진입 시 1회 batch 분석을 자동 실행

- [x] **I2** `AI Chat 전체화면 — 빈 시작 화면 예시 쿼리 칩`
  - 현상: 신규 대화 시작 시 빈 채팅 영역만 노출, 무엇을 물어볼 수 있는지 불명확
  - 제안: 채팅 메시지가 0개일 때 예시 쿼리 칩 3~4개 표시
    ```
    "전체 서버 상태 요약해줘"
    "lb-haproxy-dc1-01 CPU 추이 확인해줘"
    "장애 보고서 생성해줘"
    "CPU 80% 이상 서버 알려줘"
    ```
  - 칩 클릭 시 해당 쿼리 자동 전송

- [x] **I3** `대화 한도 임박 경고`
  - 현상: "대화 6/20" 카운터는 있지만 한도 도달 시 명시적 경고 없음
  - 제안:
    - 40/50 이상: 카운터를 노란색 + "곧 한도 도달" 툴팁
    - 50/50: 빨간색 + 입력창 아래에 "새 대화를 시작하면 계속 이용할 수 있습니다" 배너

- [x] **I4** `장애 보고서 빈 상태 CTA 강화`
  - 현상: "보고서가 없습니다" 텍스트만 있고 빈 영역이 클릭 불가
  - 제안: 빈 상태 카드 전체를 클릭 가능한 CTA로 전환  
    또는 빈 영역 내 "새 보고서 생성" Primary 버튼 추가

---

### 🟢 M — 마이크로 UX

- [x] **M1** `복사 버튼 aria-label 접근성`
  - 현상: 모든 "복사" 버튼의 `aria-label`이 `"-"` 또는 미설정
  - 제안: `"메시지 복사"`, `"코드 복사"` 등 맥락 있는 레이블 부여
  - **착수 전**: `grep -r 'aria-label.*복사\|aria-label.*copy' src/` 로 전체 범위 파악

- [x] **M2** `응답 시간 원시 숫자 → 상대적 표기`
  - 현상: "1591ms", "850ms" 등 원시 ms 값 노출
  - 제안: `< 1s → 빠름`, `1~3s → 보통`, `> 3s → 느림` 뱃지 또는 툴팁으로 원시값 숨김

- [x] **M3** `"심층 분석" 모드 설명 구체화`
  - 현상: "더 긴 분석/라우팅 경로입니다" 설명이 추상적
  - 제안: "멀티 에이전트 분석 활성화 · 예상 +5~15초" 정도의 구체적 힌트 추가

- [x] **M4** `"replay pack" 개념 툴팁`
  - 현상: 아티팩트 워크스페이스의 "replay pack"이 무엇인지 설명 없음
  - 제안: `?` 아이콘 + 툴팁 "대화 이력과 분석 결과를 저장·불러오는 스냅샷"

- [x] **M5** `도구 메뉴 팝업 위치 고정`
  - 현상: `+` 버튼 클릭 시 팝업이 직전 대화 메시지를 가림
  - 제안: 입력창 기준 위쪽으로 앵커하되 최대 높이 제한 + 스크롤 방지

- [x] **M6** `이상감지 "상세 분석 보기 >" 연결 명확화`
  - 현상: 클릭 시 어디로 이동하는지 불명확
  - 제안: 서버 상세 페이지 링크면 아이콘을 외부 링크 스타일로, AI Chat 전환이면 채팅 아이콘으로 구분
  - 구현: 서버별 카드 액션을 이동형 표현이 아닌 `상세 분석 펼치기/접기` + `aria-label`로 정리

- [x] **M7** `사이드바 모드 "전체화면" 버튼 발견성 개선`
  - 현상: 전체화면 전환 버튼(↗)이 우측 하단 모서리에 작게 위치
  - 제안: 채팅 헤더 영역에 "전체화면으로 보기" 텍스트 버튼 또는 아이콘 버튼 배치
  - 구현: 사이드바 헤더에 데스크톱용 `전체화면` 텍스트 버튼 추가, 기존 rail icon handoff 유지

---

## 검증 기준

각 태스크 완료 후 Playwright MCP로 확인:

| 태스크 | 합격 기준 |
|--------|----------|
| B1 | `filterServers` 포함 bash 스크립트가 코드 블록 전체 렌더링됨 |
| I1 | 이상감지 탭 클릭 → 2초 내 분석 결과 또는 이전 결과 표시 |
| I2 | 빈 채팅에서 예시 칩 4개 노출, 클릭 시 쿼리 자동 전송 |
| I3 | 40번째 메시지 전송 후 경고 표시 확인 |
| I4 | 빈 보고서 영역 클릭 시 새 보고서 생성 플로우 진입 |
| M1 | `axe-playwright` 접근성 감사 aria-label 위반 0건 |

---

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| B1 | `fix(ai):` | 예 | 아니오 | 예 |
| I1~I4 | `feat(ai):` | 예 | 아니오 | 예 |
| M1~M7 | `fix(ai):` 또는 `feat(ai):` | 예 | 아니오 | 예 |
| QA 기록 | `chore(qa):` | 예 | 아니오 | 아니오 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing test가 실제 QA 증상과 공용 컴포넌트 사용처를 충분히 커버하는지 |
| B1 완료 후 | 마크다운/코드블록 renderer가 raw JSON guard와 artifact card를 깨지 않는지 |
| I1~I4 완료 후 | AI Assistant 전체화면/사이드바 흐름과 빈 상태 CTA 일관성 |
| M1~M7 완료 후 | 접근성, 레이아웃 겹침, 모바일 폭에서 텍스트 overflow 여부 |
| 전체 완료 후 | Playwright local 또는 Vercel targeted QA 증거와 QA tracker 기록 |

## 위험 및 대응

| 위험 | 대응 |
|------|------|
| 코드블록 수정 중 markdown 일반 렌더링 회귀 | fenced code 전용 테스트와 기존 message/card test 동시 실행 |
| 자동 분석이 AI 호출 비용을 늘림 | 캐시/최근 결과 우선, 사용자가 탭 진입한 경우에만 트리거 |
| 예시 칩 클릭이 중복 전송 유발 | 기존 submit state/loading guard 재사용 |
| 모바일에서 도구 메뉴/전체화면 버튼 겹침 | 390px viewport Playwright screenshot 확인 |
| ops artifact 작업과 renderer 파일 충돌 | Task 0에서 충돌 파일 확인 후 UI 개선을 먼저 완료 |

## 완료 기준

- [x] Task 0 영향 범위 확인 완료
- [x] B1, I1~I4, M1~M7 중 구현한 항목의 targeted test 통과
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] artifact/message 계약 영향이 있으면 `npm run test:contract` 통과
- [x] Playwright targeted QA 기록 생성 (`QA-20260510-0464`, `QA-20260510-0465`)

---

## 관련 파일 (착수 전 grep 확인 필수)

```bash
# 마크다운 렌더러 위치
grep -r "ReactMarkdown\|remark\|rehype" src/components/ai/ --include="*.tsx"

# 복사 버튼 위치
grep -rn "복사\|copy" src/components/ai/ --include="*.tsx" | grep aria

# 이상감지 탭 컴포넌트
grep -rn "이상감지\|anomaly\|AnomalyTab" src/ --include="*.tsx" | head -10

# 장애 보고서 빈 상태
grep -rn "보고서가 없\|empty.*report\|no.*report" src/ --include="*.tsx"
```
