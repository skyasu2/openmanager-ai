# TODO - OpenManager AI v8

**Last Updated**: 2026-04-17 KST (AI Response Visibility handoff persistence slice 완료)

> **이력 아카이브**: `#1~#89` 완료 항목 → [archive/todo-history-to-2026-04-13.md](archive/todo-history-to-2026-04-13.md)

## Active Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| 없음 | — | — | 다음 후보: `AI Response Visibility` 후속(`429 UX`, `Job Queue agent path`) 또는 `AI Stream Route Contract` residual cleanup(`observability/caching`) 재평가 |

---

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| P2: QA evidence 저장소 용량 정리 | Medium | tracking-only | 2026-04-15 재검증 기준 `reports/qa=53.78MiB`, `reports/qa/evidence=49.26MiB / 194파일`. `npm run qa:evidence:audit` orphan/missing `0`. 새 evidence 누적 시점에만 재평가. |

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| ~~AI Assistant Surface Parity Refactor~~ | — | **완료** — archive 이동. |
| AI Response Visibility & Rate Limit (Phase 1~5) | Medium | 계획서: [ai-response-visibility-rate-limit-plan-2026-04-08.md](ai-response-visibility-rate-limit-plan-2026-04-08.md). handoff 가시성 UX, 429 UX, Job Queue agent path, limiter 정책 재조정. |
| AI Stream Route Contract - residual cleanup | Medium | 계획서: [ai-stream-route-contract-plan.md](ai-stream-route-contract-plan.md). Phase 5 provider fallback visibility, Phase 6 warning semantics alignment, Phase 7 legacy role-tagging 완료. 남은 slice: observability/caching 설명 정리. |
| OTel 토폴로지 개선 (P1→P2→P3) | Medium | 계획서: [otel-topology-improvement-plan.md](otel-topology-improvement-plan.md). db-backup 스펙 현실화(즉시), Redis cross-AZ/NFS SPOF 시나리오 추가(단기), 서버 3대 추가(장기). |
| Storybook circular chunk warning 정리 | Low | non-blocking, stable 승격 후 재평가 |

---

## Recent Completed

### Completed (2026-04-17 #113)
- [x] AI Stream Route Contract - legacy role-tagging 완료
  - `/api/ai/supervisor`를 삭제하지 않고 legacy contract route로 명시
  - 응답 헤더 추가:
    - `X-AI-Route-Contract=legacy-supervisor`
    - `X-AI-Primary-Route=/api/ai/supervisor/stream/v2`
    - `X-AI-Transport=json|text`
  - local dev fallback 주석과 architecture/API docs를 current reality 기준으로 정리
  - TDD 커밋:
    - `5843a8e4a` → `6e667682c`
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/supervisor/cloud-run-handler.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-17 #112)
- [x] AI Stream Route Contract - warning semantics alignment 완료
  - multi-agent `SLOW_PROCESSING` warning payload를 single-agent와 같은 shape로 정렬 (`threshold` 포함)
  - warning message를 stale `25초`에서 실제 orchestrator threshold 기반 문자열로 수정
  - frontend warning 타입 주석을 path-local threshold semantics 기준으로 일반화
  - TDD 커밋:
    - `7fb0ad86a` → `7fc5c740a`
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `782 tests`)

### Completed (2026-04-17 #111)
- [x] AI Stream Route Contract - multi-agent provider fallback visibility 완료
  - AI SDK best practice 기준으로 transient retry state는 final metadata가 아니라 stream `agent_status`로 즉시 노출하도록 정렬
  - `executeAgentStream()`에서 다음 provider 재시도 직전에 상태 이벤트 추가:
    - `No output generated`
    - empty response
    - generic provider error
  - 기존 `done.metadata` / `usage.totalTokens` 계약은 유지
  - TDD 커밋:
    - `ca3944e3b` → `d06ef316e`
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `781 tests`)

### Completed (2026-04-17 #110)
- [x] AI Response Visibility - handoff persistence contract 완료
  - `handoffHistory: []`를 stream `data-done`, job queue result metadata, assistant message hydration, chat history save/restore 전반에서 보존
  - `handoff 있음` / `handoff 없음` / `legacy/미기록` semantics를 계약 수준으로 고정
  - TDD 커밋:
    - `2e00d4e42` → `d41bc0ee7`
  - 검증:
    - root targeted: `66/66` pass
    - AI Engine targeted: `14/14` pass
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - ai-engine gate: `npm run type-check && npm run test` (`74 files`, `779 tests`)

