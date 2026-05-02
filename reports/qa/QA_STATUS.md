# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-05-02 17:22:33 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 389 |
| Total Runs (Counted) | 318 |
| Non-counted Runs | 71 |
| Total Checks | 2729 |
| Passed | 2631 |
| Failed | 89 |
| Completed Items | 402 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 20 |
| Expert Domains Tracked | 12 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260502-0391 (2026-05-02T08:22:31.207Z) |
| Latest Recorded Run | QA-20260502-0391 (2026-05-02T08:22:31.207Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260424-0340 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260502-0391 (2026-05-02T08:22:31.207Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | appropriate | no | - |
| Test Automation Architect | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Current billing period effective 0.6724 USD and billed 0.0000 USD after production QA. |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-01T08:22:31.207Z -> 2026-05-02T08:22:31.207Z (24h)
- Runs with observations: 1 recorded / 1 counted
- Samples: 2

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | mistral | 1 | 18797ms | 18797ms | - | - | 18797ms | 18797ms | QA-20260502-0389 |
| NLQ Agent | groq | 1 | 3595ms | 3595ms | - | - | 3595ms | 3595ms | QA-20260502-0389 |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: yes
- Counts Toward Summary: yes
- Deployment: dpl_2AckfwZgPbFHCLjf3uj5sXquVLKj / SHA 3b241447
- Coverage Packs: dashboard-core, ai-core, ai-advanced-surface
- Covered Surfaces: /api/version: production serves v8.11.82 with commit 3b241447a659a65adcd735896b1ed57e76c985c8, /: landing renders v8.11.82 badge, /system-boot -> /dashboard: system start flow reached dashboard, /dashboard: AI sidebar opens from production dashboard, AI sidebar keyword query: '추세 분석' called /api/ai/intelligent-monitoring and rendered Monitoring Analysis artifact card, Monitoring artifact card rendered analyzed server count, risk signal count, source metadata, MD download, JSON download, and fullscreen handoff action
- Skipped Surfaces: Incident report keyword recheck: covered by local intent tests and previous v8.11.81 production run, Abort/stop in-flight artifact: still covered by unit tests because production artifact responses complete quickly, Modal/detail pack: unchanged by keyword routing fix, Cloud Run admin observability /monitoring and /monitoring/traces: not part of Vercel artifact routing scope

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | GitLab v8.11.82 deploy pipeline | [GitLab v8.11.82 deploy pipeline](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2494833445) | - |
| vercel-deployment | Vercel production deployment v8.11.82 | [Vercel production deployment v8.11.82](https://openmanager-7wcxc65qj-skyasus-projects.vercel.app/) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-screenshot | Monitoring artifact keyword routing production verification | `reports/qa/evidence/qa-20260502-v81182-artifact-keyword-routing.png` | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Platform Constraint 1, Free Tier Tradeoff 3, Historical Obsolete 4, Portfolio Deferral 12

### Platform Constraint

_Accepted because the hosting platform or provider boundary constrains the behavior._

- [P1] ai-server-timing-header-production: Server-Timing header visibility in production (seen 2회, last QA-20260310-0081)
  - note: 플랫폼 제약으로 인한 비차단 항목: Vercel production에서는 Server-Timing 대신 X-AI-Latency-Ms를 운영 SSOT로 사용

### Free Tier Tradeoff

_Accepted to preserve the free-tier production shape instead of increasing deployed resources._

- [P2] ai-cold-start-latency: Cloud Run cold start 레이턴시 최적화 (seen 2회, last QA-20260327-0193)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] cloud-run-cold-start-latency: Cloud Run AI Chat 콜드스타트 대기시간 과도 (5회 재시도, ~5분) (seen 1회, last QA-20260310-0089)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (요청자 표시(isBlocking=true)로 즉시 개선 필요)
- [P2] streaming-ai-fallback-cold-start: Streaming AI fallback에서 Cloud Run 콜드스타트 시 프리셋 질문 실패 (seen 1회, last QA-20260310-0090)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (요청자 표시(isBlocking=true)로 즉시 개선 필요)

### Historical Obsolete

_Accepted because the item is historical, legacy, or superseded by current QA/CI gates._

- [P2] feature-dod-tsc-zero-error: tsc --noEmit 0 에러 (seen 9회, last QA-20260307-0053)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] feature-dod-unit-tests: 단위 테스트 158개 통과 (seen 9회, last QA-20260307-0053)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] vision-legacy-json-route-fallback: legacy JSON supervisor image path fallback 원인 확인 (seen 1회, last QA-20260421-0322)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] ai-provider-copy-policy-drift: Frontend AI provider and architecture copy must reflect current routing policy (seen 1회, last QA-20260404-0222)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

### Portfolio Deferral

_Accepted as non-blocking portfolio debt to avoid over-engineering._

- [P1] ai-thinking-visualizer-contract-drift: Thinking visualizer production UI contract drift (seen 2회, last QA-20260428-0357)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] landing-console-api-system-unauthorized: 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] landing-vibe-content-deployment-drift: Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] obs-fp-fn-weekly-report: 오탐/미탐 주간 리포트 자동 생성 (seen 3회, last QA-20260227-0013)
  - note: 포트폴리오 운영성 우선 규칙: 실운영 오탐/미탐 주간 자동 리포트는 데모/포트폴리오 범위 밖의 운영 프로세스 자동화이므로 WONT-FIX 유지
- [P2] ai-agent-type-metadata: AI Chat 에이전트 타입 메타데이터 표시 개선 (seen 1회, last QA-20260326-0190)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-metric-ranking-memory-path-metadata: Memory top-N query should expose deterministic metric-ranking path instead of filter fallback metadata (seen 1회, last QA-20260418-0304)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-sidebar-answer-details-default-visibility: AI sidebar should show actionable response details inline by default when analysis metadata exists (seen 1회, last QA-20260430-0374)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] analyst-drilldown: Analyst 서버별 드릴다운 (seen 1회, last QA-20260301-0030)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] analyst-trend-formatting-and-issue-ranking-polish: Analyst trend target formatting and issue ranking need polish (seen 1회, last QA-20260427-0352)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] landing-tech-stack-version-copy-drift: 기술 스택 모달 상세/아키텍처 간 버전 카피 정합성 정리 (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] mobile-header-density: Review dashboard mobile header density around AI CTA and profile cluster (seen 1회, last QA-20260418-0303)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] production-login-console-init-error: production login/assistant chunk init console error triage (seen 1회, last QA-20260421-0322)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

## Completed Improvements

