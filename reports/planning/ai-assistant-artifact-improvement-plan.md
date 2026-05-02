> Owner: project
> Status: Completed
> Last reviewed: 2026-05-02

# AI Assistant Artifact Improvement Plan

- 상태: Completed
- 작성일: 2026-05-02
- TODO.md 연결: Active Tasks > AI Assistant 사용자-facing 아티팩트 개선

## 목표

AI Chat에서 명시적인 "장애 보고서 작성/다운로드" 또는 "이상감지/추세 분석" 요청이 들어오면 일반 LLM 답변을 만들지 않고 기존 기능 API를 직접 실행해 사용자-facing 아티팩트 카드로 반환한다.

## 범위

- 포함:
  - Chat 입력 단계의 명시적 아티팩트 intent 감지
  - 장애 보고서 작성 아티팩트: 기존 `/api/ai/incident-report` generate 경로 재사용
  - 이상감지/추세 아티팩트: 기존 `/api/ai/intelligent-monitoring` batch 경로 재사용
  - 사이드바와 전체 페이지 공통 메시지 렌더링
  - Markdown/Text 또는 Markdown/JSON 다운로드
  - 모호한 보고서/추세 언급은 API 호출 없이 기능 안내 CTA만 표시
- 제외:
  - 백그라운드 cron/자동 장애 감지
  - 신규 LLM 호출 경로 추가
  - Vercel AI Elements 도입
  - Pyodide 코드 실행 기능 확장
  - Cloud Run AI Engine 계약 변경

## 계약 (Contract)

### 변경 대상 파일

- `src/hooks/ai/useAIChatCore.ts`
- `src/lib/ai/chat-artifacts/chat-artifact-intent.ts`
- `src/lib/ai/chat-artifacts/incident-report-artifact.ts`
- `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts`
- `src/components/ai/IncidentReportArtifactCard.tsx`
- `src/components/ai/MonitoringAnalysisArtifactCard.tsx`
- `src/components/ai-sidebar/SidebarMessage.tsx`
- `src/components/ai/AIWorkspaceMessage.tsx`
- `src/stores/useAISidebarStore.ts`
- `src/hooks/ai/core/useChatHistory.ts`
- `src/hooks/ai/utils/chat-history-storage.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `classifyChatArtifactIntent` | `string` | `none | incident-report | monitoring-analysis | guidance` | 없음, 보수적 분류 |
| `generateIncidentReportArtifact` | `{ queryAsOfDataSlot? }` | `IncidentReportArtifact` | 401/5xx 또는 invalid payload |
| `generateMonitoringAnalysisArtifact` | `{ queryAsOfDataSlot? }` | `MonitoringAnalysisArtifact` | 401/5xx 또는 invalid payload |
| `useAIChatCore.handleSendInput` | user text | user message + artifact assistant message | API 실패 시 assistant error message |

### 테스트 시나리오 (구현 전 확정)

- [x] 명시적 장애 보고서 요청은 `sendQuery`를 호출하지 않고 `/api/ai/incident-report`를 1회 호출해 `incidentReportArtifact` metadata를 가진 assistant message를 추가한다.
- [x] 명시적 추세 분석 요청은 `sendQuery`를 호출하지 않고 `/api/ai/intelligent-monitoring` batch를 1회 호출해 `monitoringAnalysisArtifact` metadata를 가진 assistant message를 추가한다.
- [x] 모호한 "장애 보고" 언급은 외부 API 호출 없이 안내 message만 추가한다.
- [x] 사이드바와 전체 페이지 메시지는 artifact metadata가 있으면 전용 카드와 다운로드 액션을 렌더링한다.
- [x] chat history 저장/복원 시 artifact metadata를 보존한다.

## Task 목록

- [x] Task 0 — failing test 추가 (아티팩트 intent, chat bypass, card render, history metadata)
- [x] Task 1 — intent 분류와 client artifact generator 구현
- [x] Task 2 — chat send pipeline에 아티팩트 bypass 연결
- [x] Task 3 — 공통 artifact card 렌더링과 다운로드 구현
- [x] Task 4 — history metadata 보존 및 검증
- [x] Task 5 — 품질 게이트 통과

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1~4 | `feat:` | 선택 | ❌ | 필요 |
| Task 5 | — | 사용자 요청 시 | ❌ | 사용자 요청 시 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | 테스트가 사용량 증가 방지와 아티팩트 계약을 정확히 표현하는지 |
| Task 2 완료 후 | 명시 요청만 API를 호출하고 일반 Chat 경로를 침범하지 않는지 |
| 전체 완료 후 | UI/metadata/history/download/무료 티어 영향 |

---

## Phase 2 — Client-only Artifact Enrichment

### 목표

기존 아티팩트 생성 API 호출 횟수와 Cloud Run/LLM 사용량을 늘리지 않고, 이미 응답에 포함된 구조화 payload를 더 잘 보여준다.

### 범위

- 포함:
  - 장애 보고서 카드에 영향 서버 링크, 권장 조치, 이상 징후, 타임라인 요약 표시
  - 이상감지/추세 카드에 위험 신호, 근거 refs, 데이터 기준/source/freshness 표시
  - 모든 확장은 기존 `IncidentReportArtifact` / `MonitoringAnalysisArtifact` metadata만 소비
- 제외:
  - 신규 API route
  - 신규 LLM/provider 호출
  - Supabase 영속 저장
  - Sandpack/임의 React 실행 환경
  - Cloud Run AI Engine 계약 변경

### 계약 (Contract)

| 대상 | 입력 | 출력 | 비용/사용량 계약 |
|------|------|------|------------------|
| `IncidentReportArtifactCard` | 기존 `IncidentReportArtifact` | 같은 카드 안에 server link, recommendation, anomaly, timeline summary | 추가 fetch 없음 |
| `MonitoringAnalysisArtifactCard` | 기존 `MonitoringAnalysisArtifact` | 같은 카드 안에 risk signal, evidence ref, source metadata summary | 추가 fetch 없음 |

### 테스트 시나리오

- [x] 장애 보고서 카드가 `affectedServers`, `recommendations`, `anomalies`, `timeline`을 렌더링하고 서버 링크를 제공한다.
- [x] 이상감지/추세 카드가 `riskSignals`, `evidenceRefs`, `sourceMode`, `slot.timeLabel`을 렌더링한다.
- [x] 아티팩트 카드 렌더링 테스트는 API/fetch mock 없이 통과한다.

### Task 목록

- [x] Task 6 — failing card enrichment tests 추가
- [x] Task 7 — IncidentReport artifact card 상세/서버 링크 UI 구현
- [x] Task 8 — MonitoringAnalysis artifact card 위험 신호/근거 UI 구현
- [x] Task 9 — targeted/type/lint 검증 및 TODO 완료 기록
