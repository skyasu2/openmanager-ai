# QA Trends Dashboard

> Auto-generated file. Source: `reports/qa/qa-tracker.json`.
> Generated at: 2026-06-05 22:27:36 KST

## Summary

| Metric | Value |
|---|---:|
| Recorded Runs | 658 |
| Counted Runs | 514 |
| Total Checks | 4555 |
| Total Passed | 4354 |
| Total Failed | 159 |
| Overall Pass Rate | 95.59% |
| Latest Recorded Run | QA-20260605-0660 |
| Last Counted Run | QA-20260605-0660 |

## AI Latency Rollup (Last 24h)

- Window: 2026-06-04T13:08:33.704Z -> 2026-06-05T13:08:33.704Z (24h)
- Runs with observations: 6 recorded / 5 counted
- Samples: 8

| Agent | Provider | Samples | Avg Latency | P95 Latency | Avg TTFB | P95 TTFB | Avg Processing | P95 Processing | Latest Run |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Advisor Agent | mistral | 2 | 6718ms | 8205ms | 5132ms | 5132ms | 6718ms | 8205ms | QA-20260605-0658 |
| Supervisor | groq | 2 | 1238ms | 1451ms | - | - | 1238ms | 1451ms | QA-20260605-0649 |
| Supervisor | unknown | 1 | 1213ms | 1213ms | - | - | - | - | QA-20260605-0650 |
| Artifact Intent Classifier | mistral | 2 | 604ms | 625ms | - | - | 604ms | 625ms | QA-20260605-0659 |
| Analyst Agent | mistral | 1 | 0ms | 0ms | 747ms | 747ms | - | - | QA-20260605-0653 |

## Planner Shadow Rollup (Last 24h)

- Window: 2026-06-04T13:08:33.704Z -> 2026-06-05T13:08:33.704Z (24h)
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
| All Counted Runs | 514 | 4555 | 95.59% | 88 | 17.12% | 97 | 18.87% |
| Last 30 Counted Runs | 30 | 283 | 97.17% | 2 | 6.67% | 2 | 6.67% |
| Last 10 Counted Runs | 10 | 124 | 100% | 0 | 0% | 0 | 0% |

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
| targeted | 459 | 325 |
| legacy | 137 | 137 |
| broad | 35 | 34 |
| smoke | 15 | 6 |
| release-gate | 11 | 11 |
| regression | 1 | 1 |

## Priority Recurrence

| Priority | Total Items | Recurring Items | Recurrence Rate | Open Items | Open Recurring | Open Recurrence Rate | Completed | Wont-Fix |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| P0 | 50 | 10 | 20% | 0 | 0 | 0% | 50 | 0 |
| P1 | 326 | 114 | 34.97% | 0 | 0 | 0% | 322 | 4 |
| P2 | 343 | 78 | 22.74% | 0 | 0 | 0% | 330 | 13 |
| P3 | 61 | 18 | 29.51% | 0 | 0 | 0% | 51 | 10 |
| P4 | 5 | 1 | 20% | 0 | 0 | 0% | 2 | 3 |
| P5 | 5 | 1 | 20% | 0 | 0 | 0% | 5 | 0 |

## Deployment Regression Correlation

| Deployment ID | Target | Runs | Checks | Pass Rate | Regression Runs | Regression Run Rate | Latest Run | Commit |
|---|---|---:|---:|---:|---:|---:|---|---|
| dpl_5ttYjommNd3ooBXegHLqHY7M6RK6 | vercel-production | 2 | 25 | 100% | 0 | 0% | QA-20260605-0660 | 63ca79bc |
| dpl_BrE1dBffAFfHfrKEuqDdWXD1qf7t | vercel-production | 1 | 20 | 100% | 0 | 0% | QA-20260605-0657 | 105f9b17 |
| dpl_g7Zfcag1nht2qUvsEPYJRjQoUGrq | vercel-production | 2 | 27 | 100% | 0 | 0% | QA-20260605-0656 | 3aa2f7bc |
| dpl_J1PEim6zfHjgGUoB9NcYqgEH2hVj | vercel-production | 1 | 11 | 100% | 0 | 0% | QA-20260605-0651 | 36b29a5c |
| dpl_5Af3pqTpnHXXXPUxqQWfRLWBR2r7 | vercel-production+cloud-run-production | 2 | 22 | 100% | 0 | 0% | QA-20260605-0650 | 9ae1f605 |
| dpl_4ouyrzWwdYJ3FcedNZcrp2pesDN3 | vercel-production+cloud-run-production | 1 | 6 | 100% | 0 | 0% | QA-20260604-0648 | 3b91b069 |
| dpl_JD28Eo72pCqgfRMP6qPEJ6M8pBzf | vercel-production | 1 | 10 | 100% | 0 | 0% | QA-20260530-0647 | ed19d759 |
| dpl_B9gD74nvF4FwUahzo3NwFmKZ85WA | vercel-production | 1 | 5 | 100% | 0 | 0% | QA-20260530-0646 | 2510ade1 |
| dpl_EhLf7tgfW7Hm3cQYz9pDEca9rxw9 | vercel-production | 2 | 8 | 100% | 0 | 0% | QA-20260529-0641 | ef784e4d |
| gitlab-pipeline-2558589906-v8.12.73 | vercel-production | 1 | 15 | 100% | 0 | 0% | QA-20260528-0636 | 095023c0 |
| gitlab-pipeline-2558270507-v8.12.72 | vercel-production | 1 | 13 | 100% | 0 | 0% | QA-20260528-0634 | 9d1870d4 |
| gitlab-pipeline-2557819992-v8.12.68 | vercel-production | 1 | 9 | 100% | 0 | 0% | QA-20260528-0630 | c7b54f50 |

