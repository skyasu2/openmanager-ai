# TODO - OpenManager AI v8

**Last Updated**: 2026-05-24 KST

> **작업 주체 표기 규칙** (Codex/Gemini 등 다른 AI 참조용):
> - `In Progress (Claude)` — Claude가 현재 진행 중. 검토만 할 것, 중복 착수 금지.
> - `In Progress (Codex)` — Codex에 위임 완료. Claude는 검토 대기.
> - `사용자 액션 필요` — AI 작업 불가, 사용자가 직접 처리해야 함.

> **완료 이력**: 모든 archive → [`archive/`](archive/)

---

## Active Tasks

| Task | Priority | Notes |
|------|----------|-------|
| AI 품질 - trend-routing 라우팅 보강 | P2 | QA-20260524-0579에서 "메모리 트렌드 상승 서버" 질의가 `monitoring-metric-trend` 대신 LLM inference로 처리됨. 단일 라우팅 버그 수정으로 TODO 1줄 추적. |

---

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| Dashboard UX Phase 6 | Low | T-6-A Hexagonal Host Map / T-6-B 카드 min-h / T-6-C fade overlay / T-6-D Tab 네비 / T-6-E 상태 카드 축소 / T-6-F View Transition. 착수 시 별도 기획 필요. |
| 세션 메모리 확장 (Supabase) | Low | Portfolio-deferred. 현행 Redis 1시간 TTL 유지. 재개 조건: 장기 follow-up이 포트폴리오 필수 요구로 승격될 때. |
| 장기 세션 AI data slot drift 정책 | Low | Fresh load 기준 일치. 장기 세션 resync 미도입. 제품 요구 승격 시 별도 plan 작성. |
| Single path 경량화 | Low | `ALLOW_DEGRADED_SINGLE=false` production 비활성. 단순쿼리 경로 설계 시 재검토. |

---

## On Hold

| Task | Priority | Notes |
|------|----------|-------|
| Local Docker/WSL storage hygiene | Medium | 감사: `npm run storage:audit`. WSL 상위 후보 `.npm` 9.7GiB / `.gemini/backups` 2.7GiB / `.codex/sessions` 2.6GiB. |
| QA evidence 저장소 용량 정리 | Medium | orphan durable evidence 19개, reports/qa 111MiB. cleanup batch 승인 시 재평가. |

---

> 완료 이력 → [`archive/`](archive/) 참조
