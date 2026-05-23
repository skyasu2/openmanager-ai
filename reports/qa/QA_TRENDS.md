# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-05-23 12:39:56 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 563 |
| Counted Runs | 448 |
| Total Checks | 4070 |
| Total Passed | 3908 |
| Total Failed | 145 |
| Overall Pass Rate | 96.02% |
| Latest Recorded Run | QA-20260523-0565 |
| Last Counted Run | QA-20260523-0565 |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-22T03:18:05.556Z -> 2026-05-23T03:18:05.556Z (24h)
- Runs with observations: 3 recorded / 3 counted
- Samples: 5

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Metrics Query Agent | cloud-run-deterministic | 5 | 536ms | 1662ms | - | - | - | - | QA-20260523-0565 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-22T03:18:05.556Z -> 2026-05-23T03:18:05.556Z (24h)
- Runs with observations: 6 recorded / 4 counted
- Samples: 25
- Drift rate: 24%
- Classification counts: {"matched":17,"drift":6,"unknown":2}
- Reason code counts: {}

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| reporter-agent | single-agent | 1 | 0% | 30000ms | 30000ms | QA-20260522-0559 |
| /api/ai/supervisor/stream/v2 | single-agent | 7 | 85.71% | 4571ms | 25000ms | QA-20260522-0562 |
| /api/ai/supervisor/stream/v2 | deterministic | 15 | 0% | 184ms | 1662ms | QA-20260522-0564 |
| /api/ai/supervisor/stream/v2 | multi-agent | 1 | 0% | 0ms | 0ms | QA-20260522-0559 |
| anomaly-detection | deterministic | 1 | 0% | 0ms | 0ms | QA-20260522-0559 |

## Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 448 | 4070 | 96.02% | 79 | 17.63% | 87 | 19.42% |
| Last 30 Counted Runs | 30 | 282 | 93.97% | 4 | 13.33% | 4 | 13.33% |
| Last 10 Counted Runs | 10 | 61 | 90.16% | 0 | 0% | 0 | 0% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 43 | 709 | 96.05% | 11 | 25.58% |
| Last 5 Gate Runs | 5 | 78 | 92.31% | 1 | 20% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 9 | 123 | 99.19% | 0 | 0% |
| Last 5 Release-Gate Runs | 5 | 62 | 98.39% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| targeted | 376 | 262 |
| legacy | 137 | 137 |
| broad | 35 | 34 |
| release-gate | 9 | 9 |
| smoke | 5 | 5 |
| regression | 1 | 1 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 47 | 10 | 21.28% | 0 | 0 | 0% | 47 | 0 |
| P1 | 292 | 105 | 35.96% | 0 | 0 | 0% | 285 | 7 |
| P2 | 289 | 59 | 20.42% | 0 | 0 | 0% | 261 | 28 |
| P3 | 44 | 14 | 31.82% | 0 | 0 | 0% | 39 | 5 |
| P4 | 1 | 0 | 0% | 0 | 0 | 0% | 0 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| gitlab-pipeline-2546194670 | cloud-run-production | 1 | 1 | 100% | 0 | 0% | QA-20260522-0564 | 2e80bd62 |
| gitlab-pipeline-2546072069 | vercel-production | 1 | 3 | 100% | 0 | 0% | QA-20260522-0563 | eb128e80 |
| dpl_EfWEBPcgUWKRjCh29WZfbSNypakd | vercel-production | 1 | 5 | 100% | 0 | 0% | QA-20260522-0558 | 1b0b329b |
| dpl_3fT6D3HjyvNkoAhu43FN8bGaUu5H | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260522-0556 | 4c79450c |
| dpl_FrMjb4v1eLLxXCYTAToTunPivZWf | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260522-0555 | 3c4df7a6 |
| dpl_9tVqnvdBXyaHqEAiXNHgnYrEmnLp | vercel-production | 1 | 10 | 100% | 0 | 0% | QA-20260521-0553 | b21e0aff |
| dpl_8ciG6QnRbVu5zh95pJWwF16vibKG | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260521-0551 | c989e47d |
| dpl_7xf2j9vHZkGBYwdk71i4vdy4pNXq | vercel-production | 2 | 26 | 100% | 0 | 0% | QA-20260521-0550 | 562ada66 |
| dpl_9bYYW82UPUbGRuBTcqFHvQniCW5V | vercel-production | 1 | 9 | 100% | 0 | 0% | QA-20260521-0548 | 02d08f22 |
| dpl_8WCBUoDexHcw36bifUAUdHb6S5aN | vercel-production | 1 | 6 | 100% | 0 | 0% | QA-20260521-0547 | edb28d01 |
| vercel-production-v8.11.189 | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260520-0546 | 41c9bb7f |
| dpl_5ViT7mQKcqXoWjn3DZK8anmXenRp | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260520-0545 | 5dc58936 |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-09 | 8 | 42 | 66.67% | 4 | 5 | 62.5% |
| 2026-05-10 | 22 | 263 | 98.86% | 1 | 2 | 9.09% |
| 2026-05-11 | 3 | 27 | 96.3% | 1 | 1 | 33.33% |
| 2026-05-12 | 9 | 73 | 91.78% | 3 | 3 | 33.33% |
| 2026-05-13 | 7 | 59 | 98.31% | 1 | 1 | 14.29% |
| 2026-05-14 | 4 | 42 | 95.24% | 1 | 1 | 25% |
| 2026-05-15 | 4 | 63 | 100% | 0 | 0 | 0% |
| 2026-05-17 | 3 | 29 | 93.1% | 1 | 1 | 33.33% |
| 2026-05-18 | 13 | 173 | 96.53% | 2 | 2 | 15.38% |
| 2026-05-19 | 10 | 104 | 92.31% | 3 | 3 | 30% |
| 2026-05-20 | 3 | 36 | 91.67% | 1 | 1 | 33.33% |
| 2026-05-21 | 8 | 78 | 100% | 0 | 0 | 0% |
| 2026-05-22 | 7 | 43 | 86.05% | 0 | 0 | 0% |
| 2026-05-23 | 1 | 1 | 100% | 0 | 0 | 0% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260520-0544 | 2026-05-20T08:08:43.778Z | targeted | 3 | 2 | 0 | 0 | Vercel Playwright MCP Targeted QA - v8.11.184 dashboard and AI state |
| QA-20260519-0535 | 2026-05-19T05:14:14.572Z | broad | 4 | 0 | 0 | 3 | v8.11.179 Chrome DevTools MCP QA - AI Assistant 미검증 영역 집중 테스트 |
| QA-20260519-0533 | 2026-05-19T02:49:58.801Z | targeted | 2 | 0 | 0 | 0 | v8.11.178 내용 충실도 검증 — AI 수치 정합성·응답 경로·신호 강도 |
| QA-20260519-0528 | 2026-05-18T19:14:20.082Z | targeted | 2 | 2 | 0 | 1 | v8.11.175 Vercel Playwright MCP AI NLQ/Anomaly Drift Check |
| QA-20260518-0514 | 2026-05-17T16:45:19.291Z | targeted | 4 | 3 | 0 | 0 | Vercel Playwright MCP - Recent Regression Check |
| QA-20260518-0513 | 2026-05-17T16:04:28.616Z | targeted | 1 | 0 | 0 | 0 | AI Env Disclosure Guard Targeted QA |
| QA-20260517-0510 | 2026-05-16T16:03:37.386Z | targeted | 2 | 2 | 0 | 0 | v8.11.161 Production Playwright MCP - Dashboard Cards, Profile State, System Controls |
| QA-20260514-0498 | 2026-05-14T01:59:28.858Z | targeted | 2 | 2 | 0 | 0 | Vercel Playwright MCP QA - v8.11.146 AI Five-Question Release Check |
| QA-20260513-0495 | 2026-05-13T05:02:59.311Z | targeted | 1 | 1 | 0 | 0 | Production QA - v8.11.143 AI Assistant 3-Feature Check |
| QA-20260512-0484 | 2026-05-12T03:58:50.223Z | targeted | 2 | 3 | 0 | 0 | Vercel Playwright QA - AI semantic routing regression check on v8.11.132 |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
| feature-dod-tsc-zero-error | P2 | wont-fix | 9 | QA-20260307-0053 | tsc --noEmit 0 에러 |
| feature-dod-unit-tests | P2 | wont-fix | 9 | QA-20260307-0053 | 단위 테스트 158개 통과 |
| obs-fp-fn-weekly-report | P1 | wont-fix | 3 | QA-20260227-0013 | 오탐/미탐 주간 리포트 자동 생성 |
| ai-server-timing-header-production | P1 | wont-fix | 2 | QA-20260310-0081 | Server-Timing header visibility in production |
| ai-thinking-visualizer-contract-drift | P1 | wont-fix | 2 | QA-20260428-0357 | Thinking visualizer production UI contract drift |
| ai-cold-start-latency | P2 | wont-fix | 2 | QA-20260327-0193 | Cloud Run cold start 레이턴시 최적화 |
| analyst-single-server-response-mismatch | P1 | wont-fix | 1 | QA-20260519-0535 | Analyst 단일 서버 분석 응답 구조 불일치 수정 |
| landing-console-api-system-unauthorized | P1 | wont-fix | 1 | QA-20260330-0195 | 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |
| server-comparison-deterministic-path | P1 | wont-fix | 1 | QA-20260522-0559 | 서버 1:1 비교 쿼리 deterministic 경로 미확립 |

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
