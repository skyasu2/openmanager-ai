# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-06-07 01:01:06 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 665 |
| Total Runs (Counted) | 521 |
| Non-counted Runs | 144 |
| Total Checks | 4639 |
| Passed | 4436 |
| Failed | 160 |
| Completed Items | 770 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 30 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260607-0667 (2026-06-06T16:01:05.302Z) |
| Latest Recorded Run | QA-20260607-0667 (2026-06-06T16:01:05.302Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260607-0667 (2026-06-06T16:01:05.302Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | appropriate | no | - |
| IT Monitoring & Observability SME | appropriate | no | - |
| DevOps / SRE Engineer | appropriate | no | - |
| Test Automation Architect | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Current billing period checked after Vercel production Playwright MCP and AI QA; effective=3.2367 USD, billed=0.0000 USD, chargeCount=3045, no unexpected billed usage observed. |
| gcp-cloud-run | http | checked | normal | Production /api/health?service=ai&soft=true returned status ok, backend Cloud Run, service ai-engine, version 8.12.100, latency 98ms. |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-05T16:01:05.302Z -> 2026-06-06T16:01:05.302Z (24h)
- Runs with observations: 3 recorded / 3 counted
- Samples: 7

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | mistral | 3 | 5770ms | 7677ms | - | - | - | - | QA-20260607-0667 |
| CapacityForecast | groq | 1 | 3500ms | 3500ms | - | - | - | - | QA-20260606-0665 |
| Metrics Query Agent | deterministic | 2 | 115ms | 204ms | - | - | - | - | QA-20260607-0667 |
| MetricsQuery | deterministic | 1 | 120ms | 120ms | - | - | - | - | QA-20260606-0665 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-05T16:01:05.302Z -> 2026-06-06T16:01:05.302Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Coverage (Latest Run)

- Scope: broad
- Release-Facing: yes
- Counts Toward Summary: yes
- Deployment: SHA 2df8a6aa
- Coverage Packs: core-routes-smoke, dashboard-core, ai-core, ai-advanced-surface, observability-pack
- Covered Surfaces: Planning state: reports/planning/TODO.md Active Tasks and Backlog were empty; only On Hold/Not Actionable items remain, Planning state: reports/planning/ai-assistant-improvement-plan-2026-06.md implementation tasks are complete; D-2 remains conditional and not triggered, QA state: npm run qa:status reported latest QA-20260607-0666, active gate warnings 0, pending/deferred improvements 0, expert open gaps 0, Evidence integrity: npm run qa:evidence:audit reported orphan durable evidence 0 and recent missing durable artifact refs 0, Docs gates: npm run docs:budget and npm run docs:ai-consistency passed, Contract gate: npm run test:contract passed 24/24 tests, Vercel production / rendered OpenManager AI v8.12.100 and login affordance, Guest PIN login reached authenticated landing state and dashboard start, Vercel dashboard rendered 18 total servers, 17 online, 1 warning, and AI engine Ready state, AI sidebar P25 query '위험한 서버와 안정적인 서버를 동시에 알려줘' returned both risky TOP 3 and stable BOTTOM 3 sections, AI sidebar P25 evidence card showed monitoring-server-health tool evidence and Cloud Run AI/source metadata, AI sidebar Analyst query '현재 이상 징후가 감지된 서버 있어? 분석해줘' returned server summary, warning server, trend, and recommendation, Playwright console check found 0 warning/error messages, Playwright network check found AI health, guest-login, wake-up, artifact-intent, supervisor stream, NLQ entity extraction, and AI jobs requests all succeeded with 200/201 statuses, Langfuse current trace check found 2026-06-07 00:55:07 KST supervisor-execution, provider=mistral, agent=Analyst Agent, status=ok, latency=7.6s, Langfuse recent supervisor trace sample had fallback 0 and current-run Analyst status ok, Production /api/version returned version 8.12.100, releaseTag v8.12.100, commitSha 176d4b621bdc1401cff6a6c9393f64d26805d470, pipeline 2581738367, Production AI health returned Cloud Run backend ok, version 8.12.100, latency 98ms, Vercel usage guard reported effective=3.2367 USD, billed=0.0000 USD, chargeCount=3045
- Skipped Surfaces: OAuth provider end-to-end login was not repeated; guest PIN flow is the production QA path for this run, Artifact BFF image upload and report generation were outside this closure check, Exact P25 deterministic UI query was not used as the Langfuse proof because the current Langfuse proof is the subsequent Analyst trace that appeared after ingestion delay

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | GitLab v8.12.100 release pipeline | [GitLab v8.12.100 release pipeline](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2581738367) | - |
| monitoring | Langfuse project dashboard | [Langfuse project dashboard](https://us.cloud.langfuse.com/project) | - |
| vercel-deployment | Vercel production deployment dpl_8gGRNXZ1heoCMtiHCNNKhGdVhyJv | [Vercel production deployment dpl_8gGRNXZ1heoCMtiHCNNKhGdVhyJv](https://openmanager-82ndsftih-skyasus-projects.vercel.app/) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-screenshot | P25 AI sidebar TOP+BOTTOM production response | `reports/qa/evidence/2026/qa-20260607-0667/qa-20260607-v812100-p25-ai-assistant.png` | - |
| playwright-screenshot | AI sidebar anomaly Analyst production response | `reports/qa/evidence/2026/qa-20260607-0667/qa-20260607-v812100-ai-anomaly-response.png` | - |
| playwright-console | Playwright console warning/error final log | `reports/qa/evidence/2026/qa-20260607-0667/qa-20260607-console-warning-final.txt` | - |
| playwright-network | Playwright AI network final log | `reports/qa/evidence/2026/qa-20260607-0667/qa-20260607-network-ai-final.txt` | - |
| playwright-console | Playwright console warning/error initial log | `reports/qa/evidence/2026/qa-20260607-0667/qa-20260607-console-warning-initial.txt` | - |
| playwright-network | Playwright AI network initial log | `reports/qa/evidence/2026/qa-20260607-0667/qa-20260607-network-ai-initial.txt` | - |
| playwright-report | Langfuse current Analyst trace | [Langfuse current Analyst trace](https://us.cloud.langfuse.com/project) | - |
| playwright-network | Vercel /api/version v8.12.100 | [Vercel /api/version v8.12.100](https://openmanager-ai.vercel.app/api/version) | - |
| playwright-network | Vercel AI health v8.12.100 | [Vercel AI health v8.12.100](https://openmanager-ai.vercel.app/api/health?service=ai&soft=true) | - |
| playwright-report | GitLab v8.12.100 release pipeline | [GitLab v8.12.100 release pipeline](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2581738367) | - |

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

- Total: 770 items completed (full list in qa-tracker.json)
- Recently completed:
  - p25-top-bottom-dual-query-ui-confirmed: P25 TOP+BOTTOM dual server query production UI confirmation (last QA-20260607-0667)
  - production-ai-observability-final-check: Production AI assistant Langfuse current-run trace confirmation (last QA-20260607-0667)
  - p25-top-bottom-dual-query: P25: 가장 위험한 서버 + 가장 안정적인 서버 동시 질의 deterministic evidence 처리 (last QA-20260607-0666)
  - p24-all-scope-average: P24: 전체 서버 all-scope 단일 메트릭 평균 집계 수정 완료 (last QA-20260606-0665)
  - routing-regression-check-v81299-production-released: routing regression check tooling and baseline released with v8.12.99 (last QA-20260606-0664)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| QA-20260607-0667 | 2026-06-06T16:01:05.302Z | broad | yes | yes | Vercel Playwright MCP + Langfuse Final QA - v8.12.100 improvement closure check | 19 | 2 | 0 | 0 | 0 | 0 |
| QA-20260607-0666 | 2026-06-06T15:25:12.210Z | targeted | yes | yes | Cloud Run Production Targeted QA - v8.12.100 P25 TOP+BOTTOM dual server query fix | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260606-0665 | 2026-06-06T14:36:04.907Z | targeted | no | yes | Vercel Production Playwright MCP - 24차 AI 어시스턴트 평가 (v8.12.99) | 7 | 1 | 0 | 0 | 1 | 0 |
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
