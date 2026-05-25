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
| Dashboard UX Phase 6 | Low | In Progress (Codex). 상세 계획: `reports/planning/dashboard-ux-phase-6-plan.md`. |

---

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| Single path 경량화 | Low | `ALLOW_DEGRADED_SINGLE=false` production 비활성. 단순쿼리 경로 설계 시 재검토. |

---

## Not Actionable / Accepted No-Fix

| Item | Reason | Next Review |
|------|--------|-------------|
| QA WONT-FIX 31개 | `QA-20260526-0602`에서 DoD/릴리즈 통과 증거 7개, `QA-20260526-0603`에서 플랫폼/Free Tier/레거시/도구/후보평가 no-action 9개, `QA-20260526-0604`에서 수정 커밋 확인 5개를 completed로 전환. 잔여는 Portfolio Deferral 31. | release blocker로 재분류될 때만 |
| Historical gate-window warning | `QA-20260519-0535` broad 회귀가 rolling window에 남은 historical context. active gate warning은 없음. | clean gate run이 window를 대체하면 자동 해소 |
| 최근 non-evidence artifact refs 11개 | 모두 `countsTowardSummary=false`, `releaseFacing=false` targeted run의 로컬 MCP screenshot 참조. durable evidence 요구 대상 아님. | 같은 유형이 counted/release-facing run에 생길 때만 |
| QA evidence cleanup batch | 2026-05-26 audit: orphan 0, missing 0, archive candidate 0, storage warning 0. 즉시 정리 불필요. | `reports/qa` 90MiB 초과 또는 orphan/missing 발생 시 |
| Local Docker/WSL storage hygiene residue | 2026-05-26 cleanup 완료: Docker build cache 20.45GB prune, npm cache 8.3GiB -> 16.9MiB, repo tmp/playwright 445.2MiB -> 20.9MiB, uv/puppeteer/next-swc cache 제거. 보존: `.codex`/`.gemini`/`.claude` history, active `ms-playwright`, minikube cache. | 월 1회 `npm run storage:audit` 또는 대규모 QA/배포 전 |
| Supabase 세션 메모리/장기 drift 정책 | 포트폴리오 범위에서는 장기 개인화 메모리와 장기 세션 재동기화가 제품 필수 기능이 아님. 현행 Redis 1시간 TTL과 fresh-load 기준으로 충분하며 Supabase 저장 확장은 과설계. | 포트폴리오 요구가 장기 follow-up/개인화 기억으로 명확히 승격될 때만 |

---

## On Hold

| Task | Priority | Notes |
|------|----------|-------|
| _None_ | - | 현재 보류 중인 작업 없음. |

---

> 완료 이력 → [`archive/`](archive/) 참조
