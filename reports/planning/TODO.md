# TODO - OpenManager AI v8

**Last Updated**: 2026-05-26 KST

> **작업 주체 표기 규칙** (Codex/Gemini 등 다른 AI 참조용):
> - `In Progress (Claude)` — Claude가 현재 진행 중. 검토만 할 것, 중복 착수 금지.
> - `In Progress (Codex)` — Codex에 위임 완료. Claude는 검토 대기.
> - `사용자 액션 필요` — AI 작업 불가, 사용자가 직접 처리해야 함.

> **완료 이력**: 모든 archive → [`archive/`](archive/)

---

## Active Tasks

| Task | Priority | Notes |
|------|----------|-------|
| _None_ | - | 현재 진행 중인 작업 없음. |

---

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| Dashboard UX Phase 6 | Low | T-6-A Hexagonal Host Map / T-6-B 카드 min-h / T-6-C fade overlay / T-6-D Tab 네비 / T-6-E 상태 카드 축소 / T-6-F View Transition. 착수 시 별도 기획 필요. |
| 세션 메모리 확장 (Supabase) | Low | Portfolio-deferred. 현행 Redis 1시간 TTL 유지. 재개 조건: 장기 follow-up이 포트폴리오 필수 요구로 승격될 때. |
| 장기 세션 AI data slot drift 정책 | Low | Fresh load 기준 일치. 장기 세션 resync 미도입. 제품 요구 승격 시 별도 plan 작성. |
| Single path 경량화 | Low | `ALLOW_DEGRADED_SINGLE=false` production 비활성. 단순쿼리 경로 설계 시 재검토. |

---

## Not Actionable / Accepted No-Fix

| Item | Reason | Next Review |
|------|--------|-------------|
| QA WONT-FIX 45개 | `QA-20260526-0602`에서 DoD/릴리즈 통과 증거 7개를 completed로 전환. 잔여는 Platform Constraint 1 / Free Tier Tradeoff 3 / Historical Obsolete 2 / Portfolio Deferral 39. | release blocker로 재분류될 때만 |
| Historical gate-window warning | `QA-20260519-0535` broad 회귀가 rolling window에 남은 historical context. active gate warning은 없음. | clean gate run이 window를 대체하면 자동 해소 |
| 최근 non-evidence artifact refs 16개 | 모두 `countsTowardSummary=false`, `releaseFacing=false` targeted run의 로컬 MCP screenshot 참조. durable evidence 요구 대상 아님. | 같은 유형이 counted/release-facing run에 생길 때만 |
| QA evidence cleanup batch | 2026-05-26 audit: orphan 0, missing 0, archive candidate 0, storage warning 0. 즉시 정리 불필요. | `reports/qa` 90MiB 초과 또는 orphan/missing 발생 시 |

---

## On Hold

| Task | Priority | Notes |
|------|----------|-------|
| Local Docker/WSL storage hygiene | Medium | 감사: `npm run storage:audit`. WSL 상위 후보 `.npm` 9.7GiB / `.gemini/backups` 2.7GiB / `.codex/sessions` 2.6GiB. |
| QA evidence 저장소 용량 정리 | Low | 현재 cleanup batch 불필요. `npm run qa:evidence:audit` 기준 reports/qa 65.86MiB, orphan/missing/archive candidate 0. |

---

> 완료 이력 → [`archive/`](archive/) 참조
