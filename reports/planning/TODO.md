# TODO - OpenManager AI v8

**Last Updated**: 2026-04-12 KST (command_vectors query plan 점검 — HNSW 존재 확인, 현재는 row 수가 작아 seq scan 선택)

## Active Tasks

| Task | Priority | Status |
|------|----------|--------|
| [다음 작업 목록 (release / residual follow-up)](./next-tasks-plan.md) | High | 후속 작업 진행 중 |

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| 진행 중 보류 항목 없음 | - | - | - |

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| P3: Storybook `experimentalComponentsManifest` stable 승격 여부 재확인 | Low | npm registry stable이 아직 `10.2.10`이라 보류. `10.3.x`가 stable dist-tag로 올라온 뒤 `.storybook/main.ts` feature flag 재검토. |
| P3: `src/types/README.md` 전용 타입 SSOT 문서 필요성 재평가 | Low | 현재 전용 README는 없음. 타입 정제 작업은 완료됐고, 신규 문서 추가는 실제 drift가 다시 생길 때만 검토. |

### Completed (2026-04-11 #40)

#### P1: Supabase DB 잔여 orphan 함수 2차 정리 + 보안 함수 제거

**배경**: `drop_legacy_server_logs` (20260411070843) 반영으로 `server_logs` 테이블이 삭제됐으나,
해당 테이블을 참조하는 함수 `add_server_log` / `cleanup_old_logs` 가 schema에 남아 있음.
아울러 같은 시점에 확인된 추가 orphan 9개 + SECURITY DEFINER 보안 위험 함수 `exec_sql` 존재.

**대상 함수 (총 10개)**:
```
add_server_log             → server_logs (삭제됨) 참조
cleanup_old_logs           → server_logs (삭제됨) 참조
cleanup_old_metrics        → server_metrics_history (존재 안 함) 참조
update_compression_metadata     → conversation_history (삭제됨) 참조
update_conversation_updated_at  → conversation_history trigger fn (삭제됨)
update_server_metrics_updated_at → server_metrics_history trigger fn (존재 안 함)
get_active_patterns        → learned_patterns (존재 안 함) 참조
get_latest_bottlenecks     → performance_bottlenecks (존재 안 함) 참조
calculate_system_health_score → code_quality_analysis (존재 안 함) 참조
exec_sql                   → SECURITY DEFINER arbitrary SQL 실행, 앱 미사용 → 보안 위험
```

**대상 뷰 (1개)**:
```
query_statistics  → 하드코딩 stub (모두 0 반환), 실 데이터 없음, 앱 미사용
```

- [x] `20260411133303_drop_orphan_functions_batch2.sql` 추가 — `DROP FUNCTION` 10개 + `DROP VIEW public.query_statistics` 반영.
- [x] remote Supabase에 batch2 migration 적용 완료 — `server_logs` 잔재 2개 + 추가 orphan 7개 + `exec_sql(text)` 제거.
- [x] clean 재검증 완료 — `supabase migration list` local=remote 정렬, `supabase db push --dry-run --linked` `Remote database is up to date.` 확인.
- [x] 보안 게이트 확인 — `exec_sql(text)` remote schema에서 실제 제거 확인.

---

### Completed (2026-04-12 #41)
- [x] `command_vectors` retrieval 경로 점검 완료 — remote에 `idx_command_vectors_embedding_hnsw` 존재, row 수는 `26`건으로 확인.
- [x] query plan 확인 — `ORDER BY embedding <=> ... LIMIT` 쿼리는 현재 planner가 `Seq Scan + Sort`를 선택하지만 실행시간은 warm 기준 `~0.5ms`, cold 기준 `~17ms`로 관측.
- [x] live codepath 분리 확인 — 현재 AI Engine의 주 hybrid retrieval은 [llamaindex-rag-service.ts](../../cloud-run/ai-engine/src/lib/llamaindex-rag-service.ts) → [hybrid-text-search.ts](../../cloud-run/ai-engine/src/lib/hybrid-text-search.ts) → `hybrid_search_with_text` 이며, 이는 `knowledge_base`를 주로 사용.
- [x] 결론 고정 — `command_vectors` HNSW 추가는 방어적 개선으로 유효하지만, 현재 데이터량/코드 경로 기준 즉시 추가 튜닝 과제는 아님. row 수가 충분히 커지거나 command retrieval path가 주 경로가 될 때 재평가.

---

### Completed (2026-04-11 #39)
- [x] P1: 로그 테이블 정리 완료 — `security_audit_logs`는 auth audit live 경로라 유지, `server_logs`는 runtime 미사용/0행/seed-only 상태라 `get_server_logs`와 함께 제거.
- [x] P1: Supabase parity 재검증 — `20260411070843_drop_legacy_server_logs` 반영 후 `supabase migration list` 정렬 및 `supabase db push --dry-run --linked` clean 유지 확인.
- [x] P1: orphan 함수 정리 완료 — remote schema에서 backing object가 없는 legacy 함수 `19`개 제거, `get_approval_history` / `get_approval_stats`만 유지.
- [x] P1: Supabase parity 재검증 — `20260411063810_drop_orphan_legacy_functions` 반영 후 `supabase migration list` 정렬 및 `supabase db push --dry-run --linked` clean 유지 확인.
- [x] P1: Supabase migration ledger parity repair 완료 — main repo `supabase/migrations/`를 remote timestamp ledger 기준으로 재구성하고 compressed/date-only legacy 세트를 `supabase/archive/`로 분리.
- [x] P1: CLI parity 검증 완료 — `supabase migration list` local=remote 일치, `supabase db pull` shadow DB 생성 단계 진입, `supabase db push --dry-run --linked` `Remote database is up to date.` 확인.
- [x] P2: 운영 문서 정리 — [supabase-migration-ledger-repair-plan](./supabase-migration-ledger-repair-plan.md) 완료 상태 전환, [README.legacy-ledger-hold](../../supabase/README.legacy-ledger-hold.md) 추가, archive 경로 git 추적 예외 처리.

### Completed (2026-04-07 #38)
- [x] P3: `src/types/common.ts` 잔여 unused type 정리 — 실참조가 없는 `Environment`, `ServerType`, `PaginationInfo`, `LogLevel`와 미사용 `ServerMetrics` 경유 re-export 제거.
- [x] P3: 안전성 재검증 — 실제 참조(`ServiceStatus`, `ServerStatus`, `AlertSeverity`) 유지 상태에서 `npm run type-check`, `npm run lint` 통과.

