# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-06-07 18:10:18 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 675 |
| Total Runs (Counted) | 526 |
| Non-counted Runs | 149 |
| Total Checks | 4670 |
| Passed | 4463 |
| Failed | 162 |
| Completed Items | 789 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 27 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260607-0677 (2026-06-07T09:10:18.387Z) |
| Latest Recorded Run | QA-20260607-0677 (2026-06-07T09:10:18.387Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260607-0677 (2026-06-07T09:10:18.387Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | appropriate | no | - |
| Data Quality & Metrics Analyst | appropriate | no | - |
| DevOps / SRE Engineer | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| cloud-run | cli | checked | normal | Cloud Run free-tier guardrails intact after v8.12.107 deploy: maxScale=1, concurrency=16, timeout=300s, cpu=1, memory=512Mi, cpu-throttling=true, latestReadyRevision=ai-engine-00604-6n2. |
| vercel | cli | checked | normal | Current billing period checked after v8.12.107 QA; effective=3.8906 USD, billed=0.0000 USD, chargeCount=3654. |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-06T09:10:18.387Z -> 2026-06-07T09:10:18.387Z (24h)
- Runs with observations: 10 recorded / 7 counted
- Samples: 29

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | mistral | 3 | 5770ms | 7677ms | - | - | - | - | QA-20260607-0667 |
| CapacityForecast | groq | 1 | 3500ms | 3500ms | - | - | - | - | QA-20260606-0665 |
| llama-4-scout | groq | 2 | 2050ms | 2300ms | - | - | - | - | QA-20260607-0672 |
| monitoring-metric-current | deterministic | 10 | 250ms | 1352ms | - | - | - | - | QA-20260607-0674 |
| monitoring-metric-ranking | deterministic | 2 | 434ms | 838ms | - | - | - | - | QA-20260607-0674 |
| Metrics Query Agent | deterministic | 7 | 117ms | 294ms | - | - | - | - | QA-20260607-0677 |
| MetricsQuery | deterministic | 1 | 120ms | 120ms | - | - | - | - | QA-20260606-0665 |
| monitoring-server-health | deterministic | 2 | 33ms | 33ms | - | - | - | - | QA-20260607-0670 |
| monitoring-capacity-forecast | deterministic | 1 | 29ms | 29ms | - | - | - | - | QA-20260607-0668 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-06T09:10:18.387Z -> 2026-06-07T09:10:18.387Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: yes
- Counts Toward Summary: yes
- Deployment: ai-engine-00604-6n2 / SHA 704fcd6e
- Coverage Packs: ai-core
- Covered Surfaces: Q-NEW119: 전체 서버 평균 메모리+디스크 동시 요청 -> deterministic monitoring-metric-current, 평균 메모리 46.4%, 평균 디스크 35.6%, N/A 없음 (PASS), Q-NEW121: 디스크 사용률이 가장 빠르게 증가하고 있는 서버 -> deterministic monitoring-metric-trend, 24h 평균 대비 디스크 증가폭 상위 5대 반환 (PASS), Q-NEW122: DB 서버 그룹과 cache 서버 그룹 경고 수 비교 -> deterministic monitoring-server-health, DB 0대 vs 캐시 1대 warning 비교 및 결론 반환 (PASS)
- Skipped Surfaces: 브라우저 UI 아코디언/마크다운 렌더링은 이번 변경 범위 밖, 표준 5문항 conversational QA는 v8.12.107 release-facing smoke 이후 targeted fix 검증으로 대체

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | GitLab main validate pipeline 2582748796 | [GitLab main validate pipeline 2582748796](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2582748796) | - |
| general | GitLab release pipeline 2582751443 | [GitLab release pipeline 2582751443](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2582751443) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-console | v8.12.107 Cloud Run direct API deterministic QA evidence | `reports/qa/evidence/qa-20260607-v812107-ai-engine-direct-api.txt` | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Portfolio Deferral 27
- Review classes: Verify Before Promotion 12, Future Product Expansion 5, Low-Priority Polish 6, Accepted No-Action 4

### Review Classes

- Verify Before Promotion 12: Potentially stale accepted debt. Re-run a targeted QA check before promoting it back to implementation work.
- Future Product Expansion 5: Valid enhancement only if the portfolio scope expands into a fuller product surface or longer-lived conversational memory.
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
