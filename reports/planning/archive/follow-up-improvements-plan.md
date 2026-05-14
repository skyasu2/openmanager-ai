> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-15

# Follow-up Improvements Plan — G2/G4/Line-guard

**작성 배경**: v8.11.150 Artifact UX 개선(G1/G5) 완료 후 남아있는 Backlog P3 항목들을 계획서로 승격.
TODO.md Backlog 기반 — 신규 기능 0개, 신규 API 엔드포인트 0개.

**완료 요약**: T0~T5 완료. v8.11.151에서 line-guard/G2/G4 기본 구현을 배포했고, Vercel Playwright MCP QA에서 실제 사이드바 CTA 렌더러 누락을 발견해 v8.11.152(metadata 보존), v8.11.153(sidebar renderer)로 후속 보정했다. v8.11.153 tag pipeline `2525981912` success 및 QA `QA-20260515-0503` PASS로 closure.

---

## 목표

| 항목 | 현상 | 목표 |
|------|------|------|
| G2: guidance CTA 버튼 | guidance 응답이 텍스트만 반환 → 사용자가 다시 타이핑 | 버튼 클릭 한 번으로 artifact 실행 |
| G4: 생성 진행 피드백 | Cloud Run 호출 3~10초 동안 단일 정적 문구만 표시 | 단계별 진행 메시지로 체감 대기 감소 |
| Line-guard: 경고 파일 polish | 700줄 이상 WARN 파일 7개 — 비차단이지만 유지보수성 저해 | 상위 7개 파일을 650줄 미만으로 분리 |

---

## 범위

### 포함
- `G2`: guidance 메시지 metadata에 CTA 버튼 정보 추가 + AI 메시지 렌더러에 버튼 표시
- `G4`: `startChatArtifactGeneration` 내 단계 메시지 타이머 추가
- `Line-guard`: 상위 7개 파일에서 로직 분리 (신규 파일 생성 방식)

### 제외
- guidance 분류 로직 변경 (intent classifier는 건드리지 않음)
- Cloud Run SSE 스트리밍 추가 (G4는 클라이언트 측 타이머로만 처리)
- 800줄 미만 파일의 전면 리팩터링 (분리 대상 외 파일 불포함)
- 새 artifact kind / 새 API 엔드포인트

---

## 현재 상태 분석

### G2 — guidance 메시지 경로

```
useAIChatCore.ts:506
  └─ artifactIntent.kind === 'guidance'
       └─ createArtifactGuidanceMessages() → [userMessage, assistantMessage]
            └─ assistantMessage.content = createArtifactGuidanceMessage(target)
                 → 순수 텍스트 ("이상감지/추세 기능은 사용자가 명시적으로 요청할 때만...")
```

- 현재 guidance 응답 = 텍스트 메시지 (`role: 'assistant'`)
- 메타데이터 필드 없음 → 렌더러가 버튼을 삽입할 수 없음
- 수정 포인트: `createArtifactGuidanceMessages()` → metadata에 `guidanceCta` 추가
- 렌더러 포인트: `AIWorkspaceMessage` 또는 chat bubble에서 metadata 감지 후 버튼 표시

### G4 — 현재 loading 텍스트

```typescript
// chat-artifact-metadata.ts:66
function getArtifactLoadingText(kind):
  'incident-report'    → "장애 보고서를 작성하고 있습니다."
  'monitoring-analysis'→ "이상감지/추세 분석을 실행하고 있습니다."
  ...

// chat-artifact-execution.ts:68-76
const pendingAssistantMessage = createTextMessage({ text: getArtifactLoadingText(kind) });
setMessages([...fallbackArtifactMessages, pendingAssistantMessage]);
// → await generateChatArtifact(...)  ← 3~10초 동안 단일 문구 고정
```

- `messagesRef`와 `replacePendingArtifactMessage` 패턴이 이미 존재
- step timer는 interval → `setMessages(replacePendingArtifactMessage({ messagesRef.current, ... }))` 로 구현 가능
- SSE 없이 클라이언트 타이머만으로 충분

### Line-guard 상위 7개 (2026-05-15 측정)

