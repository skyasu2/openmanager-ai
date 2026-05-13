> Owner: project
> Status: In Progress
> Last reviewed: 2026-05-13

# Server Monitoring Artifact Surface Plan

- 상태: In Progress
- 작성일: 2026-05-13
- TODO.md 연결: Active Tasks > Server monitoring artifact surface

## 목표

단일 서버 이상감지/추세 분석을 기존 기능 탭 direct fetch 경로에서 `ChatArtifact` 실행 계층으로 이동한다. 최종 형태는 자연어 artifact, 장애보고서, 전체 시스템 이상감지/추세 분석, 단일 서버 분석이 같은 실행/저장/복원 계약을 사용하는 구조다.

```text
AI Assistant / Function tab
  -> artifact execution layer
  -> typed ChatArtifact + ArtifactEnvelope
  -> page adapter or artifact renderer
  -> local-session replay workspace
```

## 범위

- 포함:
  - `server-monitoring-analysis` artifact kind 추가
  - `/api/ai/intelligent-monitoring` `analyze_server` 호출을 artifact generator 뒤로 이동
  - `IntelligentMonitoringPage`의 단일 서버 분석 direct fetch 제거
  - artifact replay store와 schema registry에 단일 서버 분석 계약 등록
  - 단일 서버 분석 계약/페이지 동작/문서 다이어그램 테스트 보강
  - artifact 통합 후 드러난 auto-report dead code 제거
- 제외:
  - Cloud Run AI Engine endpoint schema 변경
  - 서버 상세/대시보드 카드에 per-entity AI CTA 추가
  - Supabase/DB 영구 artifact 저장
  - 실 LLM 또는 외부 provider 호출 테스트
  - 프로덕션 배포 자동 수행

## 설계

```text
IntelligentMonitoringPage
  selectedServer? yes
    |
    v
executeChatArtifact(kind: server-monitoring-analysis)
    |
    v
generateServerMonitoringArtifact()
    |
    v
POST /api/ai/intelligent-monitoring { action: analyze_server }
    |
    v
ServerMonitoringAnalysisArtifact
  - serverId/serverName
  - CloudRunAnalysisResponse
  - ServerAnalysisResult adapter payload
  - ArtifactEnvelope metadata/evidence
    |
    +--> AnalysisResultsCard existing UI
    |
    `--> artifact replay workspace
```

## 계약 (Contract)

### 변경 대상 파일

- `src/lib/ai/chat-artifacts/types.ts`
- `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.ts`
- `src/lib/ai/chat-artifacts/artifact-execution.ts`
- `src/lib/ai/chat-artifacts/artifact-workspace-registry.ts`
- `src/lib/ai/chat-artifacts/artifact-workspace-store.ts`
- `src/components/ai/pages/IntelligentMonitoringPage.tsx`
- `docs/reference/architecture/ai/ai-engine-architecture.md`
- 관련 테스트:
  - `src/lib/ai/chat-artifacts/monitoring-analysis-artifact.test.ts`
  - `src/lib/ai/chat-artifacts/artifact-execution.test.ts`
  - `src/components/ai/pages/IntelligentMonitoringPage.test.tsx`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러 케이스 |
|----------|----------|----------|------------|
| `generateServerMonitoringArtifact` | `{ query, sessionId?, serverId, serverName, currentMetrics?, queryAsOfDataSlot?, signal? }` | `ServerMonitoringAnalysisArtifact` | 401 로그인 필요, upstream 실패, schema 불일치 |
| `executeChatArtifact` | `{ kind: 'server-monitoring-analysis', ...ServerMonitoringArtifactRequest }` | `ServerMonitoringAnalysisArtifact` | generator error 그대로 전달 |
| `IntelligentMonitoringPage.runAnalysis` | selected server present | `ServerMonitoringAnalysisArtifact.server` -> 기존 결과 카드 | auth/fallback/schema error message |
| artifact workspace restore | legacy metadata key 또는 current envelope | `ChatArtifact` | schema 불일치 시 복원 제외 |

### 테스트 시나리오

- [ ] 단일 서버 artifact generator는 `analyze_server` body와 `queryAsOf`를 전송하고 typed artifact를 반환한다.
- [ ] 단일 서버 artifact generator는 401과 malformed response를 사용자 노출 가능한 에러로 변환한다.
- [ ] `executeChatArtifact('server-monitoring-analysis')`는 단일 서버 generator로 라우팅한다.
- [ ] 단일 서버 분석 페이지는 direct fetch 없이 artifact execution helper를 사용하고 replay pack을 저장한다.
- [ ] 단일 서버 분석 페이지는 401 에러와 선택 서버 유지 동작을 기존 UI 계약대로 유지한다.
- [ ] artifact schema registry/store는 `server-monitoring-analysis`를 복원 가능한 kind로 인정한다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다.

- [x] Task 0 — failing test 커밋
- [x] Task 1 — 단일 서버 artifact kind/generator/execution/store 구현
- [x] Task 2 — `IntelligentMonitoringPage` direct fetch 제거 및 replay 저장 연결
- [x] Task 3 — auto-report dead code 제거
- [x] Task 4 — 아키텍처 문서/다이어그램 갱신
- [x] Task 5 — targeted/type/lint/test 검증
- [ ] Task 6 — 계획서 완료 처리 및 archive 이동

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | 아니오 | 아니오 |
| Task 1~4 | `feat(ai):` / `refactor(ai):` | 예 | 아니오 | 예, 릴리즈 시 |
| Task 6 | `docs(plan):` | 예 | 아니오 | 아니오 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing test가 direct fetch 제거와 artifact 계약을 정확히 표현하는지 |
| 핵심 구현 Task 완료 후 | artifact schema, replay 복원, auth/error behavior |
| 전체 완료 후 | 문서와 실제 실행 경로가 일치하는지 |

## 완료 기준

- [ ] 테스트 시나리오 전체 통과
- [ ] `npm run type-check` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run test:quick` 통과
- [ ] `npm run test:contract` 통과
- [ ] `npm run line-guard` 통과
- [ ] `npm run docs:budget` 통과
- [ ] `npm run docs:ai-consistency` 통과
- [ ] `git diff --check` 통과
- [ ] 단일 서버 분석 결과가 artifact replay store에 저장됨
