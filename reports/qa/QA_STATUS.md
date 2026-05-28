# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-05-28 15:15:14 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 629 |
| Total Runs (Counted) | 497 |
| Non-counted Runs | 132 |
| Total Checks | 4377 |
| Passed | 4177 |
| Failed | 159 |
| Completed Items | 729 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 31 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260528-0630 (2026-05-28T04:37:16.133Z) |
| Latest Recorded Run | QA-20260528-0631 (2026-05-28T06:15:13.877Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260528-0631 (2026-05-28T06:15:13.877Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| DevOps / SRE Engineer | appropriate | no | - |
| AI Quality Assurance Specialist | partially-appropriate | no | - |
| IT Monitoring & Observability SME | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | v8.12.69 production deploy after check: effective 17.9292 USD, billed 0.0000 USD, chargeCount 15834. |
| cloud-run | cli | checked | normal | Cloud Run guardrails intact: maxScale=1, concurrency=16, timeout=300s, cpu=1, memory=512Mi, cpu-throttling=true, latestReadyRevision=ai-engine-00574-qgq. |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-27T06:15:13.877Z -> 2026-05-28T06:15:13.877Z (24h)
- Runs with observations: 3 recorded / 3 counted
- Samples: 5

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | streaming-ai | 1 | 7000ms | 7000ms | - | - | - | - | QA-20260528-0628 |
| Metrics Query Agent | cloud-run-ai | 4 | 1140ms | 1561ms | - | - | 1561ms | 1561ms | QA-20260528-0628 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-27T06:15:13.877Z -> 2026-05-28T06:15:13.877Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Coverage (Latest Run)

- Scope: smoke
- Release-Facing: yes
- Counts Toward Summary: no
- Deployment: gitlab-pipeline-2557930982-v8.12.69 / SHA a02fccd2
- Coverage Packs: core-routes-smoke, ai-core, observability-pack
- Covered Surfaces: GitLab tag pipeline v8.12.69 completed successfully, Frontend deploy job succeeded, Cloud Run AI Engine deploy job succeeded, Vercel post-deploy smoke succeeded, AI Engine post-deploy smoke succeeded, Production /api/version reports 8.12.69, v8.12.69, and commit a02fccd2d86face2d266a09dce3869cb7bdd9be7, Cloud Run /health reports status ok and version 8.12.69, Cloud Run /monitoring without auth returns 403 as expected, Vercel usage remains billed 0.0000 USD after deploy, Cloud Run free-tier guardrails remain intact
- Skipped Surfaces: Interactive dashboard visual QA was not rerun in this deployment-smoke record, Conversational five-question AI QA was not rerun in this deployment-smoke record, Full broad route/device matrix was not run

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | GitLab pipeline v8.12.69 | [GitLab pipeline v8.12.69](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2557930982) | - |
| monitoring | Cloud Run health | [Cloud Run health](https://ai-engine-jdhrhws7ia-an.a.run.app/health) | - |
| vercel-deployment | Production app | [Production app](https://openmanager-ai.vercel.app/) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-console | v8.12.69 release smoke command evidence | `reports/qa/evidence/qa-20260528-v81269-release-smoke.txt` | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Portfolio Deferral 31
- Review classes: Verify Before Promotion 14, Future Product Expansion 6, Low-Priority Polish 8, Accepted No-Action 3

### Review Classes

- Verify Before Promotion 14: Potentially stale accepted debt. Re-run a targeted QA check before promoting it back to implementation work.
- Future Product Expansion 6: Valid enhancement only if the portfolio scope expands into a fuller product surface or longer-lived conversational memory.
- Low-Priority Polish 8: Non-blocking answer, copy, layout, or evidence-label polish. Keep accepted unless it appears in a release-facing regression.
- Accepted No-Action 3: Accepted no-fix item with no current trigger for implementation work.

### Portfolio Deferral

_Accepted as non-blocking portfolio debt to avoid over-engineering._

- [P1] ai-thinking-visualizer-contract-drift: Thinking visualizer production UI contract drift (seen 2회, last QA-20260428-0357)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] analyst-single-server-response-mismatch: Analyst 단일 서버 분석 응답 구조 불일치 수정 (seen 1회, last QA-20260519-0535)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] landing-console-api-system-unauthorized: 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling (seen 1회, last QA-20260330-0195)
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
- [P5] q-new10-pronoun-resolution: 팔로업 대명사 해석 미완 — 그 서버들 = 전체 18대로 확장 (seen 1회, last QA-20260525-0584)
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
- [P3] vision-ui-upload-e2e: Authenticated frontend image-upload UI E2E path (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

## Completed Improvements

- Total: 729 items completed (full list in qa-tracker.json)
- Recently completed:
  - dashboard-alert-feed-card-focus: Inline alert feed clicks focus and highlight the matching server card (last QA-20260528-0630)
  - dashboard-mobile-resource-gauge-wrap: System resource gauges wrap on mobile without horizontal overflow (last QA-20260528-0630)
  - ai-assistant-button-label-visible: AI Assistant button label always-visible change retained and verified (last QA-20260528-0629)
  - p20-trend-rate-ranking-routing: P20 증가율이 가장 높은 서버 질의가 peak 시간대가 아닌 metric_trend 증가폭 랭킹으로 라우팅 (last QA-20260528-0629)
  - p19c-trend-delta-ranking: Trend ranking queries sort by increase delta instead of current value (last QA-20260528-0627)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| QA-20260528-0631 | 2026-05-28T06:15:13.877Z | smoke | yes | no | GitLab production release smoke - v8.12.69 AI routing fixes | 10 | 0 | 0 | 0 | 0 | 0 |
| QA-20260528-0630 | 2026-05-28T04:37:16.133Z | targeted | yes | yes | Vercel Playwright MCP targeted recheck - v8.12.68 dashboard alert-feed focus | 9 | 2 | 0 | 0 | 0 | 0 |
| QA-20260528-0629 | 2026-05-28T01:16:50.267Z | targeted | yes | yes | Vercel Playwright MCP targeted recheck - v8.12.67 P20 trend-rate ranking | 8 | 2 | 0 | 0 | 0 | 0 |
| QA-20260528-0628 | 2026-05-27T23:33:40.324Z | targeted | yes | yes | Chrome DevTools MCP 18차 신규 질문 평가 — v8.12.65 P17/P18/P19a/stable ranking/group compare | 7 | 0 | 0 | 0 | 0 | 0 |
| QA-20260528-0627 | 2026-05-27T22:43:05.057Z | targeted | yes | yes | Vercel Playwright MCP targeted recheck - v8.12.65 P19c/P21 trend filters | 7 | 2 | 0 | 0 | 0 | 0 |
| QA-20260527-0626 | 2026-05-27T13:32:42.014Z | targeted | no | yes | Vercel Playwright MCP targeted recheck - v8.12.62 Q4 stable-server ranking | 5 | 1 | 0 | 0 | 0 | 0 |
| QA-20260527-0625 | 2026-05-27T08:31:25.273Z | targeted | no | yes | Vercel Playwright MCP targeted recheck - v8.12.60 QA-0624 regressions | 6 | 3 | 0 | 0 | 0 | 0 |
| QA-20260527-0624 | 2026-05-27T07:17:17.887Z | targeted | no | yes | Vercel Playwright MCP targeted QA - 2026-05-26..27 modified surfaces only | 16 | 0 | 3 | 0 | 0 | 2 |
| QA-20260527-0623 | 2026-05-27T06:56:44.859Z | smoke | yes | yes | v8.12.59 Release Smoke - Vercel, Cloud Run, and P17 group comparison | 23 | 1 | 0 | 0 | 0 | 0 |
| QA-20260527-0622 | 2026-05-27T05:02:40.316Z | smoke | no | no | Deployment Smoke Recheck - v8.12.58 Vercel and Cloud Run | 15 | 0 | 0 | 0 | 0 | 0 |
| QA-20260527-0621 | 2026-05-27T04:26:21.736Z | targeted | yes | yes | Vercel Playwright QA - v8.12.58 Q3 anomaly scan routing recheck | 5 | 1 | 0 | 0 | 0 | 0 |
| QA-20260527-0620 | 2026-05-27T03:05:16.952Z | targeted | no | yes | AI 어시스턴트 신규 질문 평가 Q-NEW52~Q-NEW57 + P15 재확인 (v8.12.56) | 6 | 0 | 0 | 0 | 0 | 1 |
| QA-20260527-0619 | 2026-05-27T01:08:32.983Z | targeted | yes | yes | Vercel Playwright QA - v8.12.56 Q-NEW46a anomaly clarification bypass recheck | 5 | 1 | 0 | 0 | 0 | 0 |
| QA-20260527-0618 | 2026-05-27T00:02:33.378Z | targeted | yes | yes | Vercel Playwright QA - v8.12.55 Q-NEW48 inverse metric filter recheck | 4 | 1 | 0 | 0 | 0 | 0 |
| QA-20260527-0617 | 2026-05-26T23:41:16.615Z | targeted | yes | yes | Vercel Playwright QA - v8.12.55 Q-NEW51 resource pressure ranking recheck | 4 | 2 | 0 | 0 | 0 | 0 |
| QA-20260527-0616 | 2026-05-26T17:49:46.355Z | targeted | yes | yes | Vercel Playwright QA - v8.12.53 Q-NEW46 Analyst zero-metric regression recheck | 4 | 1 | 0 | 0 | 0 | 0 |
| QA-20260526-0615 | 2026-05-26T14:54:35.345Z | targeted | no | yes | AI 어시스턴트 신규 질문 평가 Q-NEW46~Q-NEW51 (P15/P16 발견) | 7 | 0 | 0 | 0 | 0 | 1 |
| QA-20260526-0614 | 2026-05-26T12:52:44.071Z | release-gate | yes | yes | Vercel Playwright QA - v8.12.51 Release Gate | 12 | 3 | 0 | 0 | 0 | 0 |
| QA-20260526-0613 | 2026-05-26T09:58:33.066Z | targeted | yes | yes | Vercel Playwright QA - P14 group aggregate metric and Cloud Tasks dispatch | 8 | 2 | 0 | 0 | 0 | 0 |
| QA-20260526-0612 | 2026-05-26T08:37:39.090Z | targeted | no | yes | 17차 신규 6문항 평가 — v8.12.48 미테스트 영역 검증 | 6 | 0 | 0 | 0 | 0 | 1 |
