# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-05-13 11:53:04 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 490 |
| Counted Runs | 392 |
| Total Checks | 3485 |
| Total Passed | 3351 |
| Total Failed | 124 |
| Overall Pass Rate | 96.15% |
| Latest Recorded Run | QA-20260513-0492 |
| Last Counted Run | QA-20260513-0492 |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-12T02:51:02.949Z -> 2026-05-13T02:51:02.949Z (24h)
- Runs with observations: 5 recorded / 5 counted
- Samples: 15

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Supervisor | cloud-run-ai-engine | 6 | 4729ms | 15964ms | - | - | 4729ms | 15964ms | QA-20260512-0485 |
| Supervisor | vercel-bff-cloud-run | 5 | 4519ms | 12587ms | - | - | 4519ms | 12587ms | QA-20260512-0486 |
| Supervisor | groq | 2 | 1736ms | 2569ms | - | - | 1736ms | 2569ms | QA-20260512-0488 |
| Cloud Run AI | groq | 1 | 1074ms | 1074ms | - | - | 1074ms | 1074ms | QA-20260512-0487 |
| Supervisor | deterministic | 1 | 552ms | 552ms | - | - | 552ms | 552ms | QA-20260512-0488 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-12T02:51:02.949Z -> 2026-05-13T02:51:02.949Z (24h)
- Runs with observations: 5 recorded / 5 counted
- Samples: 12
- Drift rate: 25%
- Classification counts: {"matched":9,"drift":3}
- Reason code counts: {"execution_path_mismatch":1,"execution_mode_mismatch":1}

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| /api/ai/supervisor/stream | multi-agent | 1 | 0% | 15964ms | 15964ms | QA-20260512-0485 |
| /api/ai/supervisor/stream/v2 | multi-agent | 4 | 0% | 4888ms | 12587ms | QA-20260512-0486 |
| /api/ai/jobs/[id]/stream | single-agent | 4 | 75% | 2560ms | 3427ms | QA-20260512-0487 |
| /api/ai/supervisor/stream/v2 | single-agent | 2 | 0% | 451ms | 902ms | QA-20260512-0488 |
| /api/ai/supervisor/stream/v2 | deterministic | 1 | 0% | 552ms | 552ms | QA-20260512-0488 |

## Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 2 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260504-0405 (broad), QA-20260505-0407 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 392 | 3485 | 96.15% | 70 | 17.86% | 78 | 19.9% |
| Last 30 Counted Runs | 30 | 335 | 97.01% | 5 | 16.67% | 5 | 16.67% |
| Last 10 Counted Runs | 10 | 106 | 96.23% | 2 | 20% | 2 | 20% |

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
| targeted | 308 | 211 |
| legacy | 137 | 137 |
| broad | 34 | 33 |
| release-gate | 6 | 6 |
| smoke | 5 | 5 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 43 | 7 | 16.28% | 0 | 0 | 0% | 43 | 0 |
| P1 | 248 | 94 | 37.9% | 0 | 0 | 0% | 243 | 5 |
| P2 | 251 | 57 | 22.71% | 0 | 0 | 0% | 235 | 16 |
| P3 | 35 | 14 | 40% | 0 | 0 | 0% | 34 | 1 |
| P4 | 1 | 0 | 0% | 0 | 0 | 0% | 0 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_5Rf1dHnkD7CvvYJ8NfjPWX6GLo5e | vercel-production | 1 | 14 | 100% | 0 | 0% | QA-20260513-0492 | c1ff8ca5 |
| dpl_5Rf1dHnkD7CvvYJ8NfjPWX6GLo5e / ai-engine-00458-vt2 | production | 1 | 10 | 100% | 0 | 0% | QA-20260513-0491 | c1ff8ca5 |
| ai-engine-00457-rgg | cloud-run-production | 1 | 10 | 100% | 0 | 0% | QA-20260513-0490 | 7d42b336 |
| dpl_4jNrMiAxv5X9A1h5iNeFxqRZVBYc | vercel-production | 1 | 9 | 100% | 0 | 0% | QA-20260513-0489 | 1e1d49bf |
| dpl_8K1EVJvoSWCMK79skHC9V8xbZhhb | vercel-production | 1 | 16 | 100% | 0 | 0% | QA-20260512-0488 | 4bd8557a |
| 5yUzn2ACWhh5rtCb6q3ea4PHcHo4 | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260512-0487 | 7825ff30 |
| dpl_3YVJN1qfLKNT1mQ5zn1BTWqWKGwB | vercel-production | 1 | 14 | 100% | 0 | 0% | QA-20260512-0486 | 4fc66e54 |
| dpl_H9KAkBrJjdvcXPpo4SD5q99oyJsk | vercel-production | 1 | 9 | 100% | 0 | 0% | QA-20260512-0485 | cca5c469 |
| dpl_4abnPiNGVtn9Wj5ZYG9xton3DLc6 | vercel-production | 1 | 8 | 75% | 1 | 100% | QA-20260512-0484 | d7ee0027 |
| dpl_Fh3V7SSnGvFRuvHus9ieRRWidArA | vercel-production | 1 | 8 | 75% | 1 | 100% | QA-20260512-0483 | b6414889 |
| dpl_BkQYTY7ZkvN5fybyD9zCjr4HQY55 | vercel-production | 1 | 2 | 100% | 0 | 0% | QA-20260512-0482 | 4a8d5be2 |
| dpl_DHdZWyaDQmUoS8sWbivAHX7rFbso | vercel-production | 3 | 14 | 85.71% | 1 | 33.33% | QA-20260512-0481 | 86eca846 |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-04-30 | 11 | 114 | 98.25% | 2 | 2 | 18.18% |
| 2026-05-01 | 3 | 32 | 100% | 0 | 0 | 0% |
| 2026-05-02 | 4 | 35 | 100% | 0 | 0 | 0% |
| 2026-05-03 | 7 | 67 | 100% | 0 | 0 | 0% |
| 2026-05-04 | 5 | 82 | 97.56% | 1 | 1 | 20% |
| 2026-05-05 | 6 | 75 | 89.33% | 2 | 2 | 33.33% |
| 2026-05-06 | 4 | 30 | 96.67% | 1 | 1 | 25% |
| 2026-05-07 | 3 | 26 | 100% | 0 | 0 | 0% |
| 2026-05-08 | 2 | 20 | 95% | 0 | 0 | 0% |
| 2026-05-09 | 8 | 42 | 66.67% | 4 | 5 | 62.5% |
| 2026-05-10 | 22 | 263 | 98.86% | 1 | 2 | 9.09% |
| 2026-05-11 | 3 | 27 | 96.3% | 1 | 1 | 33.33% |
| 2026-05-12 | 9 | 73 | 91.78% | 3 | 3 | 33.33% |
| 2026-05-13 | 4 | 43 | 100% | 0 | 0 | 0% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260512-0484 | 2026-05-12T03:58:50.223Z | targeted | 2 | 3 | 0 | 0 | Vercel Playwright QA - AI semantic routing regression check on v8.11.132 |
| QA-20260512-0483 | 2026-05-12T02:07:18.555Z | targeted | 2 | 2 | 0 | 0 | Vercel Playwright QA - AI semantic routing regression check on v8.11.131 |
| QA-20260512-0481 | 2026-05-11T17:04:04.232Z | targeted | 2 | 1 | 0 | 0 | Vercel Playwright QA - AI fragile load-query phrasing probe on v8.11.128 |
| QA-20260511-0475 | 2026-05-11T04:57:44.283Z | targeted | 1 | 1 | 0 | 0 | Vercel Playwright MCP Targeted QA - v8.11.124 frontend and AI assistant status |
| QA-20260510-0458 | 2026-05-10T07:26:58.691Z | targeted | 3 | 0 | 0 | 3 | v8.11.122 Vercel AI Assistant Edge / Non-IT Prompt QA |
| QA-20260510-0439 | 2026-05-09T17:03:25.551Z | smoke | 0 | 2 | 0 | 0 | Vercel Production Smoke QA - v8.11.120 Frontend+AI |
| QA-20260509-0432 | 2026-05-09T00:32:58.510Z | targeted | 0 | 2 | 0 | 0 | Vercel Production AI Ops B4/B5 Closure Retest - v8.11.118 |
| QA-20260509-0431 | 2026-05-09T00:05:28.683Z | targeted | 2 | 3 | 0 | 0 | Vercel Production AI Ops B4/B5 Submit Boundary Retest - v8.11.117 |
| QA-20260509-0430 | 2026-05-08T17:45:28.422Z | targeted | 2 | 3 | 0 | 0 | Vercel Production AI Ops Command Guidance Retest - v8.11.116 |
| QA-20260509-0429 | 2026-05-08T16:33:50.518Z | targeted | 5 | 3 | 0 | 0 | Vercel Production AI Ops Conversational Retest - v8.11.114 |

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
| ai-adversarial-natural-language-qa-pack | P2 | wont-fix | 1 | QA-20260512-0487 | Add QC/security-style natural-language AI regression prompts |
| ai-agent-type-metadata | P2 | wont-fix | 1 | QA-20260326-0190 | AI Chat 에이전트 타입 메타데이터 표시 개선 |

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
