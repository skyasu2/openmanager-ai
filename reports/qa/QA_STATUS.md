# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-06-07 10:13:45 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 668 |
| Total Runs (Counted) | 523 |
| Non-counted Runs | 145 |
| Total Checks | 4655 |
| Passed | 4448 |
| Failed | 162 |
| Completed Items | 778 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 33 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 1 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260607-0669 (2026-06-06T23:59:04.960Z) |
| Latest Recorded Run | QA-20260607-0670 (2026-06-07T01:13:44.615Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260607-0670 (2026-06-07T01:13:44.615Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | appropriate | yes | P28·P29 수정 여부는 Codex 위임 판단. wont-fix 검토 가능. |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| - | - | - | - | - |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-06T01:13:44.615Z -> 2026-06-07T01:13:44.615Z (24h)
- Runs with observations: 5 recorded / 4 counted
- Samples: 16

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | mistral | 3 | 5770ms | 7677ms | - | - | - | - | QA-20260607-0667 |
| CapacityForecast | groq | 1 | 3500ms | 3500ms | - | - | - | - | QA-20260606-0665 |
| llama-4-scout | groq | 1 | 1800ms | 1800ms | - | - | - | - | QA-20260607-0670 |
| Metrics Query Agent | deterministic | 2 | 115ms | 204ms | - | - | - | - | QA-20260607-0667 |
| MetricsQuery | deterministic | 1 | 120ms | 120ms | - | - | - | - | QA-20260606-0665 |
| monitoring-metric-current | deterministic | 5 | 31ms | 35ms | - | - | - | - | QA-20260607-0670 |
| monitoring-server-health | deterministic | 2 | 33ms | 33ms | - | - | - | - | QA-20260607-0670 |
| monitoring-capacity-forecast | deterministic | 1 | 29ms | 29ms | - | - | - | - | QA-20260607-0668 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-06T01:13:44.615Z -> 2026-06-07T01:13:44.615Z (24h)
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
- Deployment: SHA 6a4ace8c
- Coverage Packs: ai-advanced-surface
- Covered Surfaces: Q1/P26 재검증: 메모리 경고 상태인 서버들의 평균 CPU => warning 1대 필터+CPU 85% 집계, 31ms (PASS), Q2/P27 재검증: CPU·메모리·디스크 모두 50% 미만인 서버 몇 대? => 7대 카운트, < operator 보존 (PASS), Q3/Q96 regression: 디스크가 거의 꽉 찬 서버 있어? => monitoring-metric-current disk>=80% 현재 필터 (PASS), Q4/Q97 regression: DB vs cache 경고 상태 서버 더 많은 쪽? => monitoring-server-health, 0 vs 0 명시 (PASS), Q5/Q-NEW100: 스토리지 서버들 중 디스크 사용률 가장 높은 서버? => peak-metric, 그룹 필터 누락, 전체 top-3 반환 (PARTIAL), Q6/Q-NEW101: 전체 서버 평균 메모리 사용률? => 18대 평균 48.2%, OTel 48.23% 일치 (PASS), Q7/Q-NEW102: CPU 경고 상태인 서버들의 평균 디스크 사용률? => CPU→디스크 크로스 메트릭 미처리 (FAIL, 신규 P28), Q8/Q-NEW103: web 서버 그룹의 평균 CPU 사용률? => 3대 평균 28%, OTel (34+34+16)/3=28% 일치 (PASS), Q9/Q-NEW104: 안정적인 서버만 목록 보여줘 => Groq/llama-4-scout, 조건 OK, markdown heading literal P3 wont-fix (PARTIAL), Q10/Q-NEW105: 디스크 기준 상위3+하위3 서버? => metric-ranking, 하위만 반환 상위 누락 (FAIL, 신규 P29), OTel 교차검증: Q6 48.2% 일치, Q8 28% 일치, Q2 7대 조건 일치
- Skipped Surfaces: Analyst 에이전트 심층 분석 테스트 미실시, Reporter 에이전트 보고서 생성 미실시, 멀티턴 컨텍스트 팔로업 미실시

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | Production AI assistant | [Production AI assistant](https://openmanager-ai.vercel.app/dashboard/ai-assistant) | 26차 QA 테스트 대상 페이지 |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-screenshot | 26차 QA Playwright MCP 스크린샷 | `qa-26-q1-p26.png` | - |

## Expert Domain Open Gaps

- ai-quality-assurance: AI Quality Assurance Specialist (last QA-20260607-0670)
  next: P28·P29 수정 여부는 Codex 위임 판단. wont-fix 검토 가능.

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Portfolio Deferral 33
- Review classes: Verify Before Promotion 13, Future Product Expansion 5, Low-Priority Polish 9, Accepted No-Action 6

### Review Classes

- Verify Before Promotion 13: Potentially stale accepted debt. Re-run a targeted QA check before promoting it back to implementation work.
- Future Product Expansion 5: Valid enhancement only if the portfolio scope expands into a fuller product surface or longer-lived conversational memory.
- Low-Priority Polish 9: Non-blocking answer, copy, layout, or evidence-label polish. Keep accepted unless it appears in a release-facing regression.
- Accepted No-Action 6: Accepted no-fix item with no current trigger for implementation work.

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
- [P2] p28-cpu-warning-filter-disk-aggregation: P28: CPU 경고 상태 필터 + 이종 메트릭(디스크) 집계 미처리 (seen 1회, last QA-20260607-0670)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] p29-metric-ranking-top-bottom-dual: P29: metric-ranking 경로 TOP+BOTTOM 동시 질의 미처리 (seen 1회, last QA-20260607-0670)
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
- [P3] q-new100-group-filtered-peak-metric: Q-NEW100: 그룹 필터된 peak metric 쿼리 그룹 필터 누락 (seen 1회, last QA-20260607-0670)
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

- Total: 778 items completed (full list in qa-tracker.json)
- Recently completed:
  - p26-status-filter-cross-metric-aggregation: P26: 상태 필터 후 이종 메트릭 집계 (메모리 경고→CPU) 재검증 PASS (last QA-20260607-0670)
  - p27-and-under-50-percent-filter: P27: 복합 AND 미만 조건(<50%) 서버 카운트 재검증 PASS (last QA-20260607-0670)
  - q96-disk-current-filter: Q96: 디스크 꽉 찬 서버 현재 필터 경로 재검증 PASS (last QA-20260607-0670)
  - q97-warning-count-comparison: Q97: 그룹별 warning 상태 서버 수 비교 재검증 PASS (last QA-20260607-0670)
  - p26-status-filter-cross-metric-aggregate: P26: 상태 필터 + 다른 메트릭 집계 복합 의도 처리 (last QA-20260607-0669)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
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
| QA-20260605-0655 | 2026-06-05T02:01:39.005Z | targeted | yes | yes | Vercel Production Chrome DevTools MCP Fallback - Frontend UI/UX Wiring Polish (v8.12.91) | 14 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0654 | 2026-06-05T01:25:05.069Z | targeted | no | no | Local Dev Chrome DevTools MCP - Frontend UI/UX Wiring Polish Verification | 12 | 1 | 0 | 0 | 0 | 0 |
| QA-20260605-0653 | 2026-06-05T00:34:46.612Z | targeted | yes | yes | Vercel Production Playwright MCP - 2주간 개선 항목 통합 검증 (v8.12.90) | 13 | 6 | 0 | 0 | 0 | 0 |
| QA-20260605-0652 | 2026-06-05T00:05:25.119Z | targeted | no | no | Vercel Production Playwright MCP Recheck - v8.12.90 After GitLab Token Recovery | 13 | 0 | 0 | 0 | 0 | 0 |
| QA-20260605-0651 | 2026-06-04T16:20:31.104Z | targeted | yes | yes | Vercel Production Targeted QA - v8.12.90 Pre-Auth System Preload Fix | 11 | 2 | 0 | 0 | 0 | 0 |