| 파일 | 현재 | 분리 방향 |
|------|-----:|-----------|
| `cloud-run/…/routes/analytics.ts` | 764 | chart/export 섹션 분리 |
| `cloud-run/…/resilience/retry-with-fallback.ts` | 744 | `retry-budget.ts` + `fallback-chain.ts` 분리 |
| `cloud-run/…/orchestrator-summary-operational.ts` | 743 | operational action builder 분리 |
| `src/components/dashboard/log-explorer/LogExplorerModal.tsx` | 728 | `LogExplorerFilters.tsx` + `LogExplorerTable.tsx` 분리 |
| `src/components/ai/AIWorkspace.tsx` | 716 | `AIWorkspaceHeader.tsx` + `AIWorkspaceSidebar.tsx` 분리 |
| `src/app/api/ai/supervisor/stream/v2/route.ts` | 708 | `stream-response-builder.ts` 분리 |
| `src/components/dashboard/alert-history/AlertHistoryModal.tsx` | 708 | `AlertHistoryTable.tsx` + `AlertHistoryFilters.tsx` 분리 |

---

## 계약 (Contract)

### G2: guidance CTA 버튼

**타입 변경**:
```typescript
// src/hooks/ai/core/chat-artifact-metadata.ts
export type GuidanceCta = {
  target: 'incident-report' | 'monitoring-analysis';
  label: string;   // "바로 장애 보고서 생성하기" / "바로 이상감지/추세 분석 실행하기"
};

// assistant message metadata에 추가
guidanceCta?: GuidanceCta;
```

**함수 변경**:
```typescript
// createArtifactGuidanceMessages() 반환 assistantMessage에
metadata: {
  type: 'guidance',
  guidanceCta: { target, label: getGuidanceCtaLabel(target) }
}
```

**렌더러 규칙**:
- metadata.type === 'guidance' && guidanceCta 존재 시 버튼 1개 렌더링
- 버튼 클릭 → `onForceArtifactIntent(target)` 콜백 (useAIChatCore에서 전달)
- `onForceArtifactIntent`: guidance bypass flag로 artifact 직접 실행
- 버튼 위치: 메시지 텍스트 하단 (인라인 CTA)
- 스타일: 기존 `cn()` + shadcn Button (`variant='outline'`, `size='sm'`)

**변경 불가 영역**:
- `classifyChatArtifactIntent` 로직 — guidance 분류 규칙 변경 없음
- `ArtifactEnvelope` 타입
- guidance 없는 일반 메시지 metadata 구조

### G4: 단계 메시지 타이머

**단계 메시지 정의**:
```typescript
// chat-artifact-metadata.ts에 추가
export function getArtifactStepMessages(kind: ChatArtifact['kind']): Array<{ delayMs: number; text: string }> {
  const base = [
    { delayMs: 0,    text: getArtifactLoadingText(kind) },   // 기존 텍스트 재사용
    { delayMs: 3000, text: '데이터를 수집하고 있습니다...' },
    { delayMs: 6000, text: '분석 결과를 정리하고 있습니다...' },
    { delayMs: 9000, text: '거의 완료됐습니다...' },
  ];
  if (kind === 'incident-report') {
    base[1] = { delayMs: 3000, text: '장애 데이터를 수집하고 있습니다...' };
    base[2] = { delayMs: 6000, text: '보고서를 작성하고 있습니다...' };
  }
  return base;
}
```

**실행 패턴** (`startChatArtifactGeneration` 내부):
```typescript
// 초기 메시지 설정 후 타이머 시작
const steps = getArtifactStepMessages(artifactKind);
const stepTimers: ReturnType<typeof setTimeout>[] = [];

for (const step of steps.slice(1)) {
  const t = setTimeout(() => {
    if (artifactRequestIdRef.current !== token) return;  // 취소됨
    const stepMsg = createTextMessage({ id: pendingAssistantMessage.id, role: 'assistant', text: step.text });
    setMessages(replacePendingArtifactMessage({
      currentMessages: messagesRef.current,
      pendingMessageId: pendingAssistantMessage.id,
      fallbackArtifactMessages,
      nextAssistantMessage: stepMsg,
    }));
  }, step.delayMs);
  stepTimers.push(t);
}

// finally 블록에서 정리
stepTimers.forEach(clearTimeout);
```

**변경 불가 영역**:
- 최종 success/error 메시지 교체 로직 (`replacePendingArtifactMessage`)
- Cloud Run API 계약
- abort 취소 처리

### Line-guard: 분리 원칙