### Completed (2026-04-07 #37)
- [x] P3: Storybook large chunk warning 정리 — `.storybook/main.ts`의 `chunkSizeWarningLimit`를 Storybook-generated `vite-inject-mocker-entry.js` 실제 산출 크기(약 `1.52 MB`) 기준으로 `1600`으로 상향해 build 로그의 false-positive large chunk warning 제거.
- [x] P3: Storybook build 재검증 — `npm run storybook:build:ci` 재실행으로 large chunk warning 없이 static build 성공 확인.

### Completed (2026-04-07 #36)
- [x] P2: `pre-push` shared node infra smoke 최적화 — `src/test/setup.node.ts`, `vitest.config.node.ts`, `vitest.config.dev.ts`, `vitest-node-wrapper.js`, shared `msw/shared-aliases/main config` 변경을 일반 `src/**` related suite에서 분리하고 `test:node:infra:smoke` 경로로 라우팅.
- [x] P2: 분류기 회귀 보강 — `pre-push-file-classifier`/`pre-push-test-classifier` 테스트에 node infra exact/shared infra/mixed source+infra 케이스 추가.
- [x] P2: smoke 경로 검증 완료 — `npm run test:node -- tests/unit/dev/pre-push-*.test.ts tests/unit/dev/vitest-node-wrapper.test.ts`, `npm run test:node:infra:smoke` 통과.

### Completed (2026-04-07 #34)
- [x] P1: `v8.11.0` 릴리스 완료 — `chore(release): 8.11.0` 커밋/태그(`v8.11.0`) 생성, release consistency check PASS, `git push --follow-tags gitlab main` 완료.
- [x] P1: GitHub 공개 스냅샷 동기화 완료 — `npm run sync:github` 실행, `cc1c579f5` 기준 공개 레포 반영.
- [x] P2: node full-suite 회귀 수정 — `vercel-post-deploy-smoke` probe 경로의 `Server is not running` 오류 수정 후 `npm run test:node` 전체 통과 (`184 files: 181 passed, 3 skipped`).

### Completed (2026-04-07 #35)
- [x] P2: `test:node` runtime 최적화 — `config/testing/vitest.config.node.ts`에 node 전용 `setup.node.ts`를 분리해 DOM 전용 셋업 비용을 제거.
- [x] P2: lightweight node routing 확장 — `tests/unit/playwright/**`를 lightweight config(`vitest.config.dev.ts`)로 라우팅해 pre-push targeted node 실행 비용 축소.
- [x] P2: 회귀 검증 완료 — `tests/unit/dev/vitest-node-wrapper.test.ts`, `tests/api/ai-supervisor-stream.contract.test.ts`, `tests/unit/playwright/playwright-config.test.ts`, `npm run test:node`, `npm run type-check`, `npm run lint` 통과. Full node suite wall time `809.63s → 536.87s`로 약 34% 단축.

### Completed (2026-04-07 #33)
- [x] P2: node smoke 테스트 안정화 — `tests/unit/dev/filter-public-scripts.test.ts`, `tests/unit/qa/check-vercel-usage.test.ts`에서 output assertion을 상태/부수효과 중심으로 보강해 무출력 환경 false negative 완화.
- [x] P2: loopback 제한 환경 대응 — `tests/unit/qa/vercel-post-deploy-smoke.test.ts`에 bind probe/listen error 처리 추가, `EPERM` 환경에서 deterministic skip 처리.
- [x] P2: 게이트 재검증 — `npm run type-check`(136.8s), `npm run test:quick`(160 tests), targeted node tests(12 tests) PASS 확인.

### Completed (2026-04-07 #32)
- [x] P2: ai-engine `ai` SDK 버전 정렬 — `cloud-run/ai-engine`의 `ai`를 `6.0.86→6.0.145`로 상향해 root app과 동일 버전으로 정렬. `npm run verify:rag`, `npm run type-check`, `npm run test`(69 files / 726 tests) 통과. 기존 Vitest resolver 가설은 현재 재현되지 않아 별도 alias 수정 없이 유지.

### Completed (2026-04-07 #31)
- [x] P3: Storybook circular chunk warning 제거 — `.storybook/main.ts`에서 `vendor-react` manual chunk를 제거해 `vendor-react -> vendor-storybook`, `vendor-react -> vendor-charts` 순환 경고 해소. `npm run storybook:build` 통과, large chunk warning만 잔존.

### Completed (2026-04-07 #30)
- [x] P2: AI 응답 `분석 근거` 접힘 상태 요약 추가 — 기본 collapsed 상태에서도 `데이터 · 도구 · 기간` 1줄 요약이 보이도록 개선. `AnalysisBasisBadge` 타입 보정 포함, `npx vitest run src/components/ai/AnalysisBasisBadge.test.tsx`, `npm run lint`, `npm run test:quick`, `npm run type-check` 통과.

### Completed (2026-04-07 #27)
- [x] P2: TypeScript 6 root 업그레이드 — `typescript 5.9.3→6.0.2` 반영. `downlevelIteration` 제거와 `src/types/css.d.ts` 추가로 TS6의 side-effect CSS import stricter check 대응. `npm run type-check`, `npm run lint`, `npm run test:quick` 통과.

### Completed (2026-04-07 #28)
- [x] P2: Storybook hygiene 정리 — 71개 story type import를 `@storybook/nextjs-vite`로 통일, `AIWorkspace`/`AIDebugPanel` autodocs 적용, `AIDebugPanel` 비표준 `mockData`를 deterministic fetch mocking으로 교체, named export mismatch(`AnalysisBasisBadge`, `WelcomePromptCards`) 수정 후 `npm run storybook:build` 통과.

### Completed (2026-04-07 #29)
- [x] P2: ai-engine 패키지 분리 트랙 1차 적용 — `typescript 6.0.2`, `@types/node 25.5.2`, `@supabase/supabase-js 2.101.1` 반영. `ai@latest`는 Vitest resolver 충돌로 실패해 `6.0.86` 유지. `cloud-run/ai-engine`의 `npm run type-check`, `npm run test` 통과.

