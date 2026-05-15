> Owner: project
> Status: Approved
> Doc type: How-to
> Last reviewed: 2026-05-15
> Tags: refactor,useAIChatCore,message-helpers,orchestrator-routing,production-qa,debt

# 2026-05-15 커밋 이후 추가 개선 계획

- 상태: Approved
- 작성일: 2026-05-15
- TODO.md 연결: Active Tasks → P2 항목들

## 배경

2026-05-15 작업 사이클(34개 커밋, GraphRAG 제거 + KRL 완성 + Artifact UX)로 KRL 경로가 단일 정상화됐고, production QA 배포 직전 상태에 있다. 이 계획서는 해당 사이클 리뷰에서 도출된 **기술 부채 해소** 항목 3개와 **pending production QA** 1개를 다룬다.

---

## Task 목록

### Task 1 — Vercel Production QA 기록 (query-pipeline-plan T7 closure)

**우선순위**: High (배포 전 미완료 상태)
**완료**: Codex (Vercel Playwright MCP QA 기록)
**SDD 게이트**: 해당 없음 (QA 기록 task)

#### 배경

`query-pipeline-improvement-plan.md` T7의 체크리스트는 완료됐다:
- `[x]` 배포가 포함되면 GitLab pipeline 확인
- `[x]` Vercel production + Playwright MCP conversational QA 기록

v8.11.154 기준으로 GraphRAG 제거, KRL hardening, Artifact UX, guidance CTA 수정이 반영됐다. push/deploy 이후 production 동작 확인이 필요하다.

#### 검증 범위

| 검증 항목 | 예상 경로 |
|-----------|-----------|
| KRL evidence card 렌더링 (EvidenceCard 배지) | AI sidebar → 질의 → 근거 출처 배지 확인 |
| Artifact guidance CTA 표시 | AI Workspace → 메시지 → CTA 버튼 표시 |
| Artifact progress steps 표시 | Artifact 실행 중 단계 표시 |
| Guidance CTA 메타데이터 보존 | sidebar/fullscreen 전환 후 CTA 유지 |
| 서버 artifact alias 매핑 | server alias → artifact intent 매핑 |

#### 완료 기준

- [x] GitLab pipeline `validate` + `deploy` 통과 확인
- [x] Vercel Playwright MCP QA 실행 및 `npm run qa:record` 기록
- [x] `query-pipeline-improvement-plan.md` T7 체크리스트 완료 후 Completed 처리

#### 진행 기록

- 2026-05-15 Codex: `v8.11.154` tag pipeline `2527097775` success, main validate pipeline `2527097782` success 확인. Vercel deployment `dpl_F8HDfrdVpxRCPUR113N32LBubvs8` ready 확인.
- 2026-05-15 Codex: Landing AI Assistant modal KRL/Postgres FTS copy와 `/dashboard/ai-assistant` 표준 5문항 대화 QA를 Playwright MCP로 검증하고 `QA-20260515-0506`에 17/17 PASS, pending 0, expert open gap 0으로 기록.

---

### Task 2 — `useAIChatCore.ts` 분할 리팩터

**우선순위**: Medium
**위임 추천**: Codex (기계적 코드 이동)
**SDD 게이트**: plan Approved → `test(spec):` 선행 필수

#### 배경

`src/hooks/ai/useAIChatCore.ts` 현재 **724줄**. 코드 스타일 규칙 경고(500줄) 초과이며, 오늘 guidance CTA +93줄이 추가됐다. 파일 내 역할이 혼재되어 있다.

#### 현재 파악된 역할 구분

| 섹션 (라인) | 책임 | 분리 대상 |
|-------------|------|----------|
| L81~L107 | `createForcedGuidanceArtifactIntent` / `createForcedGuidanceArtifactQuery` — guidance CTA factory 함수 | ✅ 분리 |
| L444~L490 | `handleArtifactGuidanceCta` useCallback — guidance CTA 제출 핸들러 | ✅ 분리 |
| L590~L620 | guidance kind 분기 처리 (forced query 주입) | ✅ 분리 |
| L500~L678 | Input Handler (sendMessage, retry, queue 소비 등) | 별도 검토 |
| L109~L440 | Hybrid AI Query, Message Transformation, Effects | 핵심 유지 |