- **내보내기 계약 유지**: 원본 파일에서 기존 exports는 모두 유지 (re-export 허용)
- **테스트 파일 유지**: 기존 `*.test.ts` 파일의 import 경로 변경 최소화
- **분리 완료 기준**: 각 파일 650줄 미만

---

## 테스트 시나리오

### G2 테스트

```
T-G2-1: "이상감지 실행할까요?" → guidance 응답에 "바로 이상감지/추세 분석 실행하기" 버튼 노출
T-G2-2: 버튼 클릭 → monitoring-analysis artifact 생성 시작 (guidance 재분류 없이)
T-G2-3: "장애 보고서 만들어줄까요?" → guidance 응답에 "바로 장애 보고서 생성하기" 버튼 노출
T-G2-4: 버튼 없는 일반 메시지(AI 일반 응답)에는 버튼 미노출
T-G2-5: createArtifactGuidanceMessages() 반환 메시지의 metadata에 guidanceCta 포함
```

### G4 테스트

```
T-G4-1: getArtifactStepMessages('incident-report') → 4단계 배열 반환, delayMs 오름차순
T-G4-2: getArtifactStepMessages('monitoring-analysis') → 4단계 배열 반환
T-G4-3: artifact 완료(또는 에러) 시 stepTimers 모두 clear
T-G4-4: artifact 취소 시 (token 불일치) 타이머 콜백이 setMessages 호출하지 않음
T-G4-5: 3초 경과 전 완료 시 "데이터를 수집하고 있습니다..." 미표시
```

### Line-guard 테스트

```
T-LG-1: npm run line-guard → 분리 후 7개 대상 파일 모두 650줄 미만
T-LG-2: 기존 import 경로가 동작하는지 루트 type-check 통과
T-LG-3: 기존 단위 테스트 변경 없이 통과
```

---

## Tasks

### Task 0 — failing regression tests 추가 (SDD 선행) `P0`

구현 전 실패 테스트 커밋 (`test(spec):`)

- [x] `chat-artifact-metadata.test.ts`: `createArtifactGuidanceMessages()` 반환 metadata에 `guidanceCta` 없음을 검증 → 실패
- [x] `chat-artifact-metadata.test.ts`: `getArtifactStepMessages()` 없어서 import 실패 → 실패
- [x] line-guard: 현재 warn 7개 파일 존재 확인 스냅샷

```bash
커밋 메시지: test(spec): add failing tests for G2/G4/line-guard before implementation
```

---

### Task 1 — G2: guidance 메시지 metadata CTA 추가 `P3`

**변경 파일**:
- `src/hooks/ai/core/chat-artifact-metadata.ts` — `GuidanceCta` 타입, `getGuidanceCtaLabel()`, `createArtifactGuidanceMessages()` metadata 추가
- `src/lib/ai/chat-artifacts/chat-artifact-intent.ts` — `createArtifactGuidanceMessage()` 는 그대로 유지

완료 기준:
- [x] `createArtifactGuidanceMessages()` 반환 assistantMessage.metadata에 `guidanceCta` 포함
- [x] `GuidanceCta` 타입 export
- [x] T-G2-5 테스트 통과

---

### Task 2 — G2: AI 메시지 렌더러 CTA 버튼 표시 `P3`

**변경 파일**:
- `src/hooks/ai/useAIChatCore.ts` — `onForceArtifactIntent` 콜백 추가 (guidance bypass)
- `src/components/ai/AIWorkspaceMessage.tsx` 또는 chat bubble 컴포넌트 — metadata.guidanceCta 감지 후 버튼 렌더링

완료 기준:
- [x] guidance 메시지에만 버튼 표시 (일반 메시지에는 미노출)
- [x] 버튼 클릭 시 `onForceArtifactIntent` 호출 → artifact 실행 시작
- [x] T-G2-1 ~ T-G2-4 테스트 통과 (Vitest)

---

### Task 3 — G4: artifact 생성 단계 메시지 타이머 `P3`

**변경 파일**:
- `src/hooks/ai/core/chat-artifact-metadata.ts` — `getArtifactStepMessages()` 추가
- `src/hooks/ai/core/chat-artifact-execution.ts` — `startChatArtifactGeneration` 내 step timer 추가/해제

완료 기준:
- [x] 3초 후 step 메시지로 업데이트
- [x] 완료/에러/취소 시 타이머 정리
- [x] T-G4-1 ~ T-G4-5 테스트 통과

