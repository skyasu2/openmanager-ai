# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-05-09 14:37:59 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 432 |
| Counted Runs | 351 |
| Total Checks | 3067 |
| Total Passed | 2943 |
| Total Failed | 114 |
| Overall Pass Rate | 95.96% |
| Latest Recorded Run | QA-20260509-0434 |
| Last Counted Run | QA-20260509-0432 |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-08T05:36:57.749Z -> 2026-05-09T05:36:57.749Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| - | - | 0 | - | - | - | - | - | - | - |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-08T05:36:57.749Z -> 2026-05-09T05:36:57.749Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%
- Classification counts: {}
- Reason code counts: {}

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 2 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260504-0405 (broad), QA-20260505-0407 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 351 | 3067 | 95.96% | 65 | 18.52% | 72 | 20.51% |
| Last 30 Counted Runs | 30 | 307 | 91.53% | 8 | 26.67% | 9 | 30% |
| Last 10 Counted Runs | 10 | 76 | 80.26% | 4 | 40% | 5 | 50% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 39 | 644 | 96.43% | 10 | 25.64% |
| Last 5 Gate Runs | 5 | 102 | 91.18% | 2 | 40% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 6 | 76 | 100% | 0 | 0% |
| Last 5 Release-Gate Runs | 5 | 59 | 100% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| targeted | 251 | 171 |
| legacy | 137 | 137 |
| broad | 34 | 33 |
| release-gate | 6 | 6 |
| smoke | 4 | 4 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 43 | 7 | 16.28% | 0 | 0 | 0% | 43 | 0 |
| P1 | 225 | 85 | 37.78% | 1 | 1 | 100% | 219 | 5 |
| P2 | 194 | 52 | 26.8% | 1 | 1 | 100% | 178 | 15 |
| P3 | 26 | 12 | 46.15% | 0 | 0 | 0% | 25 | 1 |
| P4 | 1 | 0 | 0% | 0 | 0 | 0% | 0 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_72ENkX6i3W35AnYpDLPdFVyRDMDz | vercel-production | 1 | 13 | 100% | 0 | 0% | QA-20260508-0425 | e0d19690 |
| v8.11.113 | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260507-0420 | e0d19690 |
| dpl_8Mef9Ac714R8xStDrn5weLHBxfzQ | vercel-production | 1 | 7 | 100% | 0 | 0% | QA-20260507-0419 | 89628b5f |
| dpl_GqHLaUbqvG6cASfwcM3dVfAbk12m | vercel-production | 1 | 11 | 100% | 0 | 0% | QA-20260507-0418 | ce53f6e4 |
| dpl_6GzAoiA64FgYrDUoRnkuGSbsocNn | vercel-production | 1 | 4 | 100% | 0 | 0% | QA-20260506-0416 | 0933fdb1 |
| dpl_6aLTSBYbFKpCziucwaS4MbyHc8KQ | vercel-production | 2 | 13 | 92.31% | 1 | 50% | QA-20260506-0415 | cd2a672f |
| dpl_2Lfez1J8G5WkMtoAcey5bBZvjKzM | vercel-production | 1 | 13 | 100% | 0 | 0% | QA-20260506-0413 | 4f9663fa |
| dpl_CmEcaLdhB64hMEiDxkmY9KQBGBT7 | vercel-production | 1 | 6 | 100% | 0 | 0% | QA-20260505-0412 | 0f305d78 |
| dpl_CXJM2jVTN9xUBJHogHEdkmR8oENJ | vercel-production | 1 | 3 | 100% | 0 | 0% | QA-20260505-0410 | e8c8f73d |
| dpl_3gio8RbSgi9PCptxFLBJtSFhr6j2 | vercel-production | 2 | 14 | 85.71% | 1 | 50% | QA-20260505-0409 | 30c48e80 |
| dpl_i3dRjeFgabpTKkJU3oR9XDDgd3sA | vercel-production | 2 | 52 | 88.46% | 1 | 50% | QA-20260505-0407 | 1bdb98f4 |
| dpl_B35XZVaua7VJtBjeNzFxrmZNEbHo | vercel-production | 1 | 24 | 91.67% | 1 | 100% | QA-20260504-0405 | 06384b2c |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-04-24 | 8 | 133 | 99.25% | 1 | 1 | 12.5% |
| 2026-04-27 | 6 | 56 | 96.43% | 0 | 0 | 0% |
| 2026-04-28 | 4 | 39 | 97.44% | 1 | 1 | 25% |
| 2026-04-29 | 10 | 126 | 94.44% | 4 | 4 | 40% |
| 2026-04-30 | 11 | 114 | 98.25% | 2 | 2 | 18.18% |
| 2026-05-01 | 3 | 32 | 100% | 0 | 0 | 0% |
| 2026-05-02 | 4 | 35 | 100% | 0 | 0 | 0% |
| 2026-05-03 | 7 | 67 | 100% | 0 | 0 | 0% |
| 2026-05-04 | 5 | 82 | 97.56% | 1 | 1 | 20% |
| 2026-05-05 | 6 | 75 | 89.33% | 2 | 2 | 33.33% |
| 2026-05-06 | 4 | 30 | 96.67% | 1 | 1 | 25% |
| 2026-05-07 | 3 | 26 | 100% | 0 | 0 | 0% |
| 2026-05-08 | 2 | 20 | 95% | 0 | 0 | 0% |
| 2026-05-09 | 5 | 30 | 53.33% | 4 | 5 | 100% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260509-0432 | 2026-05-09T00:32:58.510Z | targeted | 0 | 2 | 0 | 0 | Vercel Production AI Ops B4/B5 Closure Retest - v8.11.118 |
| QA-20260509-0431 | 2026-05-09T00:05:28.683Z | targeted | 2 | 3 | 0 | 0 | Vercel Production AI Ops B4/B5 Submit Boundary Retest - v8.11.117 |
| QA-20260509-0430 | 2026-05-08T17:45:28.422Z | targeted | 2 | 3 | 0 | 0 | Vercel Production AI Ops Command Guidance Retest - v8.11.116 |
| QA-20260509-0429 | 2026-05-08T16:33:50.518Z | targeted | 5 | 3 | 0 | 0 | Vercel Production AI Ops Conversational Retest - v8.11.114 |
| QA-20260509-0428 | 2026-05-08T15:49:21.373Z | targeted | 5 | 4 | 0 | 0 | Vercel Production AI Ops Conversational QA - 15 Scenario Pack |
| QA-20260506-0415 | 2026-05-06T06:28:57.301Z | targeted | 1 | 1 | 0 | 0 | v8.11.108 AI Advanced Surface Targeted QA |
| QA-20260505-0409 | 2026-05-05T03:39:15.190Z | targeted | 2 | 1 | 0 | 0 | v8.11.104 Residual Production Targeted QA |
| QA-20260505-0407 | 2026-05-04T23:33:01.502Z | broad | 6 | 5 | 0 | 0 | Vercel Playwright MCP Broad QA - v8.11.97 full surface and AI quality |
| QA-20260504-0405 | 2026-05-04T09:01:43.674Z | broad | 2 | 1 | 0 | 0 | v8.11.96 Vercel Playwright MCP Recheck |
| QA-20260430-0377 | 2026-04-30T05:14:43.053Z | targeted | 1 | 1 | 0 | 0 | Vercel Playwright QA - v8.11.69 Dashboard Navigation Contrast |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
| ai-ops-empty-response-timeout | P1 | pending | 5 | QA-20260509-0432 | AI ops QA empty response/timeouts for A5 and C2 remain unresolved after command guidance closure |
| ai-ops-haproxy-context-specificity | P2 | pending | 4 | QA-20260509-0432 | HAProxy service context answer omits CPU/backend distribution detail |
| feature-dod-tsc-zero-error | P2 | wont-fix | 9 | QA-20260307-0053 | tsc --noEmit 0 에러 |
| feature-dod-unit-tests | P2 | wont-fix | 9 | QA-20260307-0053 | 단위 테스트 158개 통과 |
| obs-fp-fn-weekly-report | P1 | wont-fix | 3 | QA-20260227-0013 | 오탐/미탐 주간 리포트 자동 생성 |
| ai-server-timing-header-production | P1 | wont-fix | 2 | QA-20260310-0081 | Server-Timing header visibility in production |
| ai-thinking-visualizer-contract-drift | P1 | wont-fix | 2 | QA-20260428-0357 | Thinking visualizer production UI contract drift |
| ai-cold-start-latency | P2 | wont-fix | 2 | QA-20260327-0193 | Cloud Run cold start 레이턴시 최적화 |
| landing-console-api-system-unauthorized | P1 | wont-fix | 1 | QA-20260330-0195 | 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |
| ai-agent-type-metadata | P2 | wont-fix | 1 | QA-20260326-0190 | AI Chat 에이전트 타입 메타데이터 표시 개선 |
| ai-metric-ranking-memory-path-metadata | P2 | wont-fix | 1 | QA-20260418-0304 | Memory top-N query should expose deterministic metric-ranking path instead of filter fallback metadata |