### Completed (2026-04-17 #109)
- [x] AI Chat Improvement Sprint 4 완료 및 계획서 archive 이동
  - non-stream routing timeout 시 `suggestedAgent` fallback 유지
  - structured-output provider fallback / invalid JSON fallback recovery 보강
  - decomposition stream `usage.totalTokens`, `failedCount`, `failedAgents` 계약 고정
  - sequential stream subtask timeout contract 완료: timeout된 subtask는 `null` 처리하고 partial success 유지, 전부 timeout 시 `ALL_SUBTASKS_FAILED`
  - TDD 커밋:
    - `94c62acfd` → `71b6b90d4`
    - `f5df3bd3a` → `721b84bce`
    - `083a23257` → `b442aac7c`
    - `68250484f` → `b724c3412`
    - `a7eb7c416` → `4c9cdb00c`
    - `5cf4b1d80` → `9ccc20d38`
    - `6f7e9156e` → `e25ba794e`
  - 검증: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `778 tests`)
  - archive: `reports/planning/archive/ai-chat-improvement-plan.md`

### Completed (2026-04-17 #108)
- [x] AI Assistant Surface Parity Refactor 완료 (Task 0~5 전체)
  - `useAIEntryController.ts` 신규: sidebar/fullscreen 진입 경로 단일화
  - `pendingEntryState` store 추가: draft/prefill/analysisMode one-shot handoff
  - `AIWorkspace` fullscreen parity: `analysisMode` 표시·변경, shared props
  - `mode="sidebar"` 레거시 분기 완전 제거 (`ce0d3a659`, -131줄)
  - 테스트 50개 통과 (AIWorkspace, AISidebarV4, useAISidebarStore)
  - 계획서 archive 이동: `reports/planning/archive/ai-assistant-surface-parity-refactor-plan.md`

### Completed (2026-04-17 #107)
- [x] active-alert `:9100` 포트 오염 근본 원인 수정 + targeted production QA 완료 (`v8.11.19`)
  - **근본 원인**: `AlertManager.ts`, `MetricsAggregator.ts`, `otel-log-views.ts` 3곳에서 `:9100` suffix 하드코딩 생성 → `instance: server.serverId` (포트 없음)로 전체 수정
  - **AIDebugPanel** 293줄 → 75줄 단순화 (Start+Check 2버튼 → 단일 "상태 확인", Log Level 섹션 제거)
  - `server-data-transformer.ts` dead code (`_targetToRawServerData`) 제거
  - 회귀 테스트 갱신: `MetricsAggregator.test.ts`, `otel-log-views.test.ts`, `monitoring-pipeline.test.ts`
  - production `v8.11.19` 배포 확인 + `QA-20260417-0302` 기록 (`4/4` pass)
  - detectAnomalies 직접 성공 확인: 실제 데이터(평균 64.9%→82% 급증) 기반 응답, 신뢰도 95%

### Completed (2026-04-17 #106)
- [x] root layout font preload warning cleanup broad production QA 완료
  - release `v8.11.17` / production deployment `dpl_sRuuaBX32ZL4rGggN552bJqcL2th` live 확인
  - `QA-20260417-0300` 기록 (`18/18` pass): landing/login/privacy/404/system-boot/dashboard/AI/fullscreen/API/console 전부 green
  - `/dashboard` + `/dashboard/ai-assistant` 경로의 `next/font preload unused` warning 재현 종료, broad reference를 `QA-20260417-0300`으로 갱신
  - Vercel usage check 정상: effective `9.7924 USD`, billed `0.0000 USD`, chargeCount `9135`

### Completed (2026-04-17 #105)
- [x] AI Domain Boundary Phase 2 production targeted QA + copy trim verification
  - production deployment `dpl_8RCgJKU4HmRuGrJUaDBUgEQYFhom` / commit `b1469ce44` (`v8.11.16`) live 확인
  - `QA-20260417-0298` 기록 (`10/10` pass): landing copy, system start → dashboard, AI sidebar welcome/placeholder, starter prompt 응답, analysis basis, `/api/version`, `/api/health`, console `0 error / 0 warning`
  - 범위 밖 surface (`fullscreen`, `Reporter/Analyst`, `observability/security`)는 targeted run 특성상 의도적으로 제외

### Completed (2026-04-16 #104)
- [x] 계획서 평가 및 개선 사이클
  - **Stream Route Contract Phase 1**: `useHybridAIQuery.ts` JSDoc 교정 (threshold 45→실제값 19 맥락 명시), `frontend-backend-comparison.md` 복잡도 라우팅 표 수정
  - **AI Domain Boundary Phase 1 완료**: `query-classifier.ts` `off-domain` intent + `isOffDomain` 플래그, `useQueryExecution.ts` 오프도메인 disclaimer warning 주입, `ChatInputArea.tsx` placeholder 도메인 안내 추가
  - **NLP/아키텍처 문서 반영**: `ai-engine-architecture.md` "NLP 엔진: 자체 구현 없음" 사실 오류 수정, `frontend-backend-comparison.md §2.3-A` NLP 전처리 파이프라인 상세 추가
  - **knowledge-base corpus drafts**: archive 이동 (실행 계획 없는 초안 모음)
  - **Backlog 재정렬**: Domain Boundary Phase 2, Sprint 4 순서 명확화

