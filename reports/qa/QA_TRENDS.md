# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-04-12 16:09:09 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 271 |
| Counted Runs | 240 |
| Total Checks | 1869 |
| Total Passed | 1797 |
| Total Failed | 66 |
| Overall Pass Rate | 96.15% |
| Latest Recorded Run | QA-20260412-0273 |
| Last Counted Run | QA-20260412-0272 |

## Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260407-0249 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 240 | 1869 | 96.15% | 41 | 17.08% | 46 | 19.17% |
| Last 30 Counted Runs | 30 | 317 | 98.74% | 3 | 10% | 3 | 10% |
| Last 10 Counted Runs | 10 | 91 | 97.8% | 1 | 10% | 1 | 10% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 18 | 243 | 97.53% | 3 | 16.67% |
| Last 5 Gate Runs | 5 | 63 | 96.83% | 1 | 20% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 4 | 61 | 100% | 0 | 0% |
| Last 5 Release-Gate Runs | 4 | 61 | 100% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| legacy | 137 | 137 |
| targeted | 113 | 83 |
| broad | 15 | 14 |
| release-gate | 4 | 4 |
| smoke | 2 | 2 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 41 | 7 | 17.07% | 0 | 0 | 0% | 41 | 0 |
| P1 | 131 | 62 | 47.33% | 0 | 0 | 0% | 127 | 4 |
| P2 | 114 | 37 | 32.46% | 0 | 0 | 0% | 106 | 8 |
| P3 | 15 | 11 | 73.33% | 0 | 0 | 0% | 14 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_GZc8iZVSUmgA1P2XoFpjRkxAzXnC | vercel-production | 1 | 10 | 100% | 0 | 0% | QA-20260412-0272 | 665d80cf |
| q9sLLaw5dMDeDbCacX11sTe8fE1t | vercel-production | 1 | 3 | 100% | 0 | 0% | QA-20260409-0267 | 858a084b |
| dpl_CAWchymB1KKe4ADsqMwLV6S9uigQ | vercel-production | 1 | 7 | 100% | 0 | 0% | QA-20260409-0264 | ca7f27ae |
| dpl_FnzN8yJFRkS5TUkvQYWREJwtJGh2 | vercel-production | 1 | 14 | 100% | 0 | 0% | QA-20260409-0259 | 8ca2b7eb |
| dpl_HsUxVfvpeXApZu25dEY4WNrQrcoy | vercel-production | 1 | 6 | 100% | 0 | 0% | QA-20260408-0250 | f515817d |
| dpl_7YFJku7zmAYHWwhF6FrizaLfHkKE | vercel-production | 1 | 18 | 88.89% | 1 | 100% | QA-20260407-0249 | 8d537c7a |
| dpl_EEf7zEdMXFGHWYqYSNMACmtXynQ8 | vercel-production | 1 | 13 | 100% | 0 | 0% | QA-20260406-0246 | 9e722456 |
| dpl_H2A52Y1DvRKLATu7o1A8fb1WbAXf | vercel-production | 1 | 9 | 100% | 0 | 0% | QA-20260406-0244 | 40bd7093 |
| dpl_2MuHQZg4ePQmikAr8MYk5rkWj1ic | vercel-production | 3 | 44 | 100% | 0 | 0% | QA-20260405-0238 | b15fd073 |
| dpl_DQqyMxBqMh3wVX6atBuctwBqDzV7 | vercel-production | 1 | 5 | 100% | 0 | 0% | QA-20260405-0233 | 98797cbb |
| dpl_HrjM2qkwGoVvv1y9jF1sdirjuUMB | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260405-0232 | b4bd537a |
| dpl_Fer4NeUmueSdqxwbajJJqDkCdR9c | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260405-0231 | 98d6c0be |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-03-27 | 1 | 12 | 91.67% | 1 | 1 | 100% |
| 2026-03-29 | 1 | 11 | 100% | 0 | 0 | 0% |
| 2026-03-30 | 6 | 47 | 93.62% | 1 | 1 | 16.67% |
| 2026-03-31 | 2 | 11 | 81.82% | 1 | 1 | 50% |
| 2026-04-01 | 2 | 16 | 100% | 0 | 0 | 0% |
| 2026-04-02 | 10 | 85 | 100% | 0 | 0 | 0% |
| 2026-04-03 | 1 | 3 | 100% | 0 | 0 | 0% |
| 2026-04-04 | 8 | 106 | 98.11% | 2 | 2 | 25% |
| 2026-04-05 | 7 | 72 | 100% | 0 | 0 | 0% |
| 2026-04-06 | 2 | 22 | 100% | 0 | 0 | 0% |
| 2026-04-07 | 1 | 18 | 88.89% | 1 | 1 | 100% |
| 2026-04-08 | 4 | 26 | 100% | 0 | 0 | 0% |
| 2026-04-09 | 3 | 24 | 100% | 0 | 0 | 0% |
| 2026-04-12 | 1 | 10 | 100% | 0 | 0 | 0% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260407-0249 | 2026-04-07T11:55:13.126Z | broad | 2 | 2 | 0 | 0 | Playwright MCP Production QA - Frontend + AI Assistant v8.11.0 broad baseline refresh |
| QA-20260404-0223 | 2026-04-04T11:06:01.219Z | targeted | 1 | 1 | 0 | 0 | Vercel Playwright QA - dashboard/AI parity rerun after ai-engine parity patch |
| QA-20260404-0222 | 2026-04-04T09:17:33.588Z | broad | 1 | 1 | 0 | 1 | Vercel Playwright QA - dashboard, AI assistant, and monitoring parity check |
| QA-20260331-0201 | 2026-03-31T11:58:25.987Z | targeted | 2 | 1 | 0 | 0 | Local dev Playwright QA - Vibe Coding modal CI/CD regression check |
| QA-20260330-0195 | 2026-03-30T04:14:36.238Z | targeted | 3 | 0 | 0 | 3 | Landing Page Playwright Analysis - 4 Cards, Modal Content, Architecture, History |
| QA-20260327-0193 | 2026-03-26T15:12:25.263Z | targeted | 1 | 0 | 0 | 1 | Vercel production targeted QA recheck after cloud-run pre-init logging fix |
| QA-20260324-0179 | 2026-03-24T10:48:15.267Z | targeted | 1 | 0 | 0 | 0 | Vercel Preview QA - PR #200 blocked by preview SSO |
| QA-20260324-0177 | 2026-03-24T07:57:28.735Z | targeted | 1 | 1 | 0 | 0 | Vercel Production QA - false realtime-analysis badge removed but parity mismatch remains |
| QA-20260324-0176 | 2026-03-24T07:35:13.658Z | targeted | 2 | 1 | 0 | 0 | Vercel Production QA - parity gate still open after analysis detail patch |
| QA-20260324-0175 | 2026-03-24T05:45:00.758Z | targeted | 1 | 1 | 0 | 0 | Vercel Production QA - deferred parity metadata preserved but detail contract still incomplete |

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
| analyst-drilldown | P2 | wont-fix | 1 | QA-20260301-0030 | Analyst 서버별 드릴다운 |
| cloud-run-cold-start-latency | P2 | wont-fix | 1 | QA-20260310-0089 | Cloud Run AI Chat 콜드스타트 대기시간 과도 (5회 재시도, ~5분) |

