> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-19
> Tags: ai-assistant,refactor,docs,frontend,cloud-run

# AI Assistant Improvement Plan (2026-05-19)

- 상태: Approved
- 작성일: 2026-05-19
- TODO.md 연결: Active Tasks > AI 어시스턴트 코드/문서 개선
- 의존성: 없음

## 목표

OpenManager AI Assistant 스택(Cloud Run AI Engine + Vercel frontend hooks/components + Supervisor proxy)의 코드 위생과 canonical 문서 정합성을 다음 한 사이클 안에 끌어올린다.

- 코드: hot file 재팽창(`orchestrator-routing.ts`, `useAIChatCore.ts`) 추가 분리. 신규 abstraction 추가 금지.
- 문서: `ai-engine-architecture.md`, `frontend-backend-comparison.md`, `01-ai-agent-design.md`, `02-runtime-architecture.md`의 stale 수치/표현 갱신. 신규 진입 맵 1장 추가.
- 다이어그램: Vision provider 체인은 `Gemini -> Z.AI Vision` 기준으로 갱신 완료. 남은 작업은 hot file 분리와 hook map 작성이다.

## 비목표

- 신규 specialist agent 추가
- Orchestrator LLM routing 복원
- Knowledge Retrieval Full GraphRAG 재도입 (`memory/ops-knowledge.md` 기준 제거 완료)
- 유료 frontier 모델 도입 (`ai-assistant-improvement-boundaries.md` Free Tier 원칙)
- Per-entity AI CTA 부활 (boundaries 문서 재확인)

## 현재 상태 진단 (2026-05-19)

### 코드 hot file

| 파일 | 현재 | 목표 | 메모 |
|------|-----:|-----:|------|
| `cloud-run/.../orchestrator-routing.ts` | 483 | ≤450 | 459→483으로 재팽창. 직전 분할(`orchestrator-prompt-helpers.ts`) 이후 routing telemetry/policy 코드가 다시 누적 |
| `src/hooks/ai/useAIChatCore.ts` | 607 | ≤580 | 597→607로 재증가. guidance CTA helper 분리 이후 hybrid/artifact 진입 분기가 다시 inline화 경향 |
| `src/hooks/ai/useHybridAIQuery.ts` | 704 | ≤600 (1차), ≤500 (2차) | `frontend-backend-comparison.md`의 잔여 909줄/~844줄 표기를 704줄 기준으로 정정. F2-r 후속 작업 명확화 필요 |
| `src/stores/useAISidebarStore.ts` | 674 | 후속 후보 | comparison 문서의 551줄 기록은 stale였으며, 현재 plan의 구현 task 범위에는 포함하지 않음 |
| `cloud-run/.../reporter-pipeline-report.ts` | 673 | ≤600 | report schema/format/score가 한 파일에 혼재. 정상 범주이나 단일 모듈 확장 시 분리 후보 |

### 문서/다이어그램 stale

| 위치 | 항목 | 현재 표기 | 실제 | 처리 |
|------|------|-----------|------|------|
| `frontend-backend-comparison.md` | useAIChatCore LOC | 426 | 607 | 갱신 완료 |
| `frontend-backend-comparison.md` | useHybridAIQuery LOC / F2-r 잔여량 | 909 / ~844 | 704 | 갱신 완료. C3은 ≤600 1차, ≤500 2차 후속 |
| `frontend-backend-comparison.md` | useAISidebarStore LOC | 551 | 674 | 갱신 완료. 구현 task는 후속 후보로만 유지 |
| `ai-engine-architecture.md` provider mesh | stale Vision provider chain | `Gemini -> Z.AI Vision` | 완료 | provider removal follow-up에서 반영 |
| `02-runtime-architecture.md:98` | Mermaid LLM 박스 | `Gemini -> Z.AI Vision` | 완료 | provider removal follow-up에서 반영 |
| `01-ai-agent-design.md` | 5 specialist 표 + `Metrics Query Agent` 명칭 | Metrics Query Agent (alias: NLQ Agent) | 코드 SSOT는 `nlq-agent.ts` 기반 NLQ Agent이며 별칭 명시 완료 | 완료 |
| `(없음)` | AI hooks 진입 맵 | 없음 | `useAIChatCore/Surface/EntryController/Hybrid/Async/Enhanced/Deferred/Developer/FileAttachments` 9개 hook 진입점 | D4 신규 1장 |

### 메모리 기록과 코드 정합

