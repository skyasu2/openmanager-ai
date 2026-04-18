# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-04-18 21:30:53 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 302 |
| Total Runs (Counted) | 258 |
| Non-counted Runs | 44 |
| Total Checks | 2039 |
| Passed | 1961 |
| Failed | 72 |
| Completed Items | 299 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 15 |
| Expert Domains Tracked | 8 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260418-0304 (2026-04-18T12:30:51.893Z) |
| Latest Recorded Run | QA-20260418-0304 (2026-04-18T12:30:51.893Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260418-0304 (2026-04-18T12:30:51.893Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| - | - | - | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Current billing period reviewed after production QA; effective usage 11.0956 USD, billed 0.0000 USD. No unexpected usage spike was observed. |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: no
- Counts Toward Summary: yes
- Deployment: ai-engine-00329-jvq / SHA 2cd5f40d
- Coverage Packs: ai-core
- Covered Surfaces: Vercel production guest session -> dashboard -> AI sidebar flow, AI sidebar query: 현재 CPU가 가장 높은 서버 알려줘, AI sidebar query: 현재 메모리 사용률 상위 3대 알려줘, CPU ranking response returns the top server with direct metric lookup metadata, Memory Top 3 response preserves descending order after ranking-answer fix
- Skipped Surfaces: fullscreen AI workspace, Reporter/Analyst advanced packs, broad route regression pack, mobile layout pack

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | Production | [Production](https://openmanager-ai.vercel.app/) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-screenshot | CPU ranking response on production | `reports/qa/evidence/qa-20260418-ranking-cpu-response.png` | - |
| playwright-screenshot | Memory top-3 response on production | `reports/qa/evidence/qa-20260418-ranking-memory-response.png` | - |
| playwright-console | Ranking hotfix session console | `reports/qa/evidence/qa-20260418-ranking-session-console.txt` | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- [P1] ai-server-timing-header-production: Server-Timing header visibility in production (seen 2회, last QA-20260310-0081)
  - note: 플랫폼 제약으로 인한 비차단 항목: Vercel production에서는 Server-Timing 대신 X-AI-Latency-Ms를 운영 SSOT로 사용
- [P1] landing-console-api-system-unauthorized: 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] landing-vibe-content-deployment-drift: Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] obs-fp-fn-weekly-report: 오탐/미탐 주간 리포트 자동 생성 (seen 3회, last QA-20260227-0013)
- [P2] ai-agent-type-metadata: AI Chat 에이전트 타입 메타데이터 표시 개선 (seen 1회, last QA-20260326-0190)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-cold-start-latency: Cloud Run cold start 레이턴시 최적화 (seen 2회, last QA-20260327-0193)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-metric-ranking-memory-path-metadata: Memory top-N query should expose deterministic metric-ranking path instead of filter fallback metadata (seen 1회, last QA-20260418-0304)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] analyst-drilldown: Analyst 서버별 드릴다운 (seen 1회, last QA-20260301-0030)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] cloud-run-cold-start-latency: Cloud Run AI Chat 콜드스타트 대기시간 과도 (5회 재시도, ~5분) (seen 1회, last QA-20260310-0089)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (요청자 표시(isBlocking=true)로 즉시 개선 필요)
- [P2] feature-dod-tsc-zero-error: tsc --noEmit 0 에러 (seen 9회, last QA-20260307-0053)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] feature-dod-unit-tests: 단위 테스트 158개 통과 (seen 9회, last QA-20260307-0053)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] landing-tech-stack-version-copy-drift: 기술 스택 모달 상세/아키텍처 간 버전 카피 정합성 정리 (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] mobile-header-density: Review dashboard mobile header density around AI CTA and profile cluster (seen 1회, last QA-20260418-0303)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] streaming-ai-fallback-cold-start: Streaming AI fallback에서 Cloud Run 콜드스타트 시 프리셋 질문 실패 (seen 1회, last QA-20260310-0090)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (요청자 표시(isBlocking=true)로 즉시 개선 필요)
- [P3] ai-provider-copy-policy-drift: Frontend AI provider and architecture copy must reflect current routing policy (seen 1회, last QA-20260404-0222)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

## Completed Improvements

