# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-04-24 02:35:13 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 340 |
| Counted Runs | 276 |
| Total Checks | 2284 |
| Total Passed | 2198 |
| Total Failed | 79 |
| Overall Pass Rate | 96.23% |
| Latest Recorded Run | QA-20260424-0342 |
| Last Counted Run | QA-20260424-0342 |

## AI Latency Rollup (Last 24h)

- Window: 2026-04-22T17:35:02.039Z -> 2026-04-23T17:35:02.039Z (24h)
- Runs with observations: 3 recorded / 3 counted
- Samples: 5

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| AI Chat | cloud-run | 5 | 2293ms | 9495ms | 471ms | 675ms | 8370ms | 19421ms | QA-20260423-0339 |

## Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 2 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260422-0330 (broad, non-release-facing), QA-20260424-0340 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 276 | 2284 | 96.23% | 50 | 18.12% | 56 | 20.29% |
| Last 30 Counted Runs | 30 | 387 | 96.9% | 8 | 26.67% | 8 | 26.67% |
| Last 10 Counted Runs | 10 | 162 | 96.91% | 4 | 40% | 4 | 40% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 33 | 511 | 97.26% | 8 | 24.24% |
| Last 5 Gate Runs | 5 | 114 | 98.25% | 2 | 40% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 6 | 76 | 100% | 0 | 0% |
| Last 5 Release-Gate Runs | 5 | 59 | 100% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| targeted | 167 | 104 |
| legacy | 137 | 137 |
| broad | 28 | 27 |
| release-gate | 6 | 6 |
| smoke | 2 | 2 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 43 | 7 | 16.28% | 0 | 0 | 0% | 43 | 0 |
| P1 | 150 | 69 | 46% | 0 | 0 | 0% | 146 | 4 |
| P2 | 143 | 45 | 31.47% | 0 | 0 | 0% | 131 | 12 |
| P3 | 16 | 10 | 62.5% | 0 | 0 | 0% | 15 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_Ab1ZA6FUYvA4LE67mWidSFvPvYP2 | vercel-production | 2 | 58 | 100% | 0 | 0% | QA-20260424-0342 | 41ae1599 |
| dpl_6JWVZRTK1zxcqikx2S9Y9uafiUDq | vercel-production | 2 | 34 | 97.06% | 1 | 50% | QA-20260424-0340 | 088eaf3f |
| dpl_HUrc3CAatRmgXyihV3V44t7zuFpS | vercel-production | 5 | 55 | 94.55% | 2 | 40% | QA-20260423-0338 | 644af633 |
| dpl_643GY6xfecoQXhCqzRUnE4TNajmF | vercel-production | 2 | 25 | 96% | 1 | 50% | QA-20260422-0330 | 538282c1 |
| dpl_3cutqnX7vMtm5qAuxzgnAnVULEmk | vercel-production | 1 | 15 | 86.67% | 1 | 100% | QA-20260421-0323 | 06e47ff8 |
| dpl_JAFCywvdMLnVLVRLW6x3KaLuRi8u | vercel-production | 1 | 17 | 100% | 0 | 0% | QA-20260419-0309 | 74bb7960 |
| n/a-vercel-mcp-token-expired | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260419-0306 | 608600ab |
| ai-engine-00333-gks | vercel-production | 1 | 4 | 100% | 0 | 0% | QA-20260418-0305 | c96881eb |
| ai-engine-00329-jvq | vercel-production | 1 | 5 | 80% | 1 | 100% | QA-20260418-0304 | 2cd5f40d |
| dpl_8Th4eohuqf6tGKxqt1G4Vro6WRcr | vercel-production | 1 | 22 | 100% | 0 | 0% | QA-20260418-0303 | d83e0a6a |
| dpl_optoHir793ZW8PGSyP6Abghmedg1 | vercel-production | 1 | 4 | 100% | 0 | 0% | QA-20260417-0302 | d9e9f453 |
| dpl_sRuuaBX32ZL4rGggN552bJqcL2th | vercel-production | 1 | 18 | 100% | 0 | 0% | QA-20260417-0300 | 2adcefb0 |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-04-08 | 4 | 26 | 100% | 0 | 0 | 0% |
| 2026-04-09 | 3 | 24 | 100% | 0 | 0 | 0% |
| 2026-04-12 | 1 | 10 | 100% | 0 | 0 | 0% |
| 2026-04-13 | 3 | 17 | 88.24% | 1 | 2 | 66.67% |
| 2026-04-15 | 6 | 53 | 96.23% | 1 | 1 | 16.67% |
| 2026-04-16 | 3 | 23 | 100% | 0 | 0 | 0% |
| 2026-04-17 | 4 | 50 | 98% | 1 | 1 | 25% |
| 2026-04-18 | 3 | 31 | 96.77% | 1 | 1 | 33.33% |
| 2026-04-19 | 2 | 29 | 96.55% | 0 | 0 | 0% |
| 2026-04-20 | 2 | 10 | 100% | 0 | 0 | 0% |
| 2026-04-21 | 3 | 40 | 95% | 1 | 1 | 33.33% |
| 2026-04-22 | 1 | 15 | 93.33% | 1 | 1 | 100% |
| 2026-04-23 | 6 | 65 | 95.38% | 2 | 2 | 33.33% |
| 2026-04-24 | 3 | 82 | 98.78% | 1 | 1 | 33.33% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260424-0340 | 2026-04-23T15:15:14.762Z | broad | 1 | 1 | 0 | 0 | Vercel broad production QA on v8.11.28 before landing profile label-in-name patch |
| QA-20260423-0338 | 2026-04-23T13:13:07.550Z | targeted | 2 | 2 | 0 | 0 | Vercel AI Assistant quality evaluation - feature surface, streaming, and answer quality |
| QA-20260423-0337 | 2026-04-23T09:08:17.769Z | targeted | 1 | 1 | 0 | 0 | Vercel MCP targeted QA - Playwright and Chrome DevTools production refresh |
| QA-20260422-0330 | 2026-04-22T14:14:24.057Z | broad | 1 | 1 | 0 | 0 | Vercel Playwright broad QA - core routes, dashboard, AI workspace recheck |
| QA-20260421-0323 | 2026-04-21T00:49:41.064Z | broad | 2 | 2 | 0 | 0 | Production broad QA - AI domain boundary Phase 3 reference refresh blocked by console/date regressions |
| QA-20260418-0304 | 2026-04-18T12:30:51.893Z | targeted | 1 | 0 | 0 | 1 | Vercel targeted QA - AI metric ranking hotfix |
| QA-20260417-0299 | 2026-04-16T15:32:08.661Z | broad | 1 | 1 | 0 | 0 | Production broad QA - 8.11.16 dashboard AI parity with font preload warning regression |
| QA-20260415-0288 | 2026-04-15T11:09:03.713Z | broad | 2 | 1 | 0 | 0 | Vercel broad QA - frontend and AI assistant evaluation on latest production |
| QA-20260413-0281 | 2026-04-13T12:40:26.449Z | targeted | 2 | 1 | 0 | 0 | GraphRAG variant stability recheck after ai-engine-00311 (boolean-string tool schema hotfix) |
| QA-20260413-0280 | 2026-04-13T11:41:39.894Z | targeted | 0 | 1 | 0 | 0 | GraphRAG variant direct supervisor recheck after ai-engine-00308 (RAG auto + advisor tool required) |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
| feature-dod-tsc-zero-error | P2 | wont-fix | 9 | QA-20260307-0053 | tsc --noEmit 0 에러 |
| feature-dod-unit-tests | P2 | wont-fix | 9 | QA-20260307-0053 | 단위 테스트 158개 통과 |
| obs-fp-fn-weekly-report | P1 | wont-fix | 3 | QA-20260227-0013 | 오탐/미탐 주간 리포트 자동 생성 |
| ai-server-timing-header-production | P1 | wont-fix | 2 | QA-20260310-0081 | Server-Timing header visibility in production |
| ai-cold-start-latency | P2 | wont-fix | 2 | QA-20260327-0193 | Cloud Run cold start 레이턴시 최적화 |
| landing-console-api-system-unauthorized | P1 | wont-fix | 1 | QA-20260330-0195 | 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |
| ai-agent-type-metadata | P2 | wont-fix | 1 | QA-20260326-0190 | AI Chat 에이전트 타입 메타데이터 표시 개선 |
| ai-metric-ranking-memory-path-metadata | P2 | wont-fix | 1 | QA-20260418-0304 | Memory top-N query should expose deterministic metric-ranking path instead of filter fallback metadata |
| analyst-drilldown | P2 | wont-fix | 1 | QA-20260301-0030 | Analyst 서버별 드릴다운 |

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
