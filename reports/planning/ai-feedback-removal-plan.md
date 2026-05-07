# AI 피드백 기능 제거 및 QA 기반 품질 개선 전환 계획

> Owner: project
> Status: In Progress
> Doc type: How-to
> Last reviewed: 2026-05-07
> Canonical: reports/planning/ai-feedback-removal-plan.md
> Tags: cleanup,feedback,qa,langfuse

## 배경 및 결정

사용자가 직접 👍/👎를 누를 유저가 없는 구조(포트폴리오, 개인 개발 도구). AI 응답 품질 평가는
Claude/Codex가 QA·테스트 시 직접 수행하고, 개선은 코드·프롬프트 수정으로 반영하는 방식이 실질적이다.

현재 피드백 기능의 문제점:
- 수집한 데이터를 읽는 UI 대시보드가 없음 (Supabase `ai_feedback` 테이블 사장)
- Langfuse 스코어링은 능동적 모니터링 없이 의미 없음
- 피드백 클릭 시 Cloud Run Cold Start를 유발 (vCPU 낭비)
- TypeScript 타입 불일치 (traceId 파라미터 누락)

**대체 방식**: QA 실행 시 Claude/Playwright가 AI 응답을 평가하고, `reports/qa/` 에 기록.
개선이 필요하면 프롬프트·코드를 직접 수정 후 재검증하는 로컬 개발 루프.

---

## 제거 대상 (전체 목록)

### 완전 삭제 파일
- [x] `src/app/api/ai/feedback/route.ts` (225줄)
- [x] `src/app/api/ai/feedback/` 디렉토리
- [x] `src/hooks/ai/core/useChatFeedback.ts` (48줄)
- [x] `src/schemas/ai-feedback.ts` (87줄)
- [x] `cloud-run/ai-engine/src/routes/feedback.ts` (193줄)

### 부분 수정 파일

| 파일 | 제거 내용 | 영향 줄 수 |
|------|----------|----------|
| `src/components/ai/MessageActions.tsx` | ThumbsUp/ThumbsDown 버튼, `onFeedback` prop, `feedback` state | ~22줄 |
| `src/components/ai/MessageActions.stories.tsx` | feedback 관련 story props | 확인 필요 |
| `src/components/ai-sidebar/SidebarMessage.tsx` | `onFeedback` prop 전달, `traceId` 전달 | ~6줄 |
| `src/components/ai-sidebar/AISidebarV4.tsx` | `onFeedback` prop | ~2줄 |
| `src/components/ai-sidebar/EnhancedAIChat.tsx` | `onFeedback` prop | 확인 필요 |
| `src/components/ai-sidebar/ChatMessageList.tsx` | `onFeedback` prop | 확인 필요 |
| `src/components/ai/AIWorkspace.tsx` | `handleFeedback`, `onFeedback` | 확인 필요 |
| `src/components/ai/AIWorkspaceMessage.tsx` | feedback 관련 | 확인 필요 |
| `src/hooks/ai/useAIChatCore.ts` | `handleFeedback` export, `useChatFeedback` import | ~6줄 |
| `src/hooks/ai/__mocks__/useAIChatCore.ts` | `handleFeedback` mock | 확인 필요 |
| `cloud-run/ai-engine/src/server.ts` | `feedbackRouter` import·등록 (3줄) | 3줄 |

### Langfuse 관련 보존 여부
- `cloud-run/ai-engine/src/services/observability/langfuse*.ts` → **보존** (AI 트레이스 자체는 유지)
- `cloud-run/ai-engine/src/lib/job-notifier.ts` → feedback 관련 확인 후 처리

---

## 계약 (Contract)

### 제거 후 보장해야 할 것
1. `MessageActions` 컴포넌트: 복사 버튼·재생성 버튼은 정상 동작
2. AI 채팅 스트림: 피드백 없이도 정상 동작
3. Langfuse 트레이스 기록: AI 대화 자체 트레이싱은 유지
4. `useAIChatCore` 반환 타입: `handleFeedback` 제거 후 타입 오류 없음

