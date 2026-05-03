> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-03
> Tags: ai-assistant,streaming,ui,plan

# AI Streaming UI Improvement Plan

## 1. 배경

`ai-assistant-ux-polish-plan.md`에서 명시적으로 제외된 스트리밍 개선 항목을 별도 계획으로 진행한다.

진행 상태:
- S1/S2: completed on 2026-05-03
- S3: completed and deployed on 2026-05-03 as `v8.11.88`. GitLab main validation, semver tag deploy, production targeted QA, and complementary fullscreen stream QA are recorded.

현재 아키텍처 분석 결과:
- 사이드바: SSE 기반 실제 스트리밍 (`useChat` + `DefaultChatTransport`) ✅
- 전체 페이지(AIWorkspace): 완성된 마지막 응답을 `TypewriterMarkdown`으로 재생해 실제 SSE와 구분이 흐려짐 ⚠️
- 스트리밍 중 메타데이터(toolsCalled, ragSources): 완료 후에만 표시 ⚠️
- Cold Start 대기 UX: `estimatedWaitSeconds`는 전달되지만 남은 시간 카운트다운으로 표현되지 않음 ⚠️

관련 파일:
- `src/components/ai/AIWorkspaceMessage.tsx` — TypewriterMarkdown 사용 중
- `src/components/ai/TypewriterMarkdown.tsx` — 시뮬레이션 컴포넌트
- `src/hooks/ai/useAIChatCore.ts` — 최상위 훅
- `src/hooks/ai/useHybridAIQuery.ts` — estimatedWaitSeconds 계산 중
- `src/app/api/ai/supervisor/stream/v2/route.ts` — SSE 스트림 라우트

## 2. 범위

### 포함 (우선순위 순)

- **S1**: 전체 페이지(AIWorkspace) 실제 SSE 스트리밍 전환 — TypewriterMarkdown 제거
- **S2**: Cold Start 대기 UX 개선 — estimatedWaitSeconds 활용한 카운트다운 표시
- **S3**: 스트리밍 중 Agent 단계 실시간 표시 — tool 실행 시점에 metadata event 조기 전송

### 제외

- Job Queue seamless 전환 (상태 머신 전면 수정 필요 — 별도 계획)
- WebSocket 전환 (현재 SSE로 충분)
- AI SDK UI message protocol 전면 마이그레이션

## 3. 공식 제약

- **공유 파일 편집 제한** (`.claude/rules/ai-tools.md`): `components/ui/`, `types/`, `stores/`, `lib/utils.ts`는 직접 수정 금지
- **타입 `any` 사용 금지** (`.claude/rules/code-style.md`)
- **Free Tier 가드** (`.claude/rules/deployment.md`): 인프라 변경 없음, Cloud Run 스펙 변경 없음

## 4. 계약

### S1 — 전체 페이지 실제 스트리밍

| 항목 | 계약 |
|------|------|
| `AIWorkspaceMessage.tsx` | `message.isStreaming === true`일 때 `TypewriterMarkdown` 대신 일반 `MarkdownRenderer`로 토큰을 그대로 표시 |
| `AIWorkspaceMessage.tsx` | 완료된 마지막 assistant 응답도 `TypewriterMarkdown`으로 재생하지 않고 `MarkdownRenderer`로 즉시 표시 |
| `TypewriterMarkdown.tsx` | 사용처가 0건이면 삭제. 남는 외부 사용처가 있으면 deprecated 마킹 후 유지 |
| 회귀 조건 | 사이드바 스트리밍 동작 변경 없음. `useAIChatCore` 수정 없음 |

### S2 — Cold Start 카운트다운

| 항목 | 계약 |
|------|------|
| `StreamingWarmupIndicator` | `warmingUp=true` + `estimatedWaitSeconds > 0`일 때 카운트다운 progress bar 표시 |
| 카운트다운 범위 | `estimatedWaitSeconds` 기준 0까지 1초 감소, 0 도달 시 "거의 다 됐습니다" 전환 |
| 완료 후 | 카운트다운 숨김, 응답 스트리밍으로 자연 전환 |

### S3 — 스트리밍 중 Agent 단계 표시

