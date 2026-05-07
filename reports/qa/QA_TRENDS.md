# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-05-07 22:13:52 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 418 |
| Counted Runs | 344 |
| Total Checks | 3017 |
| Total Passed | 2908 |
| Total Failed | 100 |
| Overall Pass Rate | 96.39% |
| Latest Recorded Run | QA-20260507-0420 |
| Last Counted Run | QA-20260507-0420 |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-06T03:06:42.069Z -> 2026-05-07T03:06:42.069Z (24h)
- Runs with observations: 4 recorded / 4 counted
- Samples: 7

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Supervisor | cloud-run-ai-engine | 2 | 24208ms | 45500ms | - | - | 2915ms | 2915ms | QA-20260507-0418 |
| Supervisor | unknown | 3 | 4723ms | 6228ms | 1113ms | 1259ms | 5064ms | 5064ms | QA-20260507-0418 |
| Reporter Agent | unknown | 1 | 3599ms | 3599ms | - | - | - | - | QA-20260506-0415 |
| Analyst Agent | deterministic | 1 | 1273ms | 1273ms | - | - | - | - | QA-20260506-0415 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-06T03:06:42.069Z -> 2026-05-07T03:06:42.069Z (24h)
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
| All Counted Runs | 344 | 3017 | 96.39% | 61 | 17.73% | 67 | 19.48% |
| Last 30 Counted Runs | 30 | 327 | 96.64% | 4 | 13.33% | 4 | 13.33% |
| Last 10 Counted Runs | 10 | 71 | 95.77% | 2 | 20% | 2 | 20% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 38 | 631 | 96.51% | 10 | 26.32% |
| Last 5 Gate Runs | 5 | 120 | 93.33% | 2 | 40% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 6 | 76 | 100% | 0 | 0% |
| Last 5 Release-Gate Runs | 5 | 59 | 100% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| targeted | 238 | 165 |
| legacy | 137 | 137 |
| broad | 33 | 32 |
| release-gate | 6 | 6 |
| smoke | 4 | 4 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 43 | 7 | 16.28% | 0 | 0 | 0% | 43 | 0 |
| P1 | 217 | 81 | 37.33% | 0 | 0 | 0% | 212 | 5 |
| P2 | 186 | 49 | 26.34% | 0 | 0 | 0% | 171 | 15 |
| P3 | 24 | 12 | 50% | 0 | 0 | 0% | 23 | 1 |
| P4 | 1 | 0 | 0% | 0 | 0 | 0% | 0 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
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
| dpl_Gv9w8CVdcJhejv1UUdYrWRyZyqSb | vercel-production | 2 | 34 | 100% | 0 | 0% | QA-20260504-0404 | b4ea434c |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-04-22 | 1 | 15 | 93.33% | 1 | 1 | 100% |
| 2026-04-23 | 6 | 65 | 95.38% | 2 | 2 | 33.33% |
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

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260506-0415 | 2026-05-06T06:28:57.301Z | targeted | 1 | 1 | 0 | 0 | v8.11.108 AI Advanced Surface Targeted QA |
| QA-20260505-0409 | 2026-05-05T03:39:15.190Z | targeted | 2 | 1 | 0 | 0 | v8.11.104 Residual Production Targeted QA |
| QA-20260505-0407 | 2026-05-04T23:33:01.502Z | broad | 6 | 5 | 0 | 0 | Vercel Playwright MCP Broad QA - v8.11.97 full surface and AI quality |
| QA-20260504-0405 | 2026-05-04T09:01:43.674Z | broad | 2 | 1 | 0 | 0 | v8.11.96 Vercel Playwright MCP Recheck |
| QA-20260430-0377 | 2026-04-30T05:14:43.053Z | targeted | 1 | 1 | 0 | 0 | Vercel Playwright QA - v8.11.69 Dashboard Navigation Contrast |
| QA-20260430-0374 | 2026-04-29T18:53:53.244Z | targeted | 1 | 0 | 0 | 1 | Vercel Playwright targeted QA - v8.11.64 AI alert-status advisory rerun |
| QA-20260429-0372 | 2026-04-29T14:03:32.361Z | targeted | 2 | 1 | 0 | 0 | Vercel Playwright targeted QA - v8.11.63 AI slot propagation recheck |
| QA-20260429-0371 | 2026-04-29T13:26:06.547Z | targeted | 2 | 1 | 0 | 0 | Vercel Playwright targeted QA - v8.11.62 dashboard AI data slot drift |
| QA-20260429-0369 | 2026-04-29T07:43:13.729Z | targeted | 2 | 2 | 0 | 0 | Vercel Production QA - AI Sidebar Cerebras Qwen Recheck |
| QA-20260429-0365 | 2026-04-29T04:25:34.157Z | targeted | 1 | 0 | 0 | 1 | Cloud Tasks Job Dispatch Fresh Browser Production Recheck - v8.11.58 |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
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