### Completed (2026-04-16 #100)
- [x] P1 `ai-workspace-analysis-basis-hydration-drift` 완전 종료
  - `stream-data-handler.ts` `data-done` 핸들러에 `toolsCalled` → deferred metadata 저장 누락 수정. `ac18ca2f9`.
  - 회귀 테스트 2케이스 추가 (deferred 경로 + pending 경로).
  - preview QA pass (sidebar→fullscreen parity 유지 확인).
  - v8.11.13 release + production QA-20260416-0294 pass (7/7, Reporter/Analyst/feedback).

### Completed (2026-04-16 #103)
- [x] Vibe Coding 공개 카피 정리
  - `feature-cards.data.ts`, `vibe-coding.ts` 수정: 모델 SKU(`claude-sonnet-4-6`) 제거, `99% 주도` → 중립 문구, Google Antigravity implementation 사용 맥락 분리, Cursor stage label 완화.
  - `docs/status.md`: Claude Code 모델 버전 `Opus 4.6` → `Sonnet 4.6` 수정.
  - 타입 체크 ✅ / 정적 검증 ✅ (Playwright WSL2 네트워크 격리로 로컬 UI 직접 검증 불가 — 다음 배포 후 production 확인).
  - 커밋: `8f9babff8`, `7ef048999`.

### Completed (2026-04-16 #102)
- [x] 계획서 archive 정리 (2차)
  - `completion-review.md`, `wbs.md`, `knowledge-base-corpus-expansion-plan.md`, `supabase-migration-ledger-repair-plan.md` → archive 이동.
  - `ai-response-visibility-rate-limit-plan-2026-04-08.md`: 메타데이터 헤더 추가 + Backlog 등록.
  - `knowledge-base-corpus-candidate-drafts.md`: Owner `platform-data` → `project` 수정.
  - 잔여 활성 plan 파일: `vibe-coding-public-copy-plan.md`, `ai-chat-improvement-plan.md`, `ai-response-visibility-rate-limit-plan-2026-04-08.md`, `knowledge-base-corpus-candidate-drafts.md`.

### Completed (2026-04-16 #101)
- [x] 계획서 디렉토리 정리 (이번 세션)
  - `approval-history-restore-plan.md`, `orphan-function-cleanup-plan.md`, `ai-user-feedback-cleanup-plan.md` → archive 이동.
  - `next-tasks-plan.md` Task 5·6 완료 처리 후 archive 이동.
  - `TODO.md` 슬림화: #1~#89 완료 이력 → `archive/todo-history-to-2026-04-13.md` 분리.
  - 잔여 Active plan (`vibe-coding-public-copy-plan.md`) Active Tasks에 등록.

### Completed (2026-04-15 #99)
- [x] AI SDK 버전 재조사 완료 — root + ai-engine 모두 `ai ^6.0.156`, `@ai-sdk/react ^3.0.140` 확인. `ai@latest` 호환성 blocker 재분류 → stale 정리로 닫음.

### Completed (2026-04-15 #98)
- [x] production release-gate QA refresh — Vercel production landing→AI sidebar 흐름 `8/8` green. `QA-20260415-0287`.

### Completed (2026-04-15 #97)
- [x] zero-backlog planning 정합성 반영 — TODO.md Active Tasks / Backlog 문구 실제 상태 반영.

### Completed (2026-04-15 #96)
- [x] QA trend metadata sync — `QA_TRENDS.md`, `QA_STATUS.md` `QA-20260415-0286` 기준으로 갱신.

### Completed (2026-04-15 #95)
- [x] mixed advisory residual follow-up — OOM/CPU+memory 혼합 3건 재검증. `no-tool` drift 미재현. non-blocking latency watch 유지.

### Completed (2026-04-15 #94)
- [x] `src/types/README.md` 필요성 재평가 → 신규 문서 불필요 판단. 기존 canonical reference로 커버 충분.

### Completed (2026-04-15 #93)
- [x] Graph traversal production 재평가 → `KEEP` 결정. topology `vector 3 + graph 1`, incident `graph 3 + vector 0` 확인. `QA-20260415-0285`.

### Completed (2026-04-15 #92)
- [x] Storybook `experimentalComponentsManifest` flag 유지 판단 고정. stable 승격 전 변경 없음.

### Completed (2026-04-15 #91)
- [x] topology duplicate invocation dedupe — `supervisor-routing.ts` step 0 이후 강제 도구 재노출 차단. revision `ai-engine-00317-sss`. `QA-20260415-0284`.

### Completed (2026-04-15 #90)
- [x] Advisor Agent P1 수정 완료 (Task 1~4) — latency 임계값 보정, 프롬프트 포맷 강화, quality-retry 트리거 추가, Cloud Run 재배포. revision `ai-engine-00316-l67`. `QA-20260415-0283`.

### Completed (2026-04-13 #89)
- [x] variant direct path 안정화 패치 — `orchestrator-web-search.ts`, `supervisor-routing.ts`, `supervisor-quality-retry.ts` 보강. revision `ai-engine-00308-6qw`. `QA-20260413-0280`.
