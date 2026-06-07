# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-06-07 16:40:21 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 673 |
| Total Runs (Counted) | 525 |
| Non-counted Runs | 148 |
| Total Checks | 4667 |
| Passed | 4460 |
| Failed | 162 |
| Completed Items | 786 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 27 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260607-0674 (2026-06-07T05:19:01.995Z) |
| Latest Recorded Run | QA-20260607-0675 (2026-06-07T07:33:22.074Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260607-0675 (2026-06-07T07:33:22.074Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| - | - | - | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| - | - | - | - | - |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-06T07:33:22.074Z -> 2026-06-07T07:33:22.074Z (24h)
- Runs with observations: 9 recorded / 6 counted
- Samples: 26

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | mistral | 3 | 5770ms | 7677ms | - | - | - | - | QA-20260607-0667 |
| CapacityForecast | groq | 1 | 3500ms | 3500ms | - | - | - | - | QA-20260606-0665 |
| llama-4-scout | groq | 2 | 2050ms | 2300ms | - | - | - | - | QA-20260607-0672 |
| monitoring-metric-current | deterministic | 10 | 250ms | 1352ms | - | - | - | - | QA-20260607-0674 |
| monitoring-metric-ranking | deterministic | 2 | 434ms | 838ms | - | - | - | - | QA-20260607-0674 |
| Metrics Query Agent | deterministic | 4 | 79ms | 204ms | - | - | - | - | QA-20260607-0671 |
| MetricsQuery | deterministic | 1 | 120ms | 120ms | - | - | - | - | QA-20260606-0665 |
| monitoring-server-health | deterministic | 2 | 33ms | 33ms | - | - | - | - | QA-20260607-0670 |
| monitoring-capacity-forecast | deterministic | 1 | 29ms | 29ms | - | - | - | - | QA-20260607-0668 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-06T07:33:22.074Z -> 2026-06-07T07:33:22.074Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: no
- Counts Toward Summary: no
- Deployment: SHA c998cc7b
- Covered Surfaces: Q-NEW107: 메모리 상위 3개 서버의 디스크 사용량 → 상위 3대 식별 후 디스크 57%/41%/22% 반환. deterministic/monitoring-metric-current (PASS), Q-NEW108: 가장 안정적인 서버 3대 → 하위 3대 반환. 확인 항목이 안정적 수치 긍정 문구로 교체됨. deterministic/monitoring-metric-ranking (PASS), Q-NEW109: web-nginx-dc1-01과 api-was-dc1-01 CPU·메모리·디스크 비교 → 3개 메트릭 모두 표시. deterministic/monitoring-metric-current (PASS), Q-NEW110: lb 서버들 중 메모리 가장 높은 서버 → peak-metric 전체 서버 상위 반환, lb 그룹 필터 미적용. 신규 P31 발견 (FAIL), Q-NEW111: CPU와 메모리 둘 다 40% 이하인 서버 몇 대 → 7대 정확 반환. 이하 AND 조건 + 카운트. deterministic/monitoring-metric-current (PASS), Q-NEW112: cache 서버들 중 CPU 가장 낮은 서버 → cache-redis-dc1-02 23% 정확. 그룹+MIN 랭킹. deterministic/monitoring-metric-ranking (PASS), Q-NEW113: api-was 서버들 평균 디스크 사용량 → 28.3% 정확. 단일 그룹 집계. deterministic/monitoring-metric-current (PASS)
- Skipped Surfaces: Fix2(numbered-list-accordion-split) 별도 UI 검증 필요 — Codex QA-0674에서 PASS 확인됨

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| - | - | - | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| - | - | - | - |

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

- Total: 786 items completed (full list in qa-tracker.json)
- Recently completed:
  - numbered-list-accordion-split: 번호 목록 아코디언 요약/상세 경계 연속 렌더링 (last QA-20260607-0674)
  - q-new106-ranking-cross-metric: Q-NEW106: 메모리 상위N 서버의 이종 메트릭(디스크) 조회 처리 (last QA-20260607-0674)
  - ranking-min-advice: 최저값 랭킹 응답의 안정 수치 문구 처리 (last QA-20260607-0674)
  - server-comparison-deterministic-path: 서버 1:1 비교 쿼리 deterministic 경로 보장 (last QA-20260607-0674)
  - summary-block-markdown-heading-hr-code-fence: 핵심 요약 스트리밍 블록 마크다운 delimiter literal 제거 (last QA-20260607-0674)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
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
| QA-20260605-0657 | 2026-06-05T06:56:30.699Z | targeted | yes | yes | Vercel Production Playwright MCP - Artifact Intent BFF Release QA (v8.12.92) | 20 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0656 | 2026-06-05T03:33:51.856Z | targeted | yes | yes | Vercel Production Playwright MCP - Recent Two-Week Improvements Applied Recheck (v8.12.91) | 13 | 1 | 0 | 0 | 0 | 0 |