### Completed (2026-04-07 #25)
- [x] P2: Knip v6 전환 — `knip` `5.88.1→6.0.5`, `knip.json` schema `@5→@6` 정렬. 새 parser 기준 unused 4건(`src/types/server/guards.ts`, `api-config` default export, server enum alias re-export)도 함께 정리해 `npm run knip:ci` clean 유지.

### Completed (2026-04-07 #23)
- [x] P2: 루트 앱 안전한 patch 업그레이드 적용 — `@supabase/supabase-js` `2.97.0→2.101.1`, `@supabase/ssr` `0.8.0→0.9.0`, `@opentelemetry/sdk-node` `0.212.0→0.214.0`, `@types/node` `25.5.0→25.5.2`, `rollup` `4.53.5→4.59.0` 반영. `ai`는 npm registry 기준 `6.0.145`가 latest라 유지.

### Completed (2026-04-07 #24)
- [x] P2: TypeScript 6 사전 준비 — root `tsconfig.json`에 `types: ["node"]`를 선행 반영해 TS6 기본 `@types/*` 포함 정책 변경에 대비. TS 자체 업그레이드는 Step 4에서 별도 수행.

### Completed (2026-04-07 #22)
- [x] P2: `server-enums` SSOT 정렬 — `src/types/server/types.ts`를 canonical enum passthrough로 단순화하고, `src/types/server/entities.ts`의 환경/역할 필드를 공통 scope로 정렬. `src/types/server/index.ts`도 base/core export 경계를 정리해 Step 2 서버 타입 SSOT 항목 마감.

### Completed (2026-04-07 #21)
- [x] P2: `ServerHealthSummary`/`ServerSpecs` SSOT 정렬 — `src/types/server/base.ts`에 health summary alias 추가, `src/types/server/core.ts`와 `EnhancedServerModal.types.ts`가 동일 summary/specs 타입을 재사용하도록 통합. `src/types/server/index.ts` re-export도 함께 정렬.

### Completed (2026-04-07 #20)
- [x] P2: `EnhancedServerModal.types.ts` 서버 타입 정렬 — 중복 `ServerSpecs` 제거, `ServerHealth`를 `src/types/server/base.ts` 기반 요약 타입으로 파생. `normalizeServerData()` fallback health에도 `status`를 채워 모달 데이터와 서버 타입 SSOT를 정렬.

### Completed (2026-04-07 #19)
- [x] P2: `type-check:changed` correctness 정리 — `files: [...]` scoped mode 제거, changed-file filtering은 전체 project type-check 시작 여부만 판단하도록 환원. `src/types/**` 위임 / tooling-only skip fast path 유지, standalone regression test에서 `tsconfig.check.json` full-project fallback 고정.

### Completed (2026-04-07 #18)
- [x] P2: `type-check:changed` 인프라 최적화 — `files: [...]` 스코프형 증분 체크 도입 (100s+ → 12s 단축), `PRESET_FILES` 공백 처리 버그 수정 (`709d88954`)
- [x] P2: 서버 타입 통합 — `server-common.ts` 제거 후 `server/base.ts` 통합, 의존성 인디렉션 제거

### Completed (2026-04-07 #17)
- [x] P3: `src/types/common.ts` 미사용 export 1차 정리 — 전역 참조 0회인 `CloudProvider`, `BaseService`, `BaseAlert`, `MetadataValue`, `ServerMetadata`, `ExtensibleMetadata`, `BaseServer`, `ApiErrorDetails`, `BaseApiResponse`, `TimeRange`, `FilterOptions`, `SortOptions`, `LogDataValue`, `LogData`, `ErrorContextValue`, `ErrorContext`, `DeepPartial`, `AnalysisDetail` 제거. 내부 전용 `isMetadataValue`/`_isLogData`/`_isErrorContext` 헬퍼도 함께 삭제.

### Completed (2026-04-07 #16)
- [x] P3: Knip unused export 정리 — `src/types/ai-sidebar/`: AIEngineInfo/AISidebarHandlers/AISidebarProps/AutoReportTrigger/SessionInfo/UseAISidebarReturn 6개 제거. `src/types/intelligent-monitoring.types.ts`: 구형 IntelligentAnalysis* 타입 블록 전체 + SimpleAnalysisRequest 9개 제거. TypeScript 에러 0.

### Completed (2026-03-31 #15)
- [x] P3: 백로그 재정비 — `대형 파일(500+줄) 분리 계획` 항목 폐기 확정. 대상 파일(system/route.ts 476줄, jobs stream 464줄)이 이미 기준 미만으로 실효 상실. schemas/api.*.schema.ts 미사용 type alias + src/types/ 미사용 exports 일괄 정리 진행.

### Completed (2026-03-29 #14)
- [x] P3: `supervisor/stream/v2/route.ts` timeout helper 분리 — warmup/abort/retry timeout 계산과 헤더 파서를 `stream-timeouts.ts`로 추출해 `route.ts` 634→561줄 축소, `stream-timeouts.test.ts` 추가 후 route/helper 28 tests 및 `npm run check` 통과

### Completed (2026-03-29 #13)
- [x] P3: `auth/guest-login/route.ts` 대형 파일 분리 — 응답/쿠키 조립을 `response-utils.ts`로 추출해 `route.ts` 521→435줄 축소, `response-utils.test.ts` 추가 후 route/utility 11 tests 및 `npm run check` 통과

### Completed (2026-03-29 #12)
- [x] P3: auto-report formatter 대형 파일 분리 — `formatters.ts` 661→304줄 축소, section builder를 `formatters-sections.ts`로 추출, `formatters-sections.test.ts` 추가 후 type-check/check/test 통과 (`4c2e4fb29`)

### Completed (2026-03-29 #11)
- [x] P3: VibeHistorySection stage4 추가 — GitLab canonical/Multi-AI CLI/로컬 Docker CI/Cloud Run AI Engine 4단계 cyan 섹션. types/data/component/test 4파일 수정, 6 tests pass. v8.10.8 릴리즈

