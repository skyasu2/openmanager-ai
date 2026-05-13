> Owner: project
> Status: Completed
> Last reviewed: 2026-05-13

# AI Artifact Surface Unification Plan

- 상태: Completed
- 작성일: 2026-05-13
- TODO.md 연결: Backlog (완료 이력) > AI artifact surface unification

## 목표

AI Assistant의 자연어 Chat artifact 실행 경로와 사이드바 기능 탭 실행 경로를 단일 artifact execution layer로 통합한다.

최종 목표 구조:

```text
Natural language query / Function tab click
  -> artifact execution layer
  -> ChatArtifact + ArtifactEnvelope
  -> renderer or page adapter
  -> local-session replay workspace
```

## 범위

- 포함:
  - 장애보고서 탭의 직접 `/api/ai/incident-report` 호출을 artifact generator 경유로 전환
  - 전체 시스템 이상감지/추세 탭의 직접 `/api/ai/intelligent-monitoring` batch 호출을 artifact generator 경유로 전환
  - Chat 경로와 기능 탭이 같은 execution helper를 사용하도록 공통 함수 추가
  - 기능 탭에서 생성한 artifact를 local-session artifact replay store에 저장
  - 기존 카드/페이지 UI는 유지하되 입력 데이터의 출처를 artifact로 단일화
- 제외:
  - 단일 서버 분석 endpoint 계약 변경
  - 신규 artifact kind 추가
  - Cloud Run AI Engine schema 변경
  - Supabase/DB artifact persistence
  - 프로덕션 배포 자동 수행

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/chat-artifacts/artifact-execution.ts` 신규
- `src/hooks/ai/core/chat-artifact-execution.ts`
- `src/components/ai/pages/auto-report/AutoReportPage.tsx`
- `src/components/ai/pages/IntelligentMonitoringPage.tsx`
- 관련 테스트:
  - `src/lib/ai/chat-artifacts/artifact-execution.test.ts`
  - `src/components/ai/pages/AutoReportPage.test.tsx`
  - `src/components/ai/pages/IntelligentMonitoringPage.test.tsx`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `executeChatArtifact` | `{ kind, query, sessionId?, queryAsOfDataSlot?, signal? }` | `ChatArtifact` | 기존 generator error 그대로 전달 |
| `saveArtifactExecutionReplayPack` | `{ artifact, workspaceId? }` | `{ saved, replayPack? }` | storage 차단 시 `{ saved: false }`로 degrade |
| `AutoReportPage.handleGenerateReport` | preset optional | `IncidentReport` UI state + replay pack | auth/fallback/schema error message |
| `IntelligentMonitoringPage.runAnalysis` | selected server empty | `MonitoringAnalysisArtifact` -> page result + replay pack | auth/fallback/schema error message |

### 테스트 시나리오

- [x] `executeChatArtifact('incident-report')`가 기존 incident generator를 호출한다.
- [x] `executeChatArtifact('monitoring-analysis')`가 기존 monitoring generator를 호출한다.
- [x] `saveArtifactExecutionReplayPack`이 artifact envelope를 local-session replay pack으로 저장한다.
- [x] 장애보고서 탭은 직접 fetch 대신 artifact execution helper를 사용하고, 생성된 report를 기존 UI에 표시한다.
- [x] 전체 시스템 이상감지/추세 탭은 직접 batch fetch 대신 artifact execution helper를 사용하고, 생성된 analysis를 기존 UI에 표시한다.
- [x] 단일 서버 분석은 기존 direct endpoint 요청 계약을 유지한다.

## Task 목록

- [x] Task 0 — failing tests 추가 및 커밋
- [x] Task 1 — artifact execution helper 구현
- [x] Task 2 — Chat 경로와 기능 탭을 helper로 연결
- [x] Task 3 — 기능 탭 artifact replay pack 저장 연결
- [x] Task 4 — targeted/type/lint/test 검증
- [x] Task 5 — 계획서 완료 처리 및 archive 이동

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| Task 1~3 | `refactor(ai):` | 예 | 아니오 | 예, 릴리즈 시 |
| Task 5 | `docs(plan):` | 예 | 아니오 | 아니오 |

## 완료 기준

- [x] 테스트 시나리오 전체 통과
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] `npm run test:contract` 통과
- [x] `npm run line-guard` 통과
- [x] `git diff --check` 통과
- [x] 기능 탭에서 생성한 장애보고서/추세분석 결과가 artifact replay store에 저장됨