- `memory/ops-knowledge.md` "Orchestrator LLM routing 제거됨 (2026-05-16)" → 코드/문서: `orchestrator-direct-routing.ts`, `docs/adr/adr-005-routing-pattern-over-orchestrator-worker.md` 확인 ✅
- `memory/ops-knowledge.md` "Knowledge Retrieval Lite (BM25+metadata boost)" → 코드: `knowledge-retrieval-lite.ts` 확인 ✅
- `memory/ops-knowledge.md` "Z.AI GLM Flash provider mesh 편입" → 코드: `agent-model-selectors.ts`에서 GLM Flash / Gemini→Z.AI Vision fallback selector 확인 ✅

## 계약 (Contract)

### 코드 경계

| 경계 | 변경 전 | 변경 후 |
|------|---------|---------|
| `orchestrator-routing.ts` LOC | 483 | ≤450 (routing telemetry/policy 추출) |
| `useAIChatCore.ts` LOC | 607 | ≤580 (hybrid 분기 헬퍼 추출) |
| `useHybridAIQuery.ts` LOC | 704 | ≤600 (1차), ≤500 (2차 후속) |
| AI hook 진입 맵 | 없음 | `docs/reference/architecture/ai/ai-hooks-map.md` 1페이지 |
| Orchestrator LLM routing 복원 | 금지 | 금지 유지 |

### 문서 경계

- `Last reviewed` 갱신은 실제 내용 변경이 있을 때만.
- 코드 LOC 인용은 `wc -l` 출력으로 검증한 값만 사용.
- Vision provider 문서 표현은 `Gemini -> Z.AI Vision` 기준으로 정리 완료. 본 plan은 남은 코드 분리/LOC 문서 갱신에 집중한다.

### 테스트 시나리오

- [ ] `orchestrator-routing.ts` 추출 후 `targeted Vitest` (orchestrator routing test suite) PASS
- [ ] `useAIChatCore.ts` 추출 후 `useAIChatCore.test.ts` + `useEnhancedChatMessages.test.ts` PASS
- [ ] `useHybridAIQuery.ts` 추출 후 `useHybridAIQuery.test.ts` PASS
- [ ] AI hook map 문서가 9개 hook 모두를 1줄 이상 설명한다
- [ ] `npm run docs:budget:strict` 통과 (활성 문서 한도 90 유지)
- [ ] `npm run line-guard` 통과

## Task 목록

| ID | 작업 | 상태 | 비고 |
|----|------|------|------|
| C1 | `orchestrator-routing.ts` → `orchestrator-routing-policy.ts`/`orchestrator-routing-telemetry-helpers.ts` 추출 (≤450) | pending | SDD: `test(spec):` 선행 |
| C2 | `useAIChatCore.ts` → hybrid 분기 헬퍼 추출 (≤580) | pending | SDD: `test(spec):` 선행 |
| C3 | `useHybridAIQuery.ts` 1차 분할 (≤600) | pending | 904→704 부분 진척 반영, 잔여 분할 우선순위 재산정 |
| D1 | `frontend-backend-comparison.md` LOC/표 갱신 | completed | 현재 LOC drift 정리 완료. C1~C3 적용 후 각 task에서 재측정 |
| D2 | Vision provider chain 문서 정리 | completed | `Gemini -> Z.AI Vision` 기준 반영 |
| D3 | `01-ai-agent-design.md` NLQ ↔ Metrics Query 별칭 명시 | completed | 2026-05-19 문서 확인 |
| D4 | `ai-hooks-map.md` 신규 1페이지 작성 | pending | 9 hook entry 매트릭스 |
| Z1 | `memory/ops-knowledge.md` ↔ 코드 정합 grep 검증 결과 본 plan에 기록 | completed | provider mesh, KRL, direct routing 확인 |

## 검증

- 코드 변경: `npm run type-check`, `npm run lint`, `npm run test:quick`, AI Engine `type-check` + targeted test
- 문서 변경: `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check`
- 배포: 본 plan은 인프라/배포 영향 없음. release lock-step 불필요.

## 롤백 기준

- 코드 추출 후 단위 테스트 회귀가 1건이라도 발생하면 해당 commit revert 후 분할 경계 재설계.
- 문서 LOC 인용을 잘못 표기한 경우 같은 PR 안에서 수정 commit으로 즉시 정정.

## 참고 문서

- [ai-engine-architecture.md](../../docs/reference/architecture/ai/ai-engine-architecture.md)
- [ai-assistant-improvement-boundaries.md](../../docs/reference/architecture/ai/ai-assistant-improvement-boundaries.md)
- [01-ai-agent-design.md](../../docs/design/01-ai-agent-design.md)
- [02-runtime-architecture.md](../../docs/architecture/02-runtime-architecture.md)
- [frontend-backend-comparison.md](../../docs/reference/architecture/ai/frontend-backend-comparison.md)
- [openrouter-code-removal-plan.md](./archive/openrouter-code-removal-plan.md)