### Completed (2026-03-29 #10)
- [x] P3: Knip unused export types 19개 제거 — FeatureCardProps, LokiPushPayload, ServerMetrics alias, HourlyJsonData, JobProgressUpdate, JobCompletionUpdate, AnalyzeComplexityFn, EstimateTimeFn, ISystemEventSubscriber, ErrorContext, ServerMetricsHistory, EnhancedServerMetrics (core), ServerGroup, CloudRunResponse, FilePartSchema, MessageSchema, RequestSchema, RequestSchemaLoose, UpstashResumableContext. 160/160 tests pass 유지

### Completed (2026-03-29 #9)
- [x] P2: v8.10.6 Production QA 완료 — Playwright MCP, 11/11 pass, 콘솔 에러 0, QA-20260329-0194 기록. Vercel 사용량 $21.09/월 정상
- [x] P2: Production 보안 헤더 배포 확인 — COOP(`same-origin-allow-popups`), CSP, HSTS(`preload`), X-Frame-Options(`DENY`), Permissions-Policy 모두 production 응답에서 확인
- [x] P1: brace-expansion CVE GHSA-f886-m6hf-6m8v 패치 — `npm audit fix`로 process hang/memory exhaustion 취약점 제거

### Completed (2026-03-28 #8)
- [x] P2: `global-error.tsx` Sentry.captureException 추가 — 다른 에러 경계와 일관성 확보 (`boundary: 'global-error'`)
- [x] P3: `error.tsx` boundary 태그 수정 — `'global-error'` → `'root'` (Sentry 에러 분류 정확도 개선)
- [x] P2: 보안 헤더 3종 개선 — `Cross-Origin-Opener-Policy: same-origin-allow-popups` 추가, `Permissions-Policy` 구식 `interest-cohort=()` 제거, 잘못된 `X-Vercel-Cache`/`X-Edge-Runtime` 수동 설정 제거
- [x] P2: `vitest.config.simple.ts` coverage suite 안정화 — playwright/dev/qa 테스트 exclude, ai-warmup jsdom 격리, esbuild target node14→node18. 12/12 pass (이전 6 failed)
- [x] P2: Biome `useOptionalChain` 4건 수정 — `AgentHandoffBadge`, `useClarificationHandlers`, `useQueryExecution`, `promql-engine-core` (커밋 `64bb17940`)

