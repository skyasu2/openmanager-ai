# QA Status Dashboard

> Auto-generated file. Edit `qa-tracker.json` or use `npm run qa:record`.
> Generated at: 2026-05-25 09:41:34 KST

## Summary

| Metric | Value |
|---|---:|
| Total Recorded Runs | 585 |
| Total Runs (Counted) | 468 |
| Non-counted Runs | 117 |
| Total Checks | 4173 |
| Passed | 3994 |
| Failed | 152 |
| Completed Items | 669 |
| Pending Items | 0 |
| Deferred Items | 0 |
| Wont-Fix Items | 50 |
| Expert Domains Tracked | 21 |
| Expert Open Gaps | 0 |
| Completion Rate | 100% |
| Last Counted Run | QA-20260525-0587 (2026-05-25T00:41:31.507Z) |
| Latest Recorded Run | QA-20260525-0587 (2026-05-25T00:41:31.507Z) |
| Summary Rule | `countsTowardSummary !== false` 인 run만 Counted 집계에 반영 |

## Active Gate Warnings

- None

## Historical Trend Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Expert Domain Assessment (Latest Run)

Latest run: QA-20260525-0587 (2026-05-25T00:41:31.507Z)

| Domain | Fit | Improvement Needed | Next Action |
|---|---|---|---|
| AI Quality Assurance Specialist | appropriate | no | - |
| Data Quality & Metrics Analyst | appropriate | no | - |
| DevOps / SRE Engineer | appropriate | no | - |

## Usage Checks (Latest Run)

| Platform | Method | Collection | Result | Summary |
|---|---|---|---|---|
| vercel | cli | checked | normal | Current billing period 2026-05-01T07:00:00Z..2026-05-25T00:40:13Z: effective=15.9631 USD, billed=0.0000 USD. No unexpected billed usage. |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-24T00:41:31.507Z -> 2026-05-25T00:41:31.507Z (24h)
- Runs with observations: 4 recorded / 4 counted
- Samples: 6

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Server Health Summary | streaming | 2 | 2711ms | 3482ms | - | - | - | - | QA-20260524-0575 |
| Metrics Query Agent | streaming | 2 | 2157ms | 3315ms | - | - | - | - | QA-20260524-0576 |
| Advisor Agent | streaming | 1 | 2018ms | 2018ms | - | - | - | - | QA-20260524-0574 |
| Metrics Query Agent | deterministic | 1 | 60ms | 60ms | - | - | 60ms | 60ms | QA-20260525-0586 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-24T00:41:31.507Z -> 2026-05-25T00:41:31.507Z (24h)
- Runs with observations: 3 recorded / 3 counted
- Samples: 9
- Drift rate: 11.11%

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| /api/ai/supervisor/stream/v2 | deterministic | 8 | 0% | 8ms | 60ms | QA-20260525-0586 |
| /api/ai/supervisor/stream/v2 | single-agent | 1 | 100% | 0ms | 0ms | QA-20260524-0579 |

## Coverage (Latest Run)

- Scope: targeted
- Release-Facing: yes
- Counts Toward Summary: yes
- Deployment: dpl_7Wbtupu75cp3QzUM6QoY2h4kLp4k / SHA f194ec74
- Coverage Packs: ai-core, observability-pack
- Covered Surfaces: /, /dashboard, AI sidebar conversational query, Q-NEW13 fix verification: 'db-mysql-dc1-primary 서버 디스크 사용량이 높은데 성능 개선 조언 해줘' displays Advisor Agent command evidence, Cloud Run ai-engine health and protected /monitoring endpoint, Vercel production version and deployment alias
- Skipped Surfaces: full standard five-question conversational AI QA, vision agent, reporter/analyst tabs, core route broad smoke, Cloud Run admin /monitoring authenticated data view

## Links (Latest Run)

| Type | Label | URL | Note |
|---|---|---|---|
| general | Cloud Run ai-engine | [Cloud Run ai-engine](https://ai-engine-jdhrhws7ia-an.a.run.app/) | - |
| general | GitLab Pipeline v8.12.33 | [GitLab Pipeline v8.12.33](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2549850530) | - |
| general | GitLab Pipeline v8.12.34 | [GitLab Pipeline v8.12.34](https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2549885486) | - |
| general | Vercel Production | [Vercel Production](https://openmanager-ai.vercel.app/) | - |
| vercel-deployment | Vercel Deployment v8.12.34 | [Vercel Deployment v8.12.34](https://openmanager-cigd3x1r7-skyasus-projects.vercel.app/) | - |

## Artifacts (Latest Run)

| Type | Label | Location | Viewer |
|---|---|---|---|
| playwright-screenshot | Q-NEW13 advisor command evidence pass | `reports/qa/evidence/2026/qa-20260525-0587/qa-20260525-q-new13-v81234-advisor-pass.png` | - |

## Expert Domain Open Gaps

- None

## Pending Improvements

- None

## Deferred Improvements

- None

## Wont-Fix Improvements

- Reason categories: Platform Constraint 1, Free Tier Tradeoff 3, Historical Obsolete 7, Portfolio Deferral 39

### Platform Constraint

_Accepted because the hosting platform or provider boundary constrains the behavior._

- [P1] ai-server-timing-header-production: Server-Timing header visibility in production (seen 2회, last QA-20260310-0081)
  - note: 플랫폼 제약으로 인한 비차단 항목: Vercel production에서는 Server-Timing 대신 X-AI-Latency-Ms를 운영 SSOT로 사용

### Free Tier Tradeoff

_Accepted to preserve the free-tier production shape instead of increasing deployed resources._

- [P2] ai-cold-start-latency: Cloud Run cold start 레이턴시 최적화 (seen 2회, last QA-20260327-0193)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] cloud-run-cold-start-latency: Cloud Run AI Chat 콜드스타트 대기시간 과도 (5회 재시도, ~5분) (seen 1회, last QA-20260310-0089)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (요청자 표시(isBlocking=true)로 즉시 개선 필요)
- [P2] streaming-ai-fallback-cold-start: Streaming AI fallback에서 Cloud Run 콜드스타트 시 프리셋 질문 실패 (seen 1회, last QA-20260310-0090)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (요청자 표시(isBlocking=true)로 즉시 개선 필요)

### Historical Obsolete

_Accepted because the item is historical, legacy, or superseded by current QA/CI gates._

- [P2] feature-dod-ai-engine-tests: AI Engine targeted and full tests (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] feature-dod-ai-engine-typecheck: AI Engine type-check (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] feature-dod-root-contract: Root API contract tests (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] feature-dod-tsc-zero-error: tsc --noEmit 0 에러 (seen 9회, last QA-20260307-0053)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] feature-dod-unit-tests: 단위 테스트 158개 통과 (seen 9회, last QA-20260307-0053)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] vision-legacy-json-route-fallback: legacy JSON supervisor image path fallback 원인 확인 (seen 1회, last QA-20260421-0322)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] ai-provider-copy-policy-drift: Frontend AI provider and architecture copy must reflect current routing policy (seen 1회, last QA-20260404-0222)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

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
- [P1] obs-fp-fn-weekly-report: 오탐/미탐 주간 리포트 자동 생성 (seen 3회, last QA-20260227-0013)
  - note: 포트폴리오 운영성 우선 규칙: 실운영 오탐/미탐 주간 자동 리포트는 데모/포트폴리오 범위 밖의 운영 프로세스 자동화이므로 WONT-FIX 유지
- [P1] playwright-mcp-native-session-reload: Current Codex session native Playwright MCP namespace remains closed until config reload (seen 1회, last QA-20260523-0571)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P1] server-comparison-deterministic-path: 서버 1:1 비교 쿼리 deterministic 경로 미확립 (seen 1회, last QA-20260522-0559)
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
- [P2] ai-sidebar-answer-details-default-visibility: AI sidebar should show actionable response details inline by default when analysis metadata exists (seen 1회, last QA-20260430-0374)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] ai-streaming-ui-improvement-s1-s3: AI streaming UI improvements (seen 1회, last QA-20260503-0397)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] analyst-domain-context-injection: 심층 분석 시 서버 도메인 특성 미주입 (seen 1회, last QA-20260522-0559)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] analyst-drilldown: Analyst 서버별 드릴다운 (seen 1회, last QA-20260301-0030)
  - note: 이 항목은 즉시 개선 우선순위가 낮아 과도 개선 방지 규칙으로 자동 WONT-FIX 처리: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리 (기본 규칙(P2 기본 비차단) 적용)
- [P2] analyst-trend-formatting-and-issue-ranking-polish: Analyst trend target formatting and issue ranking need polish (seen 1회, last QA-20260427-0352)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] anomaly-artifact-card-missing: 이상감지 분석 아티팩트 카드 미렌더링 (seen 2회, last QA-20260523-0568)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] api-system-abort-race-condition: /api/system ERR_ABORTED 경쟁상태 해결 (seen 1회, last QA-20260519-0535)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] capacity-forecast-evidence-routing: monitoringCapacityForecastEvidenceProvider 라우팅 미트리거 (seen 1회, last QA-20260522-0558)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] landing-tech-stack-version-copy-drift: 기술 스택 모달 상세/아키텍처 간 버전 카피 정합성 정리 (seen 1회, last QA-20260330-0195)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] mobile-header-density: Review dashboard mobile header density around AI CTA and profile cluster (seen 1회, last QA-20260418-0303)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] nlq-provider-ministral3b-candidate-v811157: Evaluate Mistral ministral-3b as front NLQ primary or fallback after schema compatibility fix (seen 1회, last QA-20260516-0507)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] peak-metric-response-content: monitoringPeakMetricEvidenceProvider 응답 내용 부실 (seen 1회, last QA-20260522-0558)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] production-login-console-init-error: production login/assistant chunk init console error triage (seen 1회, last QA-20260421-0322)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P5] q-new10-pronoun-resolution: 팔로업 대명사 해석 미완 — 그 서버들 = 전체 18대로 확장 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P4] q-new8-advisor-routing: P4 재확인: 특정 서버 성능 개선 조언 시 Advisor 대신 AZ 라우팅 오발동 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] release-dod-gitlab-tag-pipeline: GitLab v8.11.184 tag pipeline (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] release-dod-production-version: Vercel and Cloud Run production version (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P2] vision-gemini-exact-forecast-delta-attribution: Gemini Vision misattributes exact forecast delta values in the screenshot (seen 1회, last QA-20260520-0542)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] action-needed-transient-500-observation: One transient 500 on standard question 4 before immediate retry success (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] embedded-ai-tab-copy-scope: /dashboard/ai-assistant embedded tabs still show older generic subtitles (seen 1회, last QA-20260523-0569)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] numbered-list-accordion-split: 번호 목록이 핵심 요약/상세 분석 아코디언 경계에서 분리됨 (seen 1회, last QA-20260524-0579)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] planner-shadow-local-decision-drift: Planner shadow still reports local_decision_missing for deterministic monitoring evidence (seen 1회, last QA-20260522-0556)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new11-location-clarification: DC1-AZ1/AZ2 명시에도 clarification 불필요 발동 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] q-new12-network-metric-disclosure: 네트워크 I/O 미보유 시 데이터 부재 미명시 폴백 (seen 1회, last QA-20260525-0584)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] ranking-min-advice: 최저값 랭킹 응답에도 경고성 확인 항목이 표시됨 (seen 1회, last QA-20260524-0579)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] reporter-dashboard-threshold-unification: Reporter 영향 서버 기준 대시보드와 불일치 (seen 1회, last QA-20260522-0559)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.
- [P3] vision-ui-upload-e2e: Authenticated frontend image-upload UI E2E path (seen 1회, last QA-20260519-0538)
  - note: 포트폴리오 운영성 우선 규칙: 비차단 항목은 과도한 개선을 방지하기 위해 WONT-FIX 처리합니다.

## Completed Improvements

