# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-05-25 20:21:14 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 595 |
| Counted Runs | 472 |
| Total Checks | 4194 |
| Total Passed | 4010 |
| Total Failed | 153 |
| Overall Pass Rate | 95.61% |
| Latest Recorded Run | QA-20260525-0597 |
| Last Counted Run | QA-20260525-0591 |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-24T11:20:49.100Z -> 2026-05-25T11:20:49.100Z (24h)
- Runs with observations: 4 recorded / 2 counted
- Samples: 7

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Advisor Agent | mixed | 1 | 27514ms | 27514ms | 0ms | 0ms | 27514ms | 27514ms | QA-20260525-0591 |
| Server Realtime Analysis | mixed | 1 | 8456ms | 8456ms | - | - | - | - | QA-20260525-0595 |
| Metrics Query Agent | mistral | 1 | 3228ms | 3228ms | - | - | - | - | QA-20260525-0596 |
| Metrics Query Agent | groq | 1 | 1584ms | 1584ms | - | - | - | - | QA-20260525-0596 |
| Metrics Query Agent | deterministic | 3 | 37ms | 60ms | - | - | 60ms | 60ms | QA-20260525-0595 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-24T11:20:49.100Z -> 2026-05-25T11:20:49.100Z (24h)
- Runs with observations: 3 recorded / 3 counted
- Samples: 7
- Drift rate: 0%
- Classification counts: {"matched":6,"unknown":1}
- Reason code counts: {}

| Route | Execution Mode | Samples | Drift Rate | Avg Latency | P95 Latency | Latest Run |
|---|---|---:|---:|---:|---:|---|
| /api/ai/supervisor/stream/v2 | deterministic | 6 | 0% | 10ms | 60ms | QA-20260525-0589 |
| /api/ai/jobs/[id]/stream | single-agent | 1 | 0% | 0ms | 0ms | QA-20260525-0589 |

## Warnings

- [warning] gate-window-regression-open: Recent gate runs still show regressions. The last 5 gate runs include 1 regression run(s), but the current release-gate-only window is clean. This warning is currently driven by QA-20260519-0535 (broad) lingering in the rolling gate window. Next: Treat this as historical gate context, not an active release-gate failure. Keep broad/release-gate QA green; the warning will clear once enough clean gate runs replace the older regression in the rolling window.

## Rolling Windows

