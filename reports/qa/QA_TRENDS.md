# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-06-07 16:40:21 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 673 |
| Counted Runs | 525 |
| Total Checks | 4667 |
| Total Passed | 4460 |
| Total Failed | 162 |
| Overall Pass Rate | 95.56% |
| Latest Recorded Run | QA-20260607-0675 |
| Last Counted Run | QA-20260607-0674 |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-06T07:33:22.074Z -> 2026-06-07T07:33:22.074Z (24h)
- Runs with observations: 9 recorded / 6 counted
- Samples: 26

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Analyst Agent | mistral | 3 | 5770ms | 7677ms | - | - | - | - | QA-20260607-0667 |
| CapacityForecast | groq | 1 | 3500ms | 3500ms | - | - | - | - | QA-20260606-0665 |
| llama-4-scout | groq | 2 | 2050ms | 2300ms | - | - | - | - | QA-20260607-0672 |
| monitoring-metric-current | deterministic | 10 | 250ms | 1352ms | - | - | - | - | QA-20260607-0674 |
| monitoring-metric-ranking | deterministic | 2 | 434ms | 838ms | - | - | - | - | QA-20260607-0674 |
| Metrics Query Agent | deterministic | 4 | 79ms | 204ms | - | - | - | - | QA-20260607-0671 |
| MetricsQuery | deterministic | 1 | 120ms | 120ms | - | - | - | - | QA-20260606-0665 |
| monitoring-server-health | deterministic | 2 | 33ms | 33ms | - | - | - | - | QA-20260607-0670 |
| monitoring-capacity-forecast | deterministic | 1 | 29ms | 29ms | - | - | - | - | QA-20260607-0668 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-06T07:33:22.074Z -> 2026-06-07T07:33:22.074Z (24h)
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
| All Counted Runs | 525 | 4667 | 95.56% | 90 | 17.14% | 99 | 18.86% |
| Last 30 Counted Runs | 30 | 307 | 97.72% | 2 | 6.67% | 2 | 6.67% |
| Last 10 Counted Runs | 10 | 100 | 94% | 2 | 20% | 2 | 20% |

## Gate Run Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Gate Runs | 46 | 756 | 96.3% | 11 | 23.91% |
| Last 5 Gate Runs | 5 | 80 | 95% | 1 | 20% |

## Release-Gate Only Windows

| Window | Counted Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|
| All Release-Gate Runs | 11 | 151 | 99.34% | 0 | 0% |
| Last 5 Release-Gate Runs | 5 | 75 | 98.67% | 0 | 0% |

## Scope Distribution