## Most Repeated Completed Items

| ID | Completed Count | Seen | Last Seen Run | Title |
|---|---:|---:|---|---|
| feature-dod-system-start-guard | 7 | 7 | QA-20260227-0018 | 비로그인 시스템 시작 가드 모달 동작 |
| feature-dod-lint-zero-error | 5 | 7 | QA-20260302-0044 | lint 0 에러 |
| dashboard-health-v880-recheck | 5 | 5 | QA-20260309-0068 | 프로덕션 대시보드 및 Health API 재검증 |
| landing-copy-alignment | 4 | 8 | QA-20260227-0016 | 랜딩/로그인 정책 카피 정합성 |
| security-attack-regression-pack | 4 | 8 | QA-20260320-0138 | 보안 공격 시나리오 회귀팩 구축 |
| landing-page-render | 4 | 5 | QA-20260419-0306 | 랜딩 페이지 정상 렌더링 v8.11.20 |
| ai-chat-response-quality-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | AI Chat 응답 품질 및 권고 재검증 |
| analyst-full-analysis-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | Analyst 전체 분석 경로 재검증 |
| guest-pin-login-flow | 4 | 4 | QA-20260227-0018 | 게스트 PIN 인증 후 시스템 시작 버튼 노출 |
| reporter-empty-cta-generate-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | Reporter empty state CTA 생성 경로 재검증 |

## Definitions

- Counted Run: `countsTowardSummary !== false` 인 run.
- Failing Run: `checks.failed > 0` 인 counted run.
- Regression Run: `checks.failed > 0` 또는 `pendingCount > 0` 인 counted run.
- Deferred / Wont-Fix 는 추세에서 별도 표기하되 regression rate 계산에는 포함하지 않는다.