| Window | Counted Runs | Checks | Pass Rate | Failed Runs | Failing Run Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Counted Runs | 472 | 4194 | 95.61% | 85 | 18.01% | 94 | 19.92% |
| Last 30 Counted Runs | 30 | 144 | 80.56% | 6 | 20% | 7 | 23.33% |
| Last 10 Counted Runs | 10 | 55 | 83.64% | 2 | 20% | 2 | 20% |

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
| targeted | 408 | 286 |
| legacy | 137 | 137 |
| broad | 35 | 34 |
| release-gate | 9 | 9 |
| smoke | 5 | 5 |
| regression | 1 | 1 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 49 | 10 | 20.41% | 0 | 0 | 0% | 49 | 0 |
| P1 | 302 | 109 | 36.09% | 0 | 0 | 0% | 294 | 8 |
| P2 | 319 | 66 | 20.69% | 0 | 0 | 0% | 290 | 29 |
| P3 | 57 | 16 | 28.07% | 0 | 0 | 0% | 46 | 11 |
| P4 | 5 | 1 | 20% | 0 | 0 | 0% | 2 | 3 |
| P5 | 5 | 0 | 0% | 0 | 0 | 0% | 4 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_FocxFMt8y6Cy3GGXxwGUXBjhTyRp | vercel-production | 1 | 5 | 100% | 0 | 0% | QA-20260525-0591 | beb8e6ac |
| dpl_EJx6EaYjDnbA9dbBexrn3g1LrCxY | vercel-production | 1 | 4 | 75% | 1 | 100% | QA-20260525-0590 | 68715a95 |
| dpl_5KXXyEWQFhPjHCmgPozKs8DfvNG5 | vercel-production | 1 | 6 | 100% | 0 | 0% | QA-20260525-0589 | 3748656c |
| dpl_7Wbtupu75cp3QzUM6QoY2h4kLp4k | vercel-production | 1 | 9 | 100% | 0 | 0% | QA-20260525-0587 | f194ec74 |
| dpl_C16eKGD4LRzryrgF26bYRLv7dA6G | vercel-production | 1 | 7 | 100% | 0 | 0% | QA-20260525-0586 | ce2808bc |
| dpl_DDwFH26Jso8hGpukmEQFjkPMzvz5 | vercel-production | 1 | 2 | 100% | 0 | 0% | QA-20260525-0585 | 4cf58251 |
| dpl_97NxHEcLgvBNUVSCuxAUeuY7232L | vercel-production | 2 | 14 | 92.86% | 1 | 50% | QA-20260525-0584 | 8da361db |
| dpl_FeB6CbX4FoL8Y7teQ2evbfsh55Be | vercel-production | 1 | 2 | 100% | 0 | 0% | QA-20260524-0580 | dcba0f5e |
| dpl_AZ9gG1HfcSpw732EZ9NykZeWxkR4 | vercel-production | 2 | 7 | 100% | 1 | 50% | QA-20260524-0579 | 0513c8fd |
| gitlab-tag-pipeline-2548694499 | vercel-production | 1 | 1 | 100% | 0 | 0% | QA-20260524-0576 | 197e762a |
| gitlab-tag-pipeline-2548681561 | vercel-production | 1 | 1 | 0% | 1 | 100% | QA-20260524-0575 | dcd012fd |
| gitlab-pipeline-2548650141 / cloud-run-revision-94ce8471b | vercel-production-cloud-run-ai-engine | 1 | 3 | 66.67% | 1 | 100% | QA-20260524-0574 | 94ce8471 |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
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
| 2026-05-23 | 7 | 38 | 89.47% | 1 | 1 | 14.29% |
| 2026-05-24 | 9 | 34 | 73.53% | 3 | 4 | 44.44% |
| 2026-05-25 | 9 | 53 | 83.02% | 2 | 2 | 22.22% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260525-0590 | 2026-05-25T03:57:03.861Z | targeted | 1 | 1 | 0 | 0 | v8.12.36 Production QA - Q-NEW13 Advisor evidence regression check |
| QA-20260525-0584 | 2026-05-24T15:52:12.919Z | targeted | 1 | 0 | 0 | 4 | v8.12.28 신규 6문항 AI 어시스턴트 평가 — 디스크필터·Advisor·팔로업·AZ비교·네트워크 |
| QA-20260524-0579 | 2026-05-24T07:21:06.892Z | targeted | 0 | 1 | 0 | 2 | v8.12.20 신규 AI Assistant 6문항 QA - 목록 가독성·위험 라우팅·트렌드 관찰 |
| QA-20260524-0575 | 2026-05-24T02:26:16.493Z | targeted | 1 | 1 | 0 | 0 | v8.12.18 production targeted QA - healthy filter recheck |
| QA-20260524-0574 | 2026-05-24T02:01:17.511Z | targeted | 1 | 1 | 0 | 0 | Cloud Run 94ce8471b production targeted QA - AI routing closure check |
| QA-20260524-0572 | 2026-05-23T15:52:37.929Z | targeted | 3 | 0 | 0 | 0 | v8.12.16 AI 어시스턴트 5차 평가 — 미테스트 6문항 (cache그룹·역방향필터·최솟값·그룹+예측·Advisor·세션컨텍스트) |
| QA-20260523-0569 | 2026-05-23T10:19:45.964Z | targeted | 1 | 0 | 0 | 1 | v8.12.15 focused Vercel production QA - quick-start, artifact envelope, DB threshold |
| QA-20260520-0544 | 2026-05-20T08:08:43.778Z | targeted | 3 | 2 | 0 | 0 | Vercel Playwright MCP Targeted QA - v8.11.184 dashboard and AI state |
| QA-20260519-0535 | 2026-05-19T05:14:14.572Z | broad | 4 | 0 | 0 | 3 | v8.11.179 Chrome DevTools MCP QA - AI Assistant 미검증 영역 집중 테스트 |
| QA-20260519-0533 | 2026-05-19T02:49:58.801Z | targeted | 2 | 0 | 0 | 0 | v8.11.178 내용 충실도 검증 — AI 수치 정합성·응답 경로·신호 강도 |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
| feature-dod-tsc-zero-error | P2 | wont-fix | 9 | QA-20260307-0053 | tsc --noEmit 0 에러 |
| feature-dod-unit-tests | P2 | wont-fix | 9 | QA-20260307-0053 | 단위 테스트 158개 통과 |
| obs-fp-fn-weekly-report | P1 | wont-fix | 3 | QA-20260227-0013 | 오탐/미탐 주간 리포트 자동 생성 |
| ai-server-timing-header-production | P1 | wont-fix | 2 | QA-20260310-0081 | Server-Timing header visibility in production |
| ai-thinking-visualizer-contract-drift | P1 | wont-fix | 2 | QA-20260428-0357 | Thinking visualizer production UI contract drift |
| ai-cold-start-latency | P2 | wont-fix | 2 | QA-20260327-0193 | Cloud Run cold start 레이턴시 최적화 |
| anomaly-artifact-card-missing | P2 | wont-fix | 2 | QA-20260523-0568 | 이상감지 분석 아티팩트 카드 미렌더링 |
| analyst-single-server-response-mismatch | P1 | wont-fix | 1 | QA-20260519-0535 | Analyst 단일 서버 분석 응답 구조 불일치 수정 |
| landing-console-api-system-unauthorized | P1 | wont-fix | 1 | QA-20260330-0195 | 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |

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
