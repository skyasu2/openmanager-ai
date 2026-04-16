# TODO - OpenManager AI v8

**Last Updated**: 2026-04-17 KST (broad production QA 회귀 확인, font preload fix local patch pending deploy)

> **이력 아카이브**: `#1~#89` 완료 항목 → [archive/todo-history-to-2026-04-13.md](archive/todo-history-to-2026-04-13.md)

## Active Tasks

- P1: root layout font preload warning 정리 후 broad production QA 재검증
  - broad production run `QA-20260417-0299`에서 `landing/login/privacy/dashboard/AI/fullscreen/API`는 green이었지만, `/dashboard` + `/dashboard/ai-assistant` 경로에서 `next/font preload unused` warning 4건이 재현되어 broad reference 승격 보류
  - local patch 준비: [layout.tsx](/mnt/d/dev/openmanager-ai/src/app/layout.tsx:16) 에 `Inter` / `Noto_Sans_KR` `preload: false`
  - local 재검증은 환경 이슈로 보류:
    - `next dev` Turbopack panic: `Symlink node_modules is invalid, it points out of the filesystem root`
    - `npx next dev --webpack -p 3000` fallback은 `/login` 첫 compile이 약 `6.7min` 걸렸고 full reload warning까지 발생해, local browser QA source-of-truth로 쓰기엔 비효율적이어서 중단
  - 다음 액션: deploy 후 production에서 broad console cleanliness 재확인

---

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| P2: QA evidence 저장소 용량 정리 | Medium | tracking-only | 2026-04-15 재검증 기준 `reports/qa=53.78MiB`, `reports/qa/evidence=49.26MiB / 194파일`. `npm run qa:evidence:audit` orphan/missing `0`. 새 evidence 누적 시점에만 재평가. |

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| AI Assistant Surface Parity Refactor | Medium | 계획서: [ai-assistant-surface-parity-refactor-plan.md](ai-assistant-surface-parity-refactor-plan.md). sidebar/fullscreen `analysisMode` 가시성, draft/prefill handoff, entry controller, legacy `AIWorkspace mode="sidebar"` 정리. |
| AI Chat Improvement Sprint 4 | Medium | 계획서: [ai-chat-improvement-plan.md](ai-chat-improvement-plan.md). `generateObject` NLQ 전환 + per-step timeout. `ai-stream-route-contract` Phase 1 완료 선행 조건 해소됨. |
| AI Response Visibility & Rate Limit (Phase 1~5) | Medium | 계획서: [ai-response-visibility-rate-limit-plan-2026-04-08.md](ai-response-visibility-rate-limit-plan-2026-04-08.md). handoff 가시성 UX, 429 UX, Job Queue agent path, limiter 정책 재조정. |
| Storybook circular chunk warning 정리 | Low | non-blocking, stable 승격 후 재평가 |

---

## Recent Completed

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