---

### Task 4 — Line-guard: 상위 7개 파일 분리 `P3`

**작업 순서** (의존성 없어 병렬 가능):

| 원본 파일 | 분리 대상 파일 |
|-----------|----------------|
| `cloud-run/…/routes/analytics.ts` | `analytics-capacity-alerts.ts`, `analytics-reporter-grounding.ts`, `analytics-route-utils.ts` |
| `cloud-run/…/retry-with-fallback.ts` | `retry-with-fallback-utils.ts`, `retry-provider-chain.ts` |
| `cloud-run/…/orchestrator-summary-operational.ts` | `orchestrator-summary-operational-actions.ts` |
| `LogExplorerModal.tsx` | `LogExplorerFilterBar.tsx`, `LogExplorerModal.helpers.tsx` |
| `AIWorkspace.tsx` | `AIWorkspaceEmbeddedLayout.tsx`, `AIWorkspaceFullscreenHeader.tsx`, `AIWorkspaceNavigationSidebar.tsx` |
| `stream/v2/route.ts` | `stream-response-builder.ts` |
| `AlertHistoryModal.tsx` | `AlertHistoryFilterBar.tsx`, `AlertHistoryStatsFooter.tsx`, `AlertHistoryModal.helpers.ts` |

완료 기준:
- [x] `npm run line-guard` — 7개 파일 모두 650줄 미만
- [x] `npm run type-check` 통과
- [x] `npm run test:quick` 통과
- [x] 기존 export re-export로 외부 import 계약 유지

---

### Task 5 — 통합 검증 및 배포 `P3`

완료 기준:
- [x] `npm run type-check` 통과
- [x] `npm run lint` 통과
- [x] `npm run test:quick` 통과
- [x] `npm run test:contract` 통과
- [x] `npm run line-guard` — warn 42개 → 35개 이하
- [x] `npm run docs:budget` 통과
- [x] `git diff --check` 통과
- [x] GitLab tag pipeline success — `v8.11.153` pipeline `2525981912`
- [x] Vercel Playwright MCP QA — guidance CTA 버튼 클릭 흐름 확인 (`QA-20260515-0503`)

---

## 우선순위 및 예상 공수

| Task | Priority | 예상 공수 | 의존 |
|------|:--------:|:---------:|------|
| T0 failing tests | P0 | 30분 | 없음 |
| T1 G2 metadata | P3 | 1h | T0 |
| T2 G2 렌더러 | P3 | 1~2h | T1 |
| T3 G4 step timer | P3 | 1~1.5h | T0 |
| T4 line-guard 분리 | P3 | 2~3h | 없음 |
| T5 통합 검증/배포 | P3 | 30분 | T1-T4 |

**총 예상 공수**: 6~8시간

---

## 검증 명령어

```bash
# 로컬 검증
npm run type-check
npm run lint
npm run test:quick
npm run test:contract
npm run line-guard
npm run docs:budget
git diff --check

# AI Engine (G4가 Cloud Run 측 변경 없어서 불필요)
# → root 검증만으로 충분

# 배포 후
npm run gitlab:pipeline:head -- --wait
```

---

## 커밋 순서

| 순서 | prefix | 내용 |
|------|--------|------|
| 1 | `test(spec):` | T0 failing tests |
| 2 | `feat(ai):` | G2 metadata + 렌더러 (T1+T2) |
| 3 | `feat(ai):` | G4 step timer (T3) |
| 4 | `refactor:` | line-guard polish (T4) |
| 5 | `chore(release):` | 버전 태그 |

---

## 참조

| 역할 | 파일 |
|------|------|
| guidance 메시지 생성 | `src/lib/ai/chat-artifacts/chat-artifact-intent.ts:346` |
| guidance 메시지 조립 | `src/hooks/ai/core/chat-artifact-metadata.ts:37` |
| guidance 분기 | `src/hooks/ai/useAIChatCore.ts:506` |
| artifact 실행 | `src/hooks/ai/core/chat-artifact-execution.ts` |
| loading 텍스트 | `src/hooks/ai/core/chat-artifact-metadata.ts:66` |
| 아티팩트 설계 문서 | `docs/design/06-artifact-system.md` |

**TODO.md 연결**: Backlog G2, G4, line-guard warning buffer polish
