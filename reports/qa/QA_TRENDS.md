# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-05-19 15:25:41 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 534 |
| Counted Runs | 427 |
| Total Checks | 3891 |
| Total Passed | 3738 |
| Total Failed | 142 |
| Overall Pass Rate | 96.07% |
| Latest Recorded Run | QA-20260519-0536 |
| Last Counted Run | QA-20260519-0535 |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-18T06:23:47.328Z -> 2026-05-19T06:23:47.328Z (24h)
- Runs with observations: 4 recorded / 4 counted
- Samples: 7

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | mistral | 2 | 14779ms | 23558ms | - | - | - | - | QA-20260519-0535 |
| NLQ Agent | unknown | 1 | 14000ms | 14000ms | - | - | - | - | QA-20260519-0532 |
| Reporter Agent | unknown | 1 | 6000ms | 6000ms | - | - | - | - | QA-20260519-0532 |
| Reporter Agent | cloud-run | 1 | 2086ms | 2086ms | - | - | 2086ms | 2086ms | QA-20260518-0523 |
| NLQ | deterministic | 1 | 310ms | 310ms | - | - | - | - | QA-20260519-0533 |
| Analyst Agent | deterministic | 1 | 273ms | 273ms | - | - | - | - | QA-20260519-0535 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-18T06:23:47.328Z -> 2026-05-19T06:23:47.328Z (24h)
- Runs with observations: 0 recorded / 0 counted
- Samples: 0
- Drift rate: 0%
- Classification counts: {}
- Reason code counts: {}

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| - | - | 0 | 0% | - | - | - |

## Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 427 | 3891 | 96.07% | 78 | 18.27% | 86 | 20.14% |
| Last 30 Counted Runs | 30 | 370 | 95.68% | 6 | 20% | 6 | 20% |
| Last 10 Counted Runs | 10 | 116 | 93.1% | 3 | 30% | 3 | 30% |

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
| targeted | 348 | 242 |
| legacy | 137 | 137 |
| broad | 35 | 34 |
| release-gate | 9 | 9 |
| smoke | 5 | 5 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 47 | 9 | 19.15% | 1 | 0 | 0% | 46 | 0 |
| P1 | 272 | 102 | 37.5% | 0 | 0 | 0% | 266 | 6 |
| P2 | 279 | 59 | 21.15% | 0 | 0 | 0% | 260 | 19 |
| P3 | 40 | 14 | 35% | 0 | 0 | 0% | 39 | 1 |
| P4 | 1 | 0 | 0% | 0 | 0 | 0% | 0 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| icn1::icn1::7hs47-1779167617388-c78b3062ad59 | vercel-production | 1 | 18 | 77.78% | 1 | 100% | QA-20260519-0535 | 4ce2e3f7 |
| dpl_clytpcga8 | vercel-production | 1 | 6 | 100% | 0 | 0% | QA-20260519-0534 | 870fb39a |
| dpl_FjCHCyinMqvvzeNR2THJtcUCzRZ1 | vercel-production | 3 | 23 | 91.3% | 1 | 33.33% | QA-20260519-0533 | 5801a008 |
| dpl_HchB1A2K6muUo2LM1DMpdLfhXE9e | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260519-0530 | 35949496 |
| dpl_BdrMbVYEqzZb7vBE9Px2ukpswKpZ | vercel-production | 1 | 15 | 100% | 0 | 0% | QA-20260519-0529 | 55af9601 |
| dpl_C8eLVUEdzSPMY83AwFUezu7ybd8V | vercel-production | 2 | 33 | 93.94% | 1 | 50% | QA-20260519-0528 | 7da68ac4 |
| dpl_EWpPNaJ7EXfkPKngFjwZTpo5mAqy | vercel-production | 2 | 25 | 100% | 0 | 0% | QA-20260518-0526 | cdbec15a |
| dpl_8mZ3ciQgf8UU7i2a3smsw6fxiXaG | vercel-production | 2 | 25 | 100% | 0 | 0% | QA-20260518-0524 | 2aec191d |
| dpl_6vJBFjs5zyp5P3TtaVWoP7hskWFi | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260518-0522 | eace7809 |
| v8.11.169-gitlab-pipeline-2532228902 | vercel-production | 2 | 28 | 100% | 0 | 0% | QA-20260518-0519 | 8e294644 |
| v8.11.168-gitlab-pipeline-2531890112 | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260518-0517 | f6fe6632 |
| dpl_5Tn7eRynsx1aP6cnVWipELbfDE5G | vercel-production | 2 | 34 | 100% | 0 | 0% | QA-20260518-0516 | 125fcbaf |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-05 | 6 | 75 | 89.33% | 2 | 2 | 33.33% |
| 2026-05-06 | 4 | 30 | 96.67% | 1 | 1 | 25% |
| 2026-05-07 | 3 | 26 | 100% | 0 | 0 | 0% |
| 2026-05-08 | 2 | 20 | 95% | 0 | 0 | 0% |
| 2026-05-09 | 8 | 42 | 66.67% | 4 | 5 | 62.5% |
| 2026-05-10 | 22 | 263 | 98.86% | 1 | 2 | 9.09% |
| 2026-05-11 | 3 | 27 | 96.3% | 1 | 1 | 33.33% |
| 2026-05-12 | 9 | 73 | 91.78% | 3 | 3 | 33.33% |
| 2026-05-13 | 7 | 59 | 98.31% | 1 | 1 | 14.29% |
| 2026-05-14 | 4 | 42 | 95.24% | 1 | 1 | 25% |
| 2026-05-15 | 4 | 63 | 100% | 0 | 0 | 0% |
| 2026-05-17 | 3 | 29 | 93.1% | 1 | 1 | 33.33% |
| 2026-05-18 | 13 | 173 | 96.53% | 2 | 2 | 15.38% |
| 2026-05-19 | 8 | 83 | 90.36% | 3 | 3 | 37.5% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260519-0535 | 2026-05-19T05:14:14.572Z | broad | 4 | 0 | 0 | 3 | v8.11.179 Chrome DevTools MCP QA - AI Assistant 미검증 영역 집중 테스트 |
| QA-20260519-0533 | 2026-05-19T02:49:58.801Z | targeted | 2 | 0 | 0 | 0 | v8.11.178 내용 충실도 검증 — AI 수치 정합성·응답 경로·신호 강도 |
| QA-20260519-0528 | 2026-05-18T19:14:20.082Z | targeted | 2 | 2 | 0 | 1 | v8.11.175 Vercel Playwright MCP AI NLQ/Anomaly Drift Check |
| QA-20260518-0514 | 2026-05-17T16:45:19.291Z | targeted | 4 | 3 | 0 | 0 | Vercel Playwright MCP - Recent Regression Check |
| QA-20260518-0513 | 2026-05-17T16:04:28.616Z | targeted | 1 | 0 | 0 | 0 | AI Env Disclosure Guard Targeted QA |
| QA-20260517-0510 | 2026-05-16T16:03:37.386Z | targeted | 2 | 2 | 0 | 0 | v8.11.161 Production Playwright MCP - Dashboard Cards, Profile State, System Controls |
| QA-20260514-0498 | 2026-05-14T01:59:28.858Z | targeted | 2 | 2 | 0 | 0 | Vercel Playwright MCP QA - v8.11.146 AI Five-Question Release Check |
| QA-20260513-0495 | 2026-05-13T05:02:59.311Z | targeted | 1 | 1 | 0 | 0 | Production QA - v8.11.143 AI Assistant 3-Feature Check |
| QA-20260512-0484 | 2026-05-12T03:58:50.223Z | targeted | 2 | 3 | 0 | 0 | Vercel Playwright QA - AI semantic routing regression check on v8.11.132 |
| QA-20260512-0483 | 2026-05-12T02:07:18.555Z | targeted | 2 | 2 | 0 | 0 | Vercel Playwright QA - AI semantic routing regression check on v8.11.131 |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
| weekly-hardening-production-post-deploy-retest | P0 | pending | 1 | QA-20260519-0536 | Deploy weekly hardening changes and rerun focused Vercel production QA |
| feature-dod-tsc-zero-error | P2 | wont-fix | 9 | QA-20260307-0053 | tsc --noEmit 0 에러 |
| feature-dod-unit-tests | P2 | wont-fix | 9 | QA-20260307-0053 | 단위 테스트 158개 통과 |
| obs-fp-fn-weekly-report | P1 | wont-fix | 3 | QA-20260227-0013 | 오탐/미탐 주간 리포트 자동 생성 |
| ai-server-timing-header-production | P1 | wont-fix | 2 | QA-20260310-0081 | Server-Timing header visibility in production |
| ai-thinking-visualizer-contract-drift | P1 | wont-fix | 2 | QA-20260428-0357 | Thinking visualizer production UI contract drift |
| ai-cold-start-latency | P2 | wont-fix | 2 | QA-20260327-0193 | Cloud Run cold start 레이턴시 최적화 |
| analyst-single-server-response-mismatch | P1 | wont-fix | 1 | QA-20260519-0535 | Analyst 단일 서버 분석 응답 구조 불일치 수정 |
| landing-console-api-system-unauthorized | P1 | wont-fix | 1 | QA-20260330-0195 | 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |
| ai-adversarial-natural-language-qa-pack | P2 | wont-fix | 1 | QA-20260512-0487 | Add QC/security-style natural-language AI regression prompts |

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