### 테스트 시나리오
- `MessageActions` 렌더링 시 ThumbsUp/ThumbsDown 없음
- AI 응답 후 복사·재생성 버튼 정상 동작
- `useAIChatCore` 타입 체크 통과
- `knip` dead code 검사 통과

---

## 작업 순서 (SDD 게이트 적용)

### Phase 1: failing test 선행 커밋
```
test(spec): remove ai-feedback feature — add contract tests before removal
```
- `MessageActions` 렌더링 테스트: feedback 버튼 없음 확인
- `useAIChatCore` 타입 테스트: handleFeedback 없음 확인

### Phase 2: 구현 제거

**Step 1**: Cloud Run feedback 라우트 제거
- `cloud-run/ai-engine/src/routes/feedback.ts` 삭제
- `cloud-run/ai-engine/src/server.ts` feedbackRouter import·등록 제거

**Step 2**: Vercel API 라우트 제거
- `src/app/api/ai/feedback/` 디렉토리 삭제
- `src/schemas/ai-feedback.ts` 삭제

**Step 3**: 훅 제거
- `src/hooks/ai/core/useChatFeedback.ts` 삭제
- `src/hooks/ai/useAIChatCore.ts`: `handleFeedback` 제거
- `src/hooks/ai/__mocks__/useAIChatCore.ts`: mock 제거

**Step 4**: UI 컴포넌트 정리
- `MessageActions.tsx`: ThumbsUp/ThumbsDown 제거, `onFeedback`/`traceId` prop 제거
- `SidebarMessage.tsx`: `onFeedback`/`traceId` prop 제거
- `AISidebarV4.tsx`, `EnhancedAIChat.tsx`, `ChatMessageList.tsx`: prop 정리
- `AIWorkspace.tsx`, `AIWorkspaceMessage.tsx`: handleFeedback 제거

**Step 5**: Story 파일 정리
- `MessageActions.stories.tsx`, `AIWorkspace.stories.tsx`, `AIWorkspaceMessage.stories.tsx`: feedback props 제거

### Phase 3: 검증
```bash
npm run type-check
npm run lint
npm run test:quick
npm run knip:ci
```

### 커밋 메시지
```
feat: remove ai-feedback feature — replace with QA-based quality loop
```

---

## 대체 품질 개선 방식

피드백 수집 대신, 아래 로컬 개발 루프로 AI 응답 품질을 관리한다.

```
AI 응답 품질 의심
    ↓
Claude/Playwright QA 실행 (qa:ops skill)
    ↓
응답이 나쁘면 → 프롬프트 수정 (supervisor-prompt.ts)
              → 에이전트 라우팅 수정 (orchestrator)
              → 지식베이스 갱신 (Knowledge Retrieval Lite)
    ↓
재검증 후 reports/qa/ 기록
```

Langfuse 트레이스는 `LANGFUSE_SAMPLE_RATE=0.1` 기본값으로 계속 유지.
개발 시 문제 트레이스는 Cloud Run `/monitoring` 엔드포인트로 조회.

---

## 완료 기준

- [x] Phase 1: failing test 커밋
- [x] Phase 2 Step 1~5: 제거 구현
- [x] Phase 3: type-check, lint, test:quick, knip:ci 전부 통과
- [x] `src/app/api/ai/feedback/` 디렉토리 미존재 확인
- [ ] production 배포 후 `/api/ai/feedback` 404 확인

## 진행 현황 (2026-05-07 Codex)

```text
완료
  ├─ failing contract test 커밋: d347bfd5b
  ├─ Vercel /api/ai/feedback route/schema/hook 삭제
  ├─ Cloud Run /api/ai/feedback route 등록 및 route 파일 삭제
  ├─ MessageActions, sidebar, workspace, story/test prop chain 정리
  ├─ feedback trace manual QA script/spec 제거
  └─ active docs/QA template에서 feedback endpoint contract 제거

남음
  └─ 다음 release/tag 배포 후 production /api/ai/feedback 404 targeted QA 기록
```
