# TODO - OpenManager AI v8

**Last Updated**: 2026-05-24 KST (계획서 정리 — 완료 항목 archive 이동)

> **작업 주체 표기 규칙** (Codex/Gemini 등 다른 AI 참조용):
> - `In Progress (Claude)` — Claude가 현재 진행 중. 검토만 할 것, 중복 착수 금지.
> - `In Progress (Codex)` — Codex에 위임 완료. Claude는 검토 대기.
> - `사용자 액션 필요` — AI 작업 불가, 사용자가 직접 처리해야 함.

> **이력 아카이브**: 완료 항목 전체 → [`archive/`](archive/)

---

## Active Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Frontend bundlemon blocking 승격 판단 | Medium | tracking (2026-05-30 결정) | P0 warn-first 관찰 중. JS 1.43MB / CSS 61.95KB 현재 PASS. 2026-05-30 전후 blocking 승격 여부만 판단. 상세: [vitest-storybook-optimization-plan.md](vitest-storybook-optimization-plan.md) |

---

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| Dashboard UX Phase 6 | Low | Phase 1~5 완료(2026-05-21). Phase 6는 선택적 백로그. 착수 시 별도 기획 필요. 상세: [dashboard-ux-improvement-plan-2026-05.md](dashboard-ux-improvement-plan-2026-05.md) |
| 세션 메모리 확장 (Supabase, 로그인 사용자 한정) | Low | Portfolio-deferred. 현행 Redis 1시간 TTL 유지. 재개 조건: 사용자형 장기 follow-up이 포트폴리오 필수 요구로 승격될 때. |
| 장기 세션 AI data slot drift 정책 | Low | Fresh load 기준 AI 수치와 OTel snapshot 일치. 장기 세션 resync는 현 범위에서 미도입. 제품 요구 승격 시 별도 plan 작성. |
| Single path 경량화 | Low | `ALLOW_DEGRADED_SINGLE=false` 기본값으로 production 비활성. 경량 단순쿼리 경로 설계 시 재검토. |

---

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Local Docker/WSL storage hygiene | Medium | tracking-only | 비파괴 감사: `npm run storage:audit`. 2026-05-08 기준 WSL 상위 후보 `.npm` 9.7GiB / `.gemini/backups` 2.7GiB / `.codex/sessions` 2.6GiB. 삭제 전 `npm run qa:evidence:audit` 확인. |
| QA evidence 저장소 용량 정리 | Medium | tracking-only | 2026-05-15 기준 orphan durable evidence 19개, reports/qa 111MiB. 새 evidence 누적 또는 cleanup batch 승인 시 재평가. |

---

## Recent Completed

### 2026-05-24 — Redis R-5 실측 완료 (Claude)
- INFO delta 방식(REST API)으로 Upstash 월간 소비량 실측: 약 57,960건/월 (Free Tier 500K의 11.6%)
- R-0~R-6 전체 완료. `redis-usage-cleanup-plan.md` archive 이동.

### 2026-05-24 — bundlemon warn-first 관찰 기록 (Codex)
- `npm run bundle:budget` PASS: JS 1.43MB / CSS 61.95KB / max JS 143.27KB / max CSS 31.12KB

### 2026-05-24 — AI 어시스턴트 NLP 전처리 파이프라인 개선 P1~P4 (Claude, v8.12.17~v8.12.19)
- P1: `SEMANTIC_AGENT_CONFIDENCE_THRESHOLD` 0.8 → 0.65 완화
- P2: 역방향 필터(정상 범위 서버) evidence path + routing pattern 추가
- P3: 최솟값 순위("부하 가장 낮은") sortOrder asc routing 추가
- P4: Advisor 빈 응답 수정 (Type C/D 순수 조언 쿼리 즉시 응답 허용)
- production targeted QA `QA-20260524-0576` 1/1 PASS. 상세: [archive/ai-assistant-improvement-plan-v8.12.16.md](archive/ai-assistant-improvement-plan-v8.12.16.md)

### 2026-05-22~23 — AI 품질 개선 H/I/J 계열 + Task G (Claude+Codex, v8.12.5~v8.12.19)
- H-1~H-5: capacity forecast routing, AZ 비교 evidence provider, semantic fail-closed 등
- Task G: AZ 집계·Top-N 추세 grounding (Released)
- Task J: portfolio standalone 질의 guard 테스트 추가
- Task F: Z.AI Reporter 안정성 관찰 closure (provider-attributed 오류 0건)
- 상세: [archive/ai-quality-improvement-plan-2026-05.md](archive/ai-quality-improvement-plan-2026-05.md)

### 2026-05-21 — AI 라우팅 아키텍처 개선 (Codex)
- deterministic direct routing 완성, intentFrame/LLM orchestrator 제거
- 상세: [archive/ai-routing-improvement-plan.md](archive/ai-routing-improvement-plan.md)

### 2026-05-20~21 — Dashboard UX Phase 1~5 (Codex)
- dashboard status token, 서버 목록 검색, 카드 추세 인디케이터, AI 사이드바 UX 등 Phase 1~5 완료
- 상세: [dashboard-ux-improvement-plan-2026-05.md](dashboard-ux-improvement-plan-2026-05.md)

---

> 이전 완료 이력 전체 → [`archive/todo-history-to-2026-04-13.md`](archive/todo-history-to-2026-04-13.md) 및 각 `archive/*.md` 참조