## Most Repeated Completed Items

| ID | Completed Count | Seen | Last Seen Run | Title |
|---|---:|---:|---|---|
| feature-dod-system-start-guard | 7 | 7 | QA-20260227-0018 | 비로그인 시스템 시작 가드 모달 동작 |
| feature-dod-lint-zero-error | 5 | 7 | QA-20260302-0044 | lint 0 에러 |
| dashboard-health-v880-recheck | 5 | 5 | QA-20260309-0068 | 프로덕션 대시보드 및 Health API 재검증 |
| landing-copy-alignment | 4 | 8 | QA-20260227-0016 | 랜딩/로그인 정책 카피 정합성 |
| security-attack-regression-pack | 4 | 8 | QA-20260320-0138 | 보안 공격 시나리오 회귀팩 구축 |
| ai-chat-response-quality-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | AI Chat 응답 품질 및 권고 재검증 |
| analyst-full-analysis-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | Analyst 전체 분석 경로 재검증 |
| guest-pin-login-flow | 4 | 4 | QA-20260227-0018 | 게스트 PIN 인증 후 시스템 시작 버튼 노출 |
| reporter-empty-cta-generate-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | Reporter empty state CTA 생성 경로 재검증 |
| ai-chat-performance-v880 | 3 | 5 | QA-20260310-0082 | AI Chat 응답 시간 및 요약 품질 검증 |

## Definitions

- Counted Run: `countsTowardSummary !== false` 인 run.
- Failing Run: `checks.failed > 0` 인 counted run.
- Regression Run: `checks.failed > 0` 또는 `pendingCount > 0` 인 counted run.
- Deferred / Wont-Fix 는 추세에서 별도 표기하되 regression rate 계산에는 포함하지 않는다.
