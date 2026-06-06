# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-06-06 22:25:18 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 662 |
| Total Runs (Counted) | 518 |
| Non-counted Runs | 144 |
| Total Checks | 4603 |
| Passed | 4402 |
| Failed | 159 |
| Completed Items | 766 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 30 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260606-0664 (2026-06-06T13:25:18.055Z) |
| Latest Recorded Run | QA-20260606-0664 (2026-06-06T13:25:18.055Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260606-0664 (2026-06-06T13:25:18.055Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| DevOps / SRE Engineer | appropriate | no | - |
| IT Monitoring & Observability SME | appropriate | no | - |
| AI Security & Reliability Architect | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Current billing period checked via vercel usage after v8.12.99 production deploy; effective=3.2367 USD, billed=0.0000 USD, chargeCount=3045, no unexpected billed usage observed. |
| gcp-cloud-run | cli | checked | normal | Cloud Run ai-engine stayed within free-tier guardrails: cpu=1, memory=512Mi, latestReadyRevision ai-engine-00597-8pv at 100% traffic; /health returned status ok and version 8.12.99. |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-05T13:25:18.055Z -> 2026-06-06T13:25:18.055Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| - | - | 0 | - | - | - | - | - | - | - |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-05T13:25:18.055Z -> 2026-06-06T13:25:18.055Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Coverage (Latest Run)

- Scope: smoke
- Release-Facing: yes
- Counts Toward Summary: yes
- Deployment: dpl_4VdYaBKQqx6B8TXXBZL9nv1VzxUF / SHA 5e3c43cd
- Coverage Packs: core-routes-smoke, observability-pack
- Covered Surfaces: GitLab semver tag release pipeline v8.12.99 completed successfully (pipeline 2581519723, commit 5e3c43cd65488e3a021403e5727eb23556fca7ba), Frontend production deploy job and post_deploy_smoke succeeded, AI Engine deploy_ai_engine job and post_deploy_ai_engine_smoke succeeded, Vercel production /, /login, and /api/version smoke passed with expected version 8.12.99, Vercel /api/version returned version 8.12.99, releaseTag v8.12.99, commitSha 5e3c43cd65488e3a021403e5727eb23556fca7ba, and pipelineUrl 2581519723, Vercel production deployment dpl_4VdYaBKQqx6B8TXXBZL9nv1VzxUF is Ready and aliased to openmanager-ai.vercel.app, Cloud Run ai-engine /health returned status ok, version 8.12.99, configured providers, and routesReady=true, Cloud Run latestReadyRevision ai-engine-00597-8pv receives 100% traffic, Cloud Run live resource limits remained cpu=1 and memory=512Mi, Vercel usage checked after production deploy; billed usage stayed 0.0000 USD
- Skipped Surfaces: Full dashboard/modal/AI conversational walkthrough was not repeated because this was a release smoke for auth retention cleanup and QA tooling changes, Manual AI prompt matrix was not repeated; latest D-2 Langfuse recheck found no Analyst maxSteps regression trigger, Cloud Run admin /monitoring and /monitoring/traces were not rechecked because this release did not change admin observability endpoints

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | GitLab v8.12.99 release pipeline | [GitLab v8.12.99 release pipeline](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2581519723) | - |
| monitoring | Cloud Run ai-engine health | [Cloud Run ai-engine health](https://ai-engine-jdhrhws7ia-an.a.run.app/health) | - |
| vercel-deployment | Vercel production deployment dpl_4VdYaBKQqx6B8TXXBZL9nv1VzxUF | [Vercel production deployment dpl_4VdYaBKQqx6B8TXXBZL9nv1VzxUF](https://openmanager-465byc3bn-skyasus-projects.vercel.app/) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-report | GitLab v8.12.99 release pipeline | [GitLab v8.12.99 release pipeline](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2581519723) | - |
| playwright-report | Vercel v8.12.99 production deployment | [Vercel v8.12.99 production deployment](https://openmanager-465byc3bn-skyasus-projects.vercel.app/) | - |
| playwright-network | Vercel /api/version v8.12.99 | [Vercel /api/version v8.12.99](https://openmanager-ai.vercel.app/api/version) | - |
| playwright-network | Cloud Run /health ai-engine 8.12.99 | [Cloud Run /health ai-engine 8.12.99](https://ai-engine-jdhrhws7ia-an.a.run.app/health) | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Portfolio Deferral 30
- Review classes: Verify Before Promotion 13, Future Product Expansion 5, Low-Priority Polish 8, Accepted No-Action 4

### Review Classes

- Verify Before Promotion 13: Potentially stale accepted debt. Re-run a targeted QA check before promoting it back to implementation work.
- Future Product Expansion 5: Valid enhancement only if the portfolio scope expands into a fuller product surface or longer-lived conversational memory.
- Low-Priority Polish 8: Non-blocking answer, copy, layout, or evidence-label polish. Keep accepted unless it appears in a release-facing regression.
- Accepted No-Action 4: Accepted no-fix item with no current trigger for implementation work.

### Portfolio Deferral

_Accepted as non-blocking portfolio debt to avoid over-engineering._

- [P1] ai-thinking-visualizer-contract-drift: Thinking visualizer production UI contract drift (seen 2회, last QA-20260428-0357)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] analyst-single-server-response-mismatch: Analyst 단일 서버 분석 응답 구조 불일치 수정 (seen 1회, last QA-20260519-0535)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] landing-vibe-content-deployment-drift: Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] server-comparison-deterministic-path: 서버 1:1 비교 쿼리 deterministic 경로 미확립 (seen 1회, last QA-20260522-0559)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P4] advisor-response-quality: Advisor 응답 내용 충실도 개선 (seen 1회, last QA-20260525-0592)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-adversarial-natural-language-qa-pack: Add QC/security-style natural-language AI regression prompts (seen 1회, last QA-20260512-0487)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-agent-type-metadata: AI Chat 에이전트 타입 메타데이터 표시 개선 (seen 1회, last QA-20260326-0190)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-metric-ranking-memory-path-metadata: Memory top-N query should expose deterministic metric-ranking path instead of filter fallback metadata (seen 1회, last QA-20260418-0304)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-remediation-response-quality: AI Chat 조치 방법 응답 품질 개선 (seen 1회, last QA-20260519-0535)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P4] ai-rewrite-report-style-quality: Formatting-only rewrite works but can return a terse two-line summary instead of polished report prose (seen 1회, last QA-20260504-0404)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] analyst-domain-context-injection: 심층 분석 시 서버 도메인 특성 미주입 (seen 1회, last QA-20260522-0559)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] analyst-drilldown: Analyst 서버별 드릴다운 (seen 1회, last QA-20260301-0030)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] analyst-trend-formatting-and-issue-ranking-polish: Analyst trend target formatting and issue ranking need polish (seen 1회, last QA-20260427-0352)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] api-system-abort-race-condition: /api/system ERR_ABORTED 경쟁상태 해결 (seen 1회, last QA-20260519-0535)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] landing-tech-stack-version-copy-drift: 기술 스택 모달 상세/아키텍처 간 버전 카피 정합성 정리 (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] mobile-header-density: Review dashboard mobile header density around AI CTA and profile cluster (seen 1회, last QA-20260418-0303)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] peak-metric-response-content: monitoringPeakMetricEvidenceProvider 응답 내용 부실 (seen 1회, last QA-20260522-0558)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] production-login-console-init-error: production login/assistant chunk init console error triage (seen 1회, last QA-20260421-0322)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P4] q-new8-advisor-routing: P4 재확인: 특정 서버 성능 개선 조언 시 Advisor 대신 AZ 라우팅 오발동 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] vision-gemini-exact-forecast-delta-attribution: Gemini Vision misattributes exact forecast delta values in the screenshot (seen 1회, last QA-20260520-0542)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] action-needed-transient-500-observation: One transient 500 on standard question 4 before immediate retry success (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] embedded-ai-tab-copy-scope: /dashboard/ai-assistant embedded tabs still show older generic subtitles (seen 1회, last QA-20260523-0569)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] numbered-list-accordion-split: 번호 목록이 핵심 요약/상세 분석 아코디언 경계에서 분리됨 (seen 1회, last QA-20260524-0579)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new11-location-clarification: DC1-AZ1/AZ2 명시에도 clarification 불필요 발동 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new12-network-metric-disclosure: 네트워크 I/O 미보유 시 데이터 부재 미명시 폴백 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new13-advisor-evidence-label-preservation: Q-NEW13 Advisor command evidence label should survive getServerMetrics preparation (seen 1회, last QA-20260525-0589)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] ranking-min-advice: 최저값 랭킹 응답에도 경고성 확인 항목이 표시됨 (seen 1회, last QA-20260524-0579)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] reporter-dashboard-threshold-unification: Reporter 영향 서버 기준 대시보드와 불일치 (seen 1회, last QA-20260522-0559)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] summary-block-markdown-heading-hr-code-fence: 핵심 요약 스트리밍 블록에서 마크다운 heading(###)/hr(---)/code-fence(```bash) 미렌더링 literal 노출 (seen 1회, last QA-20260530-0645)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] vision-ui-upload-e2e: Authenticated frontend image-upload UI E2E path (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

## Completed Improvements

- Total: 766 items completed (full list in qa-tracker.json)
- Recently completed:
  - routing-regression-check-v81299-production-released: routing regression check tooling and baseline released with v8.12.99 (last QA-20260606-0664)
  - security-audit-logs-retention-v81299-production-deployed: security_audit_logs 90-day app-level retention cleanup deployed to production in v8.12.99 (last QA-20260606-0664)
  - landing-ai-example-question-cards-v81298-production-deployed: Landing AI example question cards moved to SystemStartSection and verified in production v8.12.98 (last QA-20260606-0663)
  - landing-ai-server-ops-framing-v81296-production-deployed: Landing page AI server ops framing refactor deployed to Vercel production in v8.12.96 (last QA-20260606-0662)
  - langfuse-latency-fallback-v81295-production-deployed: Langfuse latency fallback display fix released in v8.12.95 (last QA-20260606-0661)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| QA-20260606-0664 | 2026-06-06T13:25:18.055Z | smoke | yes | yes | GitLab Release Deploy Smoke - v8.12.99 auth retention and QA tooling release | 10 | 2 | 0 | 0 | 0 | 0 |
| QA-20260606-0663 | 2026-06-06T10:00:46.159Z | targeted | yes | yes | Vercel Production Manual QA - v8.12.98 AI assistant example questions and deploy smoke | 16 | 1 | 0 | 0 | 0 | 0 |
| QA-20260606-0662 | 2026-06-06T06:33:47.793Z | smoke | yes | yes | GitLab Release Deploy Smoke - v8.12.96 landing refactor release | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260606-0661 | 2026-06-06T06:20:08.317Z | smoke | yes | yes | GitLab Release Deploy Smoke - v8.12.95 RCA routing and observability release | 12 | 2 | 0 | 0 | 0 | 0 |
| QA-20260605-0660 | 2026-06-05T13:08:33.704Z | targeted | yes | yes | Vercel Production Playwright MCP - Artifact BFF LLM 분류기 활성화 검증 (v8.12.94) | 5 | 2 | 0 | 0 | 0 | 0 |
| QA-20260605-0659 | 2026-06-05T12:41:09.056Z | targeted | yes | yes | Vercel Production Playwright MCP - Artifact BFF LLM Fallback Activation QA (v8.12.94) | 20 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0658 | 2026-06-05T11:03:39.705Z | targeted | no | no | Cloud Run Observability Check - Langfuse 100% Sampling Baseline Start (v8.12.92) | 8 | 0 | 0 | 0 | 0 | 0 |
| QA-20260605-0657 | 2026-06-05T06:56:30.699Z | targeted | yes | yes | Vercel Production Playwright MCP - Artifact Intent BFF Release QA (v8.12.92) | 20 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0656 | 2026-06-05T03:33:51.856Z | targeted | yes | yes | Vercel Production Playwright MCP - Recent Two-Week Improvements Applied Recheck (v8.12.91) | 13 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0655 | 2026-06-05T02:01:39.005Z | targeted | yes | yes | Vercel Production Chrome DevTools MCP Fallback - Frontend UI/UX Wiring Polish (v8.12.91) | 14 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0654 | 2026-06-05T01:25:05.069Z | targeted | no | no | Local Dev Chrome DevTools MCP - Frontend UI/UX Wiring Polish Verification | 12 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0653 | 2026-06-05T00:34:46.612Z | targeted | yes | yes | Vercel Production Playwright MCP - 2주간 개선 항목 통합 검증 (v8.12.90) | 13 | 6 | 0 | 0 | 0 | 0 |
| QA-20260605-0652 | 2026-06-05T00:05:25.119Z | targeted | no | no | Vercel Production Playwright MCP Recheck - v8.12.90 After GitLab Token Recovery | 13 | 0 | 0 | 0 | 0 | 0 |
| QA-20260605-0651 | 2026-06-04T16:20:31.104Z | targeted | yes | yes | Vercel Production Targeted QA - v8.12.90 Pre-Auth System Preload Fix | 11 | 2 | 0 | 0 | 0 | 0 |
| QA-20260605-0650 | 2026-06-04T15:37:32.012Z | targeted | yes | yes | Vercel Production Targeted QA - Free Tier and Two-Week Direction Review | 12 | 2 | 0 | 0 | 1 | 0 |
| QA-20260605-0649 | 2026-06-04T15:08:53.658Z | targeted | yes | yes | Cloud Run Production Targeted QA - v8.12.89 Off-Domain Warn Metadata | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260604-0648 | 2026-06-04T14:12:58.111Z | targeted | yes | yes | Cloud Run Production Targeted QA - v8.12.88 Off-Domain Guardrail | 6 | 1 | 0 | 0 | 0 | 0 |
| QA-20260530-0647 | 2026-05-30T13:45:31.747Z | targeted | yes | yes | Vercel Release Smoke - v8.12.87 Parallel Deploy Verification | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260530-0646 | 2026-05-30T08:57:48.785Z | targeted | yes | yes | Vercel production Analyst prefetch QA - v8.12.84 internal prompt redaction | 5 | 2 | 0 | 0 | 0 | 0 |
| QA-20260530-0645 | 2026-05-30T00:20:52.444Z | targeted | no | yes | Vercel Playwright MCP 신규 질문 평가 - v8.12.79 (all-scope 평균/조건부 카운트/가정형 영향분석) | 3 | 2 | 0 | 0 | 1 | 1 |
