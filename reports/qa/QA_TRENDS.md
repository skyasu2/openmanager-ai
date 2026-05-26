# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-05-26 22:05:24 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 612 |
| Counted Runs | 482 |
| Total Checks | 4261 |
| Total Passed | 4073 |
| Total Failed | 153 |
| Overall Pass Rate | 95.59% |
| Latest Recorded Run | QA-20260526-0614 |
| Last Counted Run | QA-20260526-0614 |

## AI Latency Rollup (Last 24h)

- Window: 2026-05-25T12:52:44.071Z -> 2026-05-26T12:52:44.071Z (24h)
- Runs with observations: 5 recorded / 3 counted
- Samples: 14

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Metrics Query Agent | cloud-run-ai | 8 | 3245ms | 8498ms | 284ms | 284ms | 1917ms | 2545ms | QA-20260526-0614 |
| Metrics Query Agent | streaming-ai | 5 | 3592ms | 5570ms | 602ms | 741ms | 899ms | 1487ms | QA-20260526-0611 |
| Metrics Query | deterministic-monitoring | 1 | 1097ms | 1097ms | 1097ms | 1097ms | 1097ms | 1097ms | QA-20260526-0613 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-05-25T12:52:44.071Z -> 2026-05-26T12:52:44.071Z (24h)
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
| All Counted Runs | 482 | 4261 | 95.59% | 85 | 17.63% | 94 | 19.5% |
| Last 30 Counted Runs | 30 | 169 | 86.98% | 5 | 16.67% | 6 | 20% |
| Last 10 Counted Runs | 10 | 67 | 94.03% | 0 | 0% | 0 | 0% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 45 | 737 | 96.2% | 11 | 24.44% |
| Last 5 Gate Runs | 5 | 73 | 94.52% | 1 | 20% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 11 | 151 | 99.34% | 0 | 0% |
| Last 5 Release-Gate Runs | 5 | 75 | 98.67% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| targeted | 423 | 294 |
| legacy | 137 | 137 |
| broad | 35 | 34 |
| release-gate | 11 | 11 |
| smoke | 5 | 5 |
| regression | 1 | 1 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 49 | 10 | 20.41% | 0 | 0 | 0% | 49 | 0 |
| P1 | 307 | 110 | 35.83% | 0 | 0 | 0% | 302 | 5 |
| P2 | 321 | 78 | 24.3% | 0 | 0 | 0% | 308 | 13 |
| P3 | 57 | 18 | 31.58% | 0 | 0 | 0% | 48 | 9 |
| P4 | 5 | 1 | 20% | 0 | 0 | 0% | 2 | 3 |
| P5 | 5 | 0 | 0% | 0 | 0 | 0% | 4 | 1 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| gitlab-pipeline-2553301909-v8.12.51-cloud-run-ai-engine-00559-62w | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260526-0614 | ad7735e7 |
| dpl_6uigr9o8SHPZPjfH4Nb1uy7bWLGM | vercel-production | 1 | 8 | 100% | 0 | 0% | QA-20260526-0613 | 9ee0a193 |
| dpl_BVJyVGDfMJ3MQB53pWWDn2fwR3BB | vercel-production | 1 | 16 | 100% | 0 | 0% | QA-20260526-0611 | cbca218e |
| dpl_FocxFMt8y6Cy3GGXxwGUXBjhTyRp | vercel-production | 1 | 5 | 100% | 0 | 0% | QA-20260525-0591 | beb8e6ac |
| dpl_EJx6EaYjDnbA9dbBexrn3g1LrCxY | vercel-production | 1 | 4 | 75% | 1 | 100% | QA-20260525-0590 | 68715a95 |
| dpl_5KXXyEWQFhPjHCmgPozKs8DfvNG5 | vercel-production | 1 | 6 | 100% | 0 | 0% | QA-20260525-0589 | 3748656c |
| dpl_7Wbtupu75cp3QzUM6QoY2h4kLp4k | vercel-production | 1 | 9 | 100% | 0 | 0% | QA-20260525-0587 | f194ec74 |
| dpl_C16eKGD4LRzryrgF26bYRLv7dA6G | vercel-production | 1 | 7 | 100% | 0 | 0% | QA-20260525-0586 | ce2808bc |
| dpl_DDwFH26Jso8hGpukmEQFjkPMzvz5 | vercel-production | 1 | 2 | 100% | 0 | 0% | QA-20260525-0585 | 4cf58251 |
| dpl_97NxHEcLgvBNUVSCuxAUeuY7232L | vercel-production | 2 | 14 | 92.86% | 1 | 50% | QA-20260525-0584 | 8da361db |
| dpl_FeB6CbX4FoL8Y7teQ2evbfsh55Be | vercel-production | 1 | 2 | 100% | 0 | 0% | QA-20260524-0580 | dcba0f5e |
| dpl_AZ9gG1HfcSpw732EZ9NykZeWxkR4 | vercel-production | 2 | 7 | 100% | 1 | 50% | QA-20260524-0579 | 0513c8fd |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
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
| 2026-05-26 | 10 | 67 | 94.03% | 0 | 0 | 0% |

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
| ai-thinking-visualizer-contract-drift | P1 | wont-fix | 2 | QA-20260428-0357 | Thinking visualizer production UI contract drift |
| analyst-single-server-response-mismatch | P1 | wont-fix | 1 | QA-20260519-0535 | Analyst 단일 서버 분석 응답 구조 불일치 수정 |
| landing-console-api-system-unauthorized | P1 | wont-fix | 1 | QA-20260330-0195 | 랜딩 비로그인 상태에서 /api/system 401 콘솔 에러 제거 또는 graceful handling |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |
| server-comparison-deterministic-path | P1 | wont-fix | 1 | QA-20260522-0559 | 서버 1:1 비교 쿼리 deterministic 경로 미확립 |
| ai-adversarial-natural-language-qa-pack | P2 | wont-fix | 1 | QA-20260512-0487 | Add QC/security-style natural-language AI regression prompts |
| ai-agent-type-metadata | P2 | wont-fix | 1 | QA-20260326-0190 | AI Chat 에이전트 타입 메타데이터 표시 개선 |
| ai-metric-ranking-memory-path-metadata | P2 | wont-fix | 1 | QA-20260418-0304 | Memory top-N query should expose deterministic metric-ranking path instead of filter fallback metadata |
| ai-remediation-response-quality | P2 | wont-fix | 1 | QA-20260519-0535 | AI Chat 조치 방법 응답 품질 개선 |
| analyst-domain-context-injection | P2 | wont-fix | 1 | QA-20260522-0559 | 심층 분석 시 서버 도메인 특성 미주입 |

