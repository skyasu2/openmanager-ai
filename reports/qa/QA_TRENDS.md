# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-04-05 14:28:48 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 234 |
| Counted Runs | 227 |
| Total Checks | 1742 |
| Total Passed | 1672 |
| Total Failed | 64 |
| Overall Pass Rate | 95.98% |
| Latest Recorded Run | QA-20260405-0235 |
| Last Counted Run | QA-20260405-0235 |

## Warnings

- [warning] release-gate-sample-too-small: Release-gate history is too small. Only 2 counted release-gate run(s) are available. Next: Build at least 3 counted release-gate runs so the trend can distinguish one-off passes from stable release readiness.
- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s). Next: Inspect recent broad/release-gate failures before relying on gate-run pass rate as a release signal.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 227 | 1742 | 95.98% | 40 | 17.62% | 45 | 19.82% |
| Last 30 Counted Runs | 30 | 281 | 98.58% | 3 | 10% | 3 | 10% |
| Last 10 Counted Runs | 10 | 120 | 100% | 0 | 0% | 0 | 0% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 12 | 168 | 97.62% | 2 | 16.67% |
| Last 5 Gate Runs | 5 | 77 | 98.7% | 1 | 20% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 2 | 34 | 100% | 0 | 0% |
| Last 5 Release-Gate Runs | 2 | 34 | 100% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| legacy | 137 | 137 |
| targeted | 82 | 76 |
| broad | 11 | 10 |
| release-gate | 2 | 2 |
| smoke | 2 | 2 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 41 | 7 | 17.07% | 0 | 0 | 0% | 41 | 0 |
| P1 | 123 | 57 | 46.34% | 0 | 0 | 0% | 119 | 4 |
| P2 | 109 | 35 | 32.11% | 0 | 0 | 0% | 100 | 9 |
| P3 | 15 | 11 | 73.33% | 0 | 0 | 0% | 14 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_2MuHQZg4ePQmikAr8MYk5rkWj1ic | vercel-production | 1 | 17 | 100% | 0 | 0% | QA-20260405-0235 | 7095e768 |
| dpl_DQqyMxBqMh3wVX6atBuctwBqDzV7 | vercel-production | 1 | 5 | 100% | 0 | 0% | QA-20260405-0233 | 98797cbb |
| dpl_HrjM2qkwGoVvv1y9jF1sdirjuUMB | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260405-0232 | b4bd537a |
| dpl_Fer4NeUmueSdqxwbajJJqDkCdR9c | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260405-0231 | 98d6c0be |
| dpl_7RVYuLgp44dE9AMHWLBegNxY1hSH | vercel-production | 1 | 7 | 100% | 0 | 0% | QA-20260405-0230 | 1ce348df |
| dpl_BC2L2XzJ6JCXcQauXB3wviMfuPXZ | vercel-production | 4 | 59 | 100% | 0 | 0% | QA-20260404-0229 | 0b0f5c4e |
| dpl_RMZadPVLmjXrbdkkQTwRpFTx6nv4 | vercel-production | 1 | 16 | 100% | 0 | 0% | QA-20260404-0225 | fc725862 |
| dpl_Eh3o4WUwA374u7zqM4seojLawoKP | vercel-production | 1 | 13 | 92.31% | 1 | 100% | QA-20260404-0222 | 00e750bb |
| dpl_v8108_20260402_targeted | vercel-production | 1 | 10 | 100% | 0 | 0% | QA-20260402-0217 | 52b38df2 |
| dpl_v8108_20260402_2 | vercel-production | 1 | 14 | 100% | 0 | 0% | QA-20260402-0213 | 84c375ac |
| dpl_v8108_20260402 | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260402-0212 | 1d3e7a21 |
| dpl_5FCMoSTAs2NBcKjVNrvzWaJhK2Vf | vercel-production | 2 | 10 | 100% | 0 | 0% | QA-20260402-0211 | 774171c8 |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-03-22 | 10 | 48 | 97.92% | 1 | 1 | 10% |
| 2026-03-23 | 8 | 33 | 96.97% | 1 | 1 | 12.5% |
| 2026-03-24 | 13 | 61 | 88.52% | 6 | 6 | 46.15% |
| 2026-03-25 | 4 | 18 | 100% | 0 | 0 | 0% |
| 2026-03-26 | 6 | 72 | 97.22% | 0 | 0 | 0% |
| 2026-03-27 | 1 | 12 | 91.67% | 1 | 1 | 100% |
| 2026-03-29 | 1 | 11 | 100% | 0 | 0 | 0% |
| 2026-03-30 | 6 | 47 | 93.62% | 1 | 1 | 16.67% |
| 2026-03-31 | 2 | 11 | 81.82% | 1 | 1 | 50% |
| 2026-04-01 | 2 | 16 | 100% | 0 | 0 | 0% |
| 2026-04-02 | 10 | 85 | 100% | 0 | 0 | 0% |
| 2026-04-03 | 1 | 3 | 100% | 0 | 0 | 0% |
| 2026-04-04 | 8 | 106 | 98.11% | 2 | 2 | 25% |
| 2026-04-05 | 5 | 45 | 100% | 0 | 0 | 0% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260404-0223 | 2026-04-04T11:06:01.219Z | targeted | 1 | 1 | 0 | 0 | Vercel Playwright QA - dashboard/AI parity rerun after ai-engine parity patch |
| QA-20260404-0222 | 2026-04-04T09:17:33.588Z | broad | 1 | 1 | 0 | 1 | Vercel Playwright QA - dashboard, AI assistant, and monitoring parity check |
| QA-20260331-0201 | 2026-03-31T11:58:25.987Z | targeted | 2 | 1 | 0 | 0 | Local dev Playwright QA - Vibe Coding modal CI/CD regression check |
| QA-20260330-0195 | 2026-03-30T04:14:36.238Z | targeted | 3 | 0 | 0 | 3 | Landing Page Playwright Analysis - 4 Cards, Modal Content, Architecture, History |
| QA-20260327-0193 | 2026-03-26T15:12:25.263Z | targeted | 1 | 0 | 0 | 1 | Vercel production targeted QA recheck after cloud-run pre-init logging fix |
| QA-20260324-0179 | 2026-03-24T10:48:15.267Z | targeted | 1 | 0 | 0 | 0 | Vercel Preview QA - PR #200 blocked by preview SSO |
| QA-20260324-0177 | 2026-03-24T07:57:28.735Z | targeted | 1 | 1 | 0 | 0 | Vercel Production QA - false realtime-analysis badge removed but parity mismatch remains |
| QA-20260324-0176 | 2026-03-24T07:35:13.658Z | targeted | 2 | 1 | 0 | 0 | Vercel Production QA - parity gate still open after analysis detail patch |
| QA-20260324-0175 | 2026-03-24T05:45:00.758Z | targeted | 1 | 1 | 0 | 0 | Vercel Production QA - deferred parity metadata preserved but detail contract still incomplete |
| QA-20260324-0174 | 2026-03-24T05:13:06.470Z | targeted | 1 | 1 | 0 | 0 | Vercel Production QA - parity metadata after type-fix deploy |

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
| ai-chat-detail-expand | P2 | wont-fix | 1 | QA-20260301-0030 | AI Chat 상세 분석 펼치기 |
| analyst-drilldown | P2 | wont-fix | 1 | QA-20260301-0030 | Analyst 서버별 드릴다운 |

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

