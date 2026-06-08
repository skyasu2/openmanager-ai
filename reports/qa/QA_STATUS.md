# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-06-08 15:06:26 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 691 |
| Total Runs (Counted) | 533 |
| Non-counted Runs | 158 |
| Total Checks | 4737 |
| Passed | 4525 |
| Failed | 167 |
| Completed Items | 792 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 28 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260608-0693 (2026-06-08T06:06:26.263Z) |
| Latest Recorded Run | QA-20260608-0693 (2026-06-08T06:06:26.263Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260608-0693 (2026-06-08T06:06:26.263Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| DevOps / SRE Engineer | appropriate | no | - |
| Test Automation Architect | appropriate | no | - |
| IT Monitoring & Observability SME | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Current billing period checked after v8.12.117 production deploy: effective=3.8906 USD, billed=0.0000 USD, chargeCount=3654. |
| gcp-cloud-run | script | checked | normal | Cloud Run guardrails passed: maxScale=1, concurrency=16, timeoutSeconds=300, cpu=1, memory=512Mi, cpu-throttling=true, latestReadyRevision=ai-engine-00614-xf4. |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-07T06:06:26.263Z -> 2026-06-08T06:06:26.263Z (24h)
- Runs with observations: 5 recorded / 1 counted
- Samples: 24

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | cerebras | 2 | 18942ms | 30000ms | - | - | - | - | QA-20260608-0692 |
| Metrics Query Agent | deterministic | 14 | 5759ms | 25000ms | - | - | - | - | QA-20260608-0692 |
| Metrics Query Agent | zai | 1 | 17610ms | 17610ms | - | - | - | - | QA-20260607-0681 |
| zai fallback | zai | 1 | 10495ms | 10495ms | - | - | - | - | QA-20260607-0678 |
| Metrics Query Agent | mistral | 2 | 3427ms | 3900ms | - | - | - | - | QA-20260607-0681 |
| Supervisor | groq | 1 | 700ms | 700ms | - | - | - | - | QA-20260607-0681 |
| Metrics Query | deterministic | 2 | 5ms | 9ms | - | - | - | - | QA-20260607-0678 |
| Supervisor | deterministic | 1 | 1ms | 1ms | - | - | - | - | QA-20260607-0681 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-07T06:06:26.263Z -> 2026-06-08T06:06:26.263Z (24h)
- Runs with observations: 6 recorded / 5 counted
- Samples: 11
- Drift rate: 27.27%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| /api/ai/supervisor/stream/v2 | single-agent | 1 | 0% | 30000ms | 30000ms | QA-20260608-0692 |
| /api/ai/supervisor/stream/v2 | deterministic | 4 | 0% | 20000ms | 25000ms | QA-20260608-0692 |
| /api/ai/supervisor | single-agent | 1 | 100% | 0ms | 0ms | QA-20260607-0686 |
| /api/ai/supervisor | deterministic | 4 | 50% | 0ms | 0ms | QA-20260608-0690 |
| /debug/prefilter | deterministic | 1 | 0% | 0ms | 0ms | QA-20260607-0689 |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: yes
- Counts Toward Summary: yes
- Deployment: gitlab-pipeline-2583876860 / SHA 13a501c4
- Coverage Packs: core-routes-smoke, observability-pack
- Covered Surfaces: GitLab tag pipeline 2583876860 succeeded for v8.12.117, GitLab deploy job succeeded for Vercel production, GitLab deploy_ai_engine job succeeded for Cloud Run ai-engine, GitLab post_deploy_smoke job succeeded, GitLab post_deploy_ai_engine_smoke job succeeded, Vercel production /api/version returned v8.12.117 and releaseTag v8.12.117, Vercel production /api/version returned commit 13a501c403565ada062815d7f10cca66258bc1d1, Vercel production /api/health returned success=true, status=healthy, and version 8.12.117, Cloud Run /health returned status ok and version 8.12.116, Redis system running flag now uses a 1800s TTL when set true and no TTL when explicitly stopped, Local regression tests covered system boot intent display after the landing system start action, Cloud Run service limits remained cpu=1 and memory=512Mi, Cloud Run free-tier guard script passed, Vercel usage check returned billed=0.0000 USD
- Skipped Surfaces: Browser conversational AI QA was not repeated because Claude run QA-20260608-0692 already covered the AI sidebar five-query target pack on v8.12.116, and this release only changed UI boot intent and serverless system-running TTL behavior, Dashboard/modal route packs were not repeated in this targeted deployment validation run, Cloud Run admin /monitoring and /monitoring/traces were not queried because the changed scope is frontend boot/system state and Redis expiry, not trace propagation, Public GitHub snapshot sync was not requested

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | v8.12.117 GitLab tag pipeline | [v8.12.117 GitLab tag pipeline](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2583876860) | - |
| monitoring | Cloud Run ai-engine health endpoint | [Cloud Run ai-engine health endpoint](https://ai-engine-jdhrhws7ia-an.a.run.app/health) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-report | v8.12.117 deployment validation evidence | `reports/qa/evidence/qa-20260608-v812117-deployment-validation.md` | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Portfolio Deferral 28
- Review classes: Verify Before Promotion 12, Future Product Expansion 6, Low-Priority Polish 6, Accepted No-Action 4

### Review Classes

- Verify Before Promotion 12: Potentially stale accepted debt. Re-run a targeted QA check before promoting it back to implementation work.
- Future Product Expansion 6: Valid enhancement only if the portfolio scope expands into a fuller product surface or longer-lived conversational memory.
- Low-Priority Polish 6: Non-blocking answer, copy, layout, or evidence-label polish. Keep accepted unless it appears in a release-facing regression.
- Accepted No-Action 4: Accepted no-fix item with no current trigger for implementation work.

### Portfolio Deferral

_Accepted as non-blocking portfolio debt to avoid over-engineering._

- [P1] ai-thinking-visualizer-contract-drift: Thinking visualizer production UI contract drift (seen 2회, last QA-20260428-0357)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] analyst-single-server-response-mismatch: Analyst 단일 서버 분석 응답 구조 불일치 수정 (seen 1회, last QA-20260519-0535)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] landing-vibe-content-deployment-drift: Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 (seen 1회, last QA-20260330-0195)
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
- [P3] q-new100-group-filtered-peak-metric: Q-NEW100: 그룹 필터된 peak metric 스토리지 필터 누락 (seen 3회, last QA-20260607-0675)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new11-location-clarification: DC1-AZ1/AZ2 명시에도 clarification 불필요 발동 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new12-network-metric-disclosure: 네트워크 I/O 미보유 시 데이터 부재 미명시 폴백 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new128-network-io-ranking-fallback: 네트워크 I/O 상위 랭킹 질의 LLM fallback (seen 1회, last QA-20260607-0678)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new13-advisor-evidence-label-preservation: Q-NEW13 Advisor command evidence label should survive getServerMetrics preparation (seen 1회, last QA-20260525-0589)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] reporter-dashboard-threshold-unification: Reporter 영향 서버 기준 대시보드와 불일치 (seen 1회, last QA-20260522-0559)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] vision-ui-upload-e2e: Authenticated frontend image-upload UI E2E path (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

## Completed Improvements

- Total: 792 items completed (full list in qa-tracker.json)
- Recently completed:
  - ai-engine-healthy-server-topn-frame-preservation-v812115: Healthy-only server TOP-N queries preserve topN through semantic intent frame (last QA-20260608-0690)
  - ai-engine-llm-intent-classifier-prompt-contract-v812110: LLM intent classifier prompt includes explicit edge-case examples for metrics vs analyst routing (last QA-20260607-0689)
  - ai-engine-boundary-clarification-short-circuit-v812108: Cloud Run direct supervisor short-circuits deterministic boundary clarifications and reports inverse-status metadata as Metrics Query (last QA-20260607-0688)
  - q-new119-multi-metric-all-average: Q-NEW119: 전체 서버 평균 메모리+디스크 동시 요청 deterministic 처리 (last QA-20260607-0677)
  - q-new121-fast-disk-trend-ranking: Q-NEW121: 디스크 사용률 빠른 증가 질의 metric-trend ranking 라우팅 (last QA-20260607-0677)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| QA-20260608-0693 | 2026-06-08T06:06:26.263Z | targeted | yes | yes | Production deploy validation - v8.12.117 boot flow and shutdown expiry | 14 | 0 | 0 | 0 | 0 | 0 |
| QA-20260608-0692 | 2026-06-08T05:05:57.160Z | targeted | no | no | AI 어시스턴트 5-쿼리 타겟 QA — v8.12.116 | 5 | 0 | 0 | 0 | 0 | 0 |
| QA-20260608-0691 | 2026-06-08T04:48:28.823Z | targeted | yes | yes | Production deploy validation - v8.12.116 session history and skill drift hardening | 11 | 0 | 0 | 0 | 0 | 0 |
| QA-20260608-0690 | 2026-06-07T23:44:09.497Z | targeted | yes | yes | Production Cloud Run direct API post-deploy QA - v8.12.115 healthy TOP-N frame preservation | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260607-0689 | 2026-06-07T14:33:22.885Z | targeted | yes | yes | Production Cloud Run manual deploy smoke - v8.12.110 LLM intent prompt examples | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260607-0688 | 2026-06-07T13:37:08.781Z | targeted | yes | yes | Production Cloud Run direct API post-deploy QA - v8.12.110 boundary guard closure | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260607-0687 | 2026-06-07T13:25:04.388Z | targeted | yes | yes | Production Cloud Run direct API post-deploy QA - v8.12.109 boundary guard partial closure | 6 | 0 | 1 | 0 | 0 | 1 |
| QA-20260607-0686 | 2026-06-07T13:07:25.133Z | targeted | yes | yes | Production Cloud Run direct API post-deploy QA - v8.12.108 boundary guard regression | 6 | 0 | 1 | 0 | 0 | 1 |
| QA-20260607-0685 | 2026-06-07T12:31:57.296Z | targeted | no | no | AI Engine pre-commit review validation - LLM prefilter routing guards | 12 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0684 | 2026-06-07T12:21:48.095Z | targeted | no | no | AI Engine pre-commit review validation - boundary guard and current metrics split | 10 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0683 | 2026-06-07T12:11:29.710Z | targeted | no | no | AI Engine local test refactor - current metrics evidence test split | 6 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0682 | 2026-06-07T11:46:33.825Z | targeted | no | no | AI Engine local regression - boundary question routing fixes | 7 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0681 | 2026-06-07T11:24:45.425Z | targeted | no | no | Cloud Run Direct API + Langfuse - Additional AI boundary question evaluation | 18 | 0 | 0 | 0 | 0 | 1 |
| QA-20260607-0680 | 2026-06-07T11:00:01.308Z | targeted | no | no | Cloud Run Direct API + Langfuse - Codex standard conversational AI QA | 14 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0679 | 2026-06-07T09:31:29.385Z | targeted | no | no | Cloud Run Direct API - 31차 v8.12.107 수정 재검증 | 3 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0678 | 2026-06-07T09:26:24.330Z | targeted | no | no | Cloud Run Direct API - 30차 AI 어시스턴트 평가 (v8.12.106) | 11 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0677 | 2026-06-07T09:10:18.387Z | targeted | yes | yes | Cloud Run Direct API - v8.12.107 Q-NEW119/121/122 deterministic fix validation | 3 | 3 | 0 | 0 | 0 | 0 |
| QA-20260607-0676 | 2026-06-07T08:24:40.249Z | targeted | no | no | Cloud Run Direct API - 29차 추가 평가 (v8.12.106) | 9 | 0 | 0 | 0 | 0 | 0 |
| QA-20260607-0675 | 2026-06-07T07:33:22.074Z | targeted | no | no | Vercel Production Playwright MCP - 29차 AI 어시스턴트 평가 (v8.12.106) | 7 | 0 | 0 | 0 | 1 | 0 |
| QA-20260607-0674 | 2026-06-07T05:19:01.995Z | targeted | yes | yes | Vercel Production Playwright MCP - v8.12.106 WONT-FIX remediation release QA | 6 | 5 | 0 | 0 | 0 | 0 |
