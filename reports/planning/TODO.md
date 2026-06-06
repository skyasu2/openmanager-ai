# TODO - OpenManager AI v8

**Last Updated**: 2026-06-06 KST (A-2 Langfuse Analyst 기준선 실측 완료)

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
| A-1 "왜/원인" RCA 라우팅 보강 | P1 | `orchestrator-direct-routing.ts` pre-filter에 RCA 패턴 추가. 계획서: [ai-assistant-improvement-plan-2026-06.md](ai-assistant-improvement-plan-2026-06.md) |
| E-6 approval/incident 사용 여부 확인 | P1 | Supabase cleanup 선행 분석. 삭제/유지 판단 전에 실제 request path 추적 |
| E-1 command_vectors 잔여 이관+삭제 | P1 | 5행 잔여. knowledge_base 확인 후 DROP TABLE migration |
| C-1 orchestrator 중간층 상수 분리 | P2 | `AssistantDomain.routingOverridePolicy` 인터페이스 추가. A-1 이후 진행 권장 |
| E-2 knowledge_relationships 삭제 | P2 | 런타임 미사용 테이블. E-1 후 DROP TABLE migration |
| E-3 knowledge_base.embedding 컬럼 제거 | P2 | cosine path 비활성, 벡터 데이터 삭제. E-1·E-2 완료 후 |
| E-4 security_audit_logs retention | P2 | 장기 DB 증가 차단. pg_cron/Edge Function 중 Free Tier 적합 경로 선택 |
| B-1 라우팅 회귀 감지 스크립트 | P2 | 표준 질문의 expected agent/provider 이탈 자동 감지. A-2 기준선 확보 완료, A-1/C-1 이후 진행 |
| E-5 Extension 스키마 migration | P3 | Supabase advisor 경고 해소. E-3 완료 후 disposable DB에서 시뮬레이션 |
| D-2 Analyst maxSteps 하향 검증 | P3 | 2026-06-06 A-2 기준 after Analyst 표본 `n=1`, 병목 미확정. 추가 표본에서 P95 재상승 시만 착수 |

---

## On Hold

| Task | Priority | Notes |
|------|----------|-------|
| B-2 Langfuse Score 자동 기록 | Hold | LLM-as-judge/evals 기초. 상업화 준비 시 재개 |
| D-1 Langfuse 주간 자동 집계 | Hold | 장기 운영 자동화. 현재는 `npm run langfuse:check` 수동 점검으로 충분 |

---

## Not Actionable / Accepted No-Fix

| Item | Reason | Next Review |
|------|--------|-------------|
| QA WONT-FIX 30개 | `QA-20260526-0602`에서 DoD/릴리즈 통과 증거 7개, `QA-20260526-0603`에서 플랫폼/Free Tier/레거시/도구/후보평가 no-action 9개, `QA-20260526-0604`에서 수정 커밋 확인 5개를 completed로 전환했고, `QA-20260529-0642`에서 Q5 오진 메타데이터 1건을 completed로 정정. `QA-20260605-0660` 기준 expert open gap은 0, 잔여 WONT-FIX는 Portfolio Deferral 30이며 review class는 Verify Before Promotion 13, Future Product Expansion 5, Low-Priority Polish 8, Accepted No-Action 4. | release blocker로 재분류되거나 Verify Before Promotion 항목을 targeted QA로 승격할 때만 |
| Historical gate-window warning | `QA-20260519-0535` broad 회귀가 rolling window에 남은 historical context. active gate warning은 없음. | clean gate run이 window를 대체하면 자동 해소 |
| 최근 non-evidence artifact refs 11개 | 모두 `countsTowardSummary=false`, `releaseFacing=false` targeted run의 로컬 MCP screenshot 참조. durable evidence 요구 대상 아님. | 같은 유형이 counted/release-facing run에 생길 때만 |
| QA evidence cleanup batch | 2026-06-05 audit: orphan durable evidence 0, recent missing durable artifact refs 0, recent counted runs without artifacts 0 after accepted debt annotation, acknowledged artifact debt 2 in the recent window, archive candidate 0, storage warning 0. 즉시 정리 불필요. | `reports/qa` 90MiB 초과 또는 orphan/missing 발생 시 |
| Local Docker/WSL storage hygiene residue | 2026-05-26 cleanup 완료: Docker build cache 20.45GB prune, npm cache 8.3GiB -> 16.9MiB, repo tmp/playwright 445.2MiB -> 20.9MiB, uv/puppeteer/next-swc cache 제거. 보존: `.codex`/`.gemini`/`.claude` history, active `ms-playwright`, minikube cache. | 월 1회 `npm run storage:audit` 또는 대규모 QA/배포 전 |
| Supabase 세션 메모리/장기 drift 정책 | 포트폴리오 범위에서는 장기 개인화 메모리와 장기 세션 재동기화가 제품 필수 기능이 아님. 현행 Redis 1시간 TTL과 fresh-load 기준으로 충분하며 Supabase 저장 확장은 과설계. | 포트폴리오 요구가 장기 follow-up/개인화 기억으로 명확히 승격될 때만 |
| Single path 경량화 별도 구현 | 현재 `auto` 모드는 단순 질의를 deterministic/single-agent 경로로 이미 유지합니다. explicit `single`과 multi 실패 후 degraded single retry는 emergency gate이며, 2026-05-26 `deploy.sh` 기본값을 `ALLOW_DEGRADED_SINGLE=${ALLOW_DEGRADED_SINGLE:-false}`로 정리해 production 기본 정책과 문서 불일치를 제거했습니다. | 단순 질의 경로의 비용/지연 회귀가 QA 증거로 확인될 때만 |

> 완료 이력 → [`archive/`](archive/) 참조