| Scope | Recorded Runs | Counted Runs |
|---|---:|---:|
| targeted | 470 | 332 |
| legacy | 137 | 137 |
| broad | 36 | 35 |
| smoke | 18 | 9 |
| release-gate | 11 | 11 |
| regression | 1 | 1 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 50 | 10 | 20% | 0 | 0 | 0% | 50 | 0 |
| P1 | 327 | 115 | 35.17% | 0 | 0 | 0% | 324 | 3 |
| P2 | 357 | 82 | 22.97% | 0 | 0 | 0% | 344 | 13 |
| P3 | 69 | 25 | 36.23% | 0 | 0 | 0% | 61 | 8 |
| P4 | 5 | 1 | 20% | 0 | 0 | 0% | 2 | 3 |
| P5 | 5 | 1 | 20% | 0 | 0 | 0% | 5 | 0 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_D36pRxytCDadd54ka4VV56dQbwTS | vercel-production | 1 | 6 | 100% | 0 | 0% | QA-20260607-0674 | c998cc7b |
| dpl_8gGRNXZ1heoCMtiHCNNKhGdVhyJv | vercel-production | 2 | 29 | 100% | 0 | 0% | QA-20260607-0667 | 176d4b62 |
| dpl_4VdYaBKQqx6B8TXXBZL9nv1VzxUF | vercel-production | 2 | 17 | 94.12% | 1 | 50% | QA-20260606-0665 | 5e3c43cd |
| dpl_FQQRoEozYZQ3v9P2r1dQrRxatMDT | vercel-production | 1 | 16 | 100% | 0 | 0% | QA-20260606-0663 | d4f9b521 |
| dpl_3k4vLQ2UAVCQxGZ4oBBnPKwodq6t | vercel-production | 1 | 10 | 100% | 0 | 0% | QA-20260606-0662 | 8b14676e |
| dpl_36r1xN5jRjGiDf79VkCbTZWUhsoW | vercel-production | 1 | 12 | 100% | 0 | 0% | QA-20260606-0661 | 7af581df |
| dpl_5ttYjommNd3ooBXegHLqHY7M6RK6 | vercel-production | 2 | 25 | 100% | 0 | 0% | QA-20260605-0660 | 63ca79bc |
| dpl_BrE1dBffAFfHfrKEuqDdWXD1qf7t | vercel-production | 1 | 20 | 100% | 0 | 0% | QA-20260605-0657 | 105f9b17 |
| dpl_g7Zfcag1nht2qUvsEPYJRjQoUGrq | vercel-production | 2 | 27 | 100% | 0 | 0% | QA-20260605-0656 | 3aa2f7bc |
| dpl_J1PEim6zfHjgGUoB9NcYqgEH2hVj | vercel-production | 1 | 11 | 100% | 0 | 0% | QA-20260605-0651 | 36b29a5c |
| dpl_5Af3pqTpnHXXXPUxqQWfRLWBR2r7 | vercel-production+cloud-run-production | 2 | 22 | 100% | 0 | 0% | QA-20260605-0650 | 9ae1f605 |
| dpl_4ouyrzWwdYJ3FcedNZcrp2pesDN3 | vercel-production+cloud-run-production | 1 | 6 | 100% | 0 | 0% | QA-20260604-0648 | 3b91b069 |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-21 | 8 | 78 | 100% | 0 | 0 | 0% |
| 2026-05-22 | 7 | 43 | 86.05% | 0 | 0 | 0% |
| 2026-05-23 | 7 | 38 | 89.47% | 1 | 1 | 14.29% |
| 2026-05-24 | 9 | 34 | 73.53% | 3 | 4 | 44.44% |
| 2026-05-25 | 9 | 53 | 83.02% | 2 | 2 | 22.22% |
| 2026-05-26 | 11 | 74 | 89.19% | 1 | 1 | 9.09% |
| 2026-05-27 | 10 | 78 | 92.31% | 2 | 2 | 20% |
| 2026-05-28 | 6 | 59 | 96.61% | 0 | 0 | 0% |
| 2026-05-29 | 2 | 8 | 87.5% | 0 | 0 | 0% |
| 2026-05-30 | 3 | 18 | 100% | 0 | 0 | 0% |
| 2026-06-04 | 1 | 6 | 100% | 0 | 0 | 0% |
| 2026-06-05 | 9 | 118 | 100% | 0 | 0 | 0% |
| 2026-06-06 | 5 | 55 | 96.36% | 1 | 1 | 20% |
| 2026-06-07 | 6 | 57 | 92.98% | 1 | 1 | 16.67% |

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260607-0668 | 2026-06-06T16:45:34.002Z | targeted | 2 | 0 | 0 | 2 | Vercel Production Playwright MCP - 25차 AI 어시스턴트 평가 (v8.12.100) |
| QA-20260606-0665 | 2026-06-06T14:36:04.907Z | targeted | 1 | 0 | 0 | 1 | Vercel Production Playwright MCP - 24차 AI 어시스턴트 평가 (v8.12.99) |
| QA-20260527-0624 | 2026-05-27T07:17:17.887Z | targeted | 3 | 3 | 0 | 0 | Vercel Playwright MCP targeted QA - 2026-05-26..27 modified surfaces only |
| QA-20260527-0620 | 2026-05-27T03:05:16.952Z | targeted | 1 | 0 | 0 | 0 | AI 어시스턴트 신규 질문 평가 Q-NEW52~Q-NEW57 + P15 재확인 (v8.12.56) |
| QA-20260526-0615 | 2026-05-26T14:54:35.345Z | targeted | 2 | 0 | 0 | 0 | AI 어시스턴트 신규 질문 평가 Q-NEW46~Q-NEW51 (P15/P16 발견) |
| QA-20260525-0590 | 2026-05-25T03:57:03.861Z | targeted | 1 | 1 | 0 | 0 | v8.12.36 Production QA - Q-NEW13 Advisor evidence regression check |
| QA-20260525-0584 | 2026-05-24T15:52:12.919Z | targeted | 1 | 0 | 0 | 4 | v8.12.28 신규 6문항 AI 어시스턴트 평가 — 디스크필터·Advisor·팔로업·AZ비교·네트워크 |
| QA-20260524-0579 | 2026-05-24T07:21:06.892Z | targeted | 0 | 1 | 0 | 2 | v8.12.20 신규 AI Assistant 6문항 QA - 목록 가독성·위험 라우팅·트렌드 관찰 |
| QA-20260524-0575 | 2026-05-24T02:26:16.493Z | targeted | 1 | 1 | 0 | 0 | v8.12.18 production targeted QA - healthy filter recheck |
| QA-20260524-0574 | 2026-05-24T02:01:17.511Z | targeted | 1 | 1 | 0 | 0 | Cloud Run 94ce8471b production targeted QA - AI routing closure check |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
| q-new100-group-filtered-peak-metric | P3 | wont-fix | 3 | QA-20260607-0675 | Q-NEW100: 그룹 필터된 peak metric 스토리지 필터 누락 |
| ai-thinking-visualizer-contract-drift | P1 | wont-fix | 2 | QA-20260428-0357 | Thinking visualizer production UI contract drift |
| analyst-single-server-response-mismatch | P1 | wont-fix | 1 | QA-20260519-0535 | Analyst 단일 서버 분석 응답 구조 불일치 수정 |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |
| ai-adversarial-natural-language-qa-pack | P2 | wont-fix | 1 | QA-20260512-0487 | Add QC/security-style natural-language AI regression prompts |
| ai-agent-type-metadata | P2 | wont-fix | 1 | QA-20260326-0190 | AI Chat 에이전트 타입 메타데이터 표시 개선 |
| ai-metric-ranking-memory-path-metadata | P2 | wont-fix | 1 | QA-20260418-0304 | Memory top-N query should expose deterministic metric-ranking path instead of filter fallback metadata |
| ai-remediation-response-quality | P2 | wont-fix | 1 | QA-20260519-0535 | AI Chat 조치 방법 응답 품질 개선 |
| analyst-domain-context-injection | P2 | wont-fix | 1 | QA-20260522-0559 | 심층 분석 시 서버 도메인 특성 미주입 |
| analyst-drilldown | P2 | wont-fix | 1 | QA-20260301-0030 | Analyst 서버별 드릴다운 |

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
