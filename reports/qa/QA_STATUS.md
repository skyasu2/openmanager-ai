# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-06-07 22:25:04 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 685 |
| Total Runs (Counted) | 528 |
| Non-counted Runs | 157 |
| Total Checks | 4682 |
| Passed | 4470 |
| Failed | 167 |
| Completed Items | 789 |
| Pending Items | 1 |
| Deferred Items | 0 |
| Wont-Fix Items | 28 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 1 |
| Completion Rate | 99.87% |
| Last Counted Run | QA-20260607-0687 (2026-06-07T13:25:04.388Z) |
| Latest Recorded Run | QA-20260607-0687 (2026-06-07T13:25:04.388Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260607-0687 (2026-06-07T13:25:04.388Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | appropriate | yes | Prioritize inverse healthy-status filters before anomaly regex in getIntentCategory, redeploy, and rerun the six direct API boundary prompts. |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| gcp-cloud-run | curl+gcloud | checked | normal | Cloud Run health served v8.12.109; free-tier runtime limits were already verified during this deployment series. |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-06T13:25:04.388Z -> 2026-06-07T13:25:04.388Z (24h)
- Runs with observations: 13 recorded / 7 counted
- Samples: 45

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Metrics Query Agent | zai | 1 | 17610ms | 17610ms | - | - | - | - | QA-20260607-0681 |
| zai fallback | zai | 1 | 10495ms | 10495ms | - | - | - | - | QA-20260607-0678 |
| Analyst Agent | cerebras | 1 | 7883ms | 7883ms | - | - | - | - | QA-20260607-0681 |
| Analyst Agent | mistral | 3 | 5770ms | 7677ms | - | - | - | - | QA-20260607-0667 |
| Metrics Query Agent | mistral | 2 | 3427ms | 3900ms | - | - | - | - | QA-20260607-0681 |
| CapacityForecast | groq | 1 | 3500ms | 3500ms | - | - | - | - | QA-20260606-0665 |
| llama-4-scout | groq | 2 | 2050ms | 2300ms | - | - | - | - | QA-20260607-0672 |
| monitoring-metric-current | deterministic | 10 | 250ms | 1352ms | - | - | - | - | QA-20260607-0674 |
| monitoring-metric-ranking | deterministic | 2 | 434ms | 838ms | - | - | - | - | QA-20260607-0674 |
| Supervisor | groq | 1 | 700ms | 700ms | - | - | - | - | QA-20260607-0681 |
| Metrics Query Agent | deterministic | 14 | 68ms | 294ms | - | - | - | - | QA-20260607-0681 |
| MetricsQuery | deterministic | 1 | 120ms | 120ms | - | - | - | - | QA-20260606-0665 |
| monitoring-server-health | deterministic | 2 | 33ms | 33ms | - | - | - | - | QA-20260607-0670 |
| monitoring-capacity-forecast | deterministic | 1 | 29ms | 29ms | - | - | - | - | QA-20260607-0668 |
| Metrics Query | deterministic | 2 | 5ms | 9ms | - | - | - | - | QA-20260607-0678 |
| Supervisor | deterministic | 1 | 1ms | 1ms | - | - | - | - | QA-20260607-0681 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-06T13:25:04.388Z -> 2026-06-07T13:25:04.388Z (24h)
- Runs with observations: 2 recorded / 2 counted
- Samples: 3
- Drift rate: 100%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| /api/ai/supervisor | deterministic | 2 | 100% | 0ms | 0ms | QA-20260607-0687 |
| /api/ai/supervisor | single-agent | 1 | 100% | 0ms | 0ms | QA-20260607-0686 |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: yes
- Counts Toward Summary: yes
- Deployment: gitlab-pipeline-2582950316 / SHA 97f8fbc7
- Coverage Packs: ai-core
- Covered Surfaces: Cloud Run /health returned version 8.12.109 after GitLab tag pipeline 2582950316 succeeded, direct API network-ranking prompt returned deterministic monitoring-metric-ranking response, direct API unsupported GPU metric prompt returned deterministic monitoring-boundary-guard clarification, direct API explicit unknown server prompt returned deterministic not-found clarification, direct API ambiguous single-server prompt returned deterministic boundary clarification, direct API contextual follow-up prompt preserved target scope, direct API inverse-status prompt returned correct deterministic server-health content but metadata finalAgent still reported Analyst Agent
- Skipped Surfaces: Browser AI sidebar was not repeated because this check isolated Cloud Run direct supervisor behavior, Langfuse trace deep-dive was deferred until the final fix deployment

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | v8.12.109 GitLab tag pipeline | [v8.12.109 GitLab tag pipeline](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2582950316) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-report | v8.12.109 Cloud Run direct API boundary partial failure evidence | `reports/qa/evidence/qa-20260607-v812109-boundary-postdeploy-partial.md` | - |

## Expert Domain Open Gaps

- ai-quality-assurance: AI Quality Assurance Specialist (last QA-20260607-0687)
  next: Prioritize inverse healthy-status filters before anomaly regex in getIntentCategory, redeploy, and rerun the six direct API boundary prompts.

## Pending Improvements

- [P1] ai-engine-boundary-clarification-short-circuit-v812108: Cloud Run direct supervisor must short-circuit deterministic boundary clarifications and report inverse-status metadata as Metrics Query (seen 2회, last QA-20260607-0687)

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

- Total: 789 items completed (full list in qa-tracker.json)
- Recently completed:
  - q-new119-multi-metric-all-average: Q-NEW119: 전체 서버 평균 메모리+디스크 동시 요청 deterministic 처리 (last QA-20260607-0677)
  - q-new121-fast-disk-trend-ranking: Q-NEW121: 디스크 사용률 빠른 증가 질의 metric-trend ranking 라우팅 (last QA-20260607-0677)
  - q-new122-group-warning-count-compare: Q-NEW122: DB/cache 그룹 경고 수 비교 deterministic 처리 (last QA-20260607-0677)
  - numbered-list-accordion-split: 번호 목록 아코디언 요약/상세 경계 연속 렌더링 (last QA-20260607-0674)
  - q-new106-ranking-cross-metric: Q-NEW106: 메모리 상위N 서버의 이종 메트릭(디스크) 조회 처리 (last QA-20260607-0674)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
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
| QA-20260607-0673 | 2026-06-07T03:00:04.368Z | targeted | no | no | Production Playwright MCP - v8.12.104 P28/P30 fix validation | 2 | 2 | 0 | 0 | 0 | 0 |
| QA-20260607-0672 | 2026-06-07T02:33:52.729Z | targeted | no | no | Vercel Production Playwright MCP - 27차 AI 어시스턴트 평가 (v8.12.103) | 10 | 1 | 0 | 0 | 4 | 1 |
| QA-20260607-0671 | 2026-06-07T01:58:28.781Z | targeted | no | yes | Cloud Run Production Direct API - v8.12.103 P28/P29 deterministic evidence validation | 6 | 2 | 0 | 0 | 0 | 0 |
| QA-20260607-0670 | 2026-06-07T01:13:44.615Z | targeted | no | no | Vercel Production Playwright MCP - 26차 AI 어시스턴트 평가 (v8.12.102) | 10 | 4 | 0 | 0 | 3 | 1 |
| QA-20260607-0669 | 2026-06-06T23:59:04.960Z | targeted | no | yes | Cloud Run Production Direct API - v8.12.102 AI assistant advanced metric filter regression validation | 10 | 4 | 0 | 0 | 0 | 0 |
| QA-20260607-0668 | 2026-06-06T16:45:34.002Z | targeted | no | yes | Vercel Production Playwright MCP - 25차 AI 어시스턴트 평가 (v8.12.100) | 6 | 1 | 0 | 0 | 2 | 0 |