## Recent Daily Trend (KST)

| Date | Runs | Checks | Pass Rate | Failed Runs | Regression Runs | Regression Run Rate |
|---|---:|---:|---:|---:|---:|---:|
| 2026-05-19 | 10 | 104 | 92.31% | 3 | 3 | 30% |
| 2026-05-20 | 3 | 36 | 91.67% | 1 | 1 | 33.33% |
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

## Recent Regression Runs

| Run ID | Time (UTC) | Scope | Failed Checks | Pending | Deferred | Wont-Fix | Title |
|---|---|---|---:|---:|---:|---:|---|
| QA-20260527-0624 | 2026-05-27T07:17:17.887Z | targeted | 3 | 3 | 0 | 0 | Vercel Playwright MCP targeted QA - 2026-05-26..27 modified surfaces only |
| QA-20260527-0620 | 2026-05-27T03:05:16.952Z | targeted | 1 | 0 | 0 | 0 | AI 어시스턴트 신규 질문 평가 Q-NEW52~Q-NEW57 + P15 재확인 (v8.12.56) |
| QA-20260526-0615 | 2026-05-26T14:54:35.345Z | targeted | 2 | 0 | 0 | 0 | AI 어시스턴트 신규 질문 평가 Q-NEW46~Q-NEW51 (P15/P16 발견) |
| QA-20260525-0590 | 2026-05-25T03:57:03.861Z | targeted | 1 | 1 | 0 | 0 | v8.12.36 Production QA - Q-NEW13 Advisor evidence regression check |
| QA-20260525-0584 | 2026-05-24T15:52:12.919Z | targeted | 1 | 0 | 0 | 4 | v8.12.28 신규 6문항 AI 어시스턴트 평가 — 디스크필터·Advisor·팔로업·AZ비교·네트워크 |
| QA-20260524-0579 | 2026-05-24T07:21:06.892Z | targeted | 0 | 1 | 0 | 2 | v8.12.20 신규 AI Assistant 6문항 QA - 목록 가독성·위험 라우팅·트렌드 관찰 |
| QA-20260524-0575 | 2026-05-24T02:26:16.493Z | targeted | 1 | 1 | 0 | 0 | v8.12.18 production targeted QA - healthy filter recheck |
| QA-20260524-0574 | 2026-05-24T02:01:17.511Z | targeted | 1 | 1 | 0 | 0 | Cloud Run 94ce8471b production targeted QA - AI routing closure check |
| QA-20260524-0572 | 2026-05-23T15:52:37.929Z | targeted | 3 | 0 | 0 | 0 | v8.12.16 AI 어시스턴트 5차 평가 — 미테스트 6문항 (cache그룹·역방향필터·최솟값·그룹+예측·Advisor·세션컨텍스트) |
| QA-20260523-0569 | 2026-05-23T10:19:45.964Z | targeted | 1 | 0 | 0 | 1 | v8.12.15 focused Vercel production QA - quick-start, artifact envelope, DB threshold |

## Recurring Open Items

| ID | Priority | Status | Seen | Last Seen Run | Title |
|---|---|---|---:|---|---|
| ai-thinking-visualizer-contract-drift | P1 | wont-fix | 2 | QA-20260428-0357 | Thinking visualizer production UI contract drift |
| analyst-single-server-response-mismatch | P1 | wont-fix | 1 | QA-20260519-0535 | Analyst 단일 서버 분석 응답 구조 불일치 수정 |
| landing-vibe-content-deployment-drift | P1 | wont-fix | 1 | QA-20260330-0195 | Vibe Coding 프로덕션 카드 내용과 현재 소스 간 배포 드리프트 해소 |
| server-comparison-deterministic-path | P1 | wont-fix | 1 | QA-20260522-0559 | 서버 1:1 비교 쿼리 deterministic 경로 미확립 |
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
