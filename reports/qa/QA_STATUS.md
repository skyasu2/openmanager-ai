# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-05-30 22:45:32 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 645 |
| Total Runs (Counted) | 504 |
| Non-counted Runs | 141 |
| Total Checks | 4431 |
| Passed | 4230 |
| Failed | 159 |
| Completed Items | 741 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 31 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260530-0647 (2026-05-30T13:45:31.747Z) |
| Latest Recorded Run | QA-20260530-0647 (2026-05-30T13:45:31.747Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260530-0647 (2026-05-30T13:45:31.747Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| DevOps / SRE Engineer | appropriate | no | - |
| Test Automation Architect | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Current Vercel billing period reviewed after v8.12.87 production release smoke; effective 19.8825 USD, billed 0.0000 USD, chargeCount 17661. |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-29T13:45:31.747Z -> 2026-05-30T13:45:31.747Z (24h)
- Runs with observations: 1 recorded / 1 counted
- Samples: 1

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | cloud run ai | 1 | 11376ms | 11376ms | - | - | 11376ms | 11376ms | QA-20260530-0646 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-29T13:45:31.747Z -> 2026-05-30T13:45:31.747Z (24h)
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
- Deployment: dpl_JD28Eo72pCqgfRMP6qPEJ6M8pBzf / SHA ed19d759
- Coverage Packs: core-routes-smoke, observability-pack
- Covered Surfaces: GitLab tag pipeline v8.12.87 completed successfully with frontend deploy, AI Engine deploy, frontend post-deploy smoke, and AI Engine post-deploy smoke, GitLab release deploy jobs ran with overlap_detected after runner concurrent/request_concurrency was raised to 2, Production release script smoke verified GET /, GET /login, and GET /api/version for version 8.12.87, Production /api/version returned release tag v8.12.87 and commit ed19d759578fb5cc4ca0afeed65068f1b5dcf80c, Vercel production deployment dpl_JD28Eo72pCqgfRMP6qPEJ6M8pBzf was Ready for alias https://openmanager-ai.vercel.app, Cloud Run /health returned status ok and version 8.12.87, Cloud Run monitoring endpoint returned 403 without auth as expected, Cloud Run revision ai-engine-00590-s2t is serving 100% traffic, Cloud Run runtime limits remain cpu=1 and memory=512Mi, Vercel usage check passed with billed 0.0000 USD
- Skipped Surfaces: Broad browser matrix was not rerun because this was a release deployment smoke focused on CI topology, version propagation, health, and smoke closure, Production conversational AI QA was not rerun because this release did not change AI prompt routing, stream contracts, model/provider policy, tool schemas, response formatting, or Vision routing, Vision real-image QA was not in scope because this release did not change Vision routing or provider behavior

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | Cloud Run service URL | [Cloud Run service URL](https://ai-engine-jdhrhws7ia-an.a.run.app/) | - |
| general | GitLab tag pipeline v8.12.87 | [GitLab tag pipeline v8.12.87](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2563996427) | - |
| general | Production URL | [Production URL](https://openmanager-ai.vercel.app/) | - |
| vercel-deployment | Vercel production deployment | [Vercel production deployment](https://openmanager-4hgyfqlcr-skyasus-projects.vercel.app/) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-report | v8.12.87 release parallel deploy smoke evidence | `reports/qa/evidence/qa-20260530-v81287-release-parallel-smoke.md` | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Portfolio Deferral 31
- Review classes: Verify Before Promotion 14, Future Product Expansion 5, Low-Priority Polish 8, Accepted No-Action 4

### Review Classes

- Verify Before Promotion 14: Potentially stale accepted debt. Re-run a targeted QA check before promoting it back to implementation work.
- Future Product Expansion 5: Valid enhancement only if the portfolio scope expands into a fuller product surface or longer-lived conversational memory.
- Low-Priority Polish 8: Non-blocking answer, copy, layout, or evidence-label polish. Keep accepted unless it appears in a release-facing regression.
- Accepted No-Action 4: Accepted no-fix item with no current trigger for implementation work.

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

- Total: 741 items completed (full list in qa-tracker.json)
- Recently completed:
  - release-parallel-deploy-v81287-production-smoke: v8.12.87 release deployed with frontend and AI Engine deploy overlap (last QA-20260530-0647)
  - analyst-latency-evidence-prefetch: Analyst RCA first-step latency reduction via deterministic all-server anomaly evidence prefetch (last QA-20260530-0646)
  - analyst-prefetch-internal-name-redaction: Analyst prefetch prompt no longer leaks internal tool/function names into user-visible RCA answers (last QA-20260530-0646)
  - ai-disk-threshold-conditional-count: 디스크 임계값 조건부 카운트 질의 정확 처리 (신규 강점) (last QA-20260530-0645)
  - p24-all-scope-average-memory-variant-verify: all-scope 평균 라우팅 메모리 변형 production 검증 (last QA-20260530-0645)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| QA-20260530-0647 | 2026-05-30T13:45:31.747Z | targeted | yes | yes | Vercel Release Smoke - v8.12.87 Parallel Deploy Verification | 10 | 1 | 0 | 0 | 0 | 0 |
| QA-20260530-0646 | 2026-05-30T08:57:48.785Z | targeted | yes | yes | Vercel production Analyst prefetch QA - v8.12.84 internal prompt redaction | 5 | 2 | 0 | 0 | 0 | 0 |
| QA-20260530-0645 | 2026-05-30T00:20:52.444Z | targeted | no | yes | Vercel Playwright MCP 신규 질문 평가 - v8.12.79 (all-scope 평균/조건부 카운트/가정형 영향분석) | 3 | 2 | 0 | 0 | 1 | 1 |
| QA-20260530-0644 | 2026-05-29T17:45:34.038Z | smoke | yes | no | GitLab production release smoke - v8.12.79 P24 all-scope average routing | 22 | 1 | 0 | 0 | 0 | 0 |
| QA-20260530-0643 | 2026-05-29T15:28:02.565Z | smoke | yes | no | GitLab production release smoke - v8.12.78 current main deployment | 20 | 0 | 0 | 0 | 0 | 0 |
| QA-20260529-0642 | 2026-05-29T13:55:43.521Z | targeted | no | no | QA metadata correction - close superseded Q5 pronoun-resolution item | 1 | 1 | 0 | 0 | 0 | 0 |
| QA-20260529-0641 | 2026-05-29T12:50:47.147Z | targeted | yes | yes | Vercel Playwright MCP - Q5 컨텍스트 팔로업 라벨 명확화 검증 (ai-engine-00583) | 3 | 2 | 0 | 0 | 0 | 0 |
| QA-20260529-0640 | 2026-05-29T10:28:51.014Z | targeted | yes | yes | Vercel Playwright MCP 대화형 AI QA - 표준 5문항 점검 (v8.12.77) | 5 | 0 | 0 | 0 | 1 | 0 |
| QA-20260529-0639 | 2026-05-29T03:17:33.247Z | smoke | yes | no | GitLab production release smoke - v8.12.77 landing mouse spotlight motion | 16 | 0 | 0 | 0 | 0 | 0 |
| QA-20260529-0638 | 2026-05-28T18:22:11.038Z | smoke | yes | no | v8.12.76 GitLab Release Smoke - AI Engine Cloud Build Recovery | 15 | 1 | 0 | 0 | 0 | 0 |
| QA-20260528-0637 | 2026-05-28T13:35:35.677Z | smoke | yes | no | GitLab production release smoke - v8.12.74 AI Engine shared utils refactor | 14 | 0 | 0 | 0 | 0 | 0 |
| QA-20260528-0636 | 2026-05-28T10:42:22.198Z | targeted | yes | yes | Vercel production stream QA - v8.12.73 Q-NEW76 metric risk compare omitted noun | 15 | 1 | 0 | 0 | 0 | 0 |
| QA-20260528-0635 | 2026-05-28T09:20:18.560Z | targeted | no | no | Cloud Run production residual recheck - v8.12.72 P20 trend-rate ranking | 5 | 0 | 0 | 0 | 0 | 0 |
| QA-20260528-0634 | 2026-05-28T09:01:00.708Z | targeted | yes | yes | Vercel production stream QA - v8.12.72 Q-NEW72 metric risk compare | 13 | 1 | 0 | 0 | 0 | 0 |
| QA-20260528-0633 | 2026-05-28T08:02:28.899Z | smoke | yes | no | GitLab production release smoke - v8.12.71 Q-NEW72 metric risk compare | 10 | 0 | 0 | 0 | 0 | 0 |
| QA-20260528-0632 | 2026-05-28T07:05:27.882Z | smoke | yes | no | GitLab production release smoke - v8.12.70 P23 metric ranking fix | 10 | 0 | 0 | 0 | 0 | 0 |
| QA-20260528-0631 | 2026-05-28T06:15:13.877Z | smoke | yes | no | GitLab production release smoke - v8.12.69 AI routing fixes | 10 | 0 | 0 | 0 | 0 | 0 |
| QA-20260528-0630 | 2026-05-28T04:37:16.133Z | targeted | yes | yes | Vercel Playwright MCP targeted recheck - v8.12.68 dashboard alert-feed focus | 9 | 2 | 0 | 0 | 0 | 0 |
| QA-20260528-0629 | 2026-05-28T01:16:50.267Z | targeted | yes | yes | Vercel Playwright MCP targeted recheck - v8.12.67 P20 trend-rate ranking | 8 | 2 | 0 | 0 | 0 | 0 |
| QA-20260528-0628 | 2026-05-27T23:33:40.324Z | targeted | yes | yes | Chrome DevTools MCP 18차 신규 질문 평가 — v8.12.65 P17/P18/P19a/stable ranking/group compare | 7 | 0 | 0 | 0 | 0 | 0 |