- 게스트-pin-로그인-후-시스템-시작-버튼-노출: 게스트 PIN 로그인 후 시스템 시작 버튼 노출 (completed 1회, last QA-20260227-0010)
- 계약-테스트-20-tests-pass: 계약 테스트 20 tests PASS (completed 1회, last QA-20260301-0032)
- 단위-테스트-123-files-1698-tests-pass: 단위 테스트 123 files 1698 tests PASS (completed 1회, last QA-20260301-0032)
- 대시보드-15서버-렌더링-13-온라인-1-경고-1-위험: 대시보드 15서버 렌더링 (13 온라인, 1 경고, 1 위험) (completed 1회, last QA-20260302-0042)
- 대시보드-15서버-렌더링-13-온라인-2-경고: 대시보드 15서버 렌더링 (13 온라인, 2 경고) (completed 1회, last QA-20260302-0040)
- 대시보드-15서버-렌더링-14-온라인-1-경고: 대시보드 15서버 렌더링 (14 온라인, 1 경고) (completed 1회, last QA-20260302-0041)
- 랜딩-페이지-v8.7.2-로드-및-게스트-자동-로그인-정상: 랜딩 페이지 v8.7.2 로드 및 게스트 자동 로그인 정상 (completed 2회, last QA-20260302-0041)
- 랜딩-페이지-v8.7.3-로드-및-게스트-자동-로그인-정상: 랜딩 페이지 v8.7.3 로드 및 게스트 자동 로그인 정상 (completed 1회, last QA-20260302-0042)
- 로그인-정책-카피-정합성: 로그인 정책 카피 정합성 (completed 1회, last QA-20260227-0010)
- 로드밸런서-그룹-최초-검증-lb-haproxy-3대-메모리-현황: 로드밸런서 그룹 최초 검증: lb-haproxy 3대 메모리 현황 (completed 1회, last QA-20260523-0568)
- 리소스-경고-top-5-api-was-dc1-01-cpu-91-1위: 리소스 경고 Top 5 (api-was-dc1-01 CPU 91% 1위) (completed 1회, last QA-20260302-0042)
- 리소스-경고-top-5-db-mysql-dc1-primary-disk-82-1위: 리소스 경고 Top 5 (db-mysql-dc1-primary DISK 82% 1위) (completed 1회, last QA-20260302-0041)
- 리소스-경고-top-5-db-mysql-dc1-primary-mem-89-1위: 리소스 경고 Top 5 (db-mysql-dc1-primary MEM 89% 1위) (completed 1회, last QA-20260302-0040)
- 모달-esc-닫기-정상-동작: 모달 ESC 닫기 정상 동작 (completed 3회, last QA-20260302-0042)
- 문서-인프라-점검-완료: 문서 인프라 점검 완료 (completed 1회, last QA-20260301-0032)
- 보안-테스트-62-tests-pass: 보안 테스트 62 tests PASS (completed 1회, last QA-20260301-0032)
- 보안-헤더-production-확인: 보안 헤더 Production 확인 (completed 1회, last QA-20260301-0032)
- 비로그인-시스템-시작-가드-모달-동작: 비로그인 시스템 시작 가드 모달 동작 (completed 1회, last QA-20260227-0010)
- 비로그인-시스템-시작-버튼-노출-유지: 비로그인 사용자 시스템 시작 버튼 노출 유지 (completed 2회, last QA-20260227-0020)
- 비로그인-시스템-시작-클릭-로그인-모달: 비로그인 사용자 시스템 시작 클릭 시 로그인 모달 경유 (completed 2회, last QA-20260227-0020)
- 상태-필터-온라인-13경고-1위험-1오프라인-0: 상태 필터 (온라인 13/경고 1/위험 1/오프라인 0) (completed 1회, last QA-20260302-0042)
- 상태-필터-온라인-13경고-2위험-0오프라인-0: 상태 필터 (온라인 13/경고 2/위험 0/오프라인 0) (completed 1회, last QA-20260302-0040)
- 상태-필터-온라인-14경고-1위험-0오프라인-0: 상태 필터 (온라인 14/경고 1/위험 0/오프라인 0) (completed 1회, last QA-20260302-0041)
- 서버-모달-3탭-전환: 서버 모달 3탭 전환 (completed 1회, last QA-20260317-0114)
- 서버-모달-로그-네트워크-탭-syslogalertsstreams-네트워크-상태: 서버 모달 로그 & 네트워크 탭 (Syslog/Alerts/Streams, 네트워크 상태) (completed 1회, last QA-20260302-0040)
- 서버-모달-로그-네트워크-탭-syslogalertsstreams-필터-네트워크-양호-1gbps-연결-정보: 서버 모달 로그 & 네트워크 탭 (Syslog/Alerts/Streams 필터, 네트워크 양호 1Gbps, 연결 정보) (completed 2회, last QA-20260302-0042)
- 서버-모달-성능-분석-탭-실시간-차트-분석-뷰-이상탐지: 서버 모달 성능 분석 탭 (실시간 차트 + 분석 뷰 + 이상탐지) (completed 1회, last QA-20260302-0040)
- 서버-모달-성능-분석-탭-cpumemorydisknetwork-실시간-차트-서비스-mysql3306-exporter9104: 서버 모달 성능 분석 탭 (CPU/Memory/Disk/Network 실시간 차트, 서비스 MySQL:3306 + Exporter:9104) (completed 1회, last QA-20260302-0041)
- 서버-모달-성능-분석-탭-cpumemorydisknetwork-실시간-차트-서비스-node.js3000-pm29615: 서버 모달 성능 분석 탭 (CPU/Memory/Disk/Network 실시간 차트, 서비스 Node.js:3000 + PM2:9615) (completed 1회, last QA-20260302-0042)
- 서버-모달-종합-상황-탭-cpu-68-memory-78-disk-82-주의-mysqlexporter-정상: 서버 모달 종합 상황 탭 (CPU 68%, Memory 78%, Disk 82% 주의, MySQL/Exporter 정상) (completed 1회, last QA-20260302-0041)
- 서버-모달-종합-상황-탭-cpu-91-위험-memory-86-주의-disk-34-정상-서비스-22-정상: 서버 모달 종합 상황 탭 (CPU 91% 위험, Memory 86% 주의, Disk 34% 정상, 서비스 2/2 정상) (completed 1회, last QA-20260302-0042)
- 서버-모달-종합-상황-탭-cpumemorydisk서비스시스템정보: 서버 모달 종합 상황 탭 (CPU/Memory/Disk/서비스/시스템정보) (completed 1회, last QA-20260302-0040)
- 세션-타이머-정상-카운트다운: 세션 타이머 정상 카운트다운 (completed 1회, last QA-20260302-0040)
- 세션-타이머-정상-카운트다운-28분: 세션 타이머 정상 카운트다운 (28분) (completed 1회, last QA-20260302-0042)
- 세션-타이머-정상-카운트다운-29분: 세션 타이머 정상 카운트다운 (29분) (completed 1회, last QA-20260302-0041)
- 스토리지-서버-그룹-최초-검증-storage-nfss3gw-3대-정확-필터링: 스토리지 서버 그룹 최초 검증: storage-nfs/s3gw 3대 정확 필터링 (completed 1회, last QA-20260523-0568)
- 시스템-리소스-요약-cpu-36-memory-47-disk-34: 시스템 리소스 요약 (CPU 36%, Memory 47%, Disk 34%) (completed 1회, last QA-20260302-0041)
- 시스템-리소스-요약-cpu-37-memory-46-disk-36: 시스템 리소스 요약 (CPU 37%, Memory 46%, Disk 36%) (completed 1회, last QA-20260302-0040)
- 시스템-리소스-요약-cpu-40-memory-49-disk-32: 시스템 리소스 요약 (CPU 40%, Memory 49%, Disk 32%) (completed 1회, last QA-20260302-0042)
- 시스템-시작-대시보드-리다이렉트-정상: 시스템 시작 → 대시보드 리다이렉트 정상 (completed 1회, last QA-20260302-0041)
- 시스템-시작-system-boot-대시보드-리다이렉트-정상: 시스템 시작 → system-boot → 대시보드 리다이렉트 정상 (completed 2회, last QA-20260302-0042)
- 위험한-키워드-라우팅v8.12.12-monitoring-server-health-정확-라우팅-확인: 위험한 키워드 라우팅(v8.12.12): monitoring-server-health 정확 라우팅 확인 (completed 1회, last QA-20260523-0566)
- 코드-품질-리뷰-5-핵심파일: 코드 품질 리뷰 5 핵심파일 (completed 1회, last QA-20260301-0032)
- 통합-검증-validateall-통과: 통합 검증 validate:all 통과 (completed 1회, last QA-20260301-0032)
- 패턴-위반-검사-any-0-todo-0: 패턴 위반 검사 any 0 TODO 0 (completed 1회, last QA-20260301-0032)
- 프로덕션-대시보드-렌더링: 프로덕션 대시보드 렌더링 (completed 1회, last QA-20260317-0114)
- 프로덕션-빌드-46-pages-성공: 프로덕션 빌드 46 pages 성공 (completed 1회, last QA-20260301-0032)
- 프로필-메뉴-게스트-사용자-게스트-모드-표시: 프로필 메뉴 (게스트 사용자, 게스트 모드 표시) (completed 3회, last QA-20260302-0042)
- active-alerts-modal-ai-prefill: 활성 알림 모달에서 AI 사이드바 컨텍스트 자동 주입 (completed 1회, last QA-20260323-0166)
- admin-log-level-admin-auth: 관리자 로그레벨 API 관리자 권한 강제 (completed 1회, last QA-20260325-0183)
- ai-사이드바-열기닫기: AI 사이드바 열기/닫기 (completed 1회, last QA-20260317-0114)
- ai-사이드바-토글-ai-엔진-ready-프리셋-5개-ai-기능-3개: AI 사이드바 토글 (AI 엔진 Ready, 프리셋 5개, AI 기능 3개) (completed 3회, last QA-20260302-0042)
- ai-advanced-anomaly-trend-surface-v811108: Anomaly/trend production surface generated visible monitoring analysis (completed 1회, last QA-20260506-0415)
- ai-advanced-reporter-surface-v811108: Reporter Agent production surface generated a visible report with copy/download actions (completed 1회, last QA-20260506-0415)
- ai-advanced-surface-targeted-qa-pack-v811109: AI advanced surface targeted QA pack completed after RAG/Web closure (completed 1회, last QA-20260506-0416)
- ai-alert-status-advisory-response-drift: Alert-status advisory queries stay grounded and do not drift into unrelated metric rankings (completed 2회, last QA-20260430-0374)
- ai-analysis-main-response-empty-on-cerebras-quota: Prevent empty main AI analysis response when Cerebras queue or token quota fails (completed 1회, last QA-20260429-0370)
- ai-analysis-mode-route-selection-production: Production auto/thinking analysis mode route selection verified (completed 1회, last QA-20260428-0355)
- ai-analyst-success: Analyst Agent 이상감지/예측 성공 (completed 2회, last QA-20260314-0097)
- ai-answer-enumerated-requirements: AI 답변이 사용자가 요청한 항목 개수를 정확히 충족하도록 보강 (completed 1회, last QA-20260423-0339)
- ai-artifact-envelope-metadata-contract: AI artifact envelope-compatible metadata contract (completed 1회, last QA-20260503-0398)
- ai-artifact-guidance-intent-guard-v81181: Artifact guidance requests should not trigger monitoring artifact execution (completed 1회, last QA-20260502-0390)
- ai-artifact-input-guard-v81181: AI sidebar send button disables when input is empty after artifact submission (completed 1회, last QA-20260502-0390)
- ai-artifact-keyword-routing-v81182: Short artifact keywords route to the intended artifact execution path (completed 1회, last QA-20260502-0391)
- ai-artifact-short-keyword-pair-v81182: Representative short artifact keywords route correctly in production (completed 1회, last QA-20260502-0392)
- ai-artifact-workspace-ui-wiring-v811108: AI artifact workspace UI wiring and compare UX production verification (completed 1회, last QA-20260506-0414)
- ai-assistant-24h-peak-load-empty-response-v811124: Production AI Assistant 24시간 피크 부하 질의가 phrasing-sensitive routing/evidence drift를 보임 (completed 2회, last QA-20260512-0480)
- ai-assistant-action-needed-contradiction-v811146: Action-needed answer must not contradict its immediate-action conclusion (completed 1회, last QA-20260514-0499)
- ai-assistant-action-needed-over-clarification-v811132: Whole-fleet action-needed question should not require a server name before answering (completed 1회, last QA-20260512-0488)
- ai-assistant-composite-load-advice-mutating-command-v811132: Composite peak-load advice answer must not emit unsupported mutating package-install commands (completed 1회, last QA-20260512-0488)
- ai-assistant-domain-capability-resolver-phase2: AI Engine domain capability resolver Phase 2 release (completed 1회, last QA-20260511-0479)
- ai-assistant-double-scroll-v811112: AI Assistant page-level double scroll removed (completed 1회, last QA-20260507-0419)
- ai-assistant-expert-qc-security-semantic-peak-v811136: Expert, QC/QA, and security natural-language monitoring questions route to metric peak evidence (completed 1회, last QA-20260512-0486)
- ai-assistant-fullscreen-query-path: AI 전체 화면 핵심 서버 상태 요약 질의 검증 (completed 1회, last QA-20260318-0123)
- ai-assistant-fullscreen-tools-parity: AI 전체 화면 도구 메뉴 parity 검증 (completed 1회, last QA-20260318-0123)
- ai-assistant-general-coding-boundary: Guard general coding and algorithm requests at the AI Assistant input boundary (completed 1회, last QA-20260511-0467)
- ai-assistant-guest-login-mcp-check-v81136-20260427: AI assistant works through Vercel Playwright MCP guest login on v8.11.36 (completed 1회, last QA-20260427-0351)
- ai-assistant-load-advice-safety-v811131: Load advice responses should not propose mutating commands without a safety envelope for advice-only prompts (completed 1회, last QA-20260512-0484)
- ai-assistant-load-fragile-phrasing-v811131: Previously failing Korean peak-load phrasings stay grounded to load1 24h whole-fleet evidence on v8.11.131 (completed 1회, last QA-20260512-0483)
- ai-assistant-load-natural-language-metric-drift-v811128: AI Assistant natural load phrasing stays on load1/24h whole-fleet peak evidence after v8.11.129 semantic parser fix (completed 1회, last QA-20260512-0482)
- ai-assistant-multi-agent-semantic-trace-v811135: Multi-agent supervisor stream preserves semanticQueryTrace for monitoring metric_peak evidence (completed 1회, last QA-20260512-0485)
- ai-assistant-numbered-server-list-readability: AI Assistant 서버 목록 가독성 개선 (completed 1회, last QA-20260524-0579)
- ai-assistant-ops-procedure-artifact: Structure operational scripts, alert rules, and runbooks as ops-procedure artifacts (completed 1회, last QA-20260511-0468)
- ai-assistant-peak-load-composite-routing-v811131: Composite load peak plus response-guidance prompt should still use deterministic peak evidence (completed 1회, last QA-20260512-0484)
- ai-assistant-real-chat-e2e-v81136: AI assistant Playwright MCP real chat QA on Vercel v8.11.36 (completed 1회, last QA-20260427-0350)
- ai-assistant-static-health-label: Static AI Engine Active label removed (completed 1회, last QA-20260503-0396)
- ai-assistant-ux-polish-p1-p2: AI Assistant typography scale, touch target, light surface, System Context status, and provider routing polish (completed 1회, last QA-20260429-0360)
- ai-assistant-vercel-production-core-pass: AI Assistant production browser smoke passes (completed 1회, last QA-20260428-0357)
- ai-assistant-web-server-detail-v811146: Standard conversational Q2 should answer web-server-01 detail instead of whole-fleet summary (completed 1회, last QA-20260514-0499)
- ai-assistant-whole-fleet-load1-empty-summary-v811132: Whole-fleet load1 spike phrasing should route to metric_peak evidence instead of empty-summary fallback (completed 1회, last QA-20260512-0488)
- ai-cache-server-group-scope: Cache server group scope preserved for memory current-status queries (completed 1회, last QA-20260522-0556)
- ai-cerebras-gpt-oss-default-v811193: Cerebras production default model switched to gpt-oss-120b before llama3.1-8b deprecation (completed 1회, last QA-20260521-0548)
- ai-cerebras-single-attempt-check: Cerebras Qwen executes once per UI question without fallback (completed 1회, last QA-20260430-0376)
- ai-chat-cloud-run-500: AI Chat Cloud Run 자유입력 응답 - 최종 성공 확인 (completed 1회, last QA-20260310-0089)
- ai-chat-cloud-run-rate-limit-production: Complex Cloud Run AI verification path should complete without rate-limit failure in production (completed 2회, last QA-20260408-0250)
- ai-chat-detail-expand: AI Chat 상세 분석 펼치기 (completed 1회, last QA-20260407-0248)
- ai-chat-empty-response: AI Chat 서버 상태 요약 질문에 빈 응답 반환 (completed 1회, last QA-20260315-0100)
- ai-chat-latency-regression-recheck-20260310: AI Chat latency regression claim rechecked on production (completed 1회, last QA-20260310-0071)
- ai-chat-multi-agent-blank-response-v81179: AI Chat multi-agent raw JSON path returns a visible natural-language response instead of an empty assistant bubble (completed 1회, last QA-20260502-0389)
- ai-chat-nlq-cpu-top3: NLQ CPU 상위3대 정확 (completed 1회, last QA-20260419-0306)
- ai-chat-pass: AI Chat 응답 품질 정상 (OTel 데이터 기반 분석) (completed 1회, last QA-20260326-0190)
- ai-chat-performance-v880: AI Chat 응답 시간 및 요약 품질 검증 (completed 3회, last QA-20260310-0082)
- ai-chat-quality-v880-quality-recheck: AI Chat 응답 품질 재검증 (completed 1회, last QA-20260308-0059)
- ai-chat-quality-v880-recheck: AI Chat 응답 품질 및 완료 시간 재검증 (completed 1회, last QA-20260308-0058)
- ai-chat-raw-tool-call-json-v81179: AI Chat raw function/tool-call JSON is suppressed and no longer rendered in production (completed 1회, last QA-20260502-0389)
- ai-chat-response: AI Chat 응답 (completed 1회, last QA-20260301-0035)
- ai-chat-response-process-details-production: Production assistant responses should expose detailed response-process fields when analysis basis is expanded (completed 1회, last QA-20260405-0242)
- ai-chat-response-process-metadata-production: Production AI responses should expose response-process metadata when analysis basis is shown (completed 1회, last QA-20260405-0242)
- ai-chat-response-quality: AI Chat 핵심요약+상세분석+구체적 권고 응답 (completed 1회, last QA-20260306-0051)
- ai-chat-response-quality-v879: AI Chat 스트리밍 응답 및 권고 검증 (completed 1회, last QA-20260306-0052)
- ai-chat-response-quality-v880-recheck-20260309: AI Chat 응답 품질 및 권고 재검증 (completed 4회, last QA-20260309-0068)
- ai-chat-sidebar-open: AI 사이드바 열기 (completed 1회, last QA-20260317-0114)
- ai-chat-ux-build-runtime-regression: NLQ entity extraction route build regression fixed before production release (completed 1회, last QA-20260510-0466)
- ai-chat-ux-v811124-production: AI Chat UI/UX improvements deployed and verified on Vercel production (completed 1회, last QA-20260510-0466)
- ai-code-gate-input-policy: AI Code Gate: Prompt 패턴 15개 방어 점검 (completed 2회, last QA-20260318-0125)
- ai-dashboard-query-asof-slot-drift: AI sidebar job requests use the dashboard-visible OTel data slot (completed 1회, last QA-20260429-0372)
- ai-disk-cleanup-command-relevance: AI disk cleanup guidance should prioritize filesystem cleanup commands before MySQL diagnostics (completed 1회, last QA-20260510-0441)
- ai-disk-threshold-answer-accuracy-drift: AI async job answer preserves DISK threshold and dashboard metric values (completed 2회, last QA-20260429-0368)
- ai-domain-boundary-phase2-analysis-mode: AI Domain Boundary Phase 2 analysis mode toggle (auto/thinking) (completed 1회, last QA-20260416-0297)
- ai-engine-cloud-run-v81188-health: Cloud Run ai-engine v8.11.88 health and free-tier runtime limits verified (completed 1회, last QA-20260503-0399)
- ai-engine-full-test: cloud-run/ai-engine npm run test (completed 1회, last QA-20260514-0501)
- ai-engine-langfuse-dynamic-import-kept: Keep Langfuse dependency because it is dynamically loaded at runtime (completed 1회, last QA-20260510-0445)
- ai-engine-pino-v10-alignment: Align AI Engine pino to v10 (completed 1회, last QA-20260511-0473)
- ai-engine-precomputed-state-data-source-v811110: AI Engine precomputed-state data source decoupling verified in production (completed 1회, last QA-20260507-0418)
- ai-engine-response-quality-regression-v811141-deploy: Deploy AI Engine response quality regression fixes to Cloud Run (completed 1회, last QA-20260513-0490)
- ai-engine-status: AI 엔진 상태 표시 (completed 1회, last QA-20260317-0114)
- ai-engine-supervisor-runtime-host-wiring-v811107: Production supervisor stream and single-agent runtime host wiring verified (completed 1회, last QA-20260506-0413)
- ai-engine-type-check: cloud-run/ai-engine npm run type-check (completed 1회, last QA-20260514-0501)
- ai-engine-unused-direct-dependency-cleanup: Remove unused AI Engine direct dependencies (completed 1회, last QA-20260510-0445)
- ai-env-disclosure-guard-production-retest: AI env disclosure deterministic guard is live on production (completed 1회, last QA-20260518-0515)
- ai-explicit-server-id-clarification-skip: Skip NLQ clarification when a concrete server ID is present (completed 1회, last QA-20260510-0456)
- ai-explicit-server-summary-backfill: Explicit server action summary keeps named TOP2 servers and backfills partial tool payloads (completed 1회, last QA-20260430-0376)
- ai-fallback-done-usage-metadata: Delegated summarization fallback should report delegated provider token usage (completed 1회, last QA-20260429-0367)
- ai-feedback-removal-v811113: AI feedback feature removed from production (completed 1회, last QA-20260507-0420)
- ai-followup-filter-clarification-regression: AI follow-up server filter query should not be blocked by clarification (completed 1회, last QA-20260513-0489)
- ai-formatting-only-rewrite-routing-v81195: Formatting-only report rewrite stays on chat stream path (completed 1회, last QA-20260504-0403)
- ai-formatting-rewrite-context-preservation-v81196: Formatting-only follow-up rewrite reuses prior answer context and preserves all listed server IDs/values (completed 1회, last QA-20260505-0406)
- ai-friendly-template-todo-marker: Template TODO marker 분리 (TEMPLATE_TODO 적용) (completed 1회, last QA-20260226-0006)
- ai-fullscreen-cpu-ranking-v81189: Fullscreen AI Chat CPU top-3 answer remains grounded to dashboard OTel values (completed 1회, last QA-20260504-0402)
- ai-gradient-motion-restore: Restore animated AI text gradient effect on production (completed 1회, last QA-20260519-0534)
- ai-gradient-motion-restored-v811178: AI text and shared diagonal gradient motion restored (completed 1회, last QA-20260519-0531)
- ai-grounding-v8121-production-release-smoke: v8.12.1 AI grounding release deployed and smoke verified on production (completed 1회, last QA-20260522-0555)
- ai-hardening-production-verification: Verify production AI hardening release on v8.11.20 (completed 1회, last QA-20260418-0303)
- ai-health-soft-polling-local: AI health UI polling uses soft responses (completed 1회, last QA-20260503-0396)
- ai-incident-artifact-render-v81181: Incident report artifact renders from production AI sidebar (completed 1회, last QA-20260502-0390)
- ai-krl-otel-status-criteria-llm-v811192: Grounded LLM KRL answers now deterministically include OTel status criteria when asked (completed 1회, last QA-20260521-0547)
- ai-krl-platform-boundary-routing-v811184: Production AI Assistant routes Vercel BFF / Cloud Run and OTel SSOT KRL questions to internal evidence (completed 1회, last QA-20260520-0546)
- ai-math-tools: AI 계산 도구(수식/통계/용량) 셋업 완료 (completed 1회, last QA-20260228-0023)
- ai-memory-topn-broad-ranking-korean-response: AI memory TOP-N broad ranking should answer in Korean without server_id clarification (completed 1회, last QA-20260510-0440)
- ai-metric-ranking-answer-order: Ranking answers preserve descending order from tool output (completed 1회, last QA-20260418-0304)
- ai-metric-ranking-cpu-route: Current metric ranking query routes to deterministic metric lookup (completed 1회, last QA-20260418-0304)
- ai-network-followup-context-filtering: Network-only conversational follow-up returns scoped network filter output (completed 1회, last QA-20260519-0529)
- ai-nlq-entity-confidence-boundary: Trust only known high-confidence extracted entities (completed 2회, last QA-20260510-0461)
- ai-nlq-entity-route-auth-rate-limit: Protect NLQ entity extraction route with auth and rate limiting (completed 2회, last QA-20260510-0461)
- ai-nlq-entity-server-inventory-sync: Use server registry as NLQ entity extraction server inventory (completed 1회, last QA-20260510-0461)
- ai-nlq-off-domain-extractor-skip: Skip entity extraction for off-domain guarded queries (completed 2회, last QA-20260510-0461)
- ai-non-it-action-claim-guard: Prevent false completion claims for external action requests (completed 1회, last QA-20260510-0459)
- ai-non-it-live-fact-guard: Prevent unsupported live/current factual claims for off-domain questions (completed 1회, last QA-20260510-0459)
- ai-non-it-local-recommendation-quality: Improve local recommendation fallback quality (completed 1회, last QA-20260510-0459)
- ai-ops-a1-a5-c2-local-deterministic-fallback: A1/A5/C2 local deterministic fallback behavior is covered by tests (completed 1회, last QA-20260509-0434)
- ai-ops-command-clarification-intercept: Operations command guidance prompts are intercepted by clarification dialog before AI request dispatch (completed 1회, last QA-20260509-0432)
- ai-ops-command-intent-routing: HAProxy command guidance surfaces concrete backend/status commands (completed 1회, last QA-20260509-0430)
- ai-ops-command-submit-form-boundary: AI chat input exposes a semantic submit form for UI and QA automation (completed 1회, last QA-20260509-0431)
- ai-ops-command-submit-or-stream-boundary: Nginx/NFS command guidance does not produce a visible AI request/answer in Playwright flow (completed 1회, last QA-20260509-0432)
- ai-ops-empty-response-timeout: A5/C2 empty response/timeout resolved (completed 1회, last QA-20260509-0435)
- ai-ops-haproxy-context-specificity: A1 HAProxy CPU included, backend distribution limitation disclosed (completed 1회, last QA-20260509-0435)
- ai-ops-redis-context-quality: Redis context comparison response identifies highest-memory Redis nodes (completed 1회, last QA-20260509-0429)
- ai-ops-tool-result-empty-summary: Tool-backed AI responses no longer show empty-summary fallback for A1/C1 retest paths (completed 1회, last QA-20260509-0429)
- ai-provider-forced-routing-context-floor: Forced-routing quality agents skip 8K Cerebras fallback (completed 1회, last QA-20260428-0356)
- ai-provider-phase4-supervisor-routing-hints: Supervisor routing hints deployed (completed 1회, last QA-20260428-0356)
- ai-provider-queue-exceeded-retry-amplification: Cerebras queue_exceeded should not amplify retries before provider fallback (completed 1회, last QA-20260429-0366)
- ai-rag-on-document-lookup-hallucination-v81197: RAG On internal document lookup must not ask server-scope clarification or infer placeholder file paths (completed 1회, last QA-20260505-0410)
- ai-rag-web-raw-tool-call-json-leakage-v811108: RAG/Web representative query no longer leaks repeated raw tool-call JSON in production AI Chat (completed 1회, last QA-20260506-0416)
- ai-ranking-cpu-live-route: CPU highest-server query returns live top server on production (completed 1회, last QA-20260418-0305)
- ai-ranking-memory-live-route: Memory top-N ranking uses deterministic live metric path on production (completed 1회, last QA-20260418-0305)
- ai-recommendation-free-tier-fit: AI 운영 권고에서 리소스 업그레이드보다 조사/캐시/분산 조치를 우선 (completed 1회, last QA-20260423-0339)
- ai-remediation-advisor-routing-precedence: Explicit remediation queries route to Advisor before anomaly semantic frame (completed 1회, last QA-20260519-0536)
- ai-reporter-monitoring-rag-control-hidden-v811106: Reporter and monitoring AI surfaces no longer expose RAG toggles (completed 1회, last QA-20260505-0412)
- ai-reporter-success: Reporter Agent 보고서 생성 성공 (completed 3회, last QA-20260315-0104)
- ai-retrieval-actual-use-cleanup-gates: Actual-use cleanup local gates pass (completed 1회, last QA-20260510-0445)
- ai-retrieval-cleanup-root-vitest: Root AI proxy config targeted Vitest suite passes (completed 1회, last QA-20260510-0442)
- ai-retrieval-cleanup-targeted-vitest: AI retrieval cleanup targeted Vitest suites pass (completed 1회, last QA-20260510-0442)
- ai-retrieval-cleanup-type-lint-contract: Type, lint, quick, contract, and AI Engine full tests pass (completed 1회, last QA-20260510-0442)
- ai-retrieval-command-backfill-live-smoke: Verify backfilled command docs resolve through search_knowledge_text (completed 1회, last QA-20260510-0452)
- ai-retrieval-command-vector-backfill: Backfill command_vectors rows missing from KRL corpus (completed 1회, last QA-20260510-0452)
- ai-retrieval-current-krl-trigger-helper-preserved: Preserve KRL RPC and current search_vector trigger helpers (completed 1회, last QA-20260510-0451)
- ai-retrieval-dead-runtime-cleanup-gates: Retrieval cleanup targeted and broad local gates pass (completed 1회, last QA-20260510-0444)
- ai-retrieval-dead-runtime-hyde-reranker-removal: Remove unused HyDE query expansion and LLM reranker runtime files (completed 1회, last QA-20260510-0444)
- ai-retrieval-domain-fallback-candidates-expanded: Expand Knowledge Retrieval Lite deterministic fallback candidates (completed 1회, last QA-20260510-0449)
- ai-retrieval-graphrag-compat-contract-reduction: Reduce legacy contracts to useGraphRAG input compatibility only (completed 1회, last QA-20260510-0443)
- ai-retrieval-graphrag-route-removal-gates: Type, lint, quick, contract, docs, and AI Engine full tests pass (completed 1회, last QA-20260510-0443)
- ai-retrieval-graphrag-route-removal-tests: Route removal and retrieval compatibility tests pass (completed 1회, last QA-20260510-0443)
- ai-retrieval-graphrag-tombstone-route-removal: Remove legacy /api/ai/graphrag/* 410 tombstone route (completed 1회, last QA-20260510-0443)
- ai-retrieval-graphrag-usage-log-check: Confirm no recent external usage before tombstone removal (completed 1회, last QA-20260510-0443)
- ai-retrieval-krl-relaxed-recall-rpc: Improve search_knowledge_text recall for multi-token operational queries (completed 1회, last QA-20260510-0449)
- ai-retrieval-krl-smoke-script-alignment: Align supabase:rag:smoke with Knowledge Retrieval Lite (completed 1회, last QA-20260510-0444)
- ai-retrieval-krl-token-overlap-precision-ranking: Reduce broad relaxed fallback noise with token-overlap ranking (completed 1회, last QA-20260510-0450)
- ai-retrieval-legacy-data-tables-preserved: Preserve historical RAG data tables while removing helper surface (completed 1회, last QA-20260510-0451)
- ai-retrieval-legacy-drift-guard-expanded: Expand drift guard against removed retrieval runtime reintroduction (completed 1회, last QA-20260510-0444)
- ai-retrieval-legacy-embedding-seed-cleanup: Remove root legacy embedding seed scripts (completed 1회, last QA-20260510-0452)
- ai-retrieval-legacy-vector-graph-weight-cleanup: Remove stale vector/graph RAG weighting surface from active runtime (completed 1회, last QA-20260510-0442)
- ai-retrieval-live-supabase-text-rpc-smoke: Verify current Knowledge Retrieval Lite RPC works against Supabase (completed 1회, last QA-20260510-0445)
- ai-retrieval-rag-doc-corpus-sync: Synchronize RAG architecture document with live corpus and relaxed recall behavior (completed 1회, last QA-20260510-0449)
- ai-retrieval-rag-doc-precision-sync: Document KRL token-overlap ranking behavior (completed 1회, last QA-20260510-0450)
- ai-retrieval-rag-governance-rebaseline: Rebaseline RAG corpus governance after full command inventory backfill (completed 1회, last QA-20260510-0453)
- ai-retrieval-rag-smoke-precision-guard: Add precision guard to live RAG smoke (completed 1회, last QA-20260510-0450)
- ai-retrieval-remaining-legacy-helper-rpc-cleanup: Drop remaining unused legacy graph/vector helper RPCs (completed 1회, last QA-20260510-0451)
- ai-retrieval-representative-rag-smoke-expanded: Expand Supabase RAG smoke beyond two happy-path keywords (completed 1회, last QA-20260510-0449)
- ai-retrieval-stale-test-mock-cleanup: Remove stale query-expansion/reranker mocks from searchKnowledgeBase tests (completed 1회, last QA-20260510-0444)
- ai-retrieval-unused-graph-weight-index-removed: Remove unused legacy graph weight index (completed 1회, last QA-20260510-0451)
- ai-routing-trust-boundary-v811194: AI routing trust boundary and local classifier cleanup deployed to production (completed 1회, last QA-20260521-0549)
- ai-sdk-v6-engine-output-object-migration: Migrate Cloud Run orchestrator structured output helper to generateText + Output.object (completed 1회, last QA-20260510-0462)
- ai-sdk-v6-root-output-object-migration: Migrate Root App structured output routes to generateText + Output.object (completed 1회, last QA-20260510-0462)
- ai-sdk-v6-structured-output-doc-alignment: Align active architecture copy with AI SDK v6 structured output best practice (completed 1회, last QA-20260510-0462)
- ai-security-prompt-injection-smoke-v81197: Prompt-injection smoke does not leak secrets (completed 1회, last QA-20260505-0407)
- ai-semantic-trace-job-path-v811137: Preserve semanticQueryTrace for production AI job-path monitoring peak answers (completed 1회, last QA-20260512-0487)
- ai-server-snapshot-artifact-cancellation-v81185: Server snapshot artifact respects cancellation and preserves production rendering (completed 1회, last QA-20260503-0395)
- ai-server-snapshot-artifact-v81184: Server status snapshot artifact routes and renders in production without LLM/Cloud Run cost path (completed 1회, last QA-20260503-0394)
- ai-server-timing-hosting-path-diagnosed: Server-Timing production/local hosting path difference diagnosed (completed 1회, last QA-20260310-0081)
- ai-sidebar-open: AI 사이드바 열기/닫기 (completed 1회, last QA-20260317-0114)
- ai-sidebar-parity-contract-rendering: AI sidebar 상세 분석에 실제 parity metadata contract 노출 (completed 1회, last QA-20260323-0164)
- ai-sidebar-rag-control-hidden-v811106: AI sidebar hides user-facing RAG control while keeping Web source controls visible (completed 1회, last QA-20260505-0412)
- ai-sidebar-right-panel: AI 우측 패널 기능 메뉴 (completed 1회, last QA-20260317-0114)
- ai-sidebar-starters: AI 스타터 프롬프트 5개 (completed 1회, last QA-20260317-0114)
- ai-sidebar-toggle: AI 사이드바 AI Engine Ready (completed 2회, last QA-20260419-0306)
- ai-sidebar-tool-ux-release-smoke-v81135: AI sidebar tool/UX simplification v8.11.35 release smoke (completed 1회, last QA-20260427-0349)
- ai-sidebar-tools-menu: AI 도구 메뉴 (completed 1회, last QA-20260317-0114)
- ai-starter-summary-parity-guard: AI starter/direct dashboard count parity E2E guard (completed 1회, last QA-20260424-0344)
- ai-starter-summary-parity-guard-final-hardening: AI parity guard dynamic total and label-boundary hardening (completed 1회, last QA-20260424-0345)
- ai-status-diagnostic-commands: AI status answers include read-only diagnostic commands when commands are requested (completed 1회, last QA-20260514-0501)
- ai-stream-fallback-evidence-metadata: AI stream fallback metadata is preserved (completed 1회, last QA-20260503-0396)
- ai-stream-raw-tool-marker-leak-v811184: Production AI Assistant no longer leaks raw tool-call markers or reasoning JSON for the KRL prompts (completed 1회, last QA-20260520-0546)
- ai-stream-timing-x-headers-production: AI Chat streaming route exposes X-AI timing headers on production (completed 1회, last QA-20260310-0080)
- ai-streaming-ui-s1-fullscreen-direct-stream-v81188: Fullscreen AI workspace production stream path verified (completed 1회, last QA-20260503-0400)
- ai-streaming-ui-s3-agent-step-events-v81188: AI Streaming UI S3 agent-step stream contract deployed (completed 1회, last QA-20260503-0399)
- ai-summary-chat-streaming-path: AI summary chat query uses streaming path on production (completed 2회, last QA-20260310-0080)
- ai-summary-dashboard-parity-regression: AI assistant summary must match dashboard and OTel-derived system counts (completed 1회, last QA-20260404-0224)
- ai-summary-delta-guidance: AI 요약이 평균 대비 변화량과 구체적 권고를 표시 (completed 1회, last QA-20260322-0157)
- ai-summary-query-clarification-skip-production: Explicit all-server summary query skips clarification in production (completed 1회, last QA-20260310-0071)
- ai-supervisor-advanced-ranking-recovery-v81195: Supervisor single stream returns deterministic advanced metric ranking with success metadata (completed 1회, last QA-20260504-0403)
- ai-timing-header-ssot-policy: QA timing header SSOT standardized to X-AI-Latency-Ms (completed 1회, last QA-20260310-0081)
- ai-timing-x-headers-production: AI proxy responses expose production timing headers (completed 1회, last QA-20260309-0070)
- ai-topology-duplicate-tool-invocation: Topology query duplicate searchKnowledgeBase invocation removed (completed 1회, last QA-20260415-0284)
- ai-topology-variant-function-call-failure: Advisor Agent latency/format quality stabilization (Task 1-3) (completed 2회, last QA-20260415-0283)
- ai-topology-variant-schema-validation-failure: searchKnowledgeBase boolean-string tool-call validation failure removed (completed 1회, last QA-20260413-0281)
- ai-v81216-advisor-routing-empty-response: Advisor performance-improvement query should route to Advisor and return non-empty guidance (completed 2회, last QA-20260524-0574)
- ai-v81216-compact-markdown-heading: Compact markdown headings should not leak as raw ##/### text (completed 1회, last QA-20260524-0573)
- ai-v81216-healthy-filter-evidence: Healthy-only server filter should resolve to deterministic inverse filter evidence (completed 2회, last QA-20260524-0576)
- ai-v81216-lowest-load-ranking: Lowest-load and available-server TOP-N queries should use grounded ranking (completed 2회, last QA-20260524-0574)
- ai-web-search-intent-and-answer-quality-v81197: Web search query returns current sourced answer without clarification/fallback failure (completed 1회, last QA-20260505-0408)
- ai-whole-fleet-disk-trend: Whole-fleet disk trend uses 18 servers and disk metrics (completed 1회, last QA-20260522-0556)
- ai-workspace-analysis-basis-hydration-drift: Fullscreen AI workspace should preserve tool-grounded analysis basis metadata (completed 3회, last QA-20260416-0293)
- ai-workspace-dom-test-runner-hang: AIWorkspace DOM test runner hang 정리 (completed 1회, last QA-20260318-0124)
- alert-history-modal: 알림 이력 모달 (completed 1회, last QA-20260317-0114)
- alert-history-modal-ai-prefill: 알림 이력 모달에서 AI 사이드바 컨텍스트 자동 주입 (completed 1회, last QA-20260323-0167)
- analysis-basis-badge-fullscreen: 분석근거 배지 전체화면 parity (completed 1회, last QA-20260419-0306)
- analysis-basis-badge-label: AnalysisBasisBadge.tsx: collapsed 표시 '도구:' → '분석 단계:' Progressive Disclosure 개선 (completed 1회, last QA-20260408-0252)
- analysis-basis-badge-sidebar: 분석근거 배지 사이드바 정상 (completed 1회, last QA-20260419-0306)
- analysis-basis-badge-tab-ux: Analysis basis badge process/detail tabs render consistently in sidebar and fullscreen on production (completed 1회, last QA-20260419-0308)
- analysis-basis-badge-tab-ux-broad-v823: Production 8.11.23 broad QA confirms analysis basis tabs across sidebar and fullscreen surfaces (completed 1회, last QA-20260419-0309)
- analyst-agent-full-analysis: Analyst 18서버 분석 16정상 2주의 (completed 1회, last QA-20260419-0306)
- analyst-agent-pass: Analyst Agent 전체 분석 정상 (completed 1회, last QA-20260326-0190)
- analyst-full-analysis: Analyst 전체 분석 (completed 1회, last QA-20260317-0114)
- analyst-full-analysis-v879: Analyst 전체 분석 및 드릴다운 (completed 1회, last QA-20260306-0052)
- analyst-full-analysis-v880: Analyst 전체 분석 및 드릴다운 검증 (completed 2회, last QA-20260309-0069)
- analyst-full-analysis-v880-recheck-20260309: Analyst 전체 분석 경로 재검증 (completed 4회, last QA-20260309-0068)
- analyst-fullscreen-single-server-rag: Analyst 단일 서버 + RAG 분석 경로 검증 (completed 1회, last QA-20260318-0126)
- analyst-instruction-tool-name-exposure: analyst.ts: '분석 과정' 섹션 제거 및 도구명 응답 본문 노출 금지 (completed 1회, last QA-20260408-0252)
- analyst-lightweight-evidence-contract: Analyst tools expose deterministic evidence contract (completed 1회, last QA-20260519-0536)
- analyst-nan-prediction-bug: Analyst 상승 추세 예측값 NaN% 표시 (completed 1회, last QA-20260419-0307)
- analyst-normal-server-empty-state: Analyst 정상 서버 드릴다운 empty-state 의도/재현 판정 (completed 1회, last QA-20260310-0086)
- analyst-quality-v880-quality-recheck: Analyst 전체 분석 및 드릴다운 품질 재검증 (completed 1회, last QA-20260308-0059)
- analyst-quality-v880-recheck: Analyst 전체 분석 및 드릴다운 재검증 (completed 1회, last QA-20260308-0058)
- analyst-sidebar-state-retention-chat-switch: Analyst 선택 서버와 결과가 sidebar chat 전환 후 유지 (completed 3회, last QA-20260320-0138)
- analyst-state-loss-on-chat-switch: Analyst 선택 서버와 결과가 chat 전환 후 유지 (completed 1회, last QA-20260319-0127)
- anomaly-detection-prediction: 이상감지/예측 15서버 전체 분석 (completed 1회, last QA-20260306-0051)
- anomaly-detection-static-confidence: Replace static anomaly/trend snapshot confidence with severity and threshold-distance scoring (completed 1회, last QA-20260519-0534)
- anomaly-trend-confidence-label-review: Anomaly/trend confidence-style label replaced with signal strength wording (completed 1회, last QA-20260519-0529)
- api-인증-검증-401-확인: API 인증 검증 401 확인 (completed 1회, last QA-20260301-0032)
- api-metrics-route-status-label-contract: Preserve status label for openmanager_server_status (completed 1회, last QA-20260511-0472)
- approval-history-runtime-smoke: approvalStore pending/decision/history/stats runtime path verified (completed 1회, last QA-20260411-0270)
- artifact-ux-capacity-alerts: Monitoring artifact capacityAlerts section (completed 1회, last QA-20260514-0502)
- artifact-ux-incident-availability-impact: Incident report availability impact line (completed 1회, last QA-20260514-0502)
- artifact-ux-incident-log-patterns: Incident report repeated log patterns (completed 1회, last QA-20260514-0502)
- artifact-ux-replay-deeplink: Chat artifact handoff to fullscreen AI assistant (completed 1회, last QA-20260514-0502)
- artifact-ux-role-group-summary: Monitoring artifact roleGroupSummary section (completed 1회, last QA-20260514-0502)
- assistant-plan-result-facade-m2: AssistantPlan and AssistantResult facade metadata released (completed 1회, last QA-20260503-0397)
- assistant-route-decision-metadata-m1: RouteDecision metadata contract released (completed 1회, last QA-20260503-0397)
- auth-error-provider-copy: 인증 에러 라우트 메시지를 제공자-중립 표현으로 전환 (completed 1회, last QA-20260227-0010)
- auth-success-legacy-route-404-v81197: /auth/success legacy route redirects safely instead of 404 (completed 1회, last QA-20260505-0409)
- auto-incident-report: 자동장애 보고서 생성 및 상세보기 (completed 1회, last QA-20260306-0051)
- az-load-balance-comparison-routing: AZ 부하 비교 질의 라우팅 검증 (completed 1회, last QA-20260524-0579)
- biome-lint-900-files-에러-0: Biome Lint 900 files 에러 0 (completed 1회, last QA-20260301-0032)
- biome-optional-chain-4: Biome useOptionalChain 4건 수정 (completed 1회, last QA-20260329-0194)
- blocked-prompt-raw-json-exposure: 보안 차단 시 raw JSON 노출 제거 (completed 2회, last QA-20260318-0125)
- blocked-prompt-ux-fixed-v880: Prompt injection 차단 UX 정제 검증 (completed 1회, last QA-20260308-0058)
- blocked-prompt-ux-v880-quality-recheck: 보안 차단 UX 재검증 (completed 1회, last QA-20260308-0059)
- cerebras-qwen-preview-runtime-removed: Cerebras Qwen Preview removed from production runtime default (completed 1회, last QA-20260430-0385)
- cloud-run-ai-engine-v811107-health: Cloud Run AI Engine v8.11.107 health and authenticated supervisor health verified (completed 1회, last QA-20260506-0413)
- cloud-run-ai-engine-v811110-deploy-smoke: Cloud Run AI Engine v8.11.110 deploy and post-deploy smoke verified (completed 1회, last QA-20260507-0418)
- cloud-run-cerebras-env-pinned: Cloud Run env pins CEREBRAS_MODEL_ID=llama3.1-8b (completed 1회, last QA-20260430-0385)
- cloud-run-latest-traffic-recovery: Cloud Run service traffic restored to latest revision (completed 1회, last QA-20260418-0305)
- cloud-run-proxy-runtime-env-refresh: Cloud Run proxy runtime env refresh (completed 1회, last QA-20260325-0185)
- cloud-run-readiness-guard: Cloud Run direct route readiness guard 공통화 (completed 1회, last QA-20260325-0184)
- cloud-run-v892-manual-deploy: Cloud Run v8.9.2 manual deploy verification (completed 1회, last QA-20260317-0118)
- cloud-tasks-dispatch-follow-up-hardening: Cloud Tasks dispatch header allowlist and createTask transient retry hardening (completed 1회, last QA-20260429-0359)
- cloud-tasks-fresh-browser-dispatch-sse: Fresh browser Cloud Tasks dispatch and SSE completion verified (completed 1회, last QA-20260429-0365)
- cloud-tasks-payload-byte-guard: Cloud Tasks dispatch payload byte guard and 413 response (completed 1회, last QA-20260429-0364)
- cloud-tasks-worker-target-https: Cloud Tasks worker target uses HTTPS in production (completed 1회, last QA-20260428-0358)
- core-dashboard-ai-streaming-broad-v81197: Core dashboard and AI streaming paths remain functional on v8.11.97 (completed 1회, last QA-20260505-0407)
- coverage-suite-stabilize: vitest coverage suite 0 failed (6→0) 안정화 (completed 1회, last QA-20260329-0194)
- csrf-duplicate-removal: CSRF getCSRFTokenFromCookie 중복 제거 (completed 1회, last QA-20260307-0053)
- cve-brace-expansion: brace-expansion CVE GHSA-f886-m6hf-6m8v 패치 (completed 1회, last QA-20260329-0194)
- dashboard-15-servers: 대시보드 15대 서버 모니터링 정상 (completed 2회, last QA-20260314-0097)
- dashboard-active-alerts: 활성 알림 모달 (completed 1회, last QA-20260317-0114)
- dashboard-ai-direct-route-manual-sidebar-reopen: 직접 /dashboard/ai-assistant 진입 후 상단 AI 버튼으로 우측 사이드바 재오픈 유지 (completed 1회, last QA-20260430-0384)
- dashboard-ai-embedded-mobile-route: 모바일 /dashboard/ai-assistant를 사이드바 handoff가 아닌 대시보드 embedded 기능 페이지로 유지 (completed 1회, last QA-20260430-0383)
- dashboard-ai-fullscreen-embedded-page: AI 전체 화면을 별도 standalone 대신 dashboard embedded page로 통합 (completed 1회, last QA-20260430-0380)
- dashboard-ai-fullscreen-route-auto-close-reopen: AI 전체 페이지 진입 시 사이드바 자동 닫힘 및 상단 버튼 재오픈 (completed 2회, last QA-20260430-0384)
- dashboard-ai-left-nav-item-removal: 좌측 app shell navigation에서 AI 어시스턴트 항목 제거 (completed 1회, last QA-20260430-0380)
- dashboard-ai-left-nav-removal-production: AI 어시스턴트를 좌측 내비게이션에서 제거하고 상단 우측 CTA로 통합 (completed 1회, last QA-20260430-0383)
- dashboard-ai-page-sidebar-autoclose-reopen: AI 전체 페이지 진입 시 사이드바 자동 닫힘 및 상단 버튼 재열림 (completed 1회, last QA-20260430-0380)
- dashboard-ai-propagation-v81158: Dashboard OTel labels and mobile AI sidebar handoff deployed to production (completed 1회, last QA-20260429-0364)
- dashboard-ai-shell-diff-check: Patch whitespace check passes (completed 1회, last QA-20260430-0380)
- dashboard-ai-shell-lint-changed: Changed-file lint passes (completed 1회, last QA-20260430-0380)
- dashboard-ai-shell-targeted-vitest: Dashboard/AI shell targeted Vitest suites pass (completed 1회, last QA-20260430-0380)
- dashboard-ai-shell-type-check: Root TypeScript type-check passes (completed 1회, last QA-20260430-0380)
- dashboard-ai-sidebar-desktop-resize-after-wrapper-removal: AI 사이드바 래퍼 제거 후 데스크톱 resize 동작 유지 (completed 1회, last QA-20260430-0382)
- dashboard-ai-sidebar-left-rail-collapse: 우측 AI 사이드바가 열릴 때 좌측 navigation rail 축소 (completed 1회, last QA-20260430-0380)
- dashboard-ai-sidebar-resizable: AI 사이드바 사용자 resize 동작 검증 (completed 1회, last QA-20260430-0380)
- dashboard-ai-sidebar-resize-and-rail-collapse: AI 사이드바 오픈 시 좌측 rail 축소 및 데스크톱 사이드바 리사이즈 (completed 1회, last QA-20260430-0383)
- dashboard-ai-surface-boundary-core-monitoring: Dashboard core monitoring surfaces are separated from per-entity AI execution CTAs (completed 1회, last QA-20260509-0433)
- dashboard-client-lazy-shell-split: Split DashboardClient into auth wrapper and lazy interactive shell (completed 1회, last QA-20260420-0318)
- dashboard-content-lazy-server-section: Lazy load ServerDashboard from DashboardContent (completed 1회, last QA-20260420-0318)
- dashboard-detail-header-ai-action: Server detail header exposes status badge and AI ask action for warning/critical servers (completed 1회, last QA-20260509-0427)
- dashboard-detail-modal-shell-removal: Unused EnhancedServerModal shell and shell test removed (completed 1회, last QA-20260509-0427)
- dashboard-detail-overview-metric-dedup: Server detail overview removes duplicate 핵심 성능 지표 grid (completed 1회, last QA-20260509-0427)
- dashboard-dev-defer-heavy-subtree: Defer DashboardContent subtree during dev bootstrap (completed 1회, last QA-20260420-0317)
- dashboard-full-source-status-parity-v811185: Dashboard server status and resource overview use the full 18-server source (completed 1회, last QA-20260520-0545)
- dashboard-health-badge-warning-consistency: 고부하 카드가 Stable 대신 Warning으로 정렬됨 (completed 1회, last QA-20260322-0157)
- dashboard-health-v879: 프로덕션 대시보드 및 Health API 검증 (completed 1회, last QA-20260306-0052)
- dashboard-health-v880: 프로덕션 대시보드 및 Health API 검증 (completed 1회, last QA-20260308-0056)
- dashboard-health-v880-quality-recheck: 프로덕션 대시보드/Health API 품질 재검증 (completed 1회, last QA-20260308-0059)
- dashboard-health-v880-recheck: 프로덕션 대시보드 및 Health API 재검증 (completed 5회, last QA-20260309-0068)
- dashboard-log-alert-filter-wrapping: Dashboard log and alert filter/wrapping hardening (completed 1회, last QA-20260429-0362)
- dashboard-log-chunk-pagination: 로그 50개 청크 렌더링과 다음 페이지 로드 (completed 1회, last QA-20260501-0386)
- dashboard-log-pattern-grouping: 반복 로그 패턴 그룹핑 (completed 1회, last QA-20260501-0386)
- dashboard-log-stat-touch-target: 로그 통계 필터 클릭 타깃 보강 (completed 1회, last QA-20260501-0386)
- dashboard-log-url-server-filter: 로그 페이지 URL 기반 서버 필터 초기화 (completed 1회, last QA-20260501-0386)
- dashboard-mobile-ai-open-menu-trigger-hidden: 모바일 AI 사이드바 오픈 시 좌측 대시보드 메뉴 버튼 겹침 방지 (completed 1회, last QA-20260430-0382)
- dashboard-mobile-ai-sidebar-full-width-position: 모바일 AI 사이드바 이중 래퍼로 인한 우측 밀림 제거 (completed 1회, last QA-20260430-0382)
- dashboard-mobile-header-ai-cta-spacing: 모바일 헤더 로고와 AI CTA 겹침 방지 (completed 1회, last QA-20260430-0380)
- dashboard-mobile-header-overflow-fix: 모바일 대시보드 헤더 가로 overflow 및 버튼 겹침 해소 (completed 1회, last QA-20260430-0382)
- dashboard-modal-light-shells: Dashboard modal light-mode shell alignment (completed 1회, last QA-20260429-0362)
- dashboard-nav-anchor-reset-local-fix: Global anchor reset no longer overrides Tailwind text utility colors in production (completed 2회, last QA-20260430-0378)
- dashboard-nav-contrast-production: Vercel production dashboard left navigation text contrast regression (completed 1회, last QA-20260430-0378)
- dashboard-otel-static-labels: Dashboard OTel static data labels aligned with Vercel public 24h rotation (completed 1회, last QA-20260429-0362)
- dashboard-page-dev-server-data-import-split: Avoid server-data graph import on dashboard dev path (completed 1회, last QA-20260420-0317)
- dashboard-render: 대시보드 18서버 17온라인 1경고 (completed 1회, last QA-20260419-0306)
- dashboard-resources: 시스템 리소스 개요 (completed 1회, last QA-20260317-0114)
- dashboard-server-card-card-click-v811161: Server cards open detail from card body and hide visible expand/detail affordance (completed 1회, last QA-20260517-0510)
- dashboard-server-card-density: Desktop server cards use 4-column dense grid at xl width (completed 1회, last QA-20260508-0426)
- dashboard-server-card-selector-stabilization: 서버 카드 선택자 및 빈 상태 처리 안정화 (completed 2회, last QA-20260302-0039)
- dashboard-server-cards: 대시보드 서버 카드 및 메트릭 (completed 2회, last QA-20260302-0038)
- dashboard-server-detail-metrics-tab-slot-drift-v81197: Server detail performance tab current metrics align with same-page overview values (completed 2회, last QA-20260505-0411)
- dashboard-server-log-cross-link: 서버 카드 로그 바로가기 cross-link (completed 1회, last QA-20260501-0386)
- dashboard-session-data-freeze-v811194: Dashboard session data freeze deployed with dashboard summary parity intact (completed 1회, last QA-20260521-0549)
- dashboard-status-filter: 상태 필터 토글 (completed 1회, last QA-20260317-0114)
- dashboard-telemetry-copy-v811106: Dashboard telemetry copy uses OpenTelemetry snapshot/catalog language (completed 1회, last QA-20260505-0412)
- dashboard-topology-map: 토폴로지 맵 모달 (completed 1회, last QA-20260317-0114)
- dashboard-ux-phase5-ai-workspace-local-qa: Dashboard UX Phase 5 AI workspace layout verified on local browser QA (completed 1회, last QA-20260521-0554)
- dashboard-ux-search-and-trends-local-qa: Dashboard UX search and metric trend local QA (completed 1회, last QA-20260521-0552)
- dashboard-ux-v8120-production-release-smoke: v8.12.0 dashboard UX release deployed and smoke verified on production (completed 1회, last QA-20260521-0553)
- dashboard-worker-console-error-on-ai-workspace-return: Dashboard logs Web Worker fallback error after returning from fullscreen AI workspace (completed 1회, last QA-20260423-0332)
- data-metrics-quality-slot-provenance: AI parity QA evidence includes dashboard snapshot slot/source metadata (completed 1회, last QA-20260424-0348)
- db-disk-threshold-filter: DB disk threshold excludes below-threshold replica (completed 1회, last QA-20260523-0571)
- deploy-query-as-of-fix-to-production: Deploy query-as-of metric slot fix to Vercel production (completed 1회, last QA-20260429-0370)
- dev-runtime-css-split: Landing CSS and home route compile split (completed 1회, last QA-20260420-0315)
- dom-related-depscan-noise-suppression: Suppress benign zero-test DOM related dep-scan noise (completed 1회, last QA-20260325-0186)
- e2e-ai-chat-production-selector-alignment: AI Chat/Sidebar E2E selectors aligned with production DOM (completed 1회, last QA-20260310-0073)
- e2e-alerts-logs-label-drift: Alerts/logs Playwright expectations aligned with current production modal headings and labels (completed 1회, last QA-20260424-0342)
- e2e-dashboard-ready-networkidle-flake: Production dashboard navigation helper now waits for visible dashboard markers instead of hard-failing on networkidle (completed 1회, last QA-20260424-0342)
- e2e-guest-dashboard-fallback: Guest flow Playwright coverage now falls back to direct dashboard navigation in production and avoids landing-card selector drift (completed 1회, last QA-20260424-0342)
- e2e-testid-production-fix: E2E 테스트 data-testid 의존성 제거 (completed 1회, last QA-20260310-0076)
- esc-모달-닫기: ESC 모달 닫기 (completed 1회, last QA-20260317-0114)
- feature-card-modal: 피처카드 모달 (completed 1회, last QA-20260301-0035)
- feature-dod-ai-engine-tests-v81225: AI Engine full test suite (completed 1회, last QA-20260524-0580)
- feature-dod-ai-engine-typecheck-v81225: AI Engine type-check (completed 1회, last QA-20260524-0580)
- feature-dod-e2e-critical: E2E 크리티컬 흐름 통과 (completed 1회, last QA-20260228-0029)
- feature-dod-lint-zero-error: lint 0 에러 (completed 5회, last QA-20260302-0044)
- feature-dod-login-copy-neutral: 로그인 정책 카피 중립성 지속성 (completed 1회, last QA-20260227-0017)
- feature-dod-login-policy-copy: 로그인 정책 카피 중립성 지속성 (completed 3회, last QA-20260227-0018)
- feature-dod-release-response-time-check: Feature/Release DoD: 핵심 응답시간 합격 (completed 1회, last QA-20260226-0005)
- feature-dod-security-review: Feature DoD: 보안 검토(입력 검증/인증/OWASP) (completed 1회, last QA-20260226-0006)
- feature-dod-system-start-guard: 비로그인 시스템 시작 가드 모달 동작 (completed 7회, last QA-20260227-0018)
- feature-dod-targeted-production-ai-qa-v81225: Production AI Assistant targeted QA (completed 1회, last QA-20260524-0580)
- feature-dod-validation-health-endpoints: 헬스/버전 API 검사 (Vercel) (completed 2회, last QA-20260227-0018)
- feature-dod-vitals-integration: vitals:integration 통합 실행 통과 (completed 1회, last QA-20260228-0028)
- feedback-trace-links-exposed: Feedback API direct trace links exposed for operator follow-up (completed 1회, last QA-20260322-0156)
- feedback-trace-ui-link-runtime-availability: Feedback API direct trace UI link runtime availability (completed 1회, last QA-20260322-0159)
- fix-analysis-basis-sanitization: 분석 근거 패널 내부 구현 정보 노출 제거 (completed 1회, last QA-20260408-0253)
- fix-multi-agent-tool-result-bubble: 멀티 에이전트 경로 tool_result 이벤트 누락 수정 (completed 1회, last QA-20260408-0253)
- follow-up-g2-guidance-cta-sidebar: Guidance messages render actionable CTA buttons in the production AI sidebar (completed 1회, last QA-20260515-0503)
- follow-up-g2-guidance-metadata-preservation: Guidance CTA metadata survives message transformation (completed 1회, last QA-20260515-0503)
- follow-up-g4-artifact-progress-contract: Chat artifact generation exposes staged progress message contract (completed 1회, last QA-20260515-0503)
- follow-up-line-guard-top7: Top 7 line-guard follow-up targets split below 650 lines (completed 1회, last QA-20260515-0503)
- frontend-ai-data-parity-gate: 프론트엔드 표시 상태와 AI 분석 상태 동일 슬롯 참조 검증 (completed 2회, last QA-20260324-0178)
- frontend-font-cursor-production-drift-20260518: Production shows recent font/cursor recovery state (completed 1회, last QA-20260518-0515)
- frontend-landing-v880: Landing page v8.8.0 정상 렌더링 (completed 2회, last QA-20260314-0097)
- frontend-score-deduction-followup: Close frontend score deduction follow-up gaps (completed 1회, last QA-20260513-0494)
- fullscreen-parity: 전체화면 전환 parity (completed 1회, last QA-20260419-0306)
- gitlab-tag-deploy-trace-v8113: GitLab tag deploy failure root cause analysis for v8.11.3 (completed 1회, last QA-20260408-0256)
- gitlab-tag-pipeline-v81119-release-blocked: Restore v8.11.19 semver tag deploy path before targeted production QA (completed 1회, last QA-20260417-0302)
- gitlab-tag-protected-variable-exposure-v8113: Fix GitLab protected variable exposure for semver tag deploy (completed 1회, last QA-20260409-0258)
- graphrag-traversal-keep-decision: Graph traversal keep/remove re-evaluation closed with KEEP decision (completed 1회, last QA-20260415-0285)
- group-disambiguation-ui: Explicit server groups bypass clarification UI and preserve group scope (completed 1회, last QA-20260524-0580)
- group-server-list-health-frame-scope: server_health intentFrame preserves raw group-list scope (completed 1회, last QA-20260524-0580)
- guest-auth-proof-cookie: 게스트 PIN 로그인 후 auth_proof 쿠키 발급 정상 (completed 2회, last QA-20260314-0097)
- guest-dashboard-auth-check: 게스트 대시보드 로컬 인증 체크 우회 보완 (completed 1회, last QA-20260310-0078)
- guest-flow-server-card-and-startflow-resilience: 게스트 플로우 시스템 시작/AI 진입 내성 보강 (completed 3회, last QA-20260302-0039)
- guest-login-pin-4231: 게스트 PIN 4231 로그인 및 세션 진입 (completed 1회, last QA-20260306-0052)
- guest-login-visibility-toggle: 게스트 로그인 버튼 노출 옵션화 (completed 2회, last QA-20260227-0013)
- guest-pin-login-flow: 게스트 PIN 인증 후 시스템 시작 버튼 노출 (completed 4회, last QA-20260227-0018)
- health-ai-500-production-probe: /api/health?service=ai production probe returns JSON instead of HTML 500 (completed 1회, last QA-20260429-0359)
- health-all-connected: Health API 전체 서비스 connected (completed 2회, last QA-20260314-0097)
- health-api: /api/health DB/cache/ai connected (completed 2회, last QA-20260419-0306)
- health-api-200-healthy: Health API 200 healthy (completed 3회, last QA-20260320-0140)
- health-api-response-format: Health API 응답 포맷 검증 스크립트 수정 (completed 1회, last QA-20260310-0077)
- health-development-cache-disabled: /api/health respects development cache disabled runtime config (completed 1회, last QA-20260429-0364)
- health-route-envelope-test-alignment: Health route envelope/cache typing 정렬 (completed 1회, last QA-20260325-0184)
- health-route-supabase-session-timeout: 헬스체크 Supabase 세션 프로브 타임아웃 강제 (completed 1회, last QA-20260325-0183)
- home-semantic-nav: 홈 페이지 nav 랜드마크 보강 (completed 1회, last QA-20260226-0009)
- incident-report-detail-button-affordance: Incident report detail action is visibly labeled and exposes expanded/collapsed state (completed 1회, last QA-20260519-0530)
- incident-report-non-degraded-pipeline: Incident report generation returns non-degraded Reporter Pipeline success (completed 1회, last QA-20260519-0529)
- intelligent-monitoring-analyze-server-normalization: analyze_server responses normalize to frontend artifact shape (completed 1회, last QA-20260519-0536)
- internal-disclosure-user-mode-v811112: General user-mode internal path disclosure blocked (completed 1회, last QA-20260507-0419)
- landing-ai-title-crisp-v811185: Landing hero AI text no longer uses blur-like filter/shadow intensity (completed 1회, last QA-20260520-0545)
- landing-bootstrap-auth-copy-hidden: 랜딩 첫 진입 bootstrap 인증 카피 숨김 (completed 1회, last QA-20260402-0206)
- landing-bootstrap-copy-hidden: 랜딩 첫 진입 시 bootstrap auth copy 비노출 처리 (completed 2회, last QA-20260408-0250)
- landing-copy-alignment: 랜딩/로그인 정책 카피 정합성 (completed 4회, last QA-20260227-0016)
- landing-custom-cursor-removal: Remove cursor-following white dot while preserving MouseSpotlight reaction (completed 1회, last QA-20260518-0517)
- landing-diagram-label-readability: Improve static architecture diagram label readability and simplify dense AI Assistant arrows (completed 1회, last QA-20260518-0518)
- landing-feature-card-modal-independent-title: Feature card modals open with card-specific titles (completed 1회, last QA-20260518-0514)
- landing-feature-cards: 랜딩 피처카드 4개 모달 (completed 1회, last QA-20260317-0114)
- landing-page-render: 랜딩 페이지 정상 렌더링 v8.11.20 (completed 4회, last QA-20260419-0306)
- landing-production-improvements-deployed: 랜딩 페이지 개선 사항 production 반영 및 검증 완료 (completed 1회, last QA-20260330-0197)
- landing-profile-bootstrap-state: 랜딩 초기 프로필 상태 텍스트 일관성 개선 (completed 1회, last QA-20260317-0120)
- landing-profile-label-content-name-mismatch: Landing profile button accessible name now satisfies label-in-name audit (completed 1회, last QA-20260424-0341)
- landing-system-start: 시스템 시작 카운트다운 (completed 1회, last QA-20260317-0114)
- landing-vibe-qa-finish-surface: Vibe Coding 모달에 QA / Finish 뷰 추가 (completed 1회, last QA-20260330-0196)
- langfuse-feedback-trace-propagation: AI feedback traceId propagation to Langfuse (completed 1회, last QA-20260320-0142)
- langfuse-monitoring-runtime-visibility: Langfuse runtime visibility on /monitoring (completed 1회, last QA-20260317-0116)
- langfuse-monitoring-traces-search: Langfuse monitoring traces search and auxiliary filtering (completed 1회, last QA-20260317-0117)
- langfuse-monitoring-traces-timeout: Authenticated /monitoring/traces endpoint times out in production (completed 1회, last QA-20260317-0113)
- langfuse-multi-agent-traceid-live-proof: 멀티에이전트 sampled traceId 실운영 실측 (completed 1회, last QA-20260317-0116)
- langfuse-multi-agent-traceid-propagation: 멀티에이전트 stream done metadata traceId 전파 (completed 1회, last QA-20260317-0115)
- legacy-rag-rpc-cleanup-contract-hardening: Expand Supabase migration contract coverage (completed 1회, last QA-20260510-0447)
- legacy-rag-rpc-cleanup-restrict-drop: Make legacy RAG RPC cleanup dependency-safe (completed 1회, last QA-20260510-0447)
- legacy-rag-rpc-doc-apply-checklist: Document pre/post Supabase DDL checks (completed 1회, last QA-20260510-0447)
- legacy-rag-rpc-live-dependency-inventory: Confirm live legacy RPC functions have no dependent objects (completed 1회, last QA-20260510-0447)
- legacy-rag-table-cleanup-deferred: Keep legacy data tables out of the RPC cleanup migration (completed 1회, last QA-20260510-0446)
- legacy-vector-graph-rag-rpc-cleanup-migration: Add migration that drops only unused legacy vector/graph RAG RPC functions (completed 1회, last QA-20260510-0446)
- line-guard-current-hotspots-refactor: Add line-count buffer for near-threshold AI Engine stream files (completed 2회, last QA-20260511-0470)
- linux-label-normalization: 대시보드 카드 OS 표기를 Linux로 정규화 (completed 1회, last QA-20260322-0157)
- live-supabase-advisor-post-ddl-check: Check Supabase advisors after DDL (completed 1회, last QA-20260510-0448)
- live-supabase-krl-smoke-after-rpc-cleanup: Verify Knowledge Retrieval Lite still works after DB cleanup (completed 1회, last QA-20260510-0448)
- live-supabase-legacy-rag-rpc-cleanup-applied: Apply legacy vector/graph RAG RPC cleanup to Supabase production (completed 1회, last QA-20260510-0448)
- live-supabase-post-check-legacy-rpc-removed: Verify legacy vector/graph RAG RPCs are removed while KRL RPC remains (completed 1회, last QA-20260510-0448)
- log-explorer-modal: 로그 탐색기 모달 (completed 1회, last QA-20260317-0114)
- login-copy-neutral: 로그인 정책 카피 중립성 개선 (completed 1회, last QA-20260227-0014)
- login-custom-cursor-scope-no-leak: Custom cursor scope does not leak into login page (completed 1회, last QA-20260518-0514)
- login-header-self-loop-cta: 로그인 페이지 헤더 self-loop CTA 제거 (completed 1회, last QA-20260401-0204)
- login-pin-form-structure: 게스트 PIN 입력 폼 구조 정리 (completed 1회, last QA-20260226-0001)
- logs-rolling-window-range-label: Logs 24h data-range label uses explicit rolling synthetic window wording (completed 1회, last QA-20260504-0405)
- math-tool-implementation-validation: AI 계산 툴 라우팅/실행 검증 (completed 1회, last QA-20260228-0027)
- metrics-drift-threshold-standard: 지표 드리프트 임계치 표준화 (completed 1회, last QA-20260302-0044)
- modal-backdrop-close: 모달 백드롭 클릭 닫기 안정화 (completed 2회, last QA-20260226-0002)
- modal-esc-close: ESC 모달 닫기 (completed 1회, last QA-20260317-0114)
- monitoring-artifact-envelope-render: Monitoring artifact envelope renders MD/JSON download CTAs (completed 1회, last QA-20260523-0571)
- monitoring-empty-server-fallback-options: Fake monitoring server options removed on empty data (completed 1회, last QA-20260503-0396)
- monitoring-factpack-consumer-evidence-ui: MonitoringFactPack consumer/evidence UI expansion (completed 1회, last QA-20260506-0417)
- monitoring-source-errors-bff-pass-through-v81189: Monitoring source errors preserve structured sourceMode/queryAsOf payload through Cloud Run and BFF (completed 1회, last QA-20260504-0401)
- multi-agent-orchestration: 멀티에이전트 오케스트레이션 활성화 (Steps A-E) (completed 1회, last QA-20260307-0053)
- multi-agent-tool-result-bubble-up: orchestrator-agent-stream.ts: tool_result yield 누락으로 분석 근거 영역 비어있던 문제 수정 (completed 1회, last QA-20260408-0252)
- multi-metric-and-guardv8.12.13-단일-메트릭-질의-부작용-없음-확인: multi-metric AND guard(v8.12.13): 단일 메트릭 질의 부작용 없음 확인 (completed 1회, last QA-20260523-0566)
- multi-metric-cpu-memory-and-routing: CPU+memory AND query returns composite current-metrics ranking (completed 1회, last QA-20260523-0571)
- negative-feedback-trace-preserved: Negative feedback traceId preserved through feedback submission (completed 1회, last QA-20260322-0155)
- next-dev-allowed-origins-loopback-parity: 127.0.0.1 dev-origin parity for OAuth smoke (completed 1회, last QA-20260412-0273)
- nivo-active-anomaly-highlight-visual-qa: Nivo active anomaly highlight rect is visible for active alert data (completed 1회, last QA-20260508-0424)
- nivo-storage-tooltip-visual-qa: Nivo slice tooltip is visible on storage-nfs-dc1-01 DISK hover (completed 1회, last QA-20260508-0424)
- nlq-entity-schema-provider-compatibility-v811157: NLQ EntitySchema provider-compatible required nullable fields (completed 1회, last QA-20260516-0508)
- nlq-provider-live-smoke-v811157: Run low-priority NLQ provider comparison smoke after v8.11.157 deployment (completed 1회, last QA-20260516-0507)
- off-domain-relative-date-grounding: Stop stale absolute dates in off-domain relative-date answers (completed 1회, last QA-20260421-0324)
- otel-데이터-무결성-24x15-완전: OTel 데이터 무결성 24x15 완전 (completed 1회, last QA-20260301-0032)
- p5-session-context-follow-up: AI Assistant follow-up queries preserve previous server scope across streaming and async job paths (completed 1회, last QA-20260525-0583)
- performance-bundle-excellent: 번들 성능 우수 (completed 1회, last QA-20260314-0096)
- planner-shadow-latency-precision: plannerShadow latency metadata no longer collapses to 0ms for fast production shadow decisions (completed 1회, last QA-20260504-0405)
- planning-backlog-clear: planning TODO 잔여 항목 정리 (completed 1회, last QA-20260226-0006)
- playwright-mcp-localhost-transport-probe: Playwright MCP localhost initialize/tools-list probe (completed 1회, last QA-20260523-0571)
- preview-dashboard-entry-20260313: Preview guest -> system start -> dashboard (completed 1회, last QA-20260313-0092)
- preview-guest-login-recovered-20260313: Preview guest login recovered after SESSION_SECRET sync (completed 1회, last QA-20260313-0092)
- preview-guest-session-secret-sync: SESSION_SECRET synced for guest session proof issuance (completed 1회, last QA-20260313-0092)
- preview-health-200-20260313: Preview /api/health 200 recovered (completed 1회, last QA-20260313-0092)
- preview-public-supabase-env-sync: Preview runtime env sync for NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY (completed 1회, last QA-20260313-0092)
- preview-recovery-dashboard-verification: Preview guest flow and dashboard recovery verified (completed 1회, last QA-20260313-0092)
- preview-stream-v2-smoke: Preview stream/v2 smoke verified after env recovery (completed 1회, last QA-20260313-0093)
- preview-stream-v2-smoke-20260313: Preview stream/v2 smoke returns 200 event-stream with X-AI-Latency-Ms (completed 1회, last QA-20260313-0093)
- prod-ai-sidebar-open-20260313: Production AI assistant sidebar opens with starter prompts (completed 1회, last QA-20260313-0094)
- prod-guest-flow-20260313: Production landing -> login -> guest PIN -> system start -> dashboard (completed 1회, last QA-20260313-0094)
- prod-health-200-20260313: Production /api/health 200 healthy after live deploy (completed 1회, last QA-20260313-0094)
- prod-security-block-api-contract-20260313: Production stream/v2 returns 400 security contract for blocked input (completed 1회, last QA-20260313-0095)
- prod-security-block-en-20260313: Production AI Chat blocks English prompt injection request (completed 1회, last QA-20260313-0095)
- prod-security-block-ko-20260313: Production AI Chat blocks Korean system prompt exposure request (completed 1회, last QA-20260313-0095)
- prod-security-block-no-raw-json-20260313: Blocked prompt UX hides raw JSON and security error internals (completed 1회, last QA-20260313-0095)
- prod-stream-v2-smoke-20260313: Production stream/v2 smoke returns 200 event-stream with cloud-run source (completed 1회, last QA-20260313-0094)
- production-console-init-cleanliness: Clear repeated production chunk init console error across core routes (completed 1회, last QA-20260421-0324)
- production-dashboard-render: 프로덕션 대시보드 렌더링 (completed 1회, last QA-20260317-0114)
- production-smoke-console-401-cleanliness: Production smoke console 401 resource noise 정리 (completed 3회, last QA-20260320-0140)
- profile-guest-login-state-v811161: Top-right profile dropdown reflects guest authenticated state (completed 1회, last QA-20260517-0510)
- profile-menu: 프로필 메뉴 접근성 이름에 visible user state 포함 (completed 2회, last QA-20260423-0339)
- profile-system-stop-state-drift-v811161: Profile dropdown system stop does not visibly clear running/dashboard state (completed 1회, last QA-20260517-0511)
- prompt-injection-block-smoke-v880: Prompt injection 차단 스모크 검증 (completed 1회, last QA-20260308-0056)
- provider-fallback-freshness-hardening: OpenRouter vision fallback disabled by default and Cerebras GPT-OSS short-output guard added (completed 1회, last QA-20260519-0536)
- q-new13-advisor-command-evidence: Q-NEW13 named server performance advice displays Advisor Agent command evidence (completed 1회, last QA-20260525-0587)
- q-new17-generic-metric-trend-routing: Q-NEW17 generic single-server 24h metric trend routes to monitoring-metric-trend (completed 1회, last QA-20260525-0586)
- q-new18-pronoun-follow-up-scope: Q-NEW18 대명사 follow-up 범위를 직전 서버 목록으로 제한 (completed 1회, last QA-20260525-0585)
- q-new7-disk-threshold: 디스크 60% 초과 서버 목록 — PASS (completed 1회, last QA-20260525-0584)
- q-new9-cpu-ranking: CPU 상위 3대 랭킹 — PASS (completed 1회, last QA-20260525-0584)
- q5-action-needed-risky-wording-route: 위험 서버 질의 ACTION_NEEDED_PATTERN 라우팅 보강 (completed 1회, last QA-20260524-0579)
- q5-is-action-needed-query-risk-pattern: isActionNeededQuery 위험 서버 표현 확장 (completed 1회, last QA-20260524-0579)
- qa-0346-core-routes-proof-gap: QA-20260424-0346 core-routes-smoke evidence gap closed with follow-up route/API smoke (completed 1회, last QA-20260424-0347)
- qa-doc-roadmap-current-status-alignment: QA DoD 로드맵 현재 상태 정합성 갱신 (completed 1회, last QA-20260309-0067)
- qa-expert-domain-tracking: QA 런에서 전문가 영역 적합성 추적 체계 도입 (completed 1회, last QA-20260226-0003)
- qa-final-report-historical-positioning: v8.7.1 최종 QA 리포트의 historical 성격 명시 (completed 1회, last QA-20260309-0067)
- query-pipeline-graphrag-removal-sdd: GraphRAG removal and KRL production closure (completed 1회, last QA-20260515-0506)
- query-pipeline-t2-evidencecards-ui-regression: T2 evidenceCards UI browser regression (completed 1회, last QA-20260515-0504)
- query-pipeline-t5-drop-legacy-graphrag-inventory: T5 Supabase legacy GraphRAG inventory removal (completed 1회, last QA-20260515-0505)
- query-pipeline-t7-v811154-production-qa: T7 Vercel production AI/KRL QA closure (completed 1회, last QA-20260515-0506)
- query-provider-devtools-hydration-fix: React Query Devtools hydration mismatch removal (completed 1회, last QA-20260420-0316)
- rag-engine-doc-link-repair: RAG, Vercel fair-use 문서 링크 경로 갱신 (completed 1회, last QA-20260228-0026)
- rag-smoke-coverage: Redis+Supabase RAG 경로 스모크 강화 (completed 2회, last QA-20260302-0039)
- react-19-2-6-patch-alignment: Align root React and React DOM to 19.2.6 (completed 1회, last QA-20260511-0474)
- readme-qa-evidence-sync-20260325: README QA evidence snapshot sync (completed 1회, last QA-20260325-0185)
- redis-circuit-health-schema-production: Cloud Run /health exposes redis circuit state as structured object (completed 1회, last QA-20260430-0375)
- release-dod-contract-test: Release DoD: API contract test 통과 (completed 1회, last QA-20260226-0008)
- release-dod-cost-gate: Release DoD: Cloud Run Free Tier 비용 가드 검증 (completed 1회, last QA-20260226-0008)
- release-dod-doc-gate: Release DoD: 문서 게이트 90일 갱신·메타데이터·아카이빙 정책 (completed 1회, last QA-20260228-0025)
- release-dod-test-gate: validate:all 0 에러 (completed 2회, last QA-20260302-0036)
- release-v811142-production-alignment: Align Frontend and AI Engine production deployments to v8.11.142 (completed 1회, last QA-20260513-0491)
- release-v81189-production-smoke: v8.11.89 production release smoke completed through GitLab CI semver tag pipeline (completed 1회, last QA-20260504-0401)
- reporter-agent-최초-직접-검증-장애-보고서-자동-생성-의존-서버-영향-범위-분석-명령어-포함: Reporter Agent 최초 직접 검증: 장애 보고서 자동 생성, 의존 서버 영향 범위 분석, 명령어 포함 (completed 1회, last QA-20260523-0568)
- reporter-agent-generate: Reporter Agent 보고서 생성 신뢰도 80% (completed 1회, last QA-20260419-0306)
- reporter-agent-pass: Reporter Agent 보고서 즉시 생성 정상 (completed 1회, last QA-20260326-0190)
- reporter-analyst-production-mcp-functional-check-v81136: Reporter and Analyst production MCP functional check on v8.11.36 (completed 1회, last QA-20260427-0352)
- reporter-degraded-artifact-metadata-v811172: Reporter degraded-success metadata is preserved through artifact rendering (completed 1회, last QA-20260518-0523)
- reporter-degraded-metadata-vercel-ui-boundary-v811172: Reporter metadata public UI/artifact boundary verified on Vercel production (completed 1회, last QA-20260518-0524)
- reporter-download-action-visibility-v81197: Reporter generated report exposes visible MD copy and download actions (completed 1회, last QA-20260505-0409)
- reporter-empty-cta-generate-v880: Reporter 빈 상태 CTA 생성 경로 검증 (completed 1회, last QA-20260308-0058)
- reporter-empty-cta-generate-v880-quality-recheck: Reporter 빈 상태 CTA 생성 경로 재검증 (completed 1회, last QA-20260308-0059)
- reporter-empty-cta-generate-v880-recheck-20260309: Reporter empty state CTA 생성 경로 재검증 (completed 4회, last QA-20260309-0068)
- reporter-fallback-monitoring-evidence-v811175: Reporter fallback reflects monitoring warning/critical evidence instead of normalizing it away (completed 1회, last QA-20260518-0527)
- reporter-fullscreen-generate-path: Reporter 전체 화면 생성 경로 검증 (completed 1회, last QA-20260318-0126)
- reporter-generate: Reporter 보고서 생성 (completed 1회, last QA-20260317-0114)
- reporter-generate-detail-v879: Reporter 보고서 생성 및 상세보기 (completed 1회, last QA-20260306-0052)
- reporter-generate-detail-v880: Reporter 생성 및 상세 렌더링 검증 (completed 2회, last QA-20260309-0069)
- reporter-no-incident-command-dedup-v811173: Reporter no-incident path deduplicates repeated top command actions (completed 1회, last QA-20260518-0525)
- reporter-primary-generate-button-empty-state: Reporter 상단 생성 버튼 empty state 동작 정합성 (completed 2회, last QA-20260315-0104)
- reporter-short-sla-violation-threshold-v811173: Reporter short snapshot SLA violation threshold avoids false severe violation (completed 1회, last QA-20260518-0525)
- reporter-sidebar-state-retention-chat-switch: Reporter 생성 결과가 sidebar chat 전환 후 유지 (completed 3회, last QA-20260320-0138)
- reporter-state-loss-on-tab-switch: Reporter 탭 전환 시 생성 결과 상태 유지 (completed 1회, last QA-20260315-0104)
- reporter-state-retention-chat-switch: Reporter 생성 결과가 chat 전환 후 유지 (completed 1회, last QA-20260318-0126)
- reporter-structured-output-local-fix: Reporter structured output schema local fix prepared (completed 1회, last QA-20260513-0495)
- reporter-structured-output-production-deploy: Deploy Reporter structured output schema fix (completed 1회, last QA-20260513-0496)
- reporter-timeline-disk-threshold-v811173: Reporter timeline records disk threshold breaches (completed 1회, last QA-20260518-0525)
- root-auth-session-lazy-imports: Defer auth/session/store heavy imports on the root path (completed 2회, last QA-20260422-0329)
- root-client-provider-prune: Remove unused root AccessibilityProvider wrapper (completed 1회, last QA-20260422-0326)
- root-client-runtime-split: Non-critical root client runtime modules split behind dynamic wrapper (completed 1회, last QA-20260419-0314)
- root-contract-test: npm run test:contract (completed 1회, last QA-20260514-0501)
- root-dev-instrumentation-noop: Skip dev env import in instrumentation register() (completed 1회, last QA-20260422-0326)
- root-global-effects-prune: Trim root global-effects.css and inline unused design-system helpers (completed 1회, last QA-20260422-0327)
- root-layout-font-preload-cleanup: Suppress repeated root font preload warnings on dashboard and fullscreen AI routes (completed 1회, last QA-20260417-0300)
- root-shell-startup-trace: Limit Tailwind source scanning to actual app code (completed 1회, last QA-20260422-0329)
- security-attack-regression-pack: 보안 공격 시나리오 회귀팩 구축 (completed 4회, last QA-20260320-0138)
- security-audit-logs-live-path-smoke: guest login route writes security_audit_logs on success (completed 1회, last QA-20260411-0271)
- security-headers-coop: COOP 헤더 추가 (Cross-Origin-Opener-Policy: same-origin-allow-popups) (completed 1회, last QA-20260329-0194)
- security-headers-misleading-remove: 수동 X-Vercel-Cache/X-Edge-Runtime 헤더 제거 (completed 1회, last QA-20260329-0194)
- security-headers-permissions-policy: deprecated interest-cohort=() Permissions-Policy 제거 (completed 1회, last QA-20260329-0194)
- sentry-error-boundary-tag-fix: error.tsx boundary 태그 수정 (global-error → root) (completed 1회, last QA-20260329-0194)
- sentry-global-error-boundary: global-error.tsx Sentry 에러 경계 연동 추가 (completed 1회, last QA-20260329-0194)
- server-card-badge-ai-prefill: 서버 카드 경고 배지 클릭 시 AI 사이드바 컨텍스트 자동 주입 (completed 1회, last QA-20260323-0165)
- server-card-click-only-disclosure: Server card progressive disclosure opens only via explicit toggle (completed 1회, last QA-20260509-0427)
- server-card-expand: 서버 카드 상세 펼치기/접기 (completed 1회, last QA-20260317-0114)
- server-detail-evidence: Specific server ID + metric detail prompts route to deterministic current-metric evidence (completed 1회, last QA-20260524-0580)
- server-detail-log-tab: 로그 & 네트워크 탭 (completed 1회, last QA-20260317-0114)
- server-detail-mobile-overflow: Mobile server detail has no page horizontal overflow or control overlap (completed 1회, last QA-20260508-0426)
- server-detail-perf-tab: 성능 분석 탭 (completed 1회, last QA-20260317-0114)
- server-modal-3tab-switch: 서버 모달 3탭 전환 (completed 1회, last QA-20260317-0114)
- show-more-servers: 12개 더 보기 버튼 (completed 1회, last QA-20260317-0114)
- static-architecture-diagram-svg-height-auto: Static architecture diagrams no longer emit invalid SVG height=auto console errors (completed 1회, last QA-20260518-0515)
- storybook-build-dev-smoke-pass: storybook build 및 dev smoke-test 통과 (completed 1회, last QA-20260315-0099)
- storybook-build-longrun-success: Storybook build 장시간 실행 성공 확인 (completed 1회, last QA-20260315-0102)
- storybook-lock-sync-10-2-10: Storybook lockfile 버전 동기화 (completed 1회, last QA-20260315-0102)
- storybook-next-module-shims: next/navigation/link/image/dynamic 등 Storybook shim 추가 (completed 1회, last QA-20260315-0099)
- storybook-react-vite-migration: Storybook Next.js preset 제거 및 react-vite 전환 (completed 1회, last QA-20260315-0099)
- storybook-sb-mock-fix: sb.mock()을 preview.ts로 이동하여 Storybook v10 호환성 수정 (completed 1회, last QA-20260302-0043)
- storybook-smoke-script-stable-port: Storybook smoke 테스트 스크립트 안정화 (completed 1회, last QA-20260315-0102)
- streaming-analysis-basis-data-source-promotion: 스트리밍 AI 응답의 데이터 소스 라벨을 실시간 데이터 분석으로 승격 (completed 1회, last QA-20260324-0175)
- streaming-parity-type-build-fix: Streaming parity deferred metadata type mismatch fix builds on production (completed 1회, last QA-20260324-0174)
- supabase-legacy-rag-rpc-readonly-inventory: Confirm legacy vector/graph RAG RPCs remain in Supabase (completed 1회, last QA-20260510-0446)
- supabase-low-value-unused-index-cleanup: Drop low-value unused operational indexes while preserving FK/RLS support (completed 1회, last QA-20260510-0454)
- supervisor-stream-contract-alignment: Supervisor stream sessionId/deviceType 계약 정렬 (completed 1회, last QA-20260325-0184)
- system-boot-api-checks: 시스템 부트 API 존재성/헬스 체크 (completed 2회, last QA-20260302-0039)
- system-boot-redirect: 시스템 시작 대시보드 리다이렉트 (completed 1회, last QA-20260301-0035)
- system-boot-sequence: 시스템 부트 시퀀스 완료 (completed 1회, last QA-20260419-0306)
- system-boot-vercel-auth-expectation-alignment: Production system-boot Playwright auth 기대값 정렬 (completed 1회, last QA-20260320-0138)
- system-start-api-success-false-ui-dashboard-v811161: System start UI proceeds to dashboard even when /api/system start returns success:false (completed 1회, last QA-20260517-0511)
- system-start-auth-modal-guard-stability: 시스템 시작 로그인 모달 노출 경로 검증 보강 (completed 2회, last QA-20260302-0038)
- system-start-login-modal: 비로그인 상태에서 시스템 시작 클릭 시 로그인 모달 노출 (completed 1회, last QA-20260227-0021)
- system-start-login-modal-redirect: 로그인 모달에서 로그인 페이지로 이동 (completed 1회, last QA-20260227-0022)
- system-start-metrics-gate: 시스템 시작 KPI 계측 (completed 2회, last QA-20260302-0038)
- threshold-filter-missing: 그룹+임계값 조합 질의에서 임계값 필터 적용 (completed 1회, last QA-20260523-0567)
- top5-server-detail: Top5 서버 상세 모달 (3탭) (completed 1회, last QA-20260317-0114)
- topology-map-render: 토폴로지 맵 완벽 렌더링 (completed 2회, last QA-20260314-0097)
- trend-routing: 트렌드 상승 질의가 monitoring-metric-trend 경로로 라우팅되지 않음 (completed 1회, last QA-20260524-0581)
- typescript-무결성: TypeScript 무결성 (completed 1회, last QA-20260301-0032)
- ui-esc-close: ESC 사이드바 닫기 (completed 1회, last QA-20260317-0114)
- ui-landing-pass: 랜딩 페이지 로드 정상, v8.10.0 확인 (completed 1회, last QA-20260326-0190)
- ui-ux-improvement-plan-p1-p3-closure: UI/UX improvement plan P1/P2/P3 implementation and local closure QA completed (completed 1회, last QA-20260509-0436)
- v8-12-14-db-threshold-regression: DB disk 60%+ threshold filter remains fixed on v8.12.16 (completed 2회, last QA-20260523-0570)
- v8-12-15-artifact-envelope-render: artifactEnvelopes transform preservation renders monitoring artifact card/CTA (completed 2회, last QA-20260523-0570)
- v8-12-15-auto-report-quickstart-dedupe: Auto Report quick-start remains deduped (completed 2회, last QA-20260523-0570)
- v8-12-16-embedded-tab-copy: Embedded AI function tab descriptions align with shared workspace copy (completed 1회, last QA-20260523-0570)
- v8.11.121-rag-krl-production-release: Release RAG/KRL cleanup and DB index improvements to production (completed 1회, last QA-20260510-0455)
- v8.11.122-ai-server-id-clarification-production-release: Release explicit server ID clarification fix to production (completed 1회, last QA-20260510-0457)
- v8.12.14-임계값-필터-fix-검증-db-60-질의에-2대만-반환-8.12.13-partial-pass: v8.12.14 임계값 필터 fix 검증: DB 60%+ 질의에 2대만 반환 (8.12.13 PARTIAL → PASS) (completed 1회, last QA-20260523-0568)
- v811119-production-release-smoke: v8.11.119 production release smoke passed (completed 1회, last QA-20260509-0437)
- v811120-production-release-smoke: v8.11.120 production release smoke passed (completed 1회, last QA-20260510-0438)
- v811122-explicit-server-id-production-regression: Explicit server ID questions no longer trigger broad server clarification (completed 1회, last QA-20260510-0458)
- v811158-production-deploy: Deploy NLQ schema provider compatibility fix to production (completed 1회, last QA-20260516-0509)
- v81195-dashboard-core-routes-playwright-recheck: Dashboard core routes and AI assistant tabs render in Vercel production (completed 1회, last QA-20260504-0404)
- v81195-vercel-playwright-ai-routing-recheck: AI ranking and formatting rewrite production routes remain stable on v8.11.95 (completed 1회, last QA-20260504-0404)
- validation-evidence-summary-clarity: Validation evidence summary 카피와 정보 우선순위 정리 (completed 1회, last QA-20260324-0171)
- validation-public-snapshot-artifact: Validation evidence public snapshot artifact 분리 (completed 1회, last QA-20260323-0168)
- validation-stale-banner-client-side-fix: Validation stale banner client-side age check fix (completed 1회, last QA-20260324-0170)
- vercel-ai-assistant-live-smoke-v811165: Verify Vercel production AI Assistant Chat, Reporter, and Analyst live paths (completed 1회, last QA-20260517-0512)
- vercel-build-fix: SessionState import 수정으로 Vercel 빌드 복구 (completed 1회, last QA-20260307-0053)
- vercel-deployment-drift-local-ai-changes: Today's local AI/NLQ/anomaly changes are deployed to Vercel production (completed 1회, last QA-20260519-0529)
- vercel-deployment-ready: Vercel 배포 3건 모두 READY (completed 1회, last QA-20260314-0096)
- vercel-playwright-mcp-v81189-targeted-qa: v8.11.89 Vercel production Playwright MCP targeted QA completed (completed 1회, last QA-20260504-0402)
- vercel-prod-ai-clarification: AI 질의 모호성 해소 UI 정상 렌더링 및 Fallback 응답 확인 (completed 1회, last QA-20260317-0114)
- vercel-prod-ai-guest-flow-v892: Vercel 프로덕션 게스트 부팅 + 대시보드 + AI 응답 + 피드백 경로 실측 (completed 1회, last QA-20260317-0119)
- vercel-prod-ai-sidebar: 대시보드 AI 어시스턴트 사이드바 열기/닫기 정상 (completed 1회, last QA-20260317-0114)
- vercel-prod-frontend-boot: Vercel 프로덕션 시스템 시작 부팅 플로우 정상 동작 (completed 1회, last QA-20260317-0114)
- vercel-usage-cli-empty-billing-period-handling: Vercel usage CLI empty billing period handling (completed 1회, last QA-20260402-0211)
- vibe-cicd-modal-local-dev-stale-view: 로컬 dev Vibe Coding 모달 stale view 해소 (completed 1회, last QA-20260331-0202)
- vibe-hybrid-delivery-wording: Vibe Coding 모달의 배포 설명을 하이브리드 전달 구조 기준으로 정정 (completed 1회, last QA-20260330-0200)
- vibe-qa-modal-replaced-with-cicd: Vibe Coding 모달의 QA 탭을 CI/CD 구조 설명으로 교체 (completed 1회, last QA-20260330-0200)
- vision-attachment-routing: Image/file attachments force Vision multi-agent route (completed 1회, last QA-20260519-0538)
- vision-gemini-primary-image-answer-quality: Gemini primary vision image answer quality verified for dashboard screenshot (completed 1회, last QA-20260520-0541)
- vision-gemini-routing-and-current-values: Gemini Vision routes correctly and reads current dashboard values (completed 1회, last QA-20260520-0542)
- vision-glm-fallback-http-500-quality: GLM vision fallback HTTP 500 resolved by removing GLM from Vision runtime (completed 1회, last QA-20260520-0543)
- vision-native-multimodal: Vision Agent image/file path uses native multimodal model call (completed 1회, last QA-20260519-0538)
- vision-production-latency-sample-refresh: Vision 최신 production latency 표본 보강 (completed 1회, last QA-20260421-0322)
- vitals-log-suppression: Web Vitals 통합 테스트 로그 억제 옵션 추가 (completed 1회, last QA-20260228-0028)
- was-서버-그룹-매핑v8.12.11-wasapplication-정확-라우팅-확인: WAS 서버 그룹 매핑(v8.12.11): was→application 정확 라우팅 확인 (completed 1회, last QA-20260523-0566)
- weekly-followup-planning-hygiene: Weekly follow-up planning hygiene and data slot policy updated (completed 1회, last QA-20260519-0536)
- weekly-hardening-production-post-deploy-retest: Deploy weekly hardening changes and rerun focused Vercel production QA (completed 1회, last QA-20260519-0537)
- zai-glm-vision-fallback-live-smoke: Z.AI GLM Vision fallback 실제 이미지 입력 live smoke 확인 (completed 1회, last QA-20260519-0539)
- zod-v4-ai-engine-migration: Migrate AI Engine from Zod v3 to Zod v4 (completed 1회, last QA-20260511-0471)

## Recent Runs

| Run ID | Time (UTC) | Scope | Release-Facing | In Summary | Title | Checks | Completed | Pending | Deferred | Wont-Fix | Expert Gaps |
|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|
| QA-20260525-0587 | 2026-05-25T00:41:31.507Z | targeted | yes | yes | Q-NEW13 Production QA - Advisor Command Evidence | 9 | 1 | 0 | 0 | 0 | 0 |
| QA-20260525-0586 | 2026-05-24T22:51:39.888Z | targeted | yes | yes | Q-NEW17 Production QA - Generic Metric Trend Routing | 7 | 1 | 0 | 0 | 0 | 0 |
| QA-20260525-0585 | 2026-05-24T21:25:11.046Z | targeted | yes | yes | v8.12.30 Q-NEW18 pronoun follow-up targeted production QA | 2 | 1 | 0 | 0 | 0 | 0 |
| QA-20260525-0584 | 2026-05-24T15:52:12.919Z | targeted | yes | yes | v8.12.28 신규 6문항 AI 어시스턴트 평가 — 디스크필터·Advisor·팔로업·AZ비교·네트워크 | 6 | 2 | 0 | 0 | 4 | 0 |
| QA-20260525-0583 | 2026-05-24T15:31:45.890Z | targeted | yes | yes | v8.12.28 AI Assistant contextual follow-up live QA | 8 | 1 | 0 | 0 | 0 | 0 |
| QA-20260524-0582 | 2026-05-24T12:29:51.034Z | targeted | no | no | 6차 AI 어시스턴트 평가 — v8.12.17~25 수정사항 검증 (Playwright MCP) | 6 | 0 | 0 | 0 | 0 | 0 |
| QA-20260524-0581 | 2026-05-24T11:45:40.608Z | targeted | no | no | v8.12.25 AI Engine trend routing local regression closure | 6 | 1 | 0 | 0 | 0 | 0 |
| QA-20260524-0580 | 2026-05-24T10:29:54.220Z | targeted | yes | yes | v8.12.25 AI Assistant server detail and group routing targeted QA | 2 | 6 | 0 | 0 | 0 | 0 |
| QA-20260524-0579 | 2026-05-24T07:21:06.892Z | targeted | yes | yes | v8.12.20 신규 AI Assistant 6문항 QA - 목록 가독성·위험 라우팅·트렌드 관찰 | 6 | 4 | 1 | 0 | 2 | 1 |
| QA-20260524-0578 | 2026-05-24T06:37:24.413Z | targeted | yes | yes | v8.12.20 Q5 Fix QA - 위험 서버 조회 라우팅 검증 | 1 | 0 | 0 | 0 | 0 | 0 |
| QA-20260524-0577 | 2026-05-24T05:05:22.864Z | targeted | no | yes | v8.12.19 Playwright MCP QA — P1~P4 routing fix regression + portfolio | 5 | 0 | 0 | 0 | 0 | 0 |
| QA-20260524-0576 | 2026-05-24T02:47:28.531Z | targeted | yes | yes | v8.12.19 production targeted QA - healthy filter closure | 1 | 1 | 0 | 0 | 0 | 0 |
| QA-20260524-0575 | 2026-05-24T02:26:16.493Z | targeted | yes | yes | v8.12.18 production targeted QA - healthy filter recheck | 1 | 0 | 1 | 0 | 0 | 1 |
| QA-20260524-0574 | 2026-05-24T02:01:17.511Z | targeted | yes | yes | Cloud Run 94ce8471b production targeted QA - AI routing closure check | 3 | 2 | 1 | 0 | 0 | 2 |
| QA-20260524-0573 | 2026-05-23T17:08:54.211Z | targeted | yes | yes | v8.12.17 production targeted QA - AI v8.12.16 follow-up closure | 9 | 4 | 0 | 0 | 0 | 1 |
| QA-20260524-0572 | 2026-05-23T15:52:37.929Z | targeted | yes | yes | v8.12.16 AI 어시스턴트 5차 평가 — 미테스트 6문항 (cache그룹·역방향필터·최솟값·그룹+예측·Advisor·세션컨텍스트) | 6 | 0 | 0 | 0 | 0 | 1 |
| QA-20260523-0571 | 2026-05-23T14:54:43.243Z | targeted | yes | yes | QA-20260523-0571 v8.12.16 focused Vercel QA - MCP transport, multi-metric, threshold, artifact envelope | 9 | 4 | 0 | 0 | 1 | 1 |
| QA-20260523-0570 | 2026-05-23T11:30:48.477Z | targeted | yes | yes | v8.12.16 focused Vercel production QA - embedded tab copy, artifact envelope, DB threshold | 6 | 4 | 0 | 0 | 0 | 1 |
| QA-20260523-0569 | 2026-05-23T10:19:45.964Z | targeted | yes | yes | v8.12.15 focused Vercel production QA - quick-start, artifact envelope, DB threshold | 7 | 3 | 0 | 0 | 1 | 2 |
| QA-20260523-0568 | 2026-05-23T08:57:58.383Z | targeted | yes | yes | v8.12.14 신규 7문항 평가 - 임계값픽스재검증·스토리지·LB그룹·CPU+디스크AND·디스크랭킹·CPU트렌드·Reporter | 7 | 4 | 0 | 0 | 1 | 0 |