- active-alerts-modal-ai-prefill: 활성 알림 모달에서 AI 사이드바 컨텍스트 자동 주입 (completed 1회, last QA-20260323-0166)
- admin-log-level-admin-auth: 관리자 로그레벨 API 관리자 권한 강제 (completed 1회, last QA-20260325-0183)
- ai-analyst-success: Analyst Agent 이상감지/예측 성공 (completed 2회, last QA-20260314-0097)
- ai-assistant-fullscreen-query-path: AI 전체 화면 핵심 서버 상태 요약 질의 검증 (completed 1회, last QA-20260318-0123)
- ai-assistant-fullscreen-tools-parity: AI 전체 화면 도구 메뉴 parity 검증 (completed 1회, last QA-20260318-0123)
- ai-chat-cloud-run-500: AI Chat Cloud Run 자유입력 응답 - 최종 성공 확인 (completed 1회, last QA-20260310-0089)
- ai-chat-cloud-run-rate-limit-production: Complex Cloud Run AI verification path should complete without rate-limit failure in production (completed 2회, last QA-20260408-0250)
- ai-chat-detail-expand: AI Chat 상세 분석 펼치기 (completed 1회, last QA-20260407-0248)
- ai-chat-empty-response: AI Chat 서버 상태 요약 질문에 빈 응답 반환 (completed 1회, last QA-20260315-0100)
- ai-chat-latency-regression-recheck-20260310: AI Chat latency regression claim rechecked on production (completed 1회, last QA-20260310-0071)
- ai-chat-pass: AI Chat 응답 품질 정상 (OTel 데이터 기반 분석) (completed 1회, last QA-20260326-0190)
- ai-chat-performance-v880: AI Chat 응답 시간 및 요약 품질 검증 (completed 3회, last QA-20260310-0082)
- ai-chat-quality-v880-quality-recheck: AI Chat 응답 품질 재검증 (completed 1회, last QA-20260308-0059)
- ai-chat-quality-v880-recheck: AI Chat 응답 품질 및 완료 시간 재검증 (completed 1회, last QA-20260308-0058)
- ai-chat-response: AI Chat 응답 (completed 1회, last QA-20260301-0035)
- ai-chat-response-process-details-production: Production assistant responses should expose detailed response-process fields when analysis basis is expanded (completed 1회, last QA-20260405-0242)
- ai-chat-response-process-metadata-production: Production AI responses should expose response-process metadata when analysis basis is shown (completed 1회, last QA-20260405-0242)
- ai-chat-response-quality: AI Chat 핵심요약+상세분석+구체적 권고 응답 (completed 1회, last QA-20260306-0051)
- ai-chat-response-quality-v879: AI Chat 스트리밍 응답 및 권고 검증 (completed 1회, last QA-20260306-0052)
- ai-chat-response-quality-v880-recheck-20260309: AI Chat 응답 품질 및 권고 재검증 (completed 4회, last QA-20260309-0068)
- ai-chat-sidebar-open: AI 사이드바 열기 (completed 1회, last QA-20260317-0114)
- ai-code-gate-input-policy: AI Code Gate: Prompt 패턴 15개 방어 점검 (completed 2회, last QA-20260318-0125)
- ai-domain-boundary-phase2-analysis-mode: AI Domain Boundary Phase 2 analysis mode toggle (auto/thinking) (completed 1회, last QA-20260416-0297)
- ai-engine-status: AI 엔진 상태 표시 (completed 1회, last QA-20260317-0114)
- ai-friendly-template-todo-marker: Template TODO marker 분리 (TEMPLATE_TODO 적용) (completed 1회, last QA-20260226-0006)
- ai-hardening-production-verification: Verify production AI hardening release on v8.11.20 (completed 1회, last QA-20260418-0303)
- ai-math-tools: AI 계산 도구(수식/통계/용량) 셋업 완료 (completed 1회, last QA-20260228-0023)
- ai-metric-ranking-answer-order: Ranking answers preserve descending order from tool output (completed 1회, last QA-20260418-0304)
- ai-metric-ranking-cpu-route: Current metric ranking query routes to deterministic metric lookup (completed 1회, last QA-20260418-0304)
- ai-reporter-success: Reporter Agent 보고서 생성 성공 (completed 3회, last QA-20260315-0104)
- ai-server-timing-hosting-path-diagnosed: Server-Timing production/local hosting path difference diagnosed (completed 1회, last QA-20260310-0081)
- ai-sidebar-open: AI 사이드바 열기/닫기 (completed 1회, last QA-20260317-0114)
- ai-sidebar-parity-contract-rendering: AI sidebar 상세 분석에 실제 parity metadata contract 노출 (completed 1회, last QA-20260323-0164)
- ai-sidebar-right-panel: AI 우측 패널 기능 메뉴 (completed 1회, last QA-20260317-0114)
- ai-sidebar-starters: AI 스타터 프롬프트 5개 (completed 1회, last QA-20260317-0114)
- ai-sidebar-toggle: AI 사이드바 열기 (completed 1회, last QA-20260317-0114)
- ai-sidebar-tools-menu: AI 도구 메뉴 (completed 1회, last QA-20260317-0114)
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
- analysis-basis-badge-label: AnalysisBasisBadge.tsx: collapsed 표시 '도구:' → '분석 단계:' Progressive Disclosure 개선 (completed 1회, last QA-20260408-0252)
- analyst-agent-pass: Analyst Agent 전체 분석 정상 (completed 1회, last QA-20260326-0190)
- analyst-full-analysis: Analyst 전체 분석 (completed 1회, last QA-20260317-0114)
- analyst-full-analysis-v879: Analyst 전체 분석 및 드릴다운 (completed 1회, last QA-20260306-0052)
- analyst-full-analysis-v880: Analyst 전체 분석 및 드릴다운 검증 (completed 2회, last QA-20260309-0069)
- analyst-full-analysis-v880-recheck-20260309: Analyst 전체 분석 경로 재검증 (completed 4회, last QA-20260309-0068)
- analyst-fullscreen-single-server-rag: Analyst 단일 서버 + RAG 분석 경로 검증 (completed 1회, last QA-20260318-0126)
- analyst-instruction-tool-name-exposure: analyst.ts: '분석 과정' 섹션 제거 및 도구명 응답 본문 노출 금지 (completed 1회, last QA-20260408-0252)
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
- cloud-run-proxy-runtime-env-refresh: Cloud Run proxy runtime env refresh (completed 1회, last QA-20260325-0185)
- cloud-run-readiness-guard: Cloud Run direct route readiness guard 공통화 (completed 1회, last QA-20260325-0184)
- cloud-run-v892-manual-deploy: Cloud Run v8.9.2 manual deploy verification (completed 1회, last QA-20260317-0118)
- coverage-suite-stabilize: vitest coverage suite 0 failed (6→0) 안정화 (completed 1회, last QA-20260329-0194)
- csrf-duplicate-removal: CSRF getCSRFTokenFromCookie 중복 제거 (completed 1회, last QA-20260307-0053)
- cve-brace-expansion: brace-expansion CVE GHSA-f886-m6hf-6m8v 패치 (completed 1회, last QA-20260329-0194)
- dashboard-15-servers: 대시보드 15대 서버 모니터링 정상 (completed 2회, last QA-20260314-0097)
- dashboard-active-alerts: 활성 알림 모달 (completed 1회, last QA-20260317-0114)
- dashboard-health-badge-warning-consistency: 고부하 카드가 Stable 대신 Warning으로 정렬됨 (completed 1회, last QA-20260322-0157)
- dashboard-health-v879: 프로덕션 대시보드 및 Health API 검증 (completed 1회, last QA-20260306-0052)
- dashboard-health-v880: 프로덕션 대시보드 및 Health API 검증 (completed 1회, last QA-20260308-0056)
- dashboard-health-v880-quality-recheck: 프로덕션 대시보드/Health API 품질 재검증 (completed 1회, last QA-20260308-0059)
- dashboard-health-v880-recheck: 프로덕션 대시보드 및 Health API 재검증 (completed 5회, last QA-20260309-0068)
- dashboard-resources: 시스템 리소스 개요 (completed 1회, last QA-20260317-0114)
- dashboard-server-card-selector-stabilization: 서버 카드 선택자 및 빈 상태 처리 안정화 (completed 2회, last QA-20260302-0039)
- dashboard-server-cards: 대시보드 서버 카드 및 메트릭 (completed 2회, last QA-20260302-0038)
- dashboard-status-filter: 상태 필터 토글 (completed 1회, last QA-20260317-0114)
- dashboard-topology-map: 토폴로지 맵 모달 (completed 1회, last QA-20260317-0114)
- dom-related-depscan-noise-suppression: Suppress benign zero-test DOM related dep-scan noise (completed 1회, last QA-20260325-0186)
- e2e-ai-chat-production-selector-alignment: AI Chat/Sidebar E2E selectors aligned with production DOM (completed 1회, last QA-20260310-0073)
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
- health-all-connected: Health API 전체 서비스 connected (completed 2회, last QA-20260314-0097)
- health-api: Health API 검증 (completed 1회, last QA-20260301-0035)
- health-api-200-healthy: Health API 200 healthy (completed 3회, last QA-20260320-0140)
- health-api-response-format: Health API 응답 포맷 검증 스크립트 수정 (completed 1회, last QA-20260310-0077)
- health-route-envelope-test-alignment: Health route envelope/cache typing 정렬 (completed 1회, last QA-20260325-0184)
- health-route-supabase-session-timeout: 헬스체크 Supabase 세션 프로브 타임아웃 강제 (completed 1회, last QA-20260325-0183)
- home-semantic-nav: 홈 페이지 nav 랜드마크 보강 (completed 1회, last QA-20260226-0009)
- landing-bootstrap-auth-copy-hidden: 랜딩 첫 진입 bootstrap 인증 카피 숨김 (completed 1회, last QA-20260402-0206)
- landing-bootstrap-copy-hidden: 랜딩 첫 진입 시 bootstrap auth copy 비노출 처리 (completed 2회, last QA-20260408-0250)
- landing-copy-alignment: 랜딩/로그인 정책 카피 정합성 (completed 4회, last QA-20260227-0016)
- landing-feature-cards: 랜딩 피처카드 4개 모달 (completed 1회, last QA-20260317-0114)
- landing-page-render: 랜딩 페이지 렌더링 (completed 3회, last QA-20260320-0140)
- landing-production-improvements-deployed: 랜딩 페이지 개선 사항 production 반영 및 검증 완료 (completed 1회, last QA-20260330-0197)
- landing-profile-bootstrap-state: 랜딩 초기 프로필 상태 텍스트 일관성 개선 (completed 1회, last QA-20260317-0120)
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
- production-dashboard-render: 프로덕션 대시보드 렌더링 (completed 1회, last QA-20260317-0114)
- production-smoke-console-401-cleanliness: Production smoke console 401 resource noise 정리 (completed 3회, last QA-20260320-0140)
- profile-menu: 프로필 메뉴 드롭다운 (completed 1회, last QA-20260317-0114)
- prompt-injection-block-smoke-v880: Prompt injection 차단 스모크 검증 (completed 1회, last QA-20260308-0056)
- qa-doc-roadmap-current-status-alignment: QA DoD 로드맵 현재 상태 정합성 갱신 (completed 1회, last QA-20260309-0067)
- qa-expert-domain-tracking: QA 런에서 전문가 영역 적합성 추적 체계 도입 (completed 1회, last QA-20260226-0003)
- qa-final-report-historical-positioning: v8.7.1 최종 QA 리포트의 historical 성격 명시 (completed 1회, last QA-20260309-0067)
- rag-engine-doc-link-repair: RAG, Vercel fair-use 문서 링크 경로 갱신 (completed 1회, last QA-20260228-0026)
- rag-smoke-coverage: Redis+Supabase RAG 경로 스모크 강화 (completed 2회, last QA-20260302-0039)
- readme-qa-evidence-sync-20260325: README QA evidence snapshot sync (completed 1회, last QA-20260325-0185)
- release-dod-contract-test: Release DoD: API contract test 통과 (completed 1회, last QA-20260226-0008)
- release-dod-cost-gate: Release DoD: Cloud Run Free Tier 비용 가드 검증 (completed 1회, last QA-20260226-0008)
- release-dod-doc-gate: Release DoD: 문서 게이트 90일 갱신·메타데이터·아카이빙 정책 (completed 1회, last QA-20260228-0025)
- release-dod-test-gate: validate:all 0 에러 (completed 2회, last QA-20260302-0036)
- reporter-agent-pass: Reporter Agent 보고서 즉시 생성 정상 (completed 1회, last QA-20260326-0190)
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
- root-layout-font-preload-cleanup: Suppress repeated root font preload warnings on dashboard and fullscreen AI routes (completed 1회, last QA-20260417-0300)
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
| QA-20260418-0304 | 2026-04-18T12:30:51.893Z | targeted | no | yes | Vercel targeted QA - AI metric ranking hotfix | 5 | 2 | 0 | 0 | 1 | 0 |
| QA-20260418-0303 | 2026-04-18T08:01:44.685Z | broad | yes | yes | Production broad QA - 8.11.20 AI hardening verification | 22 | 1 | 0 | 0 | 1 | 0 |
| QA-20260417-0302 | 2026-04-17T05:39:27.161Z | targeted | no | yes | v8.11.19 active-alert :9100 fix targeted production QA | 4 | 1 | 0 | 0 | 0 | 0 |
| QA-20260417-0301 | 2026-04-17T05:23:31.724Z | targeted | yes | no | Production release verification blocked - v8.11.19 deploy not created | 4 | 0 | 1 | 0 | 0 | 1 |
| QA-20260417-0300 | 2026-04-17T04:06:23.738Z | broad | yes | yes | Production broad QA - 8.11.17 font preload cleanup verification | 18 | 1 | 0 | 0 | 0 | 0 |
| QA-20260417-0299 | 2026-04-16T15:32:08.661Z | broad | yes | yes | Production broad QA - 8.11.16 dashboard AI parity with font preload warning regression | 18 | 0 | 1 | 0 | 0 | 2 |
| QA-20260417-0298 | 2026-04-16T15:01:19.807Z | targeted | no | yes | Production targeted QA - 8.11.16 copy trim and AI sidebar verification | 10 | 0 | 0 | 0 | 0 | 0 |
| QA-20260416-0297 | 2026-04-16T13:53:18.702Z | targeted | no | yes | Production QA - Analysis Mode Auto vs Thinking v8.11.15 | 8 | 1 | 0 | 0 | 0 | 0 |
| QA-20260416-0296 | 2026-04-16T12:02:50.961Z | targeted | no | yes | Production mixed query QA after 8.11.14 frontend and ai-engine deploy | 8 | 0 | 0 | 0 | 0 | 0 |
| QA-20260416-0295 | 2026-04-16T11:38:00.431Z | targeted | no | no | Production mixed runtime QA after manual Cloud Run deploy | 6 | 0 | 0 | 0 | 0 | 0 |
| QA-20260416-0294 | 2026-04-16T00:26:05.077Z | targeted | yes | yes | Vercel production targeted QA - AI full-surface advanced flows on v8.11.13 | 7 | 0 | 0 | 0 | 0 | 0 |
| QA-20260416-0293 | 2026-04-16T00:12:50.093Z | targeted | yes | no | Vercel production targeted QA - fullscreen analysis basis parity after v8.11.13 deploy | 8 | 1 | 0 | 0 | 0 | 0 |
| QA-20260416-0292 | 2026-04-15T23:53:23.445Z | targeted | no | no | Vercel preview targeted QA - fullscreen analysis basis parity after data-done toolsCalled fix | 7 | 1 | 0 | 0 | 0 | 0 |
| QA-20260415-0291 | 2026-04-15T14:40:05.458Z | broad | yes | yes | Vercel broad QA - v8.11.12 production frontend and AI refresh | 18 | 0 | 0 | 0 | 0 | 0 |
| QA-20260415-0290 | 2026-04-15T14:18:02.870Z | targeted | yes | no | Vercel production targeted QA - fullscreen analysis basis parity after v8.11.12 deploy | 6 | 0 | 0 | 0 | 0 | 0 |
| QA-20260415-0289 | 2026-04-15T13:37:22.863Z | targeted | no | no | Vercel preview targeted QA - fullscreen analysis basis parity after hydration fix | 6 | 1 | 0 | 0 | 0 | 0 |
| QA-20260415-0288 | 2026-04-15T11:09:03.713Z | broad | yes | yes | Vercel broad QA - frontend and AI assistant evaluation on latest production | 16 | 0 | 1 | 0 | 0 | 1 |
| QA-20260415-0287 | 2026-04-15T00:53:57.310Z | release-gate | yes | yes | Production release-gate QA refresh after ai-engine-00317 stabilization | 8 | 0 | 0 | 0 | 0 | 0 |
| QA-20260415-0286 | 2026-04-14T23:41:31.531Z | targeted | no | no | Mixed advisory residual follow-up QA (ai-engine-00317) | 3 | 0 | 0 | 0 | 0 | 0 |
| QA-20260415-0285 | 2026-04-14T17:11:51.995Z | targeted | no | yes | Graph traversal re-evaluation post-variant-fix QA (ai-engine-00317) | 4 | 1 | 0 | 0 | 0 | 0 |