#### 분리 대상 파일

```
src/hooks/ai/core/chat-artifact-guidance.ts   (신규)
  - createForcedGuidanceArtifactIntent()
  - createForcedGuidanceArtifactQuery()
  - handleArtifactGuidanceCta 로직 (컨텍스트 주입 패턴)
```

#### 계약 (Contract)

- `useAIChatCore.ts` 공개 API(`UseAIChatCoreReturn`) 변경 없음
- `handleArtifactGuidanceCta` 시그니처 유지
- `guidance` artifact kind 분기 동작 유지

#### 완료 기준

- [x] `useAIChatCore.ts` ≤ 600줄
- [x] `chat-artifact-guidance.ts` 신규 파일에 factory + handler 로직 이동
- [x] `test(spec):` 선행 커밋 (guidance CTA 동작 회귀 테스트 추가)
- [x] `type-check` + `test:quick` 통과

#### 진행 기록

- 2026-05-15 Codex: SDD 선행 커밋 `test(spec): add guidance CTA isolation regression`으로 `chat-artifact-guidance` helper API와 CTA 실행/차단 계약을 먼저 추가했다. 신규 helper 부재로 의도된 실패를 확인한 뒤 구현에 착수.
- 2026-05-15 Codex: `src/hooks/ai/core/chat-artifact-guidance.ts`를 추가해 guidance CTA target→forced artifact intent/query 매핑, CTA 실행 차단, guidance/direct artifact request 분기를 이동했다. `useAIChatCore.ts`는 724줄에서 597줄로 축소되어 목표 기준(≤600)을 충족.
- 검증:
  - `npx vitest run --config config/testing/vitest.config.dom.ts src/hooks/ai/core/chat-artifact-guidance.test.ts src/hooks/ai/useAIChatCore.test.ts --silent=false` → 2 files / 18 tests passed
  - `npm run type-check` → passed
  - `npm run lint` → passed (`reports/qa/qa-tracker.json` size info only)
  - `npm run test:quick` → passed
  - `npm run line-guard` → no fail-threshold violations, `useAIChatCore.ts=597`

---

### Task 3 — `message-helpers.ts` 책임 분리

**우선순위**: Medium
**위임 추천**: Codex
**SDD 게이트**: plan Approved → `test(spec):` 선행 필수

#### 배경

`src/hooks/ai/utils/message-helpers.ts` 현재 **629줄**. 오늘 `buildAnalysisSourceGroups`, `getSemanticEvidenceDataSource` 등 retrieval 관련 helper가 +101줄 추가됐다. 현재 파일이 두 가지 책임을 담당한다.

#### 현재 파악된 역할 구분

| 함수 (라인) | 책임 | 분리 대상 |
|-------------|------|----------|
| `convertThinkingStepsToUI` (L193) | Thinking steps → UI 변환 | 유지 |
| `transformUIMessageToEnhanced` (L243) | 메시지 → EnhancedMessage 변환 (378줄) | 유지 (핵심) |
| `transformMessages` (L616) | 메시지 배열 변환 | 유지 |
| `buildAnalysisSourceGroups` (L99) | evidence → UI source group 빌드 | ✅ 분리 |
| `getSemanticEvidenceDataSource` (L170) | semantic trace → evidence data source 판단 | ✅ 분리 |
| `findRetrievalMetadataFromToolParts` (L63) | tool parts → retrieval metadata 추출 | ✅ 분리 |
| `findEvidenceCardsFromToolParts` (L76) | tool parts → evidence cards 추출 | ✅ 분리 |

#### 분리 대상 파일

```
src/hooks/ai/utils/evidence-source-helpers.ts  (신규)
  - findRetrievalMetadataFromToolParts()
  - findEvidenceCardsFromToolParts()
  - buildAnalysisSourceGroups()
  - getSemanticEvidenceDataSource()
```

#### 계약 (Contract)