### Completed (2026-03-28 #7)
- [x] P1: `unified-cache.ts` + `redis/index.ts` 배럴 export 오류 수정 — 삭제된 7개 함수 re-export 정리 (TypeScript 빌드 회귀 해소)
- [x] P1: npm audit fix — rollup CVE-2025 high severity 해소 (path traversal, GHSA-mw96-cpmx-2vgc)
- [x] P2: `ai-assistant/error.tsx` + `login/error.tsx` 에러 경계 추가 — 전용 Sentry 태깅 + 컨텍스트별 복구 UX
- [x] P2: SEO robots noindex — auth/* 레이아웃, system-boot/page.tsx, main/page.tsx (유틸리티 페이지 색인 차단)
- [x] P2: title template 이중 접미사 버그 수정 — `validation/page.tsx`, `privacy/page.tsx`
- [x] P1: v8.10.5 릴리즈 — GitLab push + GitHub sync 완료

### Completed (2026-03-28 #6)
- [x] P2: `auth/error.tsx` 에러 경계 추가 — auth 세그먼트 전용 에러 UI (Sentry `boundary: 'auth'` 태깅 + "로그인으로" 복구 액션)
- [x] P1: v8.10.4 릴리즈 — 19커밋 누적 후 릴리즈. GitLab push + GitHub sync 완료

### Completed (2026-03-28 #5)
- [x] P1: `pre-push-changed-files.js` 단위 테스트 20개 추가 — 6-branch 로직(`override`/`prePushUpdates`/`upstream`/`merge-base`/`baseDiff`/`HEAD~1`) + skip 조건 + 중복 제거 커버
- [x] P2: `checkNodeModules` → `createGuardResult` 패턴 전환 — guards 모듈 내 반환 타입 일관성 확보 (boolean→`{ ok, reason }`)
- [x] P2: `runDocsArtifactValidation` process.exit 제거 — return-value 패턴 + `exitIfGuardFailed()` 위임. orchestrator 외부 모듈에서 process.exit 완전 제거
- [x] P3: `dashboard.types.ts` unused types 8개 제거 — `ServerFilters`, `ServerCluster`, `ApplicationMetrics`, `ServerDashboardProps`, `ServerAction`, `RealtimeData` + 내부 전용 `ServerInstance`, `NetworkStatus` 삭제. `DashboardStats`/`DashboardTab`/`ViewMode` 유지

### Completed (2026-03-28 #4)
- [x] P3: Knip safe unused type cleanup — 내부 UI/constant 범위의 unused exported types 7개 제거 (`FilterOption`, `TimeRange`, `AlertHistoryFilterState`, `LogExplorerFilterState`, `ProfileSecurityState`, profile `SystemStatus`, `OTelMetricName`). 잔여 backlog는 schema/common/public contract 중심으로 축소

### Completed (2026-03-28 #2)
- [x] P3: Public GitHub snapshot sync 자동화 — `scripts/sync/github-sync.sh`, `.github-export-ignore`, `package.json`의 `sync:github` / `sync:github:dry-run` 추가. 코드 전용 스냅샷 기준으로 `origin/main` 동기화 완료
- [x] P1: GitLab canonical delivery 정렬 및 로컬 Docker CI 표준화 — `gitlab` canonical / `origin` public-only topology 확정, `remote.pushDefault=gitlab`, `main -> gitlab/main`, `scripts/ci/local-docker-ci.sh` + `CI_DOCKER_PULL_POLICY` 도입, 관련 규칙/문서 정렬, `git push gitlab main` 후 Vercel production deployment `dpl_HaXUuu6ewS38hYCVoFuwx5oKL6Ru` `READY` 확인

### Completed (2026-03-28 #3)
- [x] P2: Knip unused exports 정리 — `cache-helpers.ts` 미사용 7개 함수 + AI 쿼리 헬퍼 3개 삭제(-131줄), `rate-limiter.ts` `RATE_LIMIT_CONFIGS` 삭제(-57줄). Knip `exports: warn` 기준 clean pass. GitLab push + GitHub sync 완료
- [x] P2: `filter-public-scripts.js` 추출 + 단위 테스트 6개 — `github-sync.sh` 인라인 Node.js 스니펫을 독립 스크립트로 분리. dirty check 에러 메시지에 `git stash` 가이드 추가
- [x] P2: `knip.json` severity rules 추가 — `files`/`dependencies`/`unlisted` → error, `exports`/`types`/`devDependencies` → warn 세분화. `ignoreExportsUsedInFile: true` 유지
- [x] P2: `.versionrc.json` 개선 — URL GitLab으로 교체, CHANGELOG 타입 필터(chore/docs/style/ci hidden)

### Completed (2026-03-28 #2)
- [x] P1: pre-push.js 1137→595줄 모듈 분리 — `pre-push-file-classifier.js` (경로 분류), `pre-push-test-classifier.js` (테스트 라우팅), `pre-push-guards.js` (guard 체크) 추출. 단위 테스트 55개 추가. `v8.10.3` 릴리즈, GitLab push + GitHub sync 완료

### Completed (2026-03-28 #1)
- [x] P1: v8.10.2 릴리즈 — commit-and-tag-version으로 마이그레이션 (standard-version deprecated 해소), CHANGELOG 업데이트, `git push gitlab --follow-tags` 완료
- [x] P3: pre-push hook TypeScript fallback soft-timeout 적용 — 변경 감지 실패 시 full type-check 무제한 실행 경로를 `type-check:changed` + 60초 soft-timeout으로 통일 (`scripts/hooks/pre-push.js`, `754beff03`)
- [x] P3: 로컬 CI / GitLab 배포 베스트 프랙티스 분석 완료 — 웹 검색 기반: 현행 구조(직접 실행 + GitHub Actions gate) 업계 권장 일치 확인. commit-and-tag-version 교체 실행. GitLab Push Mirror는 코드 필터링 정책 유지 목적으로 현행 `sync:github` 스크립트 방식 유지 결정
- [x] P2: GitHub 저장소 정리 완료 — releases 9개·tags 67개 전부 삭제, orphan reset으로 히스토리 1커밋으로 교체 (`2f3815075`), issues/wiki/projects 비활성화, repo description 업데이트, `sync:github` 재실행으로 code-only snapshot 최신화 (`f546ea7b3`)
- [x] P1: Dependabot 대체 self-hosted Renovate 기준선 추가 — hosted GitLab app offline 상태를 반영해 `renovate.json`, `config/renovate/docker-compose.yml`, `scripts/renovate/run-self-hosted.sh` 도입. GitLab native status gate 부재로 automerge는 보류

### Completed (2026-03-17)
- [x] P2: WONT-FIX 실측 재평가 (`QA-20260317-0114`) — Playwright MCP로 38개 wont-fix 항목 중 30개 Production Vercel 동작 확인 → completed 전환. 잔여 wont-fix 8개(코드/인프라 레벨 6개 + AI 실응답 필요 2개)

### Completed (2026-03-16)
- [x] P1: 보안 회귀팩 자동화 (`QA-20260316-0108`) — `scripts/test/security-smoke.mjs` 구현. Playwright 없이 API 직접 POST로 5패턴 자동 검증. `npm run test:security:smoke`로 실행. `security-attack-regression-pack` deferred 종결
- [x] P2: AI Code Gate Prompt Injection 5패턴 검증 (`QA-20260316-0107`) — EN 지시 무시, DAN/bypass, KO 지시 무시, 역할 변경+노출, 정상 쿼리 통과 모두 PASS. 차단 메시지 일관 동작 확인. `ai-code-gate-input-policy` deferred 기준(5패턴) 충족
- [x] P1: v8.9.1 릴리즈 정렬 완료 — `v8.9.1` 태그/GitHub Release 생성, Cloud Run `ai-engine-00251-8qt` 배포, Vercel `/api/version` + Cloud Run `/health` 모두 `8.9.1` 확인, Production QA `QA-20260316-0106` 8/8 PASS
- [x] P3: Next.js dev 로컬 QA 혼선 조사 종결 — Turbopack: nested route non-404 확인, 96s 콜드스타트 정상. webpack: 120s first-request timeout은 "Compiling proxy + target" 패턴으로 Next.js 고유 동작임, 우리 코드 버그 아님. 미사용 dev-only rewrites(`/test-tools/*`, `/dev/*`) 제거로 proxy 컴파일 경로 단순화. 진단 스크립트(`dev:readiness`, `dev:probe:webpack`, `dev:trace:turbopack`, `local:smoke`) 도구화 완료.

### Completed (2026-03-15)
- [x] P3: Cloud Run 대형 파일 리팩토링 Phase 3 완료 — `incident-report` route + `ai-proxy.config.ts` 책임 분리 마감
- [x] P3: `ai-proxy.config.ts` 분리 — env 파싱/Zod 검증을 `config-loader.ts`로 이동, 퍼사드는 캐시 singleton + accessor만 유지(325→146)
- [x] P3: `incident-report` route 분리 시작 — `route.ts`를 thin handler로 축소(349→48), Cloud Run proxy/cache/retry/response 조합은 `post-handler.ts`로 분리
- [x] P2: Cloud Run 실배포 검증 — `bash deploy.sh` 기본 경로 성공, Cloud Build `9cdc5c74-97ae-4752-b532-365f8c69fd7f`, revision `ai-engine-00249-tg7`, `/health` 200, `/monitoring` 403
- [x] P2: Cloud Run 배포 기본값 복원 — `deploy.sh`가 build-only Docker preflight를 기본 수행하도록 복원, full local `/health` 검사는 opt-in으로 유지
- [x] P2: Cloud Run `docker:preflight` 복구 — `npm prune --production` 정체 제거, `prod-deps` stage 도입, local build-only/full preflight + `/health` 확인
- [x] P3: Semantic Caching — exact miss 시 token-hash embedding 기반 유사 쿼리 캐시 fallback 추가, 저장 메타데이터/유사도 계산/단위 테스트 반영

### Test Coverage Gap (Closed)

2026-03-05 코드리뷰에서 식별된 우선 테스트 대상 5건은 모두 완료되어 `Completed (2026-03-07)`에 이관됨.

우선 테스트 대상:
1. `/api/health/route.ts` — 프로덕션 모니터링 핵심
2. `/api/servers-unified/route.ts` — 메인 데이터 엔드포인트 (494줄)
3. `/api/servers/[id]/route.ts` — 서버 상세 (397줄)
4. `src/services/code-interpreter/pyodide-service.ts` — 미테스트
5. `src/services/notifications/BrowserNotificationService.ts` — 미테스트

### Completed (2026-03-07)
- [x] P0: v8.8.0 릴리스 (29커밋) — Reporter 품질 개선, CSRF 보안, 테스트 93개 추가
- [x] P2: Cloud Run 배포 — v8.8.0 (faad6169f), 빌드 7분 13초, health check HTTP 200 통과
- [x] P1: Reporter 파이프라인 품질 개선 — 임계값 SSOT 버그 수정(memory 85→80, disk 90→80), 근접 경고, 트렌드 예측, 서버 타입별 CLI 명령어
- [x] P2: `/api/servers/[id]` 테스트 추가 (31 tests) — enhanced/legacy 포맷, history, 서버 검색, 404, 환경 매핑, 에러 핸들링
- [x] P2: Services 테스트 추가 — BrowserNotificationService (13), PyodideService (7), SystemInactivityService (12)
- [x] P2: Hooks 테스트 추가 — useDashboardStats (12), useServerDataCache (7), useResizable (11)

### Completed (2026-03-06)
- [x] P0: Provider quota-tracker 수치 교정 — Cerebras 24M→1M TPD, Groq 100K→500K TPD, Groq TPM 12K→6K, Gemini RPM 15→10
- [x] P0: Cerebras 8K context 방어 — 세션 히스토리 4메시지 제한 (buildContext)
- [x] P1: Reranker Groq 전환 — Cerebras 1M TPD 보존을 위해 reranker를 Groq으로 분리
- [x] P0: v8.7.9 릴리스 (43커밋)
- [x] P1: 보안 수정 — API key timing attack 방어 (length leak 제거), error message 내부 정보 노출 차단
- [x] P2: SSE 스트림 에러 핸들링 — 연결 끊김 시 unhandled rejection 방지
- [x] P2: Redis CB 초기화 race condition 수정 — promise 캐싱으로 중복 초기화 방지
- [x] P2: 코드리뷰 4라운드 (AI Engine resilience, Vercel frontend AI, Data SSOT, Cloud Run pipeline) — 44건 발견, 7건 수정
- [x] P2: Production QA 7/7 통과 (Playwright MCP, v8.7.8 → v8.7.9)

### Completed (2026-03-05)
- [x] P1: CI/CD 파이프라인 분석 및 개선
  - CodeQL SAST 워크플로우 추가 (`codeql-analysis.yml`, v4)
  - Hardcoded secrets 검사 hard-fail 전환 (`exit 1`)
  - `npm audit --audit-level=high` CI code-quality job에 추가
  - E2E 타임아웃 15분→20분 (Cloud Run cold start 대응)
  - keep-alive 환경변수 `NEXT_PUBLIC_SUPABASE_URL`로 통일
- [x] P1: `/api/version` 라우트 복원 — 삭제되어 E2E 연속 실패 원인이었음
- [x] P1: CodeQL 설정 수정 — 존재하지 않는 `Security.ql` pack 참조 제거
- [x] P3: GitLab 이전 가능성 분석 문서 작성 (`docs/reference/architecture/infrastructure/gitlab-migration-feasibility.md`)

### Completed (2026-02-22)
- [x] P1: 이메일 Magic Link 로그인 추가 — Supabase OTP 기반, 소셜 로그인과 병행
- [x] P1: 런타임 로그 레벨 API + AIDebugPanel UI 토글 — TTL 자동 리셋, Vercel + Cloud Run 양쪽
- [x] P1: GPL v3 라이선스 적용 — LICENSE 파일 + README 배지
- [x] P1: 게스트 PIN 브루트포스 방어 — 5회 실패 → 1분 잠금 (Redis + 메모리 폴백)
- [x] P2: Dead code 20+ 파일 삭제 — 미사용 스토어, 서비스, 테스트, 유틸리티 정리
- [x] P2: 게스트 정책 단순화 — CIDR IP 범위 차단 제거, 국가코드 기반으로 통일
- [x] P2: 로그인 버튼 순서 변경 — 소셜 → 이메일 → 게스트
- [x] P2: Storybook 스토리 추가 — 이메일 로그인, AIDebugPanel, stale mock 수정
- [x] P2: 랜딩 히어로 텍스트 및 Feature Card 메시징 개선
- [x] P3: Playwright 스크린샷 정리 — 778개/356MB → 6개/1.7MB
- [x] P0: v8.2.0 릴리즈 — 89커밋 포함

### Completed (2026-02-19)
- [x] P2: Production QA 전체 통과 — 대시보드, AI 사이드바, 서버 카드, 페이지네이션, Cold Start 검증
- [x] P2: AI Rate Limit dailyLimit 50→100 — QA 테스트 중 소진 확인, Cloud Run 용량 대비 6.7% 안전 마진
- [x] P0: `/debug/*` timing-safe 인증 — string 비교→`timingSafeEqual` (타이밍 공격 방지)
- [x] P1: 429 응답 JSON 파싱 방어 — `response.json()` try-catch 래핑 (non-JSON proxy 방어)
- [x] P1: rate-limiter 주석 불일치 수정 — 실제 값(10회/분, 100회/일)과 일치
- [x] P1: wake-up 엔드포인트 rate limiter 추가 — 무인증 남용 방지
- [x] P2: ColdStartErrorBanner error prop 변경 시 retry 상태 리셋
- [x] P2: useHybridAIQuery retry 카운트 표시를 실제 maxRetries로 통일
- [x] P2: useAsyncAIQuery JSDoc timeout 기본값 수정 (120000→15000)
- [x] P2: wake-up/route HTTP 204 스펙 준수 (body 제거)
- [x] P2: rate-limiter `x-vercel-forwarded-for` 우선 사용
- [x] P2: supervisor-routing `console.log`→`logger` 마이그레이션
- [x] P3: server.ts `verifyApiKey()` 헬퍼 추출 (DRY, 3중 복사→1)
- [x] P3: rate-limiter 미사용 interface 필드 제거
- [x] P3: useAsyncAIQuery `||`→`??`, type assertion 제거
- [x] P3: wake-up/route Retry-After 헤더 추가
- [x] P3: useHybridAIQuery dead `resumeEnabled` useState→const
- [x] P3: supervisor-routing/single-agent stale `@version` JSDoc 제거
- [x] P3: Storybook play function + argTypes 추가 (11 stories)

### Completed (2026-02-18)
- [x] P2: Cloud Run E2E 파이프라인 완성 — contract test에 supervisor/stream/v2 입력검증+인증 계약 추가 (LLM 0회), 리팩토링 계획서 3개 archive 이동
- [x] P2: 기능 책임 기반 실동작 재검증 수행 — Vercel HTTP 스모크(핵심 경로/상태코드), 로컬 `test:quick` 196 PASS 근거 확보
- [x] P2: Vercel 크리티컬 브라우저 검증 교차 실행 — 샌드박스 `SIGTRAP` 원인 분리, 비샌드박스 `25/25 PASS (2.8m)` 확인
- [x] P2: Vercel E2E 저부하 기본값 전환 — `playwright.config.vercel.ts`(desktop default, mobile opt-in, retries 축소), `test:vercel:*:mobile` 스크립트 분리
- [x] P2: AI 풀스크린 실동작 검증 — `ai-fullscreen.spec.ts` 9/9 PASS (1.8m)
- [x] P2: AI NLQ 단건 검증 — 실패 원인 분리 완료 (`Failed to create job: 429`, 코드 결함 아님)
- [x] P2: AI NLQ 안정성 완화 패치 — `/api/ai/jobs` 429 감지, `Retry-After` 상한(2~15s), rate-limit 텍스트 감지 강화
- [x] P2: Playwright 테스트 호환성 수정 — `ai-supervisor-timeout.spec.ts` beforeEach 인자 시그니처 교정 후 단건 PASS
- [x] P2: CI 워크플로우 최적화 — schedule→workflow_dispatch 전환, detect-scope 조건부 테스트
- [x] P3: Biome 스키마 2.4.2 업그레이드 + renderAIGradientWithAnimation 단순화
- [x] P3: vercel MCP API key 전달 방식 수정 (env→args, v0.0.7 호환)
- [x] P3: MCP 전체 동작 테스트 8/8 정상 확인
- [x] P3: 프로젝트 문서 v8.1.0 현행화 (WBS, DoD, SRS, completion-review, status.md)
- [x] P1: AI Engine 핵심 4모듈 테스트 추가 (prompt-guard 24 + supervisor-routing 31 + error-handler 14 + text-sanitizer 22 = 91 tests)
- [x] P2: RAG 임베딩 모듈 통합 (`embedding.ts` + `embedding-service.ts` → 단일 모듈, local fallback + 3h 캐시 + 통계)
- [x] P2: CI 파이프라인 강화 — smoke `continue-on-error` 제거(차단형), `cloud-run-unit` job 신설, 계약 테스트 CI 추가
- [x] P3: 문서 갱신 — completion-review 95.3%, wbs 95.4% 반영
- [x] P3: 문서 정합성 재검증 — WBS/Completion 수치 불일치(95.0/95.4, 94% 표기, 카운트 편차) 정리
- [x] P2: 표준 완료(Option 2) 실환경 검증 — 무료티어 가드레일 + Cloud Run 저비용 스모크 + Vercel 데스크탑/모바일 50개 크리티컬 + NLQ 단건 통과

### Completed (2026-02-17)
- [x] P2: ToolSet 캐스팅 근본 수정 — `allTools: ToolSet` 타입 명시, `filterToolsByWebSearch` 단순화, `as ToolSet` 0개
- [x] P3: 루트 `@ai-sdk/groq` 제거 (cloud-run/ai-engine에서만 사용)
- [x] P3: 리팩토링 잔류 빈 디렉토리 4개 삭제
- [x] P3: Docker 빌드 캐시(4.2G) + npm/pip/node-gyp 캐시 + Playwright 구버전 정리 (총 10.3G)

### Completed (2026-02-16)
- [x] P1: Full Stack 관점 최종 검수 완료 (`completion-review.md` 96.8%)
- [x] P2: Frontend E2E 테스트 추가 (`ai-fullscreen.spec.ts`, `dashboard-ai-sidebar.spec.ts`)
- [x] P2: API Integration 테스트 추가 (`ai-supervisor.integration.test.ts`)
- [x] P2: NLQ E2E 수동 테스트 추가 (`ai-nlq-vercel.manual.ts`)
- [x] P3: 성능/보안/평가 기준 수립 (Lighthouse, CSP, Promptfoo)
- [x] P3: WBS 최신화 (테스트 커버리지 반영, 실제 완성도 94.7% 달성)

### Completed (2026-02-15)
- [x] P1: Resume Stream v2 구현 — Upstash resumable, prepareReconnectToStreamRequest, stream-state 완성
- [x] P2: RAG 시스템 개선 — hybrid-text-search, reranker, query-expansion, tavily-hybrid-rag 구현
- [x] P1: OTel 데이터 품질 개선 — network 0-1 ratio 통일, 로그 시간 분산, OOM 시퀀스 수정
- [x] P1: Cloud Run 보안 강화 — timing-safe 비교, SHA-256 해싱, ring buffer, graceful shutdown
- [x] P2: Legacy 데이터 삭제 — `src/data/hourly-data/` + `src/data/otel-processed/` 전체 제거
- [x] P2: Vision Agent fallback 구현 — 빈 응답 방어 + min token guard (256)
- [x] P3: 계획서 정리 — plans/ 51→4개, tasks/ 184→0개, reports 5개 archive 이동
- [x] P3: package.json dangling scripts 수정 (data:sync/otel/all → data:fix/verify)
- [x] P3: feature-cards/tech-stacks 문서 OTel 반영

### Completed (2026-02-10)
- [x] P3: AI SDK `ai@6.0.77 → 6.0.78` 업그레이드 + `@ts-expect-error` 2건 제거
- [x] P3: Dead code 1,465줄 제거 (5 미사용 파일 삭제)
- [x] P2: 대형 파일 리팩토링 완료 (MetricsProvider 682→435, security 596→295, ProcessManager 794→766)
- [x] P2: AsyncLocalStorage 도입 (traceId 자동 전파, 15+ 수동 interpolation 제거)
- [x] P2: `ai-proxy.config.ts` 분할 (634 → 482줄, dead code 100줄 제거)
- [x] P2: `circuit-breaker.ts` 분할 (704 → 394줄, state-store + events 모듈 추출)
- [x] P2: `useHybridAIQuery.ts` 분할 (876 → ~540줄, sub-hooks 추출)
- [x] P2: W3C Trace Context (`traceparent`) end-to-end 전파
- [x] P0: Dev bypass auth 기본값 `true` → `false` (프로덕션 인증 우회 방지)
- [x] P1: Redis 자동 복구 타이머 추가 (60초 후 재연결)
- [x] P1: Cache key 정규화 통일 (`normalizeQueryForCache`)
- [x] P1: Redis KEYS → SCAN 변경 (Upstash O(N) 블로킹 방지)
- [x] P1: `proxyStreamToCloudRun` AbortController 추가 (55초 timeout)
- [x] P0: API 라우트 인증 취약점 해결 (3건)
- [x] P1: Job Queue, Stream timeout, Supervisor validation 버그 수정
- [x] P2: `console.*` → `logger` 마이그레이션 (프로덕션 잔존 0건)
- [x] P3: Retry setTimeout 취소 누락 수정 (메모리 누수 방지)
- [x] P2: `stepCountIs(5)` → 7 상향 (복잡 쿼리 대응)

### Completed (2026-02-08)
- [x] P2: Frontend QA — memo, useShallow, SSE validation
- [x] P3: UI QA — services data, mobile AI button, top5 truncation

### Completed (2026-01-26)
- [x] P1: useButtonType A11y 위반 해결 (142개 → 0개)
- [x] P2: README AI 섹션 업데이트 (AI SDK v6, 5-Agent)
- [x] P3: 레거시 계획서 아카이브 이동 (10개 → archive/)

### 활성 계획서 (Active Plans)

> 5개 완료 계획서 → `archive/` 이동 완료 (2026-02-15)

| 파일 | 상태 | 비고 |
|------|------|------|
| `wbs.md` | 운영 | 전체 진행률 ~95.4% (검수 95.3%), v8.1.0 현행화 완료 |

### Completed (2026-01-22)
- [x] 코드 단순화 리팩토링 (YAGNI 원칙 적용)
  - ReactFlowDiagram 모듈 분리 (996줄 → 15개 모듈)
  - AIErrorHandler 제거 (-421줄, 사용처 0곳)
  - ErrorHandlingService 제거 (-2,407줄, 사용처 0곳)
  - **총 ~2,800줄 dead code 제거**

### Completed (2026-01-10 오후)
- [x] 코드 품질 개선 Phase 1-3 완료
  - TODO 주석 정리 (3개 → 0개)
  - SystemChecklist.tsx 분할 (774줄 → 709줄)
  - supervisor/route.ts 분할 (746줄 → 476줄)
- [x] 계획서 검증 및 상태 업데이트
  - AI Engine 구현 100% 완료 확인
  - Langfuse v3.38.6 설치 확인
  - 스트리밍 구현 확인

### Completed (2026-01-10 오전)
- [x] P1: Console → Pino Logger 마이그레이션 (1,561개 → 116개, 92%)
- [x] P2: 대용량 파일 분리 (4개 800줄+ → 0개, 100%)
- [x] P3: any 타입 제거 (17개 → 0개, 100%)

### Completed (2026-01-07)
- [x] Agent SSOT 패턴 리팩토링 (agent-configs.ts 중앙화)
- [x] Langfuse 무료 티어 보호 시스템 구현 (10% 샘플링)
- [x] Cloud Run 무료 티어 최적화 (1 vCPU, 512Mi)
- [x] cloud-run-deploy Skill 추가 (토큰 65% 절감)
- [x] Provider 상태 캐싱 구현 (checkProviderStatus)

### Completed (2026-01-04)
- [x] AI Rate Limit 예측 전환 (Pre-emptive Fallback) 구현
- [x] Provider Quota Tracker 구현 (Vercel + Cloud Run)
- [x] Redis Distributed Circuit Breaker Store 구현
- [x] MCP 서버 전체 동작 검증 (9/9 정상)

### Completed (2025-12-28)
- [x] LangGraph → Vercel AI SDK 마이그레이션 (v5.92.0)
- [x] 멀티-에이전트 오케스트레이션 구현 (`@ai-sdk-tools/agents`)
- [x] AI Engine 아키텍처 문서 최신화

### Documentation Cleanup (2025-12-23)
- [x] 레거시 계획서 아카이브 이동
- [x] docs/development 구조 정리
- [x] 통합 TODO 생성 (`docs/development/ai/TODO.md`)
- [x] 중복 파일 정리

## Domain-Specific TODOs

| Domain | Location | Description |
|--------|----------|-------------|
| **AI Development** | `reports/planning/TODO.md` | Multi-Agent, Prompt Optimization 작업 큐 |
| **Analysis Reports** | `reports/planning/archive/` | 완료/참조용 분석 리포트 보관 |

## Low Priority (Backlog)

| Task | Priority | Status | Description |
|------|----------|--------|-------------|
| security-attack-regression-pack | P1 | Deferred | 보안 QA 체계 구축 (실운영형 공격 회귀팩) |

## Completed Archive

| Task | Date | Notes |
|------|------|-------|
| **LangGraph → Vercel AI SDK Migration** | **2025-12-28** | v5.92.0 - `@ai-sdk-tools/agents` 기반 멀티-에이전트 |
| AI Testing & Monitoring | 2025-12-23 | Unit/Integration Tests + Cache Monitor |
| AI Architecture Improvements | 2025-12-23 | 4 Tasks (Verifier/Cache/State/Context) |
| GraphRAG 하이브리드 검색 | 2025-12-18 | Vector + Text + Graph |
| Cloud Run 하이브리드 아키텍처 | 2025-12-16 | LangGraph Multi-Agent |
| Vercel LangGraph 제거 | 2025-12-17 | 번들 2MB 감소 |
| 문서 구조 개선 Phase 1-4 | 2025-12-19 | kebab-case 통일 |
| Code Interpreter | 2025-12-18 | Browser-based Python |
| 스크립트 통합 최적화 | 2025-12-14 | 72% 감소 |
| React 19/Next.js 16 업그레이드 | 2025-12-10 | - |

---

_Legacy planning docs archived in: `reports/planning/archive/2025-12/`_