- active-alerts-modal-ai-prefill: 활성 알림 모달에서 AI 사이드바 컨텍스트 자동 주입 (completed 1회, last QA-20260323-0166)
- admin-log-level-admin-auth: 관리자 로그레벨 API 관리자 권한 강제 (completed 1회, last QA-20260325-0183)
- ai-alert-status-advisory-response-drift: Alert-status advisory queries stay grounded and do not drift into unrelated metric rankings (completed 2회, last QA-20260430-0374)
- ai-analysis-main-response-empty-on-cerebras-quota: Prevent empty main AI analysis response when Cerebras queue or token quota fails (completed 1회, last QA-20260429-0370)
- ai-analysis-mode-route-selection-production: Production auto/thinking analysis mode route selection verified (completed 1회, last QA-20260428-0355)
- ai-analyst-success: Analyst Agent 이상감지/예측 성공 (completed 2회, last QA-20260314-0097)
- ai-answer-enumerated-requirements: AI 답변이 사용자가 요청한 항목 개수를 정확히 충족하도록 보강 (completed 1회, last QA-20260423-0339)
- ai-artifact-guidance-intent-guard-v81181: Artifact guidance requests should not trigger monitoring artifact execution (completed 1회, last QA-20260502-0390)
- ai-artifact-input-guard-v81181: AI sidebar send button disables when input is empty after artifact submission (completed 1회, last QA-20260502-0390)
- ai-artifact-keyword-routing-v81182: Short artifact keywords route to the intended artifact execution path (completed 1회, last QA-20260502-0391)
- ai-assistant-fullscreen-query-path: AI 전체 화면 핵심 서버 상태 요약 질의 검증 (completed 1회, last QA-20260318-0123)
- ai-assistant-fullscreen-tools-parity: AI 전체 화면 도구 메뉴 parity 검증 (completed 1회, last QA-20260318-0123)
- ai-assistant-guest-login-mcp-check-v81136-20260427: AI assistant works through Vercel Playwright MCP guest login on v8.11.36 (completed 1회, last QA-20260427-0351)
- ai-assistant-real-chat-e2e-v81136: AI assistant Playwright MCP real chat QA on Vercel v8.11.36 (completed 1회, last QA-20260427-0350)
- ai-assistant-ux-polish-p1-p2: AI Assistant typography scale, touch target, light surface, System Context status, and provider routing polish (completed 1회, last QA-20260429-0360)
- ai-assistant-vercel-production-core-pass: AI Assistant production browser smoke passes (completed 1회, last QA-20260428-0357)
- ai-cerebras-single-attempt-check: Cerebras Qwen executes once per UI question without fallback (completed 1회, last QA-20260430-0376)
- ai-chat-cloud-run-500: AI Chat Cloud Run 자유입력 응답 - 최종 성공 확인 (completed 1회, last QA-20260310-0089)
- ai-chat-cloud-run-rate-limit-production: Complex Cloud Run AI verification path should complete without rate-limit failure in production (completed 2회, last QA-20260408-0250)
- ai-chat-detail-expand: AI Chat 상세 분석 펼치기 (completed 1회, last QA-20260407-0248)
- ai-chat-empty-response: AI Chat 서버 상태 요약 질문에 빈 응답 반환 (completed 1회, last QA-20260315-0100)
- ai-chat-latency-regression-recheck-20260310: AI Chat latency regression claim rechecked on production (completed 1회, last QA-20260310-0071)
- ai-chat-multi-agent-blank-response-v81179: AI Chat multi-agent raw JSON path returns a visible natural-language response instead of an empty assistant bubble (completed 1회, last QA-20260502-0389)
- ai-chat-nlq-cpu-top3: NLQ CPU 상위3대 정확 (completed 1회, last QA-20260419-0306)
- ai-chat-pass: AI Chat 응답 품질 정상 (OTel 데이터 기반 분석) (completed 1회, last QA-20260326-0190)
- ai-chat-performance-v880: AI Chat 응답 시간 및 요약 품질 검증 (completed 3회, last QA-20260310-0082)
- ai-chat-quality-v880-quality-recheck: AI Chat 응답 품질 재검증 (completed 1회, last QA-20260308-0059)
- ai-chat-quality-v880-recheck: AI Chat 응답 품질 및 완료 시간 재검증 (completed 1회, last QA-20260308-0058)
- ai-chat-raw-tool-call-json-v81179: AI Chat raw function/tool-call JSON is suppressed and no longer rendered in production (completed 1회, last QA-20260502-0389)
- ai-chat-response: AI Chat 응답 (completed 1회, last QA-20260301-0035)
- ai-chat-response-process-details-production: Production assistant responses should expose detailed response-process fields when analysis basis is expanded (completed 1회, last QA-20260405-0242)
- ai-chat-response-process-metadata-production: Production AI responses should expose response-process metadata when analysis basis is shown (completed 1회, last QA-20260405-0242)
- ai-chat-response-quality: AI Chat 핵심요약+상세분석+구체적 권고 응답 (completed 1회, last QA-20260306-0051)
- ai-chat-response-quality-v879: AI Chat 스트리밍 응답 및 권고 검증 (completed 1회, last QA-20260306-0052)
- ai-chat-response-quality-v880-recheck-20260309: AI Chat 응답 품질 및 권고 재검증 (completed 4회, last QA-20260309-0068)
- ai-chat-sidebar-open: AI 사이드바 열기 (completed 1회, last QA-20260317-0114)
- ai-code-gate-input-policy: AI Code Gate: Prompt 패턴 15개 방어 점검 (completed 2회, last QA-20260318-0125)
- ai-dashboard-query-asof-slot-drift: AI sidebar job requests use the dashboard-visible OTel data slot (completed 1회, last QA-20260429-0372)
- ai-disk-threshold-answer-accuracy-drift: AI async job answer preserves DISK threshold and dashboard metric values (completed 2회, last QA-20260429-0368)
- ai-domain-boundary-phase2-analysis-mode: AI Domain Boundary Phase 2 analysis mode toggle (auto/thinking) (completed 1회, last QA-20260416-0297)
- ai-engine-status: AI 엔진 상태 표시 (completed 1회, last QA-20260317-0114)
- ai-explicit-server-summary-backfill: Explicit server action summary keeps named TOP2 servers and backfills partial tool payloads (completed 1회, last QA-20260430-0376)
- ai-fallback-done-usage-metadata: Delegated summarization fallback should report delegated provider token usage (completed 1회, last QA-20260429-0367)
- ai-friendly-template-todo-marker: Template TODO marker 분리 (TEMPLATE_TODO 적용) (completed 1회, last QA-20260226-0006)
- ai-hardening-production-verification: Verify production AI hardening release on v8.11.20 (completed 1회, last QA-20260418-0303)
- ai-incident-artifact-render-v81181: Incident report artifact renders from production AI sidebar (completed 1회, last QA-20260502-0390)
- ai-math-tools: AI 계산 도구(수식/통계/용량) 셋업 완료 (completed 1회, last QA-20260228-0023)
- ai-metric-ranking-answer-order: Ranking answers preserve descending order from tool output (completed 1회, last QA-20260418-0304)
- ai-metric-ranking-cpu-route: Current metric ranking query routes to deterministic metric lookup (completed 1회, last QA-20260418-0304)
- ai-provider-forced-routing-context-floor: Forced-routing quality agents skip 8K Cerebras fallback (completed 1회, last QA-20260428-0356)
- ai-provider-phase4-supervisor-routing-hints: Supervisor routing hints deployed (completed 1회, last QA-20260428-0356)
- ai-provider-queue-exceeded-retry-amplification: Cerebras queue_exceeded should not amplify retries before provider fallback (completed 1회, last QA-20260429-0366)
- ai-ranking-cpu-live-route: CPU highest-server query returns live top server on production (completed 1회, last QA-20260418-0305)
- ai-ranking-memory-live-route: Memory top-N ranking uses deterministic live metric path on production (completed 1회, last QA-20260418-0305)
- ai-recommendation-free-tier-fit: AI 운영 권고에서 리소스 업그레이드보다 조사/캐시/분산 조치를 우선 (completed 1회, last QA-20260423-0339)
- ai-reporter-success: Reporter Agent 보고서 생성 성공 (completed 3회, last QA-20260315-0104)
- ai-server-timing-hosting-path-diagnosed: Server-Timing production/local hosting path difference diagnosed (completed 1회, last QA-20260310-0081)
- ai-sidebar-open: AI 사이드바 열기/닫기 (completed 1회, last QA-20260317-0114)
- ai-sidebar-parity-contract-rendering: AI sidebar 상세 분석에 실제 parity metadata contract 노출 (completed 1회, last QA-20260323-0164)
- ai-sidebar-right-panel: AI 우측 패널 기능 메뉴 (completed 1회, last QA-20260317-0114)
- ai-sidebar-starters: AI 스타터 프롬프트 5개 (completed 1회, last QA-20260317-0114)
- ai-sidebar-toggle: AI 사이드바 AI Engine Ready (completed 2회, last QA-20260419-0306)
- ai-sidebar-tool-ux-release-smoke-v81135: AI sidebar tool/UX simplification v8.11.35 release smoke (completed 1회, last QA-20260427-0349)
- ai-sidebar-tools-menu: AI 도구 메뉴 (completed 1회, last QA-20260317-0114)
- ai-starter-summary-parity-guard: AI starter/direct dashboard count parity E2E guard (completed 1회, last QA-20260424-0344)
- ai-starter-summary-parity-guard-final-hardening: AI parity guard dynamic total and label-boundary hardening (completed 1회, last QA-20260424-0345)
- ai-stream-timing-x-headers-production: AI Chat streaming route exposes X-AI timing headers on production (completed 1회, last QA-20260310-0080)
- ai-summary-chat-streaming-path: AI summary chat query uses streaming path on production (completed 2회, last QA-20260310-0080)
- ai-summary-dashboard-parity-regression: AI assistant summary must match dashboard and OTel-derived system counts (completed 1회, last QA-20260404-0224)
- ai-summary-delta-guidance: AI 요약이 평균 대비 변화량과 구체적 권고를 표시 (completed 1회, last QA-20260322-0157)
- ai-summary-query-clarification-skip-production: Explicit all-server summary query skips clarification in production (completed 1회, last QA-20260310-0071)
- ai-timing-header-ssot-policy: QA timing header SSOT standardized to X-AI-Latency-Ms (completed 1회, last QA-20260310-0081)
- ai-timing-x-headers-production: AI proxy responses expose production timing headers (completed 1회, last QA-20260309-0070)
- ai-topology-duplicate-tool-invocation: Topology query duplicate searchKnowledgeBase invocation removed (completed 1회, last QA-20260415-0284)
- ai-topology-variant-function-call-failure: Advisor Agent latency/format quality stabilization (Task 1-3) (completed 2회, last QA-20260415-0283)
- ai-topology-variant-schema-validation-failure: searchKnowledgeBase boolean-string tool-call validation failure removed (completed 1회, last QA-20260413-0281)
- ai-workspace-analysis-basis-hydration-drift: Fullscreen AI workspace should preserve tool-grounded analysis basis metadata (completed 3회, last QA-20260416-0293)
- ai-workspace-dom-test-runner-hang: AIWorkspace DOM test runner hang 정리 (completed 1회, last QA-20260318-0124)
- ai-사이드바-열기닫기: AI 사이드바 열기/닫기 (completed 1회, last QA-20260317-0114)
- ai-사이드바-토글-ai-엔진-ready-프리셋-5개-ai-기능-3개: AI 사이드바 토글 (AI 엔진 Ready, 프리셋 5개, AI 기능 3개) (completed 3회, last QA-20260302-0042)
- alert-history-modal: 알림 이력 모달 (completed 1회, last QA-20260317-0114)
- alert-history-modal-ai-prefill: 알림 이력 모달에서 AI 사이드바 컨텍스트 자동 주입 (completed 1회, last QA-20260323-0167)
- analysis-basis-badge-fullscreen: 분석근거 배지 전체화면 parity (completed 1회, last QA-20260419-0306)
- analysis-basis-badge-label: AnalysisBasisBadge.tsx: collapsed 표시 '도구:' → '분석 단계:' Progressive Disclosure 개선 (completed 1회, last QA-20260408-0252)
- analysis-basis-badge-sidebar: 분석근거 배지 사이드바 정상 (completed 1회, last QA-20260419-0306)
- analysis-basis-badge-tab-ux: Analysis basis badge process/detail tabs render consistently in sidebar and fullscreen on production (completed 1회, last QA-20260419-0308)
- analysis-basis-badge-tab-ux-broad-v823: Production 8.11.23 broad QA confirms analysis basis tabs across sidebar and fullscreen surfaces (completed 1회, last QA-20260419-0309)
- analyst-agent-full-analysis: Analyst 18서버 분석 16정상 2주의 (completed 1회, last QA-20260419-0306)
- analyst-agent-pass: Analyst Agent 전체 분석 정상 (completed 1회, last QA-20260326-0190)
- analyst-full-analysis: Analyst 전체 분석 (completed 1회, last QA-20260317-0114)
- analyst-full-analysis-v879: Analyst 전체 분석 및 드릴다운 (completed 1회, last QA-20260306-0052)
- analyst-full-analysis-v880: Analyst 전체 분석 및 드릴다운 검증 (completed 2회, last QA-20260309-0069)
- analyst-full-analysis-v880-recheck-20260309: Analyst 전체 분석 경로 재검증 (completed 4회, last QA-20260309-0068)
- analyst-fullscreen-single-server-rag: Analyst 단일 서버 + RAG 분석 경로 검증 (completed 1회, last QA-20260318-0126)
- analyst-instruction-tool-name-exposure: analyst.ts: '분석 과정' 섹션 제거 및 도구명 응답 본문 노출 금지 (completed 1회, last QA-20260408-0252)
- analyst-nan-prediction-bug: Analyst 상승 추세 예측값 NaN% 표시 (completed 1회, last QA-20260419-0307)
- analyst-normal-server-empty-state: Analyst 정상 서버 드릴다운 empty-state 의도/재현 판정 (completed 1회, last QA-20260310-0086)
- analyst-quality-v880-quality-recheck: Analyst 전체 분석 및 드릴다운 품질 재검증 (completed 1회, last QA-20260308-0059)
- analyst-quality-v880-recheck: Analyst 전체 분석 및 드릴다운 재검증 (completed 1회, last QA-20260308-0058)
- analyst-sidebar-state-retention-chat-switch: Analyst 선택 서버와 결과가 sidebar chat 전환 후 유지 (completed 3회, last QA-20260320-0138)
- analyst-state-loss-on-chat-switch: Analyst 선택 서버와 결과가 chat 전환 후 유지 (completed 1회, last QA-20260319-0127)
- anomaly-detection-prediction: 이상감지/예측 15서버 전체 분석 (completed 1회, last QA-20260306-0051)
- api-인증-검증-401-확인: API 인증 검증 401 확인 (completed 1회, last QA-20260301-0032)
- approval-history-runtime-smoke: approvalStore pending/decision/history/stats runtime path verified (completed 1회, last QA-20260411-0270)
- auth-error-provider-copy: 인증 에러 라우트 메시지를 제공자-중립 표현으로 전환 (completed 1회, last QA-20260227-0010)
- auto-incident-report: 자동장애 보고서 생성 및 상세보기 (completed 1회, last QA-20260306-0051)
- biome-lint-900-files-에러-0: Biome Lint 900 files 에러 0 (completed 1회, last QA-20260301-0032)
- biome-optional-chain-4: Biome useOptionalChain 4건 수정 (completed 1회, last QA-20260329-0194)
- blocked-prompt-raw-json-exposure: 보안 차단 시 raw JSON 노출 제거 (completed 2회, last QA-20260318-0125)
- blocked-prompt-ux-fixed-v880: Prompt injection 차단 UX 정제 검증 (completed 1회, last QA-20260308-0058)
- blocked-prompt-ux-v880-quality-recheck: 보안 차단 UX 재검증 (completed 1회, last QA-20260308-0059)
- cerebras-qwen-preview-runtime-removed: Cerebras Qwen Preview removed from production runtime default (completed 1회, last QA-20260430-0385)
- cloud-run-cerebras-env-pinned: Cloud Run env pins CEREBRAS_MODEL_ID=llama3.1-8b (completed 1회, last QA-20260430-0385)
- cloud-run-latest-traffic-recovery: Cloud Run service traffic restored to latest revision (completed 1회, last QA-20260418-0305)
- cloud-run-proxy-runtime-env-refresh: Cloud Run proxy runtime env refresh (completed 1회, last QA-20260325-0185)
- cloud-run-readiness-guard: Cloud Run direct route readiness guard 공통화 (completed 1회, last QA-20260325-0184)
- cloud-run-v892-manual-deploy: Cloud Run v8.9.2 manual deploy verification (completed 1회, last QA-20260317-0118)
- cloud-tasks-dispatch-follow-up-hardening: Cloud Tasks dispatch header allowlist and createTask transient retry hardening (completed 1회, last QA-20260429-0359)
- cloud-tasks-fresh-browser-dispatch-sse: Fresh browser Cloud Tasks dispatch and SSE completion verified (completed 1회, last QA-20260429-0365)
- cloud-tasks-payload-byte-guard: Cloud Tasks dispatch payload byte guard and 413 response (completed 1회, last QA-20260429-0364)
- cloud-tasks-worker-target-https: Cloud Tasks worker target uses HTTPS in production (completed 1회, last QA-20260428-0358)
- coverage-suite-stabilize: vitest coverage suite 0 failed (6→0) 안정화 (completed 1회, last QA-20260329-0194)
- csrf-duplicate-removal: CSRF getCSRFTokenFromCookie 중복 제거 (completed 1회, last QA-20260307-0053)
- cve-brace-expansion: brace-expansion CVE GHSA-f886-m6hf-6m8v 패치 (completed 1회, last QA-20260329-0194)
- dashboard-15-servers: 대시보드 15대 서버 모니터링 정상 (completed 2회, last QA-20260314-0097)
- dashboard-active-alerts: 활성 알림 모달 (completed 1회, last QA-20260317-0114)
- dashboard-ai-direct-route-manual-sidebar-reopen: 직접 /dashboard/ai-assistant 진입 후 상단 AI 버튼으로 우측 사이드바 재오픈 유지 (completed 1회, last QA-20260430-0384)
- dashboard-ai-embedded-mobile-route: 모바일 /dashboard/ai-assistant를 사이드바 handoff가 아닌 대시보드 embedded 기능 페이지로 유지 (completed 1회, last QA-20260430-0383)
- dashboard-ai-fullscreen-embedded-page: AI 전체 화면을 별도 standalone 대신 dashboard embedded page로 통합 (completed 1회, last QA-20260430-0380)
- dashboard-ai-fullscreen-route-auto-close-reopen: AI 전체 페이지 진입 시 사이드바 자동 닫힘 및 상단 버튼 재오픈 (completed 2회, last QA-20260430-0384)
- dashboard-ai-left-nav-item-removal: 좌측 app shell navigation에서 AI 어시스턴트 항목 제거 (completed 1회, last QA-20260430-0380)
- dashboard-ai-left-nav-removal-production: AI 어시스턴트를 좌측 내비게이션에서 제거하고 상단 우측 CTA로 통합 (completed 1회, last QA-20260430-0383)
- dashboard-ai-page-sidebar-autoclose-reopen: AI 전체 페이지 진입 시 사이드바 자동 닫힘 및 상단 버튼 재열림 (completed 1회, last QA-20260430-0380)
- dashboard-ai-propagation-v81158: Dashboard OTel labels and mobile AI sidebar handoff deployed to production (completed 1회, last QA-20260429-0364)
- dashboard-ai-shell-diff-check: Patch whitespace check passes (completed 1회, last QA-20260430-0380)
- dashboard-ai-shell-lint-changed: Changed-file lint passes (completed 1회, last QA-20260430-0380)
- dashboard-ai-shell-targeted-vitest: Dashboard/AI shell targeted Vitest suites pass (completed 1회, last QA-20260430-0380)
- dashboard-ai-shell-type-check: Root TypeScript type-check passes (completed 1회, last QA-20260430-0380)
- dashboard-ai-sidebar-desktop-resize-after-wrapper-removal: AI 사이드바 래퍼 제거 후 데스크톱 resize 동작 유지 (completed 1회, last QA-20260430-0382)
- dashboard-ai-sidebar-left-rail-collapse: 우측 AI 사이드바가 열릴 때 좌측 navigation rail 축소 (completed 1회, last QA-20260430-0380)
- dashboard-ai-sidebar-resizable: AI 사이드바 사용자 resize 동작 검증 (completed 1회, last QA-20260430-0380)
- dashboard-ai-sidebar-resize-and-rail-collapse: AI 사이드바 오픈 시 좌측 rail 축소 및 데스크톱 사이드바 리사이즈 (completed 1회, last QA-20260430-0383)
- dashboard-client-lazy-shell-split: Split DashboardClient into auth wrapper and lazy interactive shell (completed 1회, last QA-20260420-0318)
- dashboard-content-lazy-server-section: Lazy load ServerDashboard from DashboardContent (completed 1회, last QA-20260420-0318)
- dashboard-dev-defer-heavy-subtree: Defer DashboardContent subtree during dev bootstrap (completed 1회, last QA-20260420-0317)
- dashboard-health-badge-warning-consistency: 고부하 카드가 Stable 대신 Warning으로 정렬됨 (completed 1회, last QA-20260322-0157)
- dashboard-health-v879: 프로덕션 대시보드 및 Health API 검증 (completed 1회, last QA-20260306-0052)
- dashboard-health-v880: 프로덕션 대시보드 및 Health API 검증 (completed 1회, last QA-20260308-0056)
- dashboard-health-v880-quality-recheck: 프로덕션 대시보드/Health API 품질 재검증 (completed 1회, last QA-20260308-0059)
- dashboard-health-v880-recheck: 프로덕션 대시보드 및 Health API 재검증 (completed 5회, last QA-20260309-0068)
- dashboard-log-alert-filter-wrapping: Dashboard log and alert filter/wrapping hardening (completed 1회, last QA-20260429-0362)
- dashboard-log-chunk-pagination: 로그 50개 청크 렌더링과 다음 페이지 로드 (completed 1회, last QA-20260501-0386)
- dashboard-log-pattern-grouping: 반복 로그 패턴 그룹핑 (completed 1회, last QA-20260501-0386)
- dashboard-log-stat-touch-target: 로그 통계 필터 클릭 타깃 보강 (completed 1회, last QA-20260501-0386)
- dashboard-log-url-server-filter: 로그 페이지 URL 기반 서버 필터 초기화 (completed 1회, last QA-20260501-0386)
- dashboard-mobile-ai-open-menu-trigger-hidden: 모바일 AI 사이드바 오픈 시 좌측 대시보드 메뉴 버튼 겹침 방지 (completed 1회, last QA-20260430-0382)
- dashboard-mobile-ai-sidebar-full-width-position: 모바일 AI 사이드바 이중 래퍼로 인한 우측 밀림 제거 (completed 1회, last QA-20260430-0382)
- dashboard-mobile-header-ai-cta-spacing: 모바일 헤더 로고와 AI CTA 겹침 방지 (completed 1회, last QA-20260430-0380)
- dashboard-mobile-header-overflow-fix: 모바일 대시보드 헤더 가로 overflow 및 버튼 겹침 해소 (completed 1회, last QA-20260430-0382)
- dashboard-modal-light-shells: Dashboard modal light-mode shell alignment (completed 1회, last QA-20260429-0362)
- dashboard-nav-anchor-reset-local-fix: Global anchor reset no longer overrides Tailwind text utility colors in production (completed 2회, last QA-20260430-0378)
- dashboard-nav-contrast-production: Vercel production dashboard left navigation text contrast regression (completed 1회, last QA-20260430-0378)
- dashboard-otel-static-labels: Dashboard OTel static data labels aligned with Vercel public 24h rotation (completed 1회, last QA-20260429-0362)
- dashboard-page-dev-server-data-import-split: Avoid server-data graph import on dashboard dev path (completed 1회, last QA-20260420-0317)
- dashboard-render: 대시보드 18서버 17온라인 1경고 (completed 1회, last QA-20260419-0306)
- dashboard-resources: 시스템 리소스 개요 (completed 1회, last QA-20260317-0114)
- dashboard-server-card-selector-stabilization: 서버 카드 선택자 및 빈 상태 처리 안정화 (completed 2회, last QA-20260302-0039)
- dashboard-server-cards: 대시보드 서버 카드 및 메트릭 (completed 2회, last QA-20260302-0038)
- dashboard-server-log-cross-link: 서버 카드 로그 바로가기 cross-link (completed 1회, last QA-20260501-0386)
- dashboard-status-filter: 상태 필터 토글 (completed 1회, last QA-20260317-0114)
- dashboard-topology-map: 토폴로지 맵 모달 (completed 1회, last QA-20260317-0114)
- dashboard-worker-console-error-on-ai-workspace-return: Dashboard logs Web Worker fallback error after returning from fullscreen AI workspace (completed 1회, last QA-20260423-0332)
- data-metrics-quality-slot-provenance: AI parity QA evidence includes dashboard snapshot slot/source metadata (completed 1회, last QA-20260424-0348)
- deploy-query-as-of-fix-to-production: Deploy query-as-of metric slot fix to Vercel production (completed 1회, last QA-20260429-0370)
- dev-runtime-css-split: Landing CSS and home route compile split (completed 1회, last QA-20260420-0315)
- dom-related-depscan-noise-suppression: Suppress benign zero-test DOM related dep-scan noise (completed 1회, last QA-20260325-0186)
- e2e-ai-chat-production-selector-alignment: AI Chat/Sidebar E2E selectors aligned with production DOM (completed 1회, last QA-20260310-0073)
- e2e-alerts-logs-label-drift: Alerts/logs Playwright expectations aligned with current production modal headings and labels (completed 1회, last QA-20260424-0342)
- e2e-dashboard-ready-networkidle-flake: Production dashboard navigation helper now waits for visible dashboard markers instead of hard-failing on networkidle (completed 1회, last QA-20260424-0342)
- e2e-guest-dashboard-fallback: Guest flow Playwright coverage now falls back to direct dashboard navigation in production and avoids landing-card selector drift (completed 1회, last QA-20260424-0342)
- e2e-testid-production-fix: E2E 테스트 data-testid 의존성 제거 (completed 1회, last QA-20260310-0076)
- esc-모달-닫기: ESC 모달 닫기 (completed 1회, last QA-20260317-0114)
- feature-card-modal: 피처카드 모달 (completed 1회, last QA-20260301-0035)
- feature-dod-e2e-critical: E2E 크리티컬 흐름 통과 (completed 1회, last QA-20260228-0029)
- feature-dod-lint-zero-error: lint 0 에러 (completed 5회, last QA-20260302-0044)
- feature-dod-login-copy-neutral: 로그인 정책 카피 중립성 지속성 (completed 1회, last QA-20260227-0017)
- feature-dod-login-policy-copy: 로그인 정책 카피 중립성 지속성 (completed 3회, last QA-20260227-0018)
- feature-dod-release-response-time-check: Feature/Release DoD: 핵심 응답시간 합격 (completed 1회, last QA-20260226-0005)
- feature-dod-security-review: Feature DoD: 보안 검토(입력 검증/인증/OWASP) (completed 1회, last QA-20260226-0006)
- feature-dod-system-start-guard: 비로그인 시스템 시작 가드 모달 동작 (completed 7회, last QA-20260227-0018)
- feature-dod-validation-health-endpoints: 헬스/버전 API 검사 (Vercel) (completed 2회, last QA-20260227-0018)
- feature-dod-vitals-integration: vitals:integration 통합 실행 통과 (completed 1회, last QA-20260228-0028)
- feedback-trace-links-exposed: Feedback API direct trace links exposed for operator follow-up (completed 1회, last QA-20260322-0156)
- feedback-trace-ui-link-runtime-availability: Feedback API direct trace UI link runtime availability (completed 1회, last QA-20260322-0159)
- fix-analysis-basis-sanitization: 분석 근거 패널 내부 구현 정보 노출 제거 (completed 1회, last QA-20260408-0253)
- fix-multi-agent-tool-result-bubble: 멀티 에이전트 경로 tool_result 이벤트 누락 수정 (completed 1회, last QA-20260408-0253)
- frontend-ai-data-parity-gate: 프론트엔드 표시 상태와 AI 분석 상태 동일 슬롯 참조 검증 (completed 2회, last QA-20260324-0178)
- frontend-landing-v880: Landing page v8.8.0 정상 렌더링 (completed 2회, last QA-20260314-0097)
- fullscreen-parity: 전체화면 전환 parity (completed 1회, last QA-20260419-0306)
- gitlab-tag-deploy-trace-v8113: GitLab tag deploy failure root cause analysis for v8.11.3 (completed 1회, last QA-20260408-0256)
- gitlab-tag-pipeline-v81119-release-blocked: Restore v8.11.19 semver tag deploy path before targeted production QA (completed 1회, last QA-20260417-0302)
- gitlab-tag-protected-variable-exposure-v8113: Fix GitLab protected variable exposure for semver tag deploy (completed 1회, last QA-20260409-0258)
- graphrag-traversal-keep-decision: Graph traversal keep/remove re-evaluation closed with KEEP decision (completed 1회, last QA-20260415-0285)
- guest-auth-proof-cookie: 게스트 PIN 로그인 후 auth_proof 쿠키 발급 정상 (completed 2회, last QA-20260314-0097)
- guest-dashboard-auth-check: 게스트 대시보드 로컬 인증 체크 우회 보완 (completed 1회, last QA-20260310-0078)
- guest-flow-server-card-and-startflow-resilience: 게스트 플로우 시스템 시작/AI 진입 내성 보강 (completed 3회, last QA-20260302-0039)
- guest-login-pin-4231: 게스트 PIN 4231 로그인 및 세션 진입 (completed 1회, last QA-20260306-0052)
- guest-login-visibility-toggle: 게스트 로그인 버튼 노출 옵션화 (completed 2회, last QA-20260227-0013)
- guest-pin-login-flow: 게스트 PIN 인증 후 시스템 시작 버튼 노출 (completed 4회, last QA-20260227-0018)
- health-ai-500-production-probe: /api/health?service=ai production probe returns JSON instead of HTML 500 (completed 1회, last QA-20260429-0359)
- health-all-connected: Health API 전체 서비스 connected (completed 2회, last QA-20260314-0097)
- health-api: /api/health DB/cache/ai connected (completed 2회, last QA-20260419-0306)
- health-api-200-healthy: Health API 200 healthy (completed 3회, last QA-20260320-0140)
- health-api-response-format: Health API 응답 포맷 검증 스크립트 수정 (completed 1회, last QA-20260310-0077)
- health-development-cache-disabled: /api/health respects development cache disabled runtime config (completed 1회, last QA-20260429-0364)
- health-route-envelope-test-alignment: Health route envelope/cache typing 정렬 (completed 1회, last QA-20260325-0184)
- health-route-supabase-session-timeout: 헬스체크 Supabase 세션 프로브 타임아웃 강제 (completed 1회, last QA-20260325-0183)
- home-semantic-nav: 홈 페이지 nav 랜드마크 보강 (completed 1회, last QA-20260226-0009)
- landing-bootstrap-auth-copy-hidden: 랜딩 첫 진입 bootstrap 인증 카피 숨김 (completed 1회, last QA-20260402-0206)
- landing-bootstrap-copy-hidden: 랜딩 첫 진입 시 bootstrap auth copy 비노출 처리 (completed 2회, last QA-20260408-0250)
- landing-copy-alignment: 랜딩/로그인 정책 카피 정합성 (completed 4회, last QA-20260227-0016)
- landing-feature-cards: 랜딩 피처카드 4개 모달 (completed 1회, last QA-20260317-0114)
- landing-page-render: 랜딩 페이지 정상 렌더링 v8.11.20 (completed 4회, last QA-20260419-0306)
- landing-production-improvements-deployed: 랜딩 페이지 개선 사항 production 반영 및 검증 완료 (completed 1회, last QA-20260330-0197)
- landing-profile-bootstrap-state: 랜딩 초기 프로필 상태 텍스트 일관성 개선 (completed 1회, last QA-20260317-0120)
- landing-profile-label-content-name-mismatch: Landing profile button accessible name now satisfies label-in-name audit (completed 1회, last QA-20260424-0341)
- landing-system-start: 시스템 시작 카운트다운 (completed 1회, last QA-20260317-0114)
- landing-vibe-qa-finish-surface: Vibe Coding 모달에 QA / Finish 뷰 추가 (completed 1회, last QA-20260330-0196)
- langfuse-feedback-trace-propagation: AI feedback traceId propagation to Langfuse (completed 1회, last QA-20260320-0142)
- langfuse-monitoring-runtime-visibility: Langfuse runtime visibility on /monitoring (completed 1회, last QA-20260317-0116)
- langfuse-monitoring-traces-search: Langfuse monitoring traces search and auxiliary filtering (completed 1회, last QA-20260317-0117)
- langfuse-monitoring-traces-timeout: Authenticated /monitoring/traces endpoint times out in production (completed 1회, last QA-20260317-0113)
- langfuse-multi-agent-traceid-live-proof: 멀티에이전트 sampled traceId 실운영 실측 (completed 1회, last QA-20260317-0116)
- langfuse-multi-agent-traceid-propagation: 멀티에이전트 stream done metadata traceId 전파 (completed 1회, last QA-20260317-0115)
- linux-label-normalization: 대시보드 카드 OS 표기를 Linux로 정규화 (completed 1회, last QA-20260322-0157)
- log-explorer-modal: 로그 탐색기 모달 (completed 1회, last QA-20260317-0114)
- login-copy-neutral: 로그인 정책 카피 중립성 개선 (completed 1회, last QA-20260227-0014)
- login-header-self-loop-cta: 로그인 페이지 헤더 self-loop CTA 제거 (completed 1회, last QA-20260401-0204)
- login-pin-form-structure: 게스트 PIN 입력 폼 구조 정리 (completed 1회, last QA-20260226-0001)
- math-tool-implementation-validation: AI 계산 툴 라우팅/실행 검증 (completed 1회, last QA-20260228-0027)
- metrics-drift-threshold-standard: 지표 드리프트 임계치 표준화 (completed 1회, last QA-20260302-0044)
- modal-backdrop-close: 모달 백드롭 클릭 닫기 안정화 (completed 2회, last QA-20260226-0002)
- modal-esc-close: ESC 모달 닫기 (completed 1회, last QA-20260317-0114)
- multi-agent-orchestration: 멀티에이전트 오케스트레이션 활성화 (Steps A-E) (completed 1회, last QA-20260307-0053)
- multi-agent-tool-result-bubble-up: orchestrator-agent-stream.ts: tool_result yield 누락으로 분석 근거 영역 비어있던 문제 수정 (completed 1회, last QA-20260408-0252)
- negative-feedback-trace-preserved: Negative feedback traceId preserved through feedback submission (completed 1회, last QA-20260322-0155)
- next-dev-allowed-origins-loopback-parity: 127.0.0.1 dev-origin parity for OAuth smoke (completed 1회, last QA-20260412-0273)
- off-domain-relative-date-grounding: Stop stale absolute dates in off-domain relative-date answers (completed 1회, last QA-20260421-0324)
- otel-데이터-무결성-24x15-완전: OTel 데이터 무결성 24x15 완전 (completed 1회, last QA-20260301-0032)
- performance-bundle-excellent: 번들 성능 우수 (completed 1회, last QA-20260314-0096)
- planning-backlog-clear: planning TODO 잔여 항목 정리 (completed 1회, last QA-20260226-0006)
- preview-dashboard-entry-20260313: Preview guest -> system start -> dashboard (completed 1회, last QA-20260313-0092)
- preview-guest-login-recovered-20260313: Preview guest login recovered after SESSION_SECRET sync (completed 1회, last QA-20260313-0092)
- preview-guest-session-secret-sync: SESSION_SECRET synced for guest session proof issuance (completed 1회, last QA-20260313-0092)
- preview-health-200-20260313: Preview /api/health 200 recovered (completed 1회, last QA-20260313-0092)
- preview-public-supabase-env-sync: Preview runtime env sync for NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY (completed 1회, last QA-20260313-0092)
- preview-recovery-dashboard-verification: Preview guest flow and dashboard recovery verified (completed 1회, last QA-20260313-0092)
- preview-stream-v2-smoke: Preview stream/v2 smoke verified after env recovery (completed 1회, last QA-20260313-0093)
- preview-stream-v2-smoke-20260313: Preview stream/v2 smoke returns 200 event-stream with X-AI-Latency-Ms (completed 1회, last QA-20260313-0093)
- prod-ai-sidebar-open-20260313: Production AI assistant sidebar opens with starter prompts (completed 1회, last QA-20260313-0094)
- prod-guest-flow-20260313: Production landing -> login -> guest PIN -> system start -> dashboard (completed 1회, last QA-20260313-0094)
- prod-health-200-20260313: Production /api/health 200 healthy after live deploy (completed 1회, last QA-20260313-0094)
- prod-security-block-api-contract-20260313: Production stream/v2 returns 400 security contract for blocked input (completed 1회, last QA-20260313-0095)
- prod-security-block-en-20260313: Production AI Chat blocks English prompt injection request (completed 1회, last QA-20260313-0095)
- prod-security-block-ko-20260313: Production AI Chat blocks Korean system prompt exposure request (completed 1회, last QA-20260313-0095)
- prod-security-block-no-raw-json-20260313: Blocked prompt UX hides raw JSON and security error internals (completed 1회, last QA-20260313-0095)
- prod-stream-v2-smoke-20260313: Production stream/v2 smoke returns 200 event-stream with cloud-run source (completed 1회, last QA-20260313-0094)
- production-console-init-cleanliness: Clear repeated production chunk init console error across core routes (completed 1회, last QA-20260421-0324)
- production-dashboard-render: 프로덕션 대시보드 렌더링 (completed 1회, last QA-20260317-0114)
- production-smoke-console-401-cleanliness: Production smoke console 401 resource noise 정리 (completed 3회, last QA-20260320-0140)
- profile-menu: 프로필 메뉴 접근성 이름에 visible user state 포함 (completed 2회, last QA-20260423-0339)
- prompt-injection-block-smoke-v880: Prompt injection 차단 스모크 검증 (completed 1회, last QA-20260308-0056)
- qa-0346-core-routes-proof-gap: QA-20260424-0346 core-routes-smoke evidence gap closed with follow-up route/API smoke (completed 1회, last QA-20260424-0347)
- qa-doc-roadmap-current-status-alignment: QA DoD 로드맵 현재 상태 정합성 갱신 (completed 1회, last QA-20260309-0067)
- qa-expert-domain-tracking: QA 런에서 전문가 영역 적합성 추적 체계 도입 (completed 1회, last QA-20260226-0003)
- qa-final-report-historical-positioning: v8.7.1 최종 QA 리포트의 historical 성격 명시 (completed 1회, last QA-20260309-0067)
- query-provider-devtools-hydration-fix: React Query Devtools hydration mismatch removal (completed 1회, last QA-20260420-0316)
- rag-engine-doc-link-repair: RAG, Vercel fair-use 문서 링크 경로 갱신 (completed 1회, last QA-20260228-0026)
- rag-smoke-coverage: Redis+Supabase RAG 경로 스모크 강화 (completed 2회, last QA-20260302-0039)
- readme-qa-evidence-sync-20260325: README QA evidence snapshot sync (completed 1회, last QA-20260325-0185)
- redis-circuit-health-schema-production: Cloud Run /health exposes redis circuit state as structured object (completed 1회, last QA-20260430-0375)
- release-dod-contract-test: Release DoD: API contract test 통과 (completed 1회, last QA-20260226-0008)
- release-dod-cost-gate: Release DoD: Cloud Run Free Tier 비용 가드 검증 (completed 1회, last QA-20260226-0008)
- release-dod-doc-gate: Release DoD: 문서 게이트 90일 갱신·메타데이터·아카이빙 정책 (completed 1회, last QA-20260228-0025)
- release-dod-test-gate: validate:all 0 에러 (completed 2회, last QA-20260302-0036)
- reporter-agent-generate: Reporter Agent 보고서 생성 신뢰도 80% (completed 1회, last QA-20260419-0306)
- reporter-agent-pass: Reporter Agent 보고서 즉시 생성 정상 (completed 1회, last QA-20260326-0190)
- reporter-analyst-production-mcp-functional-check-v81136: Reporter and Analyst production MCP functional check on v8.11.36 (completed 1회, last QA-20260427-0352)
- reporter-empty-cta-generate-v880: Reporter 빈 상태 CTA 생성 경로 검증 (completed 1회, last QA-20260308-0058)
- reporter-empty-cta-generate-v880-quality-recheck: Reporter 빈 상태 CTA 생성 경로 재검증 (completed 1회, last QA-20260308-0059)
- reporter-empty-cta-generate-v880-recheck-20260309: Reporter empty state CTA 생성 경로 재검증 (completed 4회, last QA-20260309-0068)
- reporter-fullscreen-generate-path: Reporter 전체 화면 생성 경로 검증 (completed 1회, last QA-20260318-0126)
- reporter-generate: Reporter 보고서 생성 (completed 1회, last QA-20260317-0114)
- reporter-generate-detail-v879: Reporter 보고서 생성 및 상세보기 (completed 1회, last QA-20260306-0052)
- reporter-generate-detail-v880: Reporter 생성 및 상세 렌더링 검증 (completed 2회, last QA-20260309-0069)
- reporter-primary-generate-button-empty-state: Reporter 상단 생성 버튼 empty state 동작 정합성 (completed 2회, last QA-20260315-0104)
- reporter-sidebar-state-retention-chat-switch: Reporter 생성 결과가 sidebar chat 전환 후 유지 (completed 3회, last QA-20260320-0138)
- reporter-state-loss-on-tab-switch: Reporter 탭 전환 시 생성 결과 상태 유지 (completed 1회, last QA-20260315-0104)
- reporter-state-retention-chat-switch: Reporter 생성 결과가 chat 전환 후 유지 (completed 1회, last QA-20260318-0126)
- root-auth-session-lazy-imports: Defer auth/session/store heavy imports on the root path (completed 2회, last QA-20260422-0329)
- root-client-provider-prune: Remove unused root AccessibilityProvider wrapper (completed 1회, last QA-20260422-0326)
- root-client-runtime-split: Non-critical root client runtime modules split behind dynamic wrapper (completed 1회, last QA-20260419-0314)
- root-dev-instrumentation-noop: Skip dev env import in instrumentation register() (completed 1회, last QA-20260422-0326)
- root-global-effects-prune: Trim root global-effects.css and inline unused design-system helpers (completed 1회, last QA-20260422-0327)
- root-layout-font-preload-cleanup: Suppress repeated root font preload warnings on dashboard and fullscreen AI routes (completed 1회, last QA-20260417-0300)
- root-shell-startup-trace: Limit Tailwind source scanning to actual app code (completed 1회, last QA-20260422-0329)
- security-attack-regression-pack: 보안 공격 시나리오 회귀팩 구축 (completed 4회, last QA-20260320-0138)
- security-audit-logs-live-path-smoke: guest login route writes security_audit_logs on success (completed 1회, last QA-20260411-0271)
- security-headers-coop: COOP 헤더 추가 (Cross-Origin-Opener-Policy: same-origin-allow-popups) (completed 1회, last QA-20260329-0194)
- security-headers-misleading-remove: 수동 X-Vercel-Cache/X-Edge-Runtime 헤더 제거 (completed 1회, last QA-20260329-0194)
- security-headers-permissions-policy: deprecated interest-cohort=() Permissions-Policy 제거 (completed 1회, last QA-20260329-0194)
- sentry-error-boundary-tag-fix: error.tsx boundary 태그 수정 (global-error → root) (completed 1회, last QA-20260329-0194)
- sentry-global-error-boundary: global-error.tsx Sentry 에러 경계 연동 추가 (completed 1회, last QA-20260329-0194)
- server-card-badge-ai-prefill: 서버 카드 경고 배지 클릭 시 AI 사이드바 컨텍스트 자동 주입 (completed 1회, last QA-20260323-0165)
- server-card-expand: 서버 카드 상세 펼치기/접기 (completed 1회, last QA-20260317-0114)
- server-detail-log-tab: 로그 & 네트워크 탭 (completed 1회, last QA-20260317-0114)
- server-detail-perf-tab: 성능 분석 탭 (completed 1회, last QA-20260317-0114)
- server-modal-3tab-switch: 서버 모달 3탭 전환 (completed 1회, last QA-20260317-0114)
- show-more-servers: 12개 더 보기 버튼 (completed 1회, last QA-20260317-0114)
- storybook-build-dev-smoke-pass: storybook build 및 dev smoke-test 통과 (completed 1회, last QA-20260315-0099)
- storybook-build-longrun-success: Storybook build 장시간 실행 성공 확인 (completed 1회, last QA-20260315-0102)
- storybook-lock-sync-10-2-10: Storybook lockfile 버전 동기화 (completed 1회, last QA-20260315-0102)
- storybook-next-module-shims: next/navigation/link/image/dynamic 등 Storybook shim 추가 (completed 1회, last QA-20260315-0099)
- storybook-react-vite-migration: Storybook Next.js preset 제거 및 react-vite 전환 (completed 1회, last QA-20260315-0099)
- storybook-sb-mock-fix: sb.mock()을 preview.ts로 이동하여 Storybook v10 호환성 수정 (completed 1회, last QA-20260302-0043)
- storybook-smoke-script-stable-port: Storybook smoke 테스트 스크립트 안정화 (completed 1회, last QA-20260315-0102)
- streaming-analysis-basis-data-source-promotion: 스트리밍 AI 응답의 데이터 소스 라벨을 실시간 데이터 분석으로 승격 (completed 1회, last QA-20260324-0175)
- streaming-parity-type-build-fix: Streaming parity deferred metadata type mismatch fix builds on production (completed 1회, last QA-20260324-0174)
- supervisor-stream-contract-alignment: Supervisor stream sessionId/deviceType 계약 정렬 (completed 1회, last QA-20260325-0184)
- system-boot-api-checks: 시스템 부트 API 존재성/헬스 체크 (completed 2회, last QA-20260302-0039)
- system-boot-redirect: 시스템 시작 대시보드 리다이렉트 (completed 1회, last QA-20260301-0035)
- system-boot-sequence: 시스템 부트 시퀀스 완료 (completed 1회, last QA-20260419-0306)
- system-boot-vercel-auth-expectation-alignment: Production system-boot Playwright auth 기대값 정렬 (completed 1회, last QA-20260320-0138)
- system-start-auth-modal-guard-stability: 시스템 시작 로그인 모달 노출 경로 검증 보강 (completed 2회, last QA-20260302-0038)
- system-start-login-modal: 비로그인 상태에서 시스템 시작 클릭 시 로그인 모달 노출 (completed 1회, last QA-20260227-0021)
- system-start-login-modal-redirect: 로그인 모달에서 로그인 페이지로 이동 (completed 1회, last QA-20260227-0022)
- system-start-metrics-gate: 시스템 시작 KPI 계측 (completed 2회, last QA-20260302-0038)
- top5-server-detail: Top5 서버 상세 모달 (3탭) (completed 1회, last QA-20260317-0114)
- topology-map-render: 토폴로지 맵 완벽 렌더링 (completed 2회, last QA-20260314-0097)
- typescript-무결성: TypeScript 무결성 (completed 1회, last QA-20260301-0032)
- ui-esc-close: ESC 사이드바 닫기 (completed 1회, last QA-20260317-0114)
- ui-landing-pass: 랜딩 페이지 로드 정상, v8.10.0 확인 (completed 1회, last QA-20260326-0190)
- validation-evidence-summary-clarity: Validation evidence summary 카피와 정보 우선순위 정리 (completed 1회, last QA-20260324-0171)
- validation-public-snapshot-artifact: Validation evidence public snapshot artifact 분리 (completed 1회, last QA-20260323-0168)
- validation-stale-banner-client-side-fix: Validation stale banner client-side age check fix (completed 1회, last QA-20260324-0170)
- vercel-build-fix: SessionState import 수정으로 Vercel 빌드 복구 (completed 1회, last QA-20260307-0053)
- vercel-deployment-ready: Vercel 배포 3건 모두 READY (completed 1회, last QA-20260314-0096)
- vercel-prod-ai-clarification: AI 질의 모호성 해소 UI 정상 렌더링 및 Fallback 응답 확인 (completed 1회, last QA-20260317-0114)
- vercel-prod-ai-guest-flow-v892: Vercel 프로덕션 게스트 부팅 + 대시보드 + AI 응답 + 피드백 경로 실측 (completed 1회, last QA-20260317-0119)
- vercel-prod-ai-sidebar: 대시보드 AI 어시스턴트 사이드바 열기/닫기 정상 (completed 1회, last QA-20260317-0114)
- vercel-prod-frontend-boot: Vercel 프로덕션 시스템 시작 부팅 플로우 정상 동작 (completed 1회, last QA-20260317-0114)
- vercel-usage-cli-empty-billing-period-handling: Vercel usage CLI empty billing period handling (completed 1회, last QA-20260402-0211)
- vibe-cicd-modal-local-dev-stale-view: 로컬 dev Vibe Coding 모달 stale view 해소 (completed 1회, last QA-20260331-0202)
- vibe-hybrid-delivery-wording: Vibe Coding 모달의 배포 설명을 하이브리드 전달 구조 기준으로 정정 (completed 1회, last QA-20260330-0200)
- vibe-qa-modal-replaced-with-cicd: Vibe Coding 모달의 QA 탭을 CI/CD 구조 설명으로 교체 (completed 1회, last QA-20260330-0200)
- vision-production-latency-sample-refresh: Vision 최신 production latency 표본 보강 (completed 1회, last QA-20260421-0322)
- vitals-log-suppression: Web Vitals 통합 테스트 로그 억제 옵션 추가 (completed 1회, last QA-20260228-0028)
- 게스트-pin-로그인-후-시스템-시작-버튼-노출: 게스트 PIN 로그인 후 시스템 시작 버튼 노출 (completed 1회, last QA-20260227-0010)
- 계약-테스트-20-tests-pass: 계약 테스트 20 tests PASS (completed 1회, last QA-20260301-0032)
- 단위-테스트-123-files-1698-tests-pass: 단위 테스트 123 files 1698 tests PASS (completed 1회, last QA-20260301-0032)
- 대시보드-15서버-렌더링-13-온라인-1-경고-1-위험: 대시보드 15서버 렌더링 (13 온라인, 1 경고, 1 위험) (completed 1회, last QA-20260302-0042)
- 대시보드-15서버-렌더링-13-온라인-2-경고: 대시보드 15서버 렌더링 (13 온라인, 2 경고) (completed 1회, last QA-20260302-0040)
- 대시보드-15서버-렌더링-14-온라인-1-경고: 대시보드 15서버 렌더링 (14 온라인, 1 경고) (completed 1회, last QA-20260302-0041)
- 랜딩-페이지-v8.7.2-로드-및-게스트-자동-로그인-정상: 랜딩 페이지 v8.7.2 로드 및 게스트 자동 로그인 정상 (completed 2회, last QA-20260302-0041)
- 랜딩-페이지-v8.7.3-로드-및-게스트-자동-로그인-정상: 랜딩 페이지 v8.7.3 로드 및 게스트 자동 로그인 정상 (completed 1회, last QA-20260302-0042)
- 로그인-정책-카피-정합성: 로그인 정책 카피 정합성 (completed 1회, last QA-20260227-0010)
- 리소스-경고-top-5-api-was-dc1-01-cpu-91-1위: 리소스 경고 Top 5 (api-was-dc1-01 CPU 91% 1위) (completed 1회, last QA-20260302-0042)
- 리소스-경고-top-5-db-mysql-dc1-primary-disk-82-1위: 리소스 경고 Top 5 (db-mysql-dc1-primary DISK 82% 1위) (completed 1회, last QA-20260302-0041)
- 리소스-경고-top-5-db-mysql-dc1-primary-mem-89-1위: 리소스 경고 Top 5 (db-mysql-dc1-primary MEM 89% 1위) (completed 1회, last QA-20260302-0040)
- 모달-esc-닫기-정상-동작: 모달 ESC 닫기 정상 동작 (completed 3회, last QA-20260302-0042)
- 문서-인프라-점검-완료: 문서 인프라 점검 완료 (completed 1회, last QA-20260301-0032)
- 보안-테스트-62-tests-pass: 보안 테스트 62 tests PASS (completed 1회, last QA-20260301-0032)
- 보안-헤더-production-확인: 보안 헤더 Production 확인 (completed 1회, last QA-20260301-0032)
- 비로그인-시스템-시작-가드-모달-동작: 비로그인 시스템 시작 가드 모달 동작 (completed 1회, last QA-20260227-0010)
- 비로그인-시스템-시작-버튼-노출-유지: 비로그인 사용자 시스템 시작 버튼 노출 유지 (completed 2회, last QA-20260227-0020)
- 비로그인-시스템-시작-클릭-로그인-모달: 비로그인 사용자 시스템 시작 클릭 시 로그인 모달 경유 (completed 2회, last QA-20260227-0020)
- 상태-필터-온라인-13경고-1위험-1오프라인-0: 상태 필터 (온라인 13/경고 1/위험 1/오프라인 0) (completed 1회, last QA-20260302-0042)
- 상태-필터-온라인-13경고-2위험-0오프라인-0: 상태 필터 (온라인 13/경고 2/위험 0/오프라인 0) (completed 1회, last QA-20260302-0040)
- 상태-필터-온라인-14경고-1위험-0오프라인-0: 상태 필터 (온라인 14/경고 1/위험 0/오프라인 0) (completed 1회, last QA-20260302-0041)
- 서버-모달-3탭-전환: 서버 모달 3탭 전환 (completed 1회, last QA-20260317-0114)
- 서버-모달-로그-네트워크-탭-syslogalertsstreams-네트워크-상태: 서버 모달 로그 & 네트워크 탭 (Syslog/Alerts/Streams, 네트워크 상태) (completed 1회, last QA-20260302-0040)
- 서버-모달-로그-네트워크-탭-syslogalertsstreams-필터-네트워크-양호-1gbps-연결-정보: 서버 모달 로그 & 네트워크 탭 (Syslog/Alerts/Streams 필터, 네트워크 양호 1Gbps, 연결 정보) (completed 2회, last QA-20260302-0042)
- 서버-모달-성능-분석-탭-cpumemorydisknetwork-실시간-차트-서비스-mysql3306-exporter9104: 서버 모달 성능 분석 탭 (CPU/Memory/Disk/Network 실시간 차트, 서비스 MySQL:3306 + Exporter:9104) (completed 1회, last QA-20260302-0041)
- 서버-모달-성능-분석-탭-cpumemorydisknetwork-실시간-차트-서비스-node.js3000-pm29615: 서버 모달 성능 분석 탭 (CPU/Memory/Disk/Network 실시간 차트, 서비스 Node.js:3000 + PM2:9615) (completed 1회, last QA-20260302-0042)
- 서버-모달-성능-분석-탭-실시간-차트-분석-뷰-이상탐지: 서버 모달 성능 분석 탭 (실시간 차트 + 분석 뷰 + 이상탐지) (completed 1회, last QA-20260302-0040)
- 서버-모달-종합-상황-탭-cpu-68-memory-78-disk-82-주의-mysqlexporter-정상: 서버 모달 종합 상황 탭 (CPU 68%, Memory 78%, Disk 82% 주의, MySQL/Exporter 정상) (completed 1회, last QA-20260302-0041)
- 서버-모달-종합-상황-탭-cpu-91-위험-memory-86-주의-disk-34-정상-서비스-22-정상: 서버 모달 종합 상황 탭 (CPU 91% 위험, Memory 86% 주의, Disk 34% 정상, 서비스 2/2 정상) (completed 1회, last QA-20260302-0042)
- 서버-모달-종합-상황-탭-cpumemorydisk서비스시스템정보: 서버 모달 종합 상황 탭 (CPU/Memory/Disk/서비스/시스템정보) (completed 1회, last QA-20260302-0040)
- 세션-타이머-정상-카운트다운: 세션 타이머 정상 카운트다운 (completed 1회, last QA-20260302-0040)
- 세션-타이머-정상-카운트다운-28분: 세션 타이머 정상 카운트다운 (28분) (completed 1회, last QA-20260302-0042)
- 세션-타이머-정상-카운트다운-29분: 세션 타이머 정상 카운트다운 (29분) (completed 1회, last QA-20260302-0041)
- 시스템-리소스-요약-cpu-36-memory-47-disk-34: 시스템 리소스 요약 (CPU 36%, Memory 47%, Disk 34%) (completed 1회, last QA-20260302-0041)
- 시스템-리소스-요약-cpu-37-memory-46-disk-36: 시스템 리소스 요약 (CPU 37%, Memory 46%, Disk 36%) (completed 1회, last QA-20260302-0040)
- 시스템-리소스-요약-cpu-40-memory-49-disk-32: 시스템 리소스 요약 (CPU 40%, Memory 49%, Disk 32%) (completed 1회, last QA-20260302-0042)
- 시스템-시작-system-boot-대시보드-리다이렉트-정상: 시스템 시작 → system-boot → 대시보드 리다이렉트 정상 (completed 2회, last QA-20260302-0042)
- 시스템-시작-대시보드-리다이렉트-정상: 시스템 시작 → 대시보드 리다이렉트 정상 (completed 1회, last QA-20260302-0041)
- 코드-품질-리뷰-5-핵심파일: 코드 품질 리뷰 5 핵심파일 (completed 1회, last QA-20260301-0032)
- 통합-검증-validateall-통과: 통합 검증 validate:all 통과 (completed 1회, last QA-20260301-0032)
- 패턴-위반-검사-any-0-todo-0: 패턴 위반 검사 any 0 TODO 0 (completed 1회, last QA-20260301-0032)
- 프로덕션-대시보드-렌더링: 프로덕션 대시보드 렌더링 (completed 1회, last QA-20260317-0114)
- 프로덕션-빌드-46-pages-성공: 프로덕션 빌드 46 pages 성공 (completed 1회, last QA-20260301-0032)
- 프로필-메뉴-게스트-사용자-게스트-모드-표시: 프로필 메뉴 (게스트 사용자, 게스트 모드 표시) (completed 3회, last QA-20260302-0042)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| QA-20260502-0391 | 2026-05-02T08:22:31.207Z | targeted | yes | yes | Vercel Production Targeted QA - Artifact Keyword Routing v8.11.82 | 6 | 1 | 0 | 0 | 0 | 0 |
| QA-20260502-0390 | 2026-05-02T07:43:11.883Z | targeted | yes | yes | Vercel Production Targeted QA - Artifact Guardrails v8.11.81 | 9 | 3 | 0 | 0 | 0 | 0 |
| QA-20260502-0389 | 2026-05-01T18:36:18.241Z | targeted | no | yes | Vercel Production AI Chat Recent Change Playwright QA v8.11.79 | 12 | 2 | 0 | 0 | 0 | 0 |
| QA-20260501-0388 | 2026-05-01T09:03:46.030Z | targeted | no | yes | Dashboard Playwright MCP Detailed Interaction QA | 12 | 0 | 0 | 0 | 0 | 0 |
| QA-20260501-0387 | 2026-05-01T08:52:56.763Z | smoke | yes | yes | v8.11.77 GitLab Release Smoke | 4 | 0 | 0 | 0 | 0 | 0 |
| QA-20260501-0386 | 2026-04-30T22:58:38.750Z | targeted | no | yes | Dashboard server/log UX Phase 3 local Playwright QA | 16 | 5 | 0 | 0 | 0 | 0 |
| QA-20260430-0385 | 2026-04-30T14:18:18.454Z | targeted | yes | yes | Vercel/Cloud Run Production QA v8.11.76 - Cerebras llama runtime | 7 | 2 | 0 | 0 | 0 | 0 |
| QA-20260430-0384 | 2026-04-30T13:00:04.697Z | targeted | yes | yes | Vercel Production QA v8.11.75 - Direct AI page sidebar reopen | 12 | 2 | 0 | 0 | 0 | 0 |
| QA-20260430-0383 | 2026-04-30T12:02:34.893Z | targeted | yes | yes | Vercel Production QA v8.11.74 - Dashboard AI app shell | 21 | 4 | 0 | 0 | 0 | 0 |
| QA-20260430-0382 | 2026-04-30T10:20:01.475Z | targeted | no | yes | Dashboard mobile overlap and AI sidebar local QA | 11 | 4 | 0 | 0 | 0 | 0 |
| QA-20260430-0381 | 2026-04-30T09:32:32.544Z | targeted | no | no | Dashboard AI app-shell local Playwright rerun | 14 | 0 | 0 | 0 | 0 | 0 |
| QA-20260430-0380 | 2026-04-30T09:14:16.317Z | targeted | no | yes | Dashboard AI app-shell navigation targeted QA | 14 | 10 | 0 | 0 | 0 | 0 |
| QA-20260430-0379 | 2026-04-30T06:12:50.431Z | broad | yes | yes | Vercel Production QA v8.11.70 - Dashboard + AI 3-Feature + Cerebras Check | 6 | 0 | 0 | 0 | 0 | 0 |
| QA-20260430-0378 | 2026-04-30T05:30:46.057Z | targeted | yes | yes | Vercel Playwright QA - v8.11.70 Dashboard Navigation Contrast Recheck | 8 | 2 | 0 | 0 | 0 | 0 |
| QA-20260430-0377 | 2026-04-30T05:14:43.053Z | targeted | yes | yes | Vercel Playwright QA - v8.11.69 Dashboard Navigation Contrast | 15 | 1 | 1 | 0 | 0 | 2 |
| QA-20260430-0376 | 2026-04-29T20:55:55.746Z | targeted | yes | yes | Vercel Playwright QA - v8.11.68 Explicit Server Summary | 6 | 2 | 0 | 0 | 0 | 0 |
| QA-20260430-0375 | 2026-04-29T19:26:27.989Z | targeted | yes | yes | curl smoke - v8.11.64 Cloud Run /health redis circuit schema | 4 | 1 | 0 | 0 | 0 | 0 |
| QA-20260430-0374 | 2026-04-29T18:53:53.244Z | targeted | yes | yes | Vercel Playwright targeted QA - v8.11.64 AI alert-status advisory rerun | 10 | 1 | 0 | 0 | 1 | 1 |
| QA-20260429-0373 | 2026-04-29T14:29:33.712Z | targeted | yes | yes | Vercel Playwright targeted QA - v8.11.64 AI alert-status advisory recheck | 9 | 1 | 0 | 0 | 0 | 0 |
| QA-20260429-0372 | 2026-04-29T14:03:32.361Z | targeted | yes | yes | Vercel Playwright targeted QA - v8.11.63 AI slot propagation recheck | 9 | 1 | 1 | 0 | 0 | 1 |