- `message-helpers.ts`에서 re-export하여 기존 import 경로 변경 없음 (또는 사용처 일괄 수정)
- `transformUIMessageToEnhanced` 동작 불변
- 분리 후 `message-helpers.ts` ≤ 450줄 목표

#### 완료 기준

- [ ] `evidence-source-helpers.ts` 신규 파일 생성
- [ ] `message-helpers.ts` ≤ 450줄
- [ ] `test(spec):` 선행 커밋 (source group 빌드 로직 유닛 테스트 추가)
- [ ] `AnalysisBasisMetadata.test.tsx` 기존 테스트 회귀 없음
- [ ] `type-check` + `test:quick` 통과

---

### Task 4 — `orchestrator-routing.ts` 모듈 경계 정리

**우선순위**: Low
**위임 추천**: Codex
**SDD 게이트**: plan Approved → `test(spec):` 선행 필수

#### 배경

`cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts` 현재 **706줄**. 오늘 `executeForcedRouting`, `orchestrator-routing-direct-knowledge.ts` 추가로 실질적인 분리가 일부 진행됐으나, 파일 자체가 여전히 routing 정책 + provider 선택 + agent config 3가지 책임을 혼재한다.

#### 현재 파악된 역할 구분

| 섹션 | 책임 | 비고 |
|------|------|------|
| `getAgentConfig`, `getAgentProviderOrder`, `getAgentMaxSteps` | agent config 조회 | 이미 일부 위임됨 |
| `buildContextAwarePrompt`, `getAgentInstructions` | 프롬프트 빌더 | ✅ 분리 후보 |
| `getForcedRoutingCapabilityRequirements` | forced routing 판단 | ✅ 분리 후보 |
| `executeForcedRouting` | forced routing 실행 (~120줄) | 분리 검토 |
| `ORCHESTRATOR_PROVIDER_ORDER` | 상수 | 유지 |

#### 접근 방식

강제 분할보다는 **자연스러운 책임 이동**으로 접근한다. `orchestrator-routing-direct-knowledge.ts`에 이미 direct knowledge routing이 분리됐으므로, prompt builder 함수들을 `orchestrator-prompt-helpers.ts`로 이동하는 것만으로도 파일 규모가 경고 구간 이하로 내려갈 수 있다.

#### 목표

- `orchestrator-routing.ts` ≤ 500줄

#### 완료 기준

- [ ] `orchestrator-prompt-helpers.ts` 신규 파일에 `buildContextAwarePrompt`, `getAgentInstructions` 이동
- [ ] AI Engine `type-check` + targeted tests 통과
- [ ] `orchestrator-routing.ts` ≤ 500줄

---

## 실행 순서 및 위임 계획

```
Task 1 (Production QA)   → 완료, Codex, QA-20260515-0506
Task 2 (useAIChatCore)   → Codex 위임, test(spec): 선행 후 구현
Task 3 (message-helpers) → Codex 위임, Task 2와 병렬 가능
Task 4 (orchestrator)    → Codex 위임, Task 2/3 완료 후 또는 독립 수행
```

## 커밋 패턴

| Task | test(spec): | feat/refactor: |
|------|-------------|----------------|
| T1 | 해당 없음 | `test(qa): record v8.11.154 production QA` |
| T2 | `test(spec): add guidance CTA isolation regression` | `refactor(ai): extract guidance CTA helpers from useAIChatCore` |
| T3 | `test(spec): add evidence source helper unit tests` | `refactor(ai): extract evidence source helpers from message-helpers` |
| T4 | `test(spec): add orchestrator prompt builder tests` | `refactor(ai-engine): extract prompt helpers from orchestrator-routing` |

## 리스크

| 리스크 | 가능성 | 대응 |
|--------|--------|------|
| guidance CTA 분리 후 ref 타이밍 문제 | 중간 | `test(spec):` 에서 콜백 호출 타이밍 검증 |
| message-helpers re-export 누락 | 낮음 | `type-check`가 즉시 탐지 |
| orchestrator 분리 중 provider order 상수 중복 | 낮음 | 분리 전 사용처 grep 확인 |

---

_작성: 2026-05-15 KST (오늘 커밋 리뷰 기반)_
