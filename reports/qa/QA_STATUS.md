# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-05-27 16:17:19 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 622 |
| Total Runs (Counted) | 491 |
| Non-counted Runs | 131 |
| Total Checks | 4335 |
| Passed | 4137 |
| Failed | 159 |
| Completed Items | 719 |
| Pending Items | 3 |
| Deferred Items | 0 |
| Wont-Fix Items | 31 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 2 |
| Completion Rate | 99.58% |
| Last Counted Run | QA-20260527-0624 (2026-05-27T07:17:17.887Z) |
| Latest Recorded Run | QA-20260527-0624 (2026-05-27T07:17:17.887Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260527-0624 (2026-05-27T07:17:17.887Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | partially-appropriate | yes | Fix Q-NEW48 directional route preservation and P13 multi-metric metric selection, then rerun the two failed prompts on Vercel. |
| IT Monitoring & Observability SME | partially-appropriate | yes | Enable Web Analytics for the Vercel project or gate/remove Analytics import until /_vercel/insights/script.js is served. |
| Test Automation Architect | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Vercel usage checked after targeted Playwright MCP QA; effective usage 17.9292 USD, billed 0.0000 USD, no billed overage observed. |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-26T07:17:17.887Z -> 2026-05-27T07:17:17.887Z (24h)
- Runs with observations: 10 recorded / 10 counted
- Samples: 21

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | cloud-run-ai | 7 | 11600ms | 20000ms | - | - | - | - | QA-20260527-0620 |
| Metrics Query Agent | cloud-run-ai | 11 | 1708ms | 5900ms | - | - | 1692ms | 2545ms | QA-20260527-0620 |
| Analyst Agent | streaming-ai | 1 | 3000ms | 3000ms | - | - | - | - | QA-20260527-0621 |
| Metrics Query Agent | streaming-ai | 1 | 1487ms | 1487ms | - | - | 1487ms | 1487ms | QA-20260526-0611 |
| Metrics Query | deterministic-monitoring | 1 | 1097ms | 1097ms | 1097ms | 1097ms | 1097ms | 1097ms | QA-20260526-0613 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-26T07:17:17.887Z -> 2026-05-27T07:17:17.887Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: no
- Counts Toward Summary: yes
- Deployment: dpl_LrHxeU8siSzXj8LAZeCfJ5b8cpW1 / SHA c017a2b7
- Coverage Packs: core-routes-smoke, dashboard-core, ai-core, observability-pack
- Covered Surfaces: Landing production version badge v8.12.59 - PASS, Vercel Analytics script after reactivation - FAIL /_vercel/insights/script.js 404 and MIME console error, Vercel Speed Insights vitals after reactivation - PASS /_vercel/speed-insights/vitals 200, Dashboard Host Map tab render - PASS Hexagonal host map with 8 nodes, Host Map node click - PASS api-was-dc1-01 navigated to /dashboard/servers/api-was-dc1-01, Server detail route after Host Map click - PASS Application · DC1-AZ1 and tabs rendered, Server detail tab switch - PASS 성능 분석 and 로그 & 네트워크, /api/version from browser context - PASS 8.12.59 and commit c017a2b7f60d348b72433f5ed327630e67940206, /api/health from browser context - PASS 200, Deleted root /api/servers route - PASS direct fetch returned 404 and dashboard did not call root /api/servers, P17 api vs web CPU group comparison - PASS application 41.7% vs web 25.3%, Q3/Q-NEW46a anomaly scan wording - PASS no clarification, full fleet anomaly summary returned, Q-NEW48 CPU low + memory high directional filter - FAIL returned generic health summary using monitoring-server-health, P14 db-mysql average memory - PASS average 55.3% with three DB servers, P10 backup disk filter - PASS only db-mysql-dc1-backup returned with DISK 65%, P13 api-was-dc1-01 CPU+memory multi-metric query - FAIL returned CPU only and omitted memory
- Skipped Surfaces: Full broad route pack - skipped by user request to test only yesterday/today modified areas, Vision live image QA - skipped; no Vision routing/provider change in the selected commits, Reporter advanced flow - skipped; no reporter UI flow change in the selected commits, Cloud Run admin /monitoring and /monitoring/traces - skipped; selected Vercel Playwright scope was frontend/UI and AI sidebar behavior

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | Current production version API | [Current production version API](https://openmanager-ai.vercel.app/api/version) | Returned v8.12.59 and c017a2b7f60d348b72433f5ed327630e67940206 |
| vercel-deployment | Vercel production deployment dpl_LrHxeU8siSzXj8LAZeCfJ5b8cpW1 | [Vercel production deployment dpl_LrHxeU8siSzXj8LAZeCfJ5b8cpW1](https://openmanager-r0t2d1f4i-skyasus-projects.vercel.app/) | Production deployment tested through openmanager-ai.vercel.app |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-console | Targeted Playwright MCP modified-surface evidence | `reports/qa/evidence/2026/qa-20260527-0624/qa-20260527-targeted-playwright-modified-surfaces.txt` | - |

## Expert Domain Open Gaps

- ai-quality-assurance: AI Quality Assurance Specialist (last QA-20260527-0624)
  next: Fix Q-NEW48 directional route preservation and P13 multi-metric metric selection, then rerun the two failed prompts on Vercel.
- observability-monitoring: IT Monitoring & Observability SME (last QA-20260527-0624)
  next: Enable Web Analytics for the Vercel project or gate/remove Analytics import until /_vercel/insights/script.js is served.

## Pending Improvements

- [P1] q-new34-p13-single-server-multi-metric-regression: P13/Q-NEW34 single-server CPU+memory query returns both requested metrics (seen 1회, last QA-20260527-0624)
- [P1] q-new48-inverse-directional-metric-filter: Q-NEW48 CPU 낮고 메모리 높은 역상관 복합 조건 필터 (seen 2회, last QA-20260527-0624)
- [P1] vercel-analytics-script-404: Vercel Web Analytics script loads without production console errors (seen 1회, last QA-20260527-0624)

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

- Total: 719 items completed (full list in qa-tracker.json)
- Recently completed:
  - q-new54-api-vs-web-cross-group-comparison: Q-NEW54/P17 api-vs-web CPU cross-group comparison returns both group averages (last QA-20260527-0623)
  - q3-anomaly-scan-wording-analyst-routing: Q3 전체 서버 이상징후 스캔 프롬프트가 anomaly evidence path로 실행 (last QA-20260527-0621)
  - q-new46a-generic-anomaly-scan-clarification-bypass: Q-NEW46a 이상 징후 분석 프롬프트가 clarification 없이 전체 anomaly scan으로 실행 (last QA-20260527-0619)
  - q-new51-evidence-label-provider-alignment: Q-NEW51 evidence trace label uses validated provider capability (last QA-20260527-0617)
  - q-new51-resource-pressure-ranking-current-path: Q-NEW51 리소스 압박 순위가 현재 metric-ranking 경로로 응답 (last QA-20260527-0617)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
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
| QA-20260526-0611 | 2026-05-26T08:11:39.764Z | release-gate | yes | yes | v8.12.48 Vercel production Playwright MCP release smoke | 16 | 0 | 0 | 0 | 0 | 0 |
| QA-20260526-0610 | 2026-05-26T05:33:38.310Z | targeted | no | yes | P10 production Playwright recheck — backup group filter | 6 | 0 | 0 | 0 | 0 | 0 |
| QA-20260526-0609 | 2026-05-26T05:23:27.822Z | targeted | no | yes | P10 수정 확인 — v8.12.47 backup 그룹 서버 필터 (단위 테스트 검증) | 3 | 0 | 0 | 0 | 0 | 0 |
| QA-20260526-0608 | 2026-05-26T04:01:53.841Z | targeted | no | no | Codex 직접 재검증 — v8.12.46 P4/P13 AI Assistant fixes | 2 | 0 | 0 | 0 | 0 | 0 |
| QA-20260526-0607 | 2026-05-26T03:34:11.537Z | targeted | no | yes | P4 수정 확인 — v8.12.46 원인/RCA 쿼리 Analyst 경로 라우팅 (Q-NEW38 재검증) | 1 | 0 | 0 | 0 | 0 | 0 |
| QA-20260526-0606 | 2026-05-26T02:18:46.663Z | targeted | no | yes | P13 수정 확인 — v8.12.45 서버 1:1 다중 메트릭 비교 (Q-NEW34 재검증) | 1 | 0 | 0 | 0 | 0 | 0 |
| QA-20260526-0605 | 2026-05-26T01:24:48.297Z | targeted | no | yes | 14차 AI 어시스턴트 평가 + Host Map UX Phase 6 배포 점검 (Q-NEW34~39) | 9 | 0 | 0 | 0 | 0 | 1 |