상태: Approved. Cloud Run `data` event contract 변경이므로 별도 failing test와 구현 커밋으로 진행한다.

| 항목 | 계약 |
|------|------|
| Cloud Run 측 | tool 실행 시작 시점에 `data` event로 `{type:"agent-step", tool: string, status: "start"\|"done"}` 전송 |
| 프론트엔드 측 | `onData` 콜백에서 `agent-step` 이벤트 수신 → `InlineAgentStatus` 업데이트 |
| 기존 완료 후 배지 | 유지 (대체 아님, 보완) |

## 5. 테스트 시나리오

- [x] `AIWorkspaceMessage.tsx`에 `TypewriterMarkdown` import가 0건임을 grep으로 검증
- [x] 마지막 non-streaming assistant 메시지 렌더링 단위 테스트: TypewriterMarkdown이 아닌 MarkdownRenderer 사용 확인
- [x] `estimatedWaitSeconds=3`일 때 카운트다운 UI가 렌더링되고 0 도달 시 "거의 다 됐습니다"로 전환되는 단위 테스트
- [x] `onData` 에서 `agent-step` 이벤트 수신 시 `InlineAgentStatus`가 업데이트되는 훅 테스트
- [x] Playwright targeted QA: 사이드바 Job SSE와 전체 화면 direct stream 경로가 production에서 응답/분석 근거를 렌더링하는지 확인 ([QA-20260503-0399](../qa/runs/2026/qa-run-QA-20260503-0399.json), [QA-20260503-0400](../qa/runs/2026/qa-run-QA-20260503-0400.json))

## 6. Task 목록

- [x] Task 0 — failing test 커밋 (S1 TypewriterMarkdown 제거 spec, S2 카운트다운 spec)
- [x] Task 1 — S1: AIWorkspaceMessage TypewriterMarkdown → MarkdownRenderer 전환
- [x] Task 2 — S1: TypewriterMarkdown.tsx 사용처 grep 후 삭제 또는 deprecated 마킹
- [x] Task 3 — S2: StreamingWarmupIndicator 카운트다운 progress bar 구현
- [x] Task 4 — S3: Cloud Run `agent-step` data event 전송 추가
- [x] Task 5 — S3: 프론트엔드 `onData` 핸들러에서 `agent-step` 이벤트 처리
- [x] Task 6 — 로컬 deterministic validation 통과 확인 (`type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`/`test`)
- [x] Task 7 — Playwright targeted QA + `npm run qa:record`
- [x] Task 8 — commit / push gitlab

## 7. 완료 기준

- [x] `npm run lint` 통과
- [x] `npm run type-check` 통과
- [x] 추가 단위 테스트 모두 통과
- [x] 전체 페이지 채팅에서 production direct stream route(`/api/ai/supervisor/stream/v2`) 응답 렌더링 확인
- [x] 사이드바 스트리밍 동작 회귀 없음
- [x] Playwright targeted QA `releaseDecision=go`

## 8. 위험과 대응

| 위험 | 대응 |
|------|------|
| TypewriterMarkdown 삭제 시 Job Queue 완성 응답이 즉시 표시되어 어색할 수 있음 | Job Queue 응답은 `isStreaming=false`이므로 영향 없음. 별도 확인 필요 |
| estimatedWaitSeconds가 0으로 초기화되어 카운트다운이 즉시 종료되는 케이스 | `estimatedWaitSeconds > 0` 조건 가드 필수 |
| Cloud Run `agent-step` event 추가 시 기존 스트림 파싱 오류 | `onData` 핸들러에서 unknown type은 무시하는 방어 코드 선행 |
| S3 Cloud Run 수정 후 ai-engine 재배포 필요 | `cloud-run/ai-engine/deploy.sh` 수동 실행 필요. Vercel 배포와 별도 타이밍 조율 |

## 9. 구현 순서 권고

S1 → S2 → S3 순서 권장. S1·S2는 프론트엔드만 수정하므로 Cloud Run 재배포 없이 독립 진행 가능. S3는 Cloud Run 수정이 수반되므로 S1·S2 QA 완료 후 진행.
