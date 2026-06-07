# TODO - OpenManager AI v8

**Last Updated**: 2026-06-07 KST (WONT-FIX targeted remediation 완료)

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
| _None_ | - | 현재 즉시 착수 가능한 backlog 없음. |

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
| D-2 Analyst maxSteps 하향 | 2026-06-06 `npm run langfuse:check -- --limit 100 --q supervisor --json` 재확인 결과 post-improvement(2026-05-29 이후) Analyst 표본은 `n=1`뿐이며, 해당 trace는 `durationMs=6344`, `toolsCalled=[detectAnomalies, finalAnswer]`로 maxSteps=5 병목 근거가 없음. maxSteps 5→4 변경은 테스트 SSOT 변경과 production 표본 근거가 함께 필요하므로 보류. | post-improvement Analyst 표본 `n>=3`이고 P95/toolsCalled가 재상승할 때만 |
| QA WONT-FIX 27개 | `QA-20260526-0602`에서 DoD/릴리즈 통과 증거 7개, `QA-20260526-0603`에서 플랫폼/Free Tier/레거시/도구/후보평가 no-action 9개, `QA-20260526-0604`에서 수정 커밋 확인 5개를 completed로 전환했고, `QA-20260529-0642`에서 Q5 오진 메타데이터 1건을 completed로 정정. `QA-20260607-0674`에서 Verify Before Promotion 5개(`ranking-min-advice`, `numbered-list-accordion-split`, `q-new106-ranking-cross-metric`, `server-comparison-deterministic-path`, `summary-block-markdown-heading-hr-code-fence`)를 completed로 전환. 잔여 WONT-FIX는 Portfolio Deferral 27이며 expert open gap은 0. | release blocker로 재분류되거나 Verify Before Promotion 항목을 targeted QA로 승격할 때만 |
| Historical gate-window warning | `QA-20260519-0535` broad 회귀가 rolling window에 남은 historical context. active gate warning은 없음. | clean gate run이 window를 대체하면 자동 해소 |
| 최근 non-evidence artifact refs | 2026-06-06 audit 기준 recent non-evidence artifact refs 0. counted/release-facing run의 비-durable evidence drift 없음. | 같은 유형이 counted/release-facing run에 생길 때만 |
| QA evidence cleanup batch | 2026-06-06 audit: orphan durable evidence 0, recent missing durable artifact refs 0, recent counted runs without artifacts 0, acknowledged artifact debt 2 in the recent window, archive candidate 0, storage warning 0. 즉시 정리 불필요. | `reports/qa` 90MiB 초과 또는 orphan/missing 발생 시 |
| Supabase legacy GraphRAG cleanup E-1/E-2/E-3/E-5 | 2026-06-06 live DB 확인: `command_vectors`, `knowledge_relationships`, `vector_documents_stats`, `knowledge_base.embedding` 모두 없음. `knowledge_base.search_vector`, `search_knowledge_text`, `generate_knowledge_search_vector`, `update_knowledge_search_vector`는 유지됨. `vector`와 `pg_trgm`은 `extensions` 스키마에 설치됨. `npm run supabase:rag:smoke` 통과. | 관련 테이블/컬럼이 다시 생성되거나 Supabase migration ledger repair가 필요할 때만 |
| Local Docker/WSL storage hygiene residue | 2026-05-26 cleanup 완료: Docker build cache 20.45GB prune, npm cache 8.3GiB -> 16.9MiB, repo tmp/playwright 445.2MiB -> 20.9MiB, uv/puppeteer/next-swc cache 제거. 보존: `.codex`/`.gemini`/`.claude` history, active `ms-playwright`, minikube cache. | 월 1회 `npm run storage:audit` 또는 대규모 QA/배포 전 |
| Supabase 세션 메모리/장기 drift 정책 | 포트폴리오 범위에서는 장기 개인화 메모리와 장기 세션 재동기화가 제품 필수 기능이 아님. 현행 Redis 1시간 TTL과 fresh-load 기준으로 충분하며 Supabase 저장 확장은 과설계. | 포트폴리오 요구가 장기 follow-up/개인화 기억으로 명확히 승격될 때만 |
| Single path 경량화 별도 구현 | 현재 `auto` 모드는 단순 질의를 deterministic/single-agent 경로로 이미 유지합니다. explicit `single`과 multi 실패 후 degraded single retry는 emergency gate이며, 2026-05-26 `deploy.sh` 기본값을 `ALLOW_DEGRADED_SINGLE=${ALLOW_DEGRADED_SINGLE:-false}`로 정리해 production 기본 정책과 문서 불일치를 제거했습니다. | 단순 질의 경로의 비용/지연 회귀가 QA 증거로 확인될 때만 |

> 완료 이력 → [`archive/`](archive/) 참조