## Most Repeated Completed Items

| ID | Completed Count | Seen | Last Seen Run | Title |
|---|---:|---:|---|---|
| feature-dod-system-start-guard | 7 | 7 | QA-20260227-0018 | 비로그인 시스템 시작 가드 모달 동작 |
| feature-dod-tsc-zero-error | 6 | 10 | QA-20260526-0602 | Root TypeScript type-check passes |
| feature-dod-unit-tests | 6 | 10 | QA-20260526-0602 | Root quick unit/smoke test gate passes |
| feature-dod-lint-zero-error | 5 | 7 | QA-20260302-0044 | lint 0 에러 |
| dashboard-health-v880-recheck | 5 | 5 | QA-20260309-0068 | 프로덕션 대시보드 및 Health API 재검증 |
| landing-copy-alignment | 4 | 8 | QA-20260227-0016 | 랜딩/로그인 정책 카피 정합성 |
| security-attack-regression-pack | 4 | 8 | QA-20260320-0138 | 보안 공격 시나리오 회귀팩 구축 |
| landing-page-render | 4 | 5 | QA-20260419-0306 | 랜딩 페이지 정상 렌더링 v8.11.20 |
| ai-chat-response-quality-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | AI Chat 응답 품질 및 권고 재검증 |
| analyst-full-analysis-v880-recheck-20260309 | 4 | 4 | QA-20260309-0068 | Analyst 전체 분석 경로 재검증 |

## Definitions

- Counted Run: `countsTowardSummary !== false` 인 run.
- Failing Run: `checks.failed > 0` 인 counted run.
- Regression Run: `checks.failed > 0` 또는 `pendingCount > 0` 인 counted run.
- Deferred / Wont-Fix 는 추세에서 별도 표기하되 regression rate 계산에는 포함하지 않는다.
