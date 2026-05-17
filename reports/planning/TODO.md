# TODO - OpenManager AI v8

**Last Updated**: 2026-05-17 KST (릴리스 구성요소 버전 계약 완료)

> **작업 주체 표기 규칙** (Codex/Gemini 등 다른 AI 참조용):
> - `In Progress (Claude)` — Claude가 현재 진행 중. 검토만 할 것, 중복 착수 금지.
> - `In Progress (Codex)` — Codex에 위임 완료. Claude는 검토 대기.
> - `사용자 액션 필요` — AI 작업 불가, 사용자가 직접 처리해야 함.

> **이력 아카이브**: `#1~#89` 완료 항목 → [archive/todo-history-to-2026-04-13.md](archive/todo-history-to-2026-04-13.md)

## Active Tasks

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| Frontend 품질 게이트 최적화 (bundlemon warn-first 포함) | High | In Progress (tracking) | P0/P1/P2/P3/P4 완료. Storybook interaction runner는 안정 스토리 4개/5 tests bounded 실행으로 확정(`npm run test:storybook:interaction` PASS, 207.51s). `npm run bundle:budget` 첫 관측 PASS(JS group 1.37MB/2MB, CSS group 34.94KB/250KB). 잔여 구현 없음. P0 bundlemon은 2026-05-30 전후 1~2주 관측 후 blocking 승격 여부만 판단. 상세: [vitest-storybook-optimization-plan.md](vitest-storybook-optimization-plan.md) |
---

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| Single path 경량화 | Low | `ALLOW_DEGRADED_SINGLE=false` 기본값으로 production에서 single mode 실질 비활성. 경량 단순쿼리 경로 설계 시 재검토. |
| AI 어시스턴트 이식성 개선 — 프론트엔드 아티팩트 레지스트리 전환 (T1~T4) | Low | 다른 도메인 AI 어시스턴트 제작 시 이 프로젝트를 참조할 수 있도록 정비. 백엔드는 이미 완성. 프론트엔드 3곳(ChatArtifact 유니온, ArtifactRendererHost switch, chat-artifact-execution switch)을 레지스트리 패턴으로 전환. 상세: [ai-portability-improvement-plan.md](ai-portability-improvement-plan.md) |

---

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| ~~Cerebras 기본 모델 전환 재확인~~ | — | **완료** | `gpt-oss-120b` 전환 완료 (2026-05-16 이전). `llama3.1-8b` 2026-05-27 종료 대응 완료. |
| P2: Local Docker/WSL storage hygiene | Medium | tracking-only | 주기 점검 기준 추가. 비파괴 감사는 `npm run storage:audit` / 상세 Docker 확인은 `npm run storage:audit -- --docker-verbose`. 2026-05-08 감사: `/mnt/d` 4%, WSL `/` 8%, `/mnt/c` 66% 사용. Docker images 10.11GiB, build cache 0B, volumes 309.3MiB이며 대부분 실행 중인 Supabase/GitHub MCP 컨테이너에 연결됨. 즉시 삭제보다 Supabase 중지 후 prune 여부 판단. WSL 상위 정리 후보는 `.npm` 9.7GiB, `.gemini/backups` 2.7GiB, `.codex/sessions` 2.6GiB, `.npm/_npx` 2.5GiB, `.cache/uv` 2.4GiB, browser cache 각 1.2GiB, `tmp/root-artifacts` 641MiB. 삭제 전 QA evidence는 `npm run qa:evidence:audit` 확인. |
| P2: QA evidence 저장소 용량 정리 | Medium | tracking-only | 2026-05-15 `npm run qa:evidence:audit` 재확인: missing durable artifact paths `0`, orphan durable evidence `19개`, recent counted runs without artifacts `0`, recent acknowledged artifact debt runs `0`, `reports/qa=111.18MiB`, `reports/qa/evidence=104.32MiB`, referenced legacy evidence `125개/36.40MiB`, archive candidates `7개/2.16MiB`, size warning 유지. run-level soft budget warning은 `QA-20260330-0197`, `QA-20260330-0198` 2건. orphan evidence는 삭제 전 각 run/repro 참조 가치 확인이 필요하며, referenced legacy evidence는 policy-protected proof 가능성이 높아 explicit cleanup batch 없이는 보존. 새 evidence 누적 또는 별도 cleanup batch 승인 시 재평가. |

## Backlog (완료 이력)

| Task | Priority | Notes |
|------|----------|-------|
| ~~Routing & UX 개선 — 오프도메인 경고 위임 + 보안 riskLevel 분화~~ | — | **완료** — `767acd026`로 high-only 차단, medium/low 경고 통과, off-domain 경고 위임을 구현하고 GitLab pipeline `2530042325` success 확인. 이어서 Direct Router/5 specialist agents, request guard 정책, Round-Robin provider flow를 아키텍처 문서와 ADR에 반영했다. `v8.11.160` release/tag pipeline `2530076991` success로 Vercel production과 Cloud Run `ai-engine-00477-fxw` 100% traffic 배포 완료. 상세: [archive/routing-ux-improvement-plan.md](archive/routing-ux-improvement-plan.md) |
| ~~Provider runtime env sync — Z.AI/GLM 활성화 + Cerebras env drift 제거~~ | — | **완료** — Secret Manager `ai-providers-config` version 8에 `zai`를 안전 병합하고 Cloud Run `ai-engine-00476-hz2` revision을 100% traffic으로 적용했다. `/health.config.zai=true`, `CEREBRAS_MODEL_ID=gpt-oss-120b`, `ZAI_DEFAULT_MODEL=glm-4.5-flash` 확인. 재발 방지를 위해 `deploy.sh`/`cloudbuild.yaml` 기본값과 env 문서를 갱신했다. GitLab main pipeline `2530020344` success. 상세: [archive/provider-runtime-env-sync-plan.md](archive/provider-runtime-env-sync-plan.md) |
| ~~NLQ EntitySchema provider compatibility fix~~ | — | **완료** — `/api/ai/nlq/extract-entities` structured-output schema를 required nullable 계약으로 정렬하고 top-level `metric/timeRange` provider drift를 normalizer 경계에서 흡수하도록 완충했다. `QA-20260516-0508`에서 Groq `llama-4-scout` 4/4 schema_valid·intent_accuracy·executionMode_accuracy 회복, Mistral `ministral-3b`는 4/4 schema_valid·intent_accuracy 및 3/4 executionMode_accuracy로 비교 기록. |
| ~~NLQ front provider live 비교 QA~~ | — | **완료** — `QA-20260516-0507`에서 Groq/Mistral/Cerebras/Z.AI 후보를 provider당 4 fixture로 수동 smoke. Current schema 기준 Mistral `ministral-3b-latest`만 4/4 통과, strict required nullable schema 기준 Groq 3/4·Mistral `ministral-3b-latest` 4/4. 결론: production provider 전환보다 `NLQ EntitySchema provider compatibility fix`가 선행. |
| ~~대형 리팩터 커밋 분할 기준 보강~~ | — | **완료** — `reports/planning/README.md`에 대형 리팩터의 `test(spec):` / 구현 / docs·QA 커밋 분리 기준과 분할 필요·불필요 조건을 추가했다. 코드 변경 없는 프로세스 규칙 개선으로 처리. |
| ~~orchestrator-routing 모듈 경계 정리~~ | — | **완료** — `cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-prompt-helpers.ts`로 prompt/capability helper를 분리하고, deterministic forced knowledge path와 empty tool-result summarization fallback도 각각 전용 모듈로 이동했다. `orchestrator-routing.ts`는 706줄 → 459줄로 축소되어 계획 기준(≤500)을 충족. SDD 선행 커밋 `test(spec): add orchestrator prompt builder tests` 후 구현. 검증: targeted Vitest 2 files / 23 tests, AI Engine `type-check`, AI Engine full test 125 files / 1218 tests, `line-guard` 통과. 상세: [archive/post-2026-0515-improvement-plan.md](archive/post-2026-0515-improvement-plan.md) T4 |
| ~~message-helpers evidence/source helper 분리~~ | — | **완료** — `src/hooks/ai/utils/evidence-source-helpers.ts`로 knowledge search tool output retrieval/evidence card 추출, source group 구성, semantic evidence data source 라벨, assistant `analysisBasis` 조립을 이동했다. `message-helpers.ts`는 629줄 → 382줄로 축소되어 계획 기준(≤450)을 충족. SDD 선행 커밋 `test(spec): add evidence source helper unit tests` 후 구현. 검증: targeted Vitest 4 files / 63 tests, `type-check`, `lint`, `test:quick`, `line-guard` 통과. 상세: [archive/post-2026-0515-improvement-plan.md](archive/post-2026-0515-improvement-plan.md) T3 |
| ~~서버 카드 Peek UX 개선~~ | — | **완료 / 2026-05-17 UX 재조정으로 superseded** — 2026-05-16에는 초기 상태 전용 1.5행 `max-height`, fade overlay, `접기`를 추가했으나, 2026-05-17 서버 카드 UX 재검토에서 부분 행 노출과 불필요한 접힘으로 판단해 제거했다. 현재 기준은 카드 전체 상세 진입, 고정폭 그리드, 온전한 행 단위 `더 보기`이며, archive plan은 과거 구현 이력으로만 보존한다. 상세 계획서 archive: [archive/dashboard-server-card-peek-plan.md](archive/dashboard-server-card-peek-plan.md) |
| ~~useAIChatCore guidance CTA helper 분리~~ | — | **완료** — `src/hooks/ai/core/chat-artifact-guidance.ts`로 guidance CTA target→artifact intent/query 매핑, CTA 실행 차단, guidance/direct artifact request 분기를 이동했다. `useAIChatCore.ts`는 724줄 → 597줄로 축소되어 계획 기준(≤600)을 충족. SDD 선행 커밋 `test(spec): add guidance CTA isolation regression` 후 구현. 검증: targeted Vitest `2 files / 18 tests` PASS. 상세: [archive/post-2026-0515-improvement-plan.md](archive/post-2026-0515-improvement-plan.md) T2 |
| ~~GraphRAG 완전 제거 SDD / KRL production closure~~ | — | **완료** — active runtime의 GraphRAG/useGraphRAG/graph traversal/vector 검색 표면을 제거하고 KRL(`search_knowledge_text` + EvidenceCard/RetrievalMetadata)을 canonical 경로로 정리했다. Supabase legacy inventory 제거(T5)는 `QA-20260515-0505`, Vercel production T7은 `QA-20260515-0506`에서 17/17 PASS, pending 0, expert open gap 0으로 기록. release `v8.11.154`, tag pipeline `2527097775` success, main validate pipeline `2527097782` success. 상세: [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) |
| ~~Supabase legacy GraphRAG inventory 제거~~ | — | **완료** — 사용자 승인 후 production Supabase `drop_legacy_graphrag_inventory` migration 적용. `vector_documents_stats`, `knowledge_relationships`, `command_vectors`, `knowledge_base.embedding` 제거, `search_knowledge_text`/`search_vector` 보존 확인. `npm run supabase:rag:smoke` 16/16 PASS, `cloud-run/ai-engine` `rag:analyze` governance 12/12 PASS. QA: [QA-20260515-0505](../qa/runs/2026/qa-run-QA-20260515-0505.json). 상세: [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) T5 |
| ~~KRL 한국어 운영 표현 fallback + golden smoke 강화~~ | — | **완료** — `프로세서 사용률`, `mysql 접속 실패`, `서버 토폴로지 구성도` 같은 운영 표현을 KRL deterministic fallback에 반영하고, `supabase:rag:smoke`가 row count 외 기대 top title/category를 확인하도록 강화했다. Live smoke 16 checks PASS. 상세: [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) T11 |
| ~~AI 근거 출처 가시성 + KRL category smoke~~ | — | **완료** — analysis basis metadata에 `monitoring-data`, `knowledge-base`, `web-search`, `tool-result` source grouping을 추가하고 `semanticQueryTrace.selectedEvidenceProvider`를 domain evidence detail로 표시한다. `supabase:rag:smoke`에 `architecture`, `command`, `incident` category 대표 질의를 추가해 live smoke PASS 확인. 검증: targeted DOM tests 3 files / 59 tests, `npm run type-check`, `npm run test:quick`, `npm run lint`, docs checks, `git diff --check` 통과. 상세: [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) T10 |
| ~~지식 베이스 항목 강화 live inventory 확인~~ | — | **완료** — live `npm run rag:analyze` 기준 KB는 총 60건으로 governance 전부 PASS이며 `architecture=5`, `command=25`, `incident=9`, `best_practice=9`, `security=1`로 목표 범위를 충족한다. seed 10건 추가 시 hard max 64 초과가 확인되어 같은 turn에서 관계 참조 0건 확인 후 롤백(`deleted=10`, total=60)했다. 추가 seed 작업은 불필요하며 category smoke는 T10에서 진행. 상세: [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) T9 |
| ~~ragEnabled store 잔재 제거~~ | — | **완료** — client store의 `ragEnabled/setRagEnabled` dead state를 제거하고, `useAIChatCore`가 더 이상 RAG override를 supervisor 경로로 전달하지 않도록 정리했다. 관련 sidebar/workspace mock과 metadata fallback도 정렬했다. 검증: targeted Vitest 7 files / 85 tests, `npm run type-check`, `npm run test:quick`, `git diff --check` 통과. 상세: [archive/query-pipeline-improvement-plan.md](archive/query-pipeline-improvement-plan.md) T8 |
| ~~artifact G1 — server-monitoring-analysis 채팅 경로 정합성~~ | — | **완료** — `server-registry.ts`에 운영자 친화 alias resolver를 추가하고 `chat-artifact-intent.ts`가 `web-server-01` 같은 입력을 canonical serverId(`web-nginx-dc1-01`)로 정규화해 `server-monitoring-analysis` 아티팩트를 실행하도록 정렬했다. 레지스트리/intent 회귀 테스트와 설계 문서의 stale "채팅 불가" 설명을 갱신했다. |
| ~~artifact G5 — workspace 비교 결과 사람이 읽기 좋게 표시~~ | — | **완료** — `ArtifactWorkspacePanel` 비교 결과에 count만 표시하던 상태에서 artifact kind + `generatedAt` KST 시각 + 상태(`matched/missing/added/changed`) 상세 라벨을 추가했다. 기존 replay pack 비교 count 계약은 유지했고, store/UI 회귀 테스트를 보강했다. |
| ~~Artifact UX 개선 Phase 2+~~ | — | **완료** — [artifact-ux-improvement-plan.md](artifact-ux-improvement-plan.md) T1~T8 전체 완료. Cloud Run batch `capacityAlerts[]`, monitoring `roleGroupSummary[]`, incident 반복 로그/가용성 영향, 채팅→탭 replay, ops-procedure trace 불변성, server-monitoring-analysis intent 경로를 반영했다. 검증: AI Engine targeted/full tests, root targeted tests, `type-check`, `lint`, `test:quick`, `test:contract` 통과. |
| ~~v8.11.146 AI five-question QA 잔여 회귀 수정~~ | — | **완료** — failing regression test 커밋 `1085b66e5` 후 구현 커밋 `2962692dd`로 `web-server-01` 별칭을 `web-nginx-dc1-01` 상세로 해석하고, action-needed 답변의 즉시 조치/주의 관찰 결론을 분리했다. `v8.11.147` tag pipeline `2524168807` success 배포 후 Vercel production Playwright MCP 표준 5문항 QA `QA-20260514-0499`에서 10/10 PASS, pending 0, expert open gap 0으로 closure. |
| ~~Cerebras `llama3.1-8b` Graceful Exit~~ | — | **완료** — 공식 deprecation 기준으로 2026-05-27 이후 `llama3.1-8b` 요청을 provider loop 진입 전 Groq로 사전 전환하도록 구현했다. `FALLBACK_ERROR_CODES`에 404/410을 추가하고, `isCerebrasExpiredByDate()` 계약/회귀 테스트를 추가했다. 검증: AI Engine targeted tests, AI Engine `type-check`, AI Engine full test 122 files / 1196 tests, root `type-check`, `lint`, `test:contract`, `line-guard`, docs checks, `git diff --check`. GitLab main pipeline `2523895744` success: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2523895744`. 상세: [archive/cerebras-deprecation-graceful-exit-plan.md](archive/cerebras-deprecation-graceful-exit-plan.md) |
| ~~AI Assistant 안정화 커밋 전달 마감~~ | — | **완료** — `0ca8d9b88 refactor(ai): clarify assistant agent runtime roles`를 GitLab main에 전달. 심층 평가 후 follow-up으로 fallback/summary/theme hook 직접 테스트(`52067050d`), component dependency map 갱신(`4b52e30f7`), CI no-provider 환경 logger mock 보강(`957a84659`)을 추가했다. `memory/ops-knowledge.md`는 활성 문서 참조 보존 대상으로 포함. GitLab pipeline `2523752216` success: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2523752216`. |
| ~~AI Assistant 변경분 커밋 전 안정화~~ | — | **완료** — 추가 line-guard polish보다 커밋 우선으로 판단하고, AI Assistant 역할/라우팅/문서/라인가드 완충 리팩터 변경분을 단일 안정화 묶음으로 정리했다. 최종 게이트: root `test:quick`, `type-check`, `lint`, `test:contract`, `line-guard`, AI Engine `type-check`, `test`, `docs:budget`, `docs:ai-consistency`, `git diff --check` 통과. `memory/ops-knowledge.md`는 로컬 메모라 커밋 대상에서 제외. |
| ~~AI Assistant 설계 개선 (agent role/tool/runtime routing cleanup)~~ | — | **완료** — Cloud Run `NLQ Agent` 사용자 노출명을 `Metrics Query Agent`로 정렬하고 legacy alias 호환을 유지했다. Metrics Query/Reporter/Advisor 역할별 tool allowlist를 재조정하고, Cerebras 2026-05-27 contingency, Vercel preprocessing runtime gate, Orchestrator confidence/decomposition gate, monitoring tool policy 일원화, Domain Evidence 승격, `matchPatterns` metadata-only 정리, root `metric_peak` local-first entity extraction을 완료했다. Metrics Query Cerebras-first 전환 검토는 2026-05-16 quota rebalance에서 종료. 검증: AI Engine/root targeted Vitest, AI Engine full test, root `type-check`, `test:quick`, `test:contract`, `lint:changed`, `docs:budget`, `docs:ai-consistency`, `git diff --check`. 상세 계획서 archive 이동: [archive/ai-assistant-agent-runtime-improvements-plan.md](archive/ai-assistant-agent-runtime-improvements-plan.md) |
| ~~AI Assistant 설계 개선 (artifact route guard + entity routing polish)~~ | — | **완료** — 재검토 결과 artifact BFF 우회는 실제 결함이 아니라 다이어그램 표현 오해로 판정하고, 실제 개선 필요 항목만 반영. `incident-report`/`intelligent-monitoring` POST에 `aiAnalysis` rate-limit 계약을 추가하고, Groq text model ID를 `meta-llama/llama-4-scout-17b-16e-instruct`로 통일. `extractEntitiesCached()` 5분 TTL/in-flight cache, 자연어 부하 표현 semantic gate, Cloud Run zero-token 문서 표현 정정을 완료. 검증: targeted node/dom Vitest, `npm run type-check`, `npm run lint:changed`, `npm run test:quick`, `npm run test:contract`, `npm run line-guard`, `docs:budget`, `docs:ai-consistency`, `docs:lint:changed`, `git diff --check`. 상세 계획서 archive 이동: [archive/ai-assistant-design-improvements.md](archive/ai-assistant-design-improvements.md) |
| ~~Server monitoring artifact surface~~ | — | **완료** — 단일 서버 이상감지/추세 분석을 direct fetch에서 `server-monitoring-analysis` typed artifact로 전환하고, artifact execution/replay/schema/renderer에 흡수. 기능 탭 selected-server 경로는 `executeChatArtifact`를 사용하며 자연어 artifact intent classifier target은 확장하지 않고 서버 선택 context가 있는 surface로 분리. auto-report stale export cleanup 및 아키텍처 다이어그램/문서 갱신 완료. 검증: targeted Vitest 7 files / 57 tests, `npm run type-check`, `npm run lint`, `npm run test:quick`, `npm run test:contract`, `npm run line-guard`, `npm run docs:budget`, `npm run docs:ai-consistency`, `npm run docs:components:verify`, `npm run knip:ci`, `git diff --check`. 상세 계획서 archive 이동: [archive/server-monitoring-artifact-surface-plan.md](archive/server-monitoring-artifact-surface-plan.md) |
| ~~AI artifact surface unification~~ | — | **완료** — Chat 자연어 artifact 실행 경로와 장애보고서/전체 시스템 이상감지 기능 탭 실행 경로를 `artifact-execution` helper로 통합. 기능 탭 생성 결과를 `ArtifactEnvelope` 기반 local-session replay pack으로 저장하고, 장애보고서 직접 API 변환 중복을 제거. 검증: targeted Vitest 3 files / 15 tests, `npm run type-check`, `npm run lint`, `npm run test:quick`, `npm run test:contract`, `npm run line-guard`, `git diff --check`. 상세 계획서 archive 이동: [archive/ai-artifact-surface-unification-plan.md](archive/ai-artifact-surface-unification-plan.md) |
| ~~AI architecture cleanup + status automation~~ | — | **완료** — P1~P4에서 query routing signal SSOT 정렬, artifact workspace corrupt storage regression coverage, supervisor routing re-export 제거, guest disclosure intent 주석화를 완료. P5에서 `docs/status.md` 자동 갱신 마커와 `scripts/docs/update-status.ts`, `docs:status:update/check`, release commit 연동 및 publish drift check를 추가. 검증: status dry-run/write/check, historical docs lint, Biome targeted check, `git diff --check`. 상세 계획서 archive 이동: [archive/ai-architecture-cleanup-plan.md](archive/ai-architecture-cleanup-plan.md) |
| ~~GitLab pipeline resource diagnostics~~ | — | **완료** — v8.11.141 tag pipeline을 재분석해 `deploy` job이 `resource_group=production`에서 `waiting_for_resource`이고 후속 jobs는 stage-blocked `created` 상태임을 확인. `gitlab:pipeline:inspect`를 추가해 pipeline/jobs/resource queue/diagnosis를 한 번에 출력하도록 보강. 검증: pipeline inspect smoke, fake SHA no-pipeline path, docs checks, `git diff --check`. |
| ~~CI wait progress and QA evidence audit refresh~~ | — | **완료** — `runner-health-check.sh`가 로컬 runner/Docker 확인만 보장한다는 한계를 명시하고 출력에 `scope=local`을 추가. `gitlab:pipeline:head -- --wait`가 pipeline 생성 대기 중에도 `waiting_for_pipeline_creation` 진행 줄을 출력하도록 보강하고 GitLab API curl timeout을 추가. QA evidence On Hold 수치를 2026-05-13 감사 결과로 갱신. 검증: shell syntax, runner health check, pipeline wait smoke, `npm run qa:evidence:audit`, `git diff --check`. |
| ~~CI/QA operational triage cleanup~~ | — | **완료** — v8.11.141 배포 후 남은 문제를 런타임/CI/QA evidence로 분리 진단. GitLab tag pipeline `created` 정체 시 `gitlab:pipeline:head -- --wait`가 기존 pipeline을 `not_created`로 오판하지 않도록 timeout 보고를 수정했고, `QA-20260511-0479` historical no-durable-evidence 상태를 `artifactDebt`로 분리해 recent counted run artifact warning을 해소. 검증: `bash -n scripts/gitlab/check-head-pipeline.sh`, targeted GitLab pipeline wait smoke, `npm run qa:evidence:audit`. |
| ~~AI Engine line-guard regression cleanup~~ | — | **완료** — `orchestrator-execution.ts` streaming entrypoint를 `orchestrator-execution-stream.ts`로 분리하고, `supervisor-single-agent.ts` tool result summary helper를 `supervisor-tool-results.ts`로 분리해 line-guard fail 2건을 0건으로 복구. 검증: `npm run line-guard`, AI Engine type-check, targeted Vitest 3 files / 27 tests, AI Engine full test 117 files / 1162 tests, `git diff --check` 통과. |
| ~~AI Assistant response quality regression hardening~~ | — | **완료** — Production 직접 Cloud Run supervisor 회귀를 재현한 failing spec 커밋 `a6d76c6a9` 후 구현 커밋 `10ae60c7f`로 TOP-N direct single-agent deterministic synthesis, user-facing response sanitizer, `getServerMetricsAdvanced.answer` scaffold 제거, AI Engine off-domain guard, 짧은 정량 metric answer `TOO_SHORT` false positive 완화를 적용. 검증: targeted Vitest 4 files / 79 tests, AI Engine type-check, AI Engine full test 117 files / 1162 tests, `git diff --check`, `docs:budget`, `docs:ai-consistency` 통과. 상세 계획서 archive 이동: [archive/ai-assistant-response-quality-regression-plan.md](archive/ai-assistant-response-quality-regression-plan.md) |
| ~~AI Assistant routing decision trace hardening~~ | — | **완료** — QueryRoutingSignals/ RoutingDecisionTrace 공통 계약을 추가해 mode/tool/pre-filter/agent/context 판단 근거를 sanitized metadata로 추적 가능하게 정렬하고, Context Store structured findings 우선 저장 + legacy regex fallback reasonCode를 도입. Phase 1~3 AI Engine targeted/full tests, root follow-up clarification regression test, type/lint/quick gate 통과. `v8.11.139` tag pipeline `2519567410` success로 AI Engine 배포 완료 후 production conversational QA에서 follow-up filter clarification 회귀를 발견해 `e9fbece4d` 수정, `v8.11.140` tag pipeline `2519666338` success 및 `QA-20260513-0489` PASS/pending 0으로 closure. 상세 계획서 archive 이동: [archive/ai-assistant-routing-decision-trace-hardening-plan.md](archive/ai-assistant-routing-decision-trace-hardening-plan.md) |
| ~~AI Assistant weekly stabilization and QA hardening~~ | — | **완료** — `QA-20260512-0484`의 P1 3건을 분석해 composite peak+advice mutating command 경로를 deterministic read-only answer로 short-circuit하도록 수정. SDD failing test 커밋 `aa3c7950e`, 구현 커밋 `98b8e2e4d`, `main` pipeline `2519044003` success, release `v8.11.138` tag pipeline `2519054015` success. Production `QA-20260512-0488`에서 composite read-only guidance, whole-fleet load1 no empty-summary, action-needed no clarification을 모두 PASS로 기록했고 QA pending 0 확인. 상세 계획서 archive 이동: [archive/ai-assistant-weekly-stabilization-plan.md](archive/ai-assistant-weekly-stabilization-plan.md) |
| ~~AI Assistant Semantic Query Routing Phase 3~~ | — | **완료** — Root `SemanticIntentFrame`을 Cloud Run `DomainIntentFrame` metadata로 변환해 AI SDK transport, Vercel BFF, Cloud Run supervisor request metadata로 전달. AI Engine semantic metadata normalizer, resolver metadata 우선순위, evidence validation, semantic trace/reasonCodes, deterministic eval seed를 추가해 monitoring 외 domain pack으로 이식 가능한 query routing contract를 확정. 검증: root targeted Vitest 4 files / 73 tests, AI Engine targeted Vitest 2 files / 12 tests, root/AI Engine type-check, root lint, `git diff --check` 통과. 상세 계획서 archive 이동: [archive/ai-assistant-semantic-query-routing-plan.md](archive/ai-assistant-semantic-query-routing-plan.md) |
| ~~AI Assistant Domain Capability Resolver Phase 2~~ | — | **완료** — AI Engine 공통 런타임에 `DomainCapabilityManifest`/`DomainIntentFrame`/`DomainIntentParser` 계약을 추가하고, resolver가 metadata frame/domain parser/capability lookup을 provider request로 전달. monitoring `metric_peak` manifest/parser/provider 연결, sample renewal-risk frame portability로 monitoring 외 도메인 재사용성 검증. raw message fallback 유지. 검증: AI Engine targeted Vitest 3 files / 19 tests, AI Engine type-check 통과. 상세 계획서 archive 이동: [archive/ai-assistant-domain-capability-resolver-plan.md](archive/ai-assistant-domain-capability-resolver-plan.md) |
| ~~AI Assistant Semantic Intent Frame Phase 1~~ | — | **완료** — NLQ entity extraction에 optional `SemanticIntentFrame` 계약을 추가하고, clarification을 원문 텍스트가 아닌 frame 힌트 기준으로 보강. `scope=whole_fleet`이면 서버명이 없어도 서버 clarification으로 차단하지 않으며, provider 구현체 이름은 normalizer/API 응답에서 제거. AI Engine monitoring peak evidence provider는 `24h/load1/peak` 표현을 처리하도록 alias 보강. 검증: targeted root Vitest 3 files / 58 tests, AI Engine targeted Vitest 1 file / 3 tests, root type-check, `git diff --check` 통과. 상세 계획서 archive 이동: [archive/ai-assistant-semantic-intent-frame-plan.md](archive/ai-assistant-semantic-intent-frame-plan.md) |
| ~~API 라우트 테스트 커버리지~~ | — | **완료** — stale한 “15개 무테스트” 표현을 route handler 계약 gap 기준으로 재분류하고, `/api/metrics` `openmanager_server_status` status label 결함을 수정한 뒤 잔여 핵심 route 테스트를 보강. 추가: `/api/ai/supervisor` legacy POST 계약(401/429/400/job redirect/fallback/Cloud Run JSON), `/api/ai/status` summary/service/reset 계약, `/api/ai/wake-up` rate-limit/upstream/timeout 계약, `/api/csrf-token` cookie/rate-limit 계약, `/api/servers` legacy delegation 계약. 검증: targeted Vitest 5 files / 17 tests 통과. 상세: [archive/tech-debt-remediation-plan.md](archive/tech-debt-remediation-plan.md) Task 2 |
| ~~AI Assistant domain evidence + stream recovery refactor~~ | — | **완료** — portable `DomainEvidenceProvider` 계약을 추가해 공통 런타임은 도메인 intent/data를 모르게 유지하고, monitoring peak evidence provider와 non-monitoring sample renewal-risk provider로 재사용성을 검증. `supervisor-single-agent-stream.ts`의 빈 응답 복구 체인을 `supervisor-stream-recovery.ts`로 분리해 800줄 fail-threshold 여유를 확보했으며, generic empty fallback이 provider retry보다 먼저 실행되는 회귀를 테스트로 고정. Root jobs API에는 title-only/placeholder/too-short result 품질 게이트를 추가. 검증: AI Engine targeted Vitest 8 files / 34 tests, provider retry regression 2 files / 20 tests, AI Engine/root type-check, root lint, line-guard, `git diff --check` 통과. |
| ~~React 19.2.4 → 19.2.6 패치~~ | — | **완료** — 루트 `react`/`react-dom`을 `19.2.4` → `19.2.6`으로 정렬. `npm view` 기준 최신 stable 확인 후 `npm install react@^19.2.6 react-dom@^19.2.6` 적용. 검증은 비용 큰 live/broad QA 없이 dependency import smoke, `npm run type-check`, `git diff --check` 중심으로 수행. Root `npm audit --omit=dev`의 `next@16.1.6` high 1건은 React와 무관하며, 잔여 작업이 아니라 [archive/tech-debt-remediation-plan.md](archive/tech-debt-remediation-plan.md) 마지막 upstream wait memo로만 보존. |
| ~~AI Engine pino v10 alignment~~ | — | **완료** — AI Engine `pino@9.14.0` → `pino@10.3.1` 정렬. Node runtime은 repo/AI Engine 모두 `>=24 <25`이고 Cloud Run Dockerfile도 Node 24라 pino v10의 `thread-stream@4` Node `>=20` 요구사항 충족. 비용 큰 live QA 없이 targeted logger test, AI Engine type-check, production audit로 검증. Local deterministic QA `QA-20260511-0473` 기록. |
| ~~API metrics route status label contract~~ | — | **완료** — `/api/metrics`가 `openmanager_server_status` metric을 지원하지만 PromQL 결과의 `status` label 조건이 `server_status`로 되어 누락되던 실제 결함을 확인. `src/app/api/metrics/route.test.ts` failing test 선행 커밋 `5e143ab2e` 후 `openmanager_server_status` 조건으로 수정. Local deterministic QA `QA-20260511-0472` 기록. |
| ~~Zod v4 AI Engine 마이그레이션~~ | — | **완료** — AI Engine `zod@3.25.76` → `zod@4.4.3` 정렬. v4 top-level format helper 회귀 테스트 추가, `vision-url-tool.ts`를 `z.url()`로 이전, Zod v4 `z.record(key, value)` 시그니처와 structured routing parse 타입 보정 완료. SDD failing test 선행 커밋 `6293ea221`. AI Engine `type-check`, targeted Vitest 4 files / 42 tests, full test 110 files / 1091 tests, root `test:contract` 24 tests, production/full `npm audit` 0 vulnerabilities, Local deterministic QA `QA-20260511-0471` 기록. 상세: [archive/tech-debt-remediation-plan.md](archive/tech-debt-remediation-plan.md) Task 1 |
| ~~Line guard current hotspots refactor~~ | — | **완료** — 800줄 이상 fail-threshold hotspot 5건을 모두 800줄 미만으로 분리. `useAIChatCore.ts` 1,287줄 → 720줄, `supervisor-stream.ts` 1,494줄 → 260줄, `orchestrator-agent-stream.ts` 1,202줄 → 786줄, `orchestrator-routing.ts` 1,182줄 → 691줄, `routes/jobs.ts` 978줄 → 738줄. 후속 buffer polish로 `supervisor-single-agent-stream.ts` 798줄 → 791줄. `npm run line-guard` fail 5건 → 0건. Local deterministic QA `QA-20260511-0469`, buffer polish QA `QA-20260511-0470` 기록. 상세 계획서 archive 이동: [archive/line-guard-current-hotspots-refactor-plan.md](archive/line-guard-current-hotspots-refactor-plan.md) |
| ~~AI Assistant operational artifact hardening~~ | — | **완료** — 운영 스크립트, Slack 알림 규칙, 로그 기반 대응 절차를 `ops-procedure` typed artifact로 생성·보존·수정하도록 구현. script/Alertmanager/runbook intent, follow-up threshold edit, artifact workspace/renderer, secret/fake function validator, Cloud Run routing alignment 반영. Local deterministic QA `QA-20260511-0468` 기록, 배포 후 production script/log/runbook conversational QA는 해당 QA의 skipped surface / expert nextAction 후속으로 남김. 상세 계획서 archive 이동: [archive/ai-assistant-ops-artifact-plan.md](archive/ai-assistant-ops-artifact-plan.md) |
| ~~AI Assistant general coding boundary hardening~~ | — | **완료** — 일반 코딩/알고리즘/학습용 코드 요청을 `general_coding` deterministic guard로 short-circuit하고, 운영 문맥 코드 요청은 허용 예외로 유지. Cloud Run monitoring supervisor prompt도 frontend guard 정책과 정렬. Local targeted QA `QA-20260511-0467` 기록, 배포 후 production 재검증은 해당 QA의 skipped surface / expert nextAction 후속으로 남김. 상세 계획서 archive 이동: [archive/ai-assistant-general-coding-boundary-plan.md](archive/ai-assistant-general-coding-boundary-plan.md) |
| ~~AI Chat UI/UX 개선 (B1·I1~I4·M1~M7)~~ | — | **완료** — AI Chat 코드블록/복사 접근성/빈 상태 prompt/대화 한도/Reporter CTA/Analyst 자동 분석/상세 분석 copy/sidebar fullscreen handoff 개선 완료. GitLab branch validate `2513712243` success, `v8.11.124` tag pipeline `2513741959` success, release-facing Vercel targeted QA `QA-20260510-0466` 기록. 상세 계획서 archive 이동: [archive/ai-chat-ux-improvement-plan.md](archive/ai-chat-ux-improvement-plan.md) |
| ~~AI SDK v6 structured output migration~~ | — | **완료** — Root App NLQ entity extraction/artifact intent 라우트와 Cloud Run orchestrator structured-output helper를 deprecated `generateObject` 직접 호출에서 `generateText + Output.object`로 이전. `generateStructuredOutputWithFallback` 명명으로 helper 의미를 정렬하고 provider fallback/text JSON fallback/retry budget 동작은 유지. Local targeted QA `QA-20260510-0462` 기록. |
| ~~AI NLQ entity extraction hardening~~ | — | **완료** — `/api/ai/nlq/extract-entities`에 `withAuth` + `withRateLimit` 적용, server registry 기반 enum + client response normalizer + confidence threshold로 LLM 추출값 신뢰 경계 보강, `sendQuery`에서 off-domain guard를 entity extraction보다 먼저 실행하도록 순서 조정. Local targeted QA `QA-20260510-0461` 기록. |
| ~~AI Assistant off-domain guardrail 개선~~ | — | **완료** — 비 IT 실시간/외부작업 질문을 `useQueryExecution` 입력 경계에서 deterministic guard로 short-circuit해 `sendMessage`/job 호출을 차단. `off-domain-guard` utility와 classifier 패턴을 정렬하고 회귀 테스트 추가. Local targeted QA `QA-20260510-0459` 기록. 계획서 archive 이동: [archive/ai-assistant-off-domain-guard-plan.md](archive/ai-assistant-off-domain-guard-plan.md) |
| ~~Supabase low-value unused index cleanup~~ | — | **완료** — Supabase performance advisor unused index 10건 중 FK/RLS 보조 인덱스는 보존하고, 코드 경로/복합 인덱스로 대체 가능한 단일 컬럼 인덱스 6건만 `20260510034213_drop_low_value_unused_operational_indexes.sql`로 제거. 운영 적용 후 advisor unused index INFO는 10건 → 4건으로 감소. 남은 4건(`security_audit_logs.user_id`, `incident_reports` FK 3개)은 의도적 보존. |
| ~~RAG command vector backfill 및 legacy seed cleanup~~ | — | **완료** — 운영 DB 실측 결과 `command_vectors` 26행 중 7행이 `knowledge_base`에 없었고, `knowledge_base.embedding` 52건/`command_vectors.embedding` 26건이 실제 존재해 컬럼 DROP은 보류. `20260510032441_backfill_remaining_command_vectors_to_knowledge_base.sql`로 누락 7행을 KRL corpus에 비파괴 backfill해 `knowledge_base=60`, command row 표현률 `26/26` 달성. 루트 `src/scripts/*`의 Mistral embedding 기반 legacy seed script 제거, drift guard와 live smoke에 command backfill 질의 추가. full command inventory 기준으로 `rag-doc-policy` threshold를 재조정해 `npm run rag:analyze` governance 12/12 PASS. |
| ~~Remaining legacy vector/graph helper cleanup~~ | — | **완료** — active code 검색과 운영 DB inventory 기준 request path에서 미사용인 helper RPC(`get_knowledge_neighbors`, `traverse_knowledge_graph`, `get_vector_stats`, `search_all_commands*`, `search_similar_*`, `search_vectors_*`) 제거 migration 추가 및 운영 Supabase 적용 완료. `search_knowledge_text`, `generate_knowledge_search_vector`, `update_knowledge_search_vector`, `knowledge_base`, `command_vectors`, `knowledge_relationships`는 보존. Supabase advisor unused index 대상 `idx_kr_weight` 제거. |
| ~~AI retrieval KRL ranking precision tuning~~ | — | **완료** — relaxed OR fallback 이후 단일 토큰 매치가 과상위로 올라오던 문제를 `search_knowledge_text` token-overlap ranking으로 보정. 운영 DB에 `20260510025317 tune_search_knowledge_text_precision` 적용 완료. `nginx 5xx gateway timeout` live smoke top 결과가 `Storage 서버...`에서 `웹 서버 502 에러 해결`로 개선됨. |
| ~~AI retrieval KRL multi-token recall improvement~~ | — | **완료** — Supabase `search_knowledge_text`에 exact/full query 우선 + token-prefix OR relaxed recall fallback을 추가하고 운영 DB에 `20260510024218 improve_search_knowledge_text_recall` 적용 완료. KRL deterministic fallback 후보를 CPU/MEM/DISK/DB/Nginx/Topology/Security로 확장. `npm run supabase:rag:smoke`가 `cpu`, `cpu high load`, `disk space cleanup`, `redis memory`, `server topology dependency` rows `3/3` 통과. Local/live targeted QA `QA-20260510-0449` 기록. |
| ~~운영 Supabase legacy RAG RPC cleanup 적용~~ | — | **완료** — Supabase MCP `apply_migration`으로 `20260510022419 drop_legacy_vector_graph_rag_rpcs` 운영 DB 적용 완료. post-check에서 legacy vector/graph RPC 6개는 `to_regprocedure=false`, current KRL `search_knowledge_text=true`. `npm run supabase:rag:smoke` rows `3/3` 통과. Security advisor 신규 블로커 없음, performance advisor는 기존 unused index INFO만 보고. |
| ~~Legacy RAG RPC cleanup 문서/테스트 안전성 보강~~ | — | **완료** — `20260510022419_drop_legacy_vector_graph_rag_rpcs.sql`을 `DROP FUNCTION ... RESTRICT`로 강화해 unexpected dependency가 있으면 실패하도록 수정. 계약 테스트에 idempotent null skip, `CASCADE` 금지, table/column 보존 검증 추가. 운영 Supabase `pg_depend` read-only 조회로 제거 대상 legacy RPC dependent object 0건 확인. DB 문서에 적용 전/후 SQL 체크와 `supabase:rag:smoke` 후속 확인 절차 반영. Local targeted QA `QA-20260510-0447` 기록. |
| ~~Legacy vector/graph RAG RPC cleanup migration 준비~~ | — | **완료** — 운영 Supabase DB read-only inventory로 legacy vector/graph RPC 6개(`search_knowledge_base`, `match_documents`, `match_knowledge_base`, `hybrid_search_with_text`, `hybrid_graph_vector_search`, `hybrid_search_vectors`) 존재 확인. 현재 런타임은 `search_knowledge_text`만 사용하므로 `20260510022419_drop_legacy_vector_graph_rag_rpcs.sql` migration 추가. `knowledge_base=53`, `command_vectors=26`, `knowledge_relationships=170` 행이 있어 테이블 삭제는 별도 데이터 migration으로 보류. Local targeted QA `QA-20260510-0446` 기록. |
| ~~AI retrieval actual-use smoke + dependency cleanup~~ | — | **완료** — `npm run supabase:rag:smoke`로 live Supabase `search_knowledge_text` RPC 2건(`cpu`, `redis memory`)이 각각 3행 반환 확인. AI Engine direct dependency 중 active import가 없는 `@upstash/redis`, `js-tiktoken`, `pg`, `@types/pg` 제거. `langfuse`는 `import('langfuse' as string)` dynamic runtime import로 실제 사용 중이라 유지. Local targeted QA `QA-20260510-0445` 기록. |
| ~~AI retrieval LLM rerank/HyDE dead runtime 제거~~ | — | **완료** — active runtime 미사용 `query-expansion.ts`, `reranker.ts` 삭제. `searchKnowledgeBase` 테스트의 stale mock 제거, `supabase:rag:smoke`를 vector/graph RPC가 아닌 `search_knowledge_text` KRL smoke로 교체, drift guard에 재도입 방지 규칙 추가. Local targeted QA `QA-20260510-0444` 기록. |
| ~~GraphRAG 410 tombstone route 제거~~ | — | **완료** — Cloud Run 로그 확인 결과 최근 7일 `/api/ai/graphrag/*` 요청 0건, 30일 내 최신 요청은 2026-04-13 과거 수동 확인성 호출. `routes/graphrag.ts`와 route test 삭제, `server.ts` 동적 import/route 등록 제거, `legacy-contracts`를 `useGraphRAG` compat-only 입력 경계로 축소. Local targeted QA `QA-20260510-0443` 기록. |
| ~~AI retrieval legacy graph/vector weight cleanup~~ | — | **완료** — active runtime에서 미사용 `getDynamicSearchWeights`, `AI_RAG_WEIGHT_*`, vector/graph 가중치 설정 제거. Knowledge Retrieval Lite는 BM25 `search_knowledge_text` + metadata boost 기준 유지. Local targeted QA `QA-20260510-0442` 기록. |
| ~~AI 명령어 추천 resource intent 우선순위 개선~~ | — | **완료** — `QA-20260510-0441` local deterministic QA로 P3 closure 기록. service keyword보다 disk/capacity resource intent를 우선하고, generic keyword 오매칭을 줄였으며, 관련 계획서 archive 이동: [archive/ai-assistant-command-guidance-resource-intent-plan.md](archive/ai-assistant-command-guidance-resource-intent-plan.md) |
| ~~AI 메모리 TOP-N 광범위 랭킹 응답 개선~~ | — | **완료** — `QA-20260510-0440` local deterministic QA로 P2 closure 기록. `조치 방법` 문구가 있어도 메트릭 TOP-N 질의는 `data-ranking` fast-path를 우선 적용해 `getServerMetricsAdvanced`를 강제하고, 한국어 deterministic TOP-N + 서버별 확인 항목을 반환하도록 회귀 테스트 추가. |
| ~~AI 어시스턴트 운영 대응 QA 확장~~ | — | **완료** — QA-20260509-0432(v8.11.118) B4/B5 closure PASS, QA-20260509-0435(v8.11.118) A1/A5/C2 production targeted retest PASS. QA pending 0, 계획서 archive 이동: [archive/ai-assistant-ops-qa-expansion-plan.md](archive/ai-assistant-ops-qa-expansion-plan.md) |
| ~~Dashboard AI surface boundary 정렬~~ | — | **완료** — 서버 카드/상세/알림/overview의 per-entity AI CTA 제거, 전역 AI Assistant와 `/dashboard/ai-assistant` 유지, local targeted QA `QA-20260509-0433` 기록. 계획서 archive 이동: [archive/dashboard-ai-surface-boundary-plan.md](archive/dashboard-ai-surface-boundary-plan.md) |
| ~~UI/UX 개선 (포스트 리팩토링 감사)~~ | — | **완료** — P1×3, P2×5, P3×4 전체 구현. Local targeted closure QA `QA-20260509-0436` 기록(7/7 PASS, pending 0, screenshot evidence 4개). 계획서 archive 이동: [archive/ui-ux-improvement-plan.md](archive/ui-ux-improvement-plan.md) |
| ~~Dashboard 알림 UX 개선 (A1~A7)~~ | — | **완료** — 한국어 통일, border-left, StatCell 클릭 필터, 스크롤 자동 로드, 로그 크로스링크 전부 적용. [archive/dashboard-alert-ux-plan.md](archive/dashboard-alert-ux-plan.md) |
| ~~IntersectionObserver 전환 (B1~B6)~~ | — | **완료** — scroll event 제거, sentinel 패턴, 로그+알림 더보기 버튼 fallback 적용. [dashboard-scroll-observer-plan.md](archive/dashboard-scroll-observer-plan.md) |
| ~~AI Assistant Surface Parity Refactor~~ | — | **완료** — archive 이동. |
| ~~AI assistant retrieval and multi-agent runtime refactor~~ | — | **완료** — archive 이동. Task 0~8 전체 완료. Knowledge Retrieval Lite 도입, GraphRAG 제거, provider model policy SSOT, 18대 서버 topology contract, frontend retrieval status contract 모두 반영. 상세: [archive/ai-assistant-retrieval-multi-agent-refactor-plan.md](archive/ai-assistant-retrieval-multi-agent-refactor-plan.md) |
| ~~AI Response Visibility & Rate Limit (Phase 1~5)~~ | — | **완료** — archive 이동. write bucket 재평가 결과 `supervisor 10/min`, `jobs/process 5/min`, `daily 100` 유지 결정 로그는 archived plan에 유지. |
| ~~AI Stream Route Contract - residual cleanup~~ | — | **완료** — archive 이동. |
| ~~OTel 토폴로지 개선~~ | — | **완료** — archive 이동: [archive/otel-topology-improvement-plan.md](archive/otel-topology-improvement-plan.md). |

---

## Recent Completed

### Completed (2026-05-17) — Codex (Release Component Version Contract)
- [x] 릴리스 구성요소 버전 계약 T6 완료
  - `RELEASE_BUMP_AI_ENGINE_VERSION=1 npm run release:publish:patch`로 `v8.11.166` 릴리스를 생성하고 GitLab에 push했다.
  - 태그 파이프라인 `2531547712` success: `deploy`, `deploy_ai_engine`, `post_deploy_ai_engine_smoke`, `post_deploy_smoke` 모두 성공.
  - `deploy_ai_engine`에서 `decision=deploy reason=ai_engine_version_metadata_release_tag` 확인, Cloud Run `/health.version=8.11.166` 확인.
  - Vercel `/api/version`은 `overall/frontend=8.11.166`과 `pipelineUrl=https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2531547712`를 반환.
  - 참고: branch validate pipeline `2531547704`는 전체 `success`이나, warn-first `validate_bundle_budget` job은 `BUNDLEMON_PROJECT_ID` 누락으로 allow-failure 실패했다. 상세: [ai-engine-release-version-sync-plan.md](ai-engine-release-version-sync-plan.md)

### Completed (2026-05-17) — Codex (Frontend UI)
- [x] Frontend UI 개선 T1/T2 완료
  - 모바일 시스템 리소스 CPU 게이지가 375px에서 좌측 edge에 붙지 않도록 `justify-evenly px-2 sm:px-0`로 보정.
  - `ServerDashboard` 서버 validation을 `servers` 변경 기준 `useMemo`로 분리하고, 개발 성능 경고 임계값을 100ms로 정렬.
  - 검증: dashboard targeted tests 2 files / 14 tests PASS, `type-check`/`lint`/`test:quick`/docs checks PASS. 상세: [archive/frontend-inspection-improvement-plan.md](archive/frontend-inspection-improvement-plan.md)

### Completed (2026-05-17) — Codex (AI Assistant UX)
- [x] AI 어시스턴트 UX 개선 T1~T7 완료
  - Phase1: 사이드바 미니뷰 줄바꿈 방어, 전체 페이지 헤더 단순화, 분석 근거 기본 접힘 상태 확인.
  - Phase2: AI 메시지 연한 버블, 최신 메시지 복귀 버튼, handoff 기반 agent badge.
  - Phase3: 웰컴 화면을 현재 서버 상태 요약 배너와 상태 기반 동적 제안 카드로 전환.
  - 검증: targeted DOM tests 3 files / 8 tests PASS, `type-check`/`lint`/`test:quick`/docs checks PASS. 상세: [archive/ai-assistant-ux-improvement-plan.md](archive/ai-assistant-ux-improvement-plan.md)

### Completed (2026-05-16) — Claude (Routing & UX 개선)
- [x] 오프도메인 전 카테고리(날씨·주식·운세·맛집·캘린더·코딩 등) 차단 제거 → `⚠️` 경고 1줄 prepend 후 LLM 위임 (`off-domain-guard.ts`, `supervisor-stream.ts`, `supervisor-single-agent.ts`)
- [x] 보안 riskLevel 분화: `high` → HTTP 400 유지, `medium`/`low` → 경고 prepend + sanitize 쿼리로 LLM 계속 진행 (`prompt-guard.ts`, `supervisor.ts`)
- [x] AI SDK conformance O1~O3 backlog에서 제거 (구조적 차단 — 단일 런타임 전제 충돌, 재착수 불필요)
- 검증: AI Engine `type-check` PASS, off-domain-guard.test.ts 20개 PASS, prompt-guard.test.ts 31개 PASS, 전체 1327 tests PASS. 커밋: `767acd026`.

### Completed (2026-05-16) — Codex (AI SDK conformance optional O4)
- [x] Mock provider 기반 path parity benchmark 보강
  - `ai/test`의 `MockLanguageModelV3`를 사용해 `generateText`/`streamText` 경로가 실제 provider 호출 없이 같은 loop ceiling을 쓰는지 고정했다.
  - single metric lookup과 incident report escalation의 route/plan snapshot을 함께 고정해 route selection 회귀를 비용 0원 benchmark로 확인한다.
  - SDK 내부 retry amplification이 없도록 mock provider `doGenerate`/`doStream` 호출 횟수 1회를 assertion으로 고정했다.
  - 검증: AI Engine targeted benchmark 3 files / 5 tests PASS, targeted conformance regression 4 files / 55 tests PASS, AI Engine `type-check` PASS.

### Completed (2026-05-16) — Codex (AI Engine enrichment follow-up)
- [x] `enrichResponseWithToolResults` multi-path 적용
  - single-agent non-stream에만 있던 tool result 기반 후처리 보강을 Direct Router forced-routing multi-agent non-stream 경로에도 적용했다.
  - multi-agent streaming은 추가 LLM 호출 없이 `done` 전 보강 `text_delta`를 내보내고, 저장 컨텍스트/quality metadata가 보강 후 본문 기준이 되도록 정렬했다.
  - 회귀 테스트로 non-stream/stream 양쪽에서 metric evidence와 server reference 보강, quality flag 재평가, 추가 LLM 호출 없음 조건을 고정했다.
  - 검증: AI Engine targeted tests 3 files / 42 tests PASS.

### Completed (2026-05-16) — Codex (frontend backlog follow-up)
- [x] 메인 페이지 컴포넌트 분석 및 소규모 UX 정리
  - `src/app/main/components/`의 `GuestRestrictionModal`, `SystemStartSection`, `DashboardSection`, `LoginPrompt`, `MainPageErrorBoundary`를 검토했다.
  - 장식용 포인터/중복 클릭 안내와 버튼 이모지 라벨을 제거하고, 아이콘 `aria-hidden` 및 불필요 props 정리를 반영했다.
  - `DashboardSection`/`GuestRestrictionModal` DOM 회귀 테스트를 추가하고 DOM test manifest에 등록했다.
  - 검증: targeted DOM tests 3 files / 5 tests PASS, `type-check`/`lint`/`test:quick`/docs checks PASS.
- [x] 차트 컴포넌트 분석 및 responsive tick 보정
  - `NivoTimeSeriesChart`의 Nivo layer 구성, memo dependency, dashboard 호출부를 검토했다.
  - 긴 시계열에서 `timeRange`/compact 기준으로 x축 tick 수를 제한하고, 유효 숫자 포인트가 없는 입력은 빈 상태로 처리하도록 보강했다.
  - 회귀 테스트를 추가해 24h tick sampling, compact tick limit, invalid numeric input empty state를 고정했다.
  - 검증: `NivoTimeSeriesChart.test.tsx` 1 file / 11 tests PASS.
- [x] shared 컴포넌트 분석 및 접근성/표현 정리
  - `VibeCiCdSection`의 작업 규모별 흐름 표시를 이모지 문자열 배열에서 label+lucide icon 데이터 모델로 바꿔 의미/표현을 분리했다.
  - `UnifiedProfileHeader`의 장식 아이콘 `aria-hidden`, 인증 확인 중 메뉴 토글 차단, 비인증 로그인 클릭 경로를 정리했다.
  - 사용자 노출 confirm/alert 문구에서 장식 문자를 제거하고 관련 DOM 회귀 테스트를 보강했다.
  - 검증: shared targeted DOM tests 2 files / 9 tests PASS, `type-check`/`lint`/`test:quick` PASS.
- [x] Zustand AI sidebar store 분석 및 persist 정규화
  - `useAISidebarStore`의 selector 사용처와 `pendingEntryState`/`pendingPrefillMessage` surface handoff 경로를 검토했다.
  - persisted `sidebarWidth`를 440~960px 범위로 정규화하고, store와 `AISidebarV4`가 같은 width 상수를 공유하도록 정리했다.
  - localStorage에는 최근 20개 메시지만 저장되도록 helper/test를 명시하고, rehydrate 시 잘못된 tab/mode/session/message snapshot을 방어적으로 정규화한다.
  - 검증: store/sidebar targeted tests 3 files / 47 tests PASS, `type-check`/`lint`/`test:quick` PASS.
- [x] AI 훅 레이어 분석 및 async job path 정리
  - `useHybridAIQuery`/`useAsyncAIQuery`의 streaming ↔ job-queue 분기, SSE cleanup, error/result settlement 경로를 검토했다.
  - `useAsyncAIQuery`의 job request body 조립을 `buildAsyncQueryJobRequestBody`로 분리해 source toggles, semantic intent, log extract metadata 계약을 테스트로 고정했다.
  - `sendQuery`와 `retryJob`의 중복 completion handler를 공통화하고, `retryJob` POST에도 `AbortController.signal`을 전달해 cancel/unmount cleanup 경계를 맞췄다.
  - 검증: async/hybrid targeted tests 3 files / 40 tests PASS, `type-check`/`lint`/`test:quick` PASS.
- [x] App Router error boundary Tailwind 전환
  - `app/error.tsx`의 inline style 객체를 Tailwind class 기반 root error UI로 전환하고, reset 버튼에 lucide icon을 추가했다.
  - 동일 inline style 패턴이 남아 있던 `auth/error.tsx`도 함께 전환해 root/login/auth error boundary 스타일을 정렬했다.
  - root/auth error boundary 테스트에 inline style 재도입 방지와 복구 액션 회귀를 추가했다.
  - 검증: targeted error tests 3 files / 7 tests PASS, `type-check`/`lint`/`test:quick` PASS.

### Completed (2026-05-16) — Codex (dashboard improvement)
- [x] Dashboard 핵심 컴포넌트 개선 7건 완료
  - `withCurrentMetricPoint`를 `dashboard-metric-points.ts`로 공통화하고 카드/상세/모달 metrics helper 중복을 제거했다.
  - 서버 상세의 `ProcessesTab`을 별도 `프로세스` 탭으로 분리해 탭 레이블과 콘텐츠를 맞췄다.
  - `ServerDashboard`의 항상 true인 `activeTab` state, `ImprovedServerCard` 외부 double memo, `DashboardHeader` deprecated `addListener` fallback을 제거했다.
  - dashboard status token TODO 주석과 service status emoji `aria-hidden` 처리를 반영했다.
  - 검증: dashboard targeted tests 6 files / 83 tests PASS, `type-check`/`lint` PASS.
  - 상세: [archive/dashboard-improvement-plan.md](archive/dashboard-improvement-plan.md)

### Completed (2026-05-16) — Codex (login page improvement)
- [x] 로그인 페이지 개선 8건 완료
  - 게스트 PIN 실패 에러가 메인 카드와 모달에 동시에 표시되는 문제를 막고, 모달 닫힘 시 에러를 clear하도록 정리했다.
  - OAuth 로딩 중에는 실제 취소가 불가능한 취소 버튼을 숨기고, guest/email 로딩에서만 취소 버튼을 표시한다.
  - `LoadingType`을 `login.constants.ts`로 통합하고, `LoginButtons`가 버튼 스타일 상수를 자체 소유하도록 props를 줄였다.
  - Email Magic Link 성공 시 내부 이메일 입력을 초기화하도록 `onEmail` 계약을 `Promise<boolean>`으로 바꿨다.
  - 미사용 상수, 완료된 migration 주석, `login/error.tsx` inline style을 정리했다.
  - 검증: `type-check`/`lint`/`test:quick` PASS.
  - 상세: [archive/login-page-improvement-plan.md](archive/login-page-improvement-plan.md)

### Completed (2026-05-16) — Codex (frontend UI improvement)
- [x] Frontend UI 개선 6건 완료
  - `BootProgressBar` 100% 포인터 overflow를 보정하고, `AILoginRequiredModal` CTA 아이콘을 provider-neutral `LogIn`으로 교체했다.
  - `FeatureCardModal`의 비기능 try/catch wrapper를 제거하고 `DiagramErrorBoundary`를 다이어그램 렌더 경계에 직접 적용했다.
  - `SystemBootClient` 인라인 wave CSS를 `global-effects.css`로 이동했다.
  - `TopologyModal` 닫기 버튼을 `TopologyView` 헤더 라인으로 옮기고, landing footer provider copy를 `Provider Mesh AI` 상수로 정렬했다.
  - 검증: targeted DOM tests 2 files / 5 tests PASS, `type-check`/`lint` PASS.
  - 상세: [archive/frontend-ui-improvement-plan.md](archive/frontend-ui-improvement-plan.md)

### Completed (2026-05-16) — Codex (dead code cleanup)
- [x] 데드 코드 & 레거시 export 정리
  - 미사용 utility 파일 4개와 대응 테스트를 제거했다: `env-validation`, `development-only`, `csp-utils`, `useTypewriter`.
  - `env-validation`의 production startup `TEST_API_KEY` 최소 길이 검증은 `instrumentation.ts`에 inline으로 보존했다.
  - deprecated `createNlqAgent()` alias와 `ExecutableSurfaceArtifact` 타입 export를 제거하고, V2 supervisor stream schema alias는 canonical `requestSchema`로 정렬했다.
  - 검증: Root `type-check`/`test:quick` PASS, AI Engine `type-check`/full test PASS, `knip:ci` PASS.
  - 상세: [archive/dead-code-cleanup-plan.md](archive/dead-code-cleanup-plan.md)

### Completed (2026-05-16) — Codex (semantic intent direct routing)
- [x] Vercel AI SDK native handoff 전환 검토 및 Direct Router 강화
  - 공식 문서 비교 결과, SDK native supervisor/handoff는 Free Tier 기준 Groq RPD를 다시 소모하므로 production 기본 전환을 보류했다.
  - Groq NLQ `intentFrame`의 `intent/capabilityId/inputType`을 specialist agent target hint로 재사용하도록 Cloud Run Direct Router를 확장했다.
  - `incident_report` → Reporter, `ops_advice` → Advisor, `root_cause`/`log_analysis`/`metric_trend` → Analyst, `metric_current`/`metric_peak`/`server_health` → Metrics Query 경로를 high-confidence frame에서 우선한다.
  - 검증: Root targeted 3 files / 36 tests PASS, AI Engine targeted 4 files / 32 tests PASS, Root `type-check`/`lint`/`test:quick` PASS, AI Engine `type-check`/full test 129 files / 1267 tests PASS, docs checks/git diff check PASS.
  - 상세: [archive/vercel-ai-sdk-agent-native-review-plan.md](archive/vercel-ai-sdk-agent-native-review-plan.md)

### Completed (2026-05-16) — Codex (supervisor schema cleanup)
- [x] `requestSchema` / `requestSchemaLoose` 중복 제거
  - `src/app/api/ai/supervisor/schemas.ts`에서 V2 proxy schema를 `requestSchema` alias로 정리했다.
  - N1/N3 이후 두 스키마의 계약이 동일하므로 별도 중복 정의를 유지할 이유가 없어졌다.
  - 검증: `src/app/api/ai/supervisor/schemas.test.ts` targeted 재실행.

### Completed (2026-05-16) — Codex (NLQ preprocessing redesign)
- [x] NLQ Pre-processing Redesign N0~N4 완료
  - N3 잔여였던 `inputType`/`logExtract` 계약을 Root BFF → transport/job metadata → Cloud Run normalize/mode selection/system context까지 연결했다.
  - `log_paste`는 Cloud Run에서 multi로 강제하고, 로그 발췌는 untrusted evidence로만 주입한다.
  - Groq baseline은 유지하고, provider live 비교는 외부 LLM 호출이므로 QA backlog로 분리했다.
  - 검증: Root targeted 4 files / 73 tests PASS, AI Engine targeted 3 files / 79 tests PASS, Root/AI Engine type-check PASS.
  - 상세: [archive/nlq-preprocessing-redesign-plan.md](archive/nlq-preprocessing-redesign-plan.md)

### Completed (2026-05-16) — Codex (AI assistant structure completed)
- [x] AI 어시스턴트 구조 개선 T1/T3 완료
  - T1: Circuit Breaker 요청 경로의 Redis 자동 초기화 오해를 제거하고 현재 in-memory 동작을 테스트로 고정했다.
  - T3: `useArtifactManager`를 추가해 artifact loading/ref/reset/abort 상태를 `useAIChatCore`에서 분리했다.
  - 검증: `npx vitest run --config config/testing/vitest.config.dom.ts src/hooks/ai/core/useArtifactManager.test.ts src/hooks/ai/useAIChatCore.test.ts` — 2 files / 17 tests PASS.
  - 상세: [archive/ai-assistant-structure-improvement-plan.md](archive/ai-assistant-structure-improvement-plan.md)

### Completed (2026-05-16) — Codex (AI sidebar workspace improvement)
- [x] AI 사이드바 & 워크스페이스 개선 S1~S5 전체 완료
  - S5 잔여였던 `ChatInputArea.tsx` `fileErrors` index key를 `idx + err.message` 복합 키로 교체했다.
  - 계획서 Status를 Completed로 전환하고 archive 이동 대상으로 정리했다.
  - 검증: `npx vitest run --config config/testing/vitest.config.dom.ts src/components/ai-sidebar/ChatInputArea.test.tsx` — 1 file / 15 tests PASS.
  - 상세: [archive/ai-sidebar-workspace-improvement-plan.md](archive/ai-sidebar-workspace-improvement-plan.md)

### Completed (2026-05-16) — Claude (계획서 정리)
- [x] Vercel AI SDK Multi-Agent Conformance 계획서 archive 이동
  - T0~T4 전부 완료(부합도 8.6/10) 확인. Status: Approved → Completed로 갱신 후 `archive/` 이동.
  - Optional O1~O4는 Backlog에 유지. Backlog 링크 경로 갱신.
  - 상세: [archive/vercel-ai-sdk-multi-agent-conformance-plan.md](archive/vercel-ai-sdk-multi-agent-conformance-plan.md)
- [x] Provider Quota 재배치 (Q0~Q2) 완료 처리
  - Q0: Cerebras gpt-oss-120b 정책 보정, Q1: Orchestrator Groq-last + decomposition budget, Q2: Orchestrator LLM routing/decomposeTask() 제거 완료.
  - 기본 경로는 deterministic direct specialist routing으로 전환. Q3/NLQ N1 intentFrame trust도 완료되어 계획서는 archive로 이동했다.
  - **tracking 항목**: 2026-05-26 `DEFAULT_CEREBRAS_MODEL`→`CEREBRAS_GPT_OSS_MODEL_ID` 전환 여부 재확인은 On Hold tracking으로 분리했다.
  - 상세: [archive/provider-quota-rebalance-plan.md](archive/provider-quota-rebalance-plan.md)

### Completed (2026-05-16) — Claude (커밋 분석 및 계획서 업데이트)
- [x] 오늘 커밋 10개 전수 분석 및 계획서 업데이트
  - **잘 된 부분**: TypeScript 타입 체크 PASS, AI Engine 127 files / 1243 tests PASS, root 15 files / 209 tests PASS. `supervisor-response-enrichment.ts` enrichment 로직이 `supervisor-single-agent.ts`와 잘 연결됨. `download-utils.ts` 추출로 5중 복제 해소. provider mesh rebalance(Cerebras→fallback, mistral→groq→zai 순서)가 정책 문서와 일치.
  - **이슈 3건 발견 및 Backlog 추가**: (1) Cerebras 만료 D-11 — `provider-model-policy.ts` `blockAfterDeprecation: true` 기준으로 2026-05-27 이후 자동 차단 예정이나 TODO에 누락. 사용자 액션 필요 항목으로 Backlog 추가. (2) `enrichResponseWithToolResults` single-agent path만 연결 — multi-agent/stream path에 미적용, Backlog 추가. (3) `ChatInputArea.tsx:192` `key={idx}` 패턴 S5 미완성 확인 — 위치와 패턴 명시해 Notes 갱신.
  - **상태 업데이트**: Vercel AI SDK Conformance T0~T4 + 3차 검토 완료로 `Completed` 처리. optional O1~O4 Backlog 이관.

### Completed (2026-05-16) — Codex
- [x] Orchestrator LLM 제거 / Direct specialist routing
  - Cloud Run multi-agent request path에서 Orchestrator LLM routing 호출과 `decomposeTask()` decomposition LLM 호출을 제거했다.
  - `preFilterResult.suggestedAgent`가 있으면 confidence와 무관하게 전문 agent를 직접 실행하고, suggested agent가 없으면 `Metrics Query Agent` deterministic fallback으로 처리한다.
  - Vision Agent unavailable 시 Analyst fallback은 유지했다.
  - `routingDecisionTrace.agentDecision.source`에 `deterministic_fallback`을 추가해 direct fallback 경로를 관측 가능하게 했다.
  - 검증: targeted direct routing 1 file / 14 tests PASS, agent stream 1 file / 17 tests PASS, AI Engine `type-check`, AI Engine full 127 files / 1249 tests PASS, root `test:contract` 3 files / 24 tests PASS, docs checks/git diff check PASS.

- [x] Agent provider quota rebalance
  - 커밋: `01bc1eac8 refactor(ai-engine): rebalance provider mesh policy`
  - Analyst/Verifier long-context 경로에서 Cerebras phantom primary를 제거하고 Mistral-first로 전환했다.
  - Reporter는 Z.AI-first를 유지하되 `maxSteps`를 5 → 4로 낮춰 conservative 5 RPM guard 병목을 줄였다.
  - Advisor는 Mistral-first 3-step 경로로 보수화하고, Cerebras `llama3.1-8b`는 2026-05-27 종료 전까지 short-context last fallback으로만 유지한다.
  - Metrics Query Cerebras-first 전환 검토는 8K context/deprecation/quota 조건 때문에 종료하고 Groq-first를 유지한다.
  - 구조 재검토: Evaluator/Optimizer 패턴은 deterministic 품질 기준이 명확하므로 유지하되, Reporter optimizer의 "백틱=실행 가능" 휴리스틱은 command-like 패턴만 인정하도록 축소했다.
  - 검증: targeted provider/runtime tests 6 files / 61 tests PASS, incident/reporter targeted 2 files / 41 tests PASS, AI Engine full test 127 files / 1243 tests PASS, docs checks/git diff check PASS.

### Completed (2026-05-16) — Codex
- [x] Vercel AI SDK stable package alignment
  - npm registry `latest` 기준으로 `ai@6.0.175`, `@ai-sdk/react@3.0.99`, `@ai-sdk/groq@3.0.38`, `@ai-sdk/google@3.0.68`, `@ai-sdk/openai@3.0.62`, `@ai-sdk/cerebras@2.0.50`, `@ai-sdk/mistral@3.0.35`를 재확인했다.
  - 루트 앱의 `@ai-sdk/mistral`만 `^3.0.28`에서 `^3.0.35`로 patch 업그레이드해 AI Engine과 버전을 정렬했다.
  - 루트 앱의 `@ai-sdk/react@^3.0.140`은 registry에 존재하지 않는 버전으로 확인되어 공식 stable `latest`인 `^3.0.99`로 정렬하고 lockfile 재현성을 회복했다.
  - `ai@7.0.0-beta.116`, `@ai-sdk/react@3.0.0-beta.172`, provider beta/canary 계열은 stable `latest`가 아니므로 무료 티어 운영 안정성 기준에서 채택 보류했다.
  - `ai` 및 `@ai-sdk/*` 의존성은 root/AI Engine 모두 exact pin으로 전환해 patch 릴리스 자동 유입을 막고, 변경점 확인 후 수동 업그레이드하도록 정렬했다.
  - 후속 개선으로 `npm run check:ai-sdk`를 추가해 root/AI Engine의 `ai` 및 `@ai-sdk/*` 선언 버전과 lockfile 설치 버전이 실제 npm registry에 존재하는지 검증하도록 했다. 기본 모드는 미공개 버전/lock 누락을 실패 처리하고, `--strict-latest` 사용 시 latest 불일치도 실패 처리한다.
  - `@ai-sdk/react` `UIMessage` 계약 회귀 테스트를 보강해 `reasoning`/`source-url`/`data-*`/`tool-*` 파트가 텍스트 추출에 섞이지 않고, AI SDK v6 `FileUIPart`의 `url`/`mediaType`/`filename`이 Cloud Run 첨부 형식으로 유지되는지 확인했다.
  - GitLab validate 단계에 `validate_ai_sdk_registry` job을 추가해 root/AI Engine AI SDK 선언 버전과 lockfile 버전이 npm registry에 존재하는지 CI에서 자동 검증하도록 했다. 일반 validate는 upstream patch 릴리스만으로 막히지 않게 non-strict 모드로 두고, strict latest 점검은 수동/로컬 점검으로 유지한다.
  - provider fallback mesh 회귀 테스트를 보강해 `A-B-C`, `B-C-A`, `C-A-B` 회전 순서에서 앞 provider가 실패해도 다음 provider로 순차 복구되는지 mock 기반으로 확인했다.

### Completed (2026-05-16) — Codex
- [x] AI provider 문서/계획서 정합성 정리
  - AI Provider Fallback Mesh와 AI Assistant 답변 품질 안정화 결과를 운영 문서와 계획서 상태에 반영했다.
  - 완료된 답변 품질 안정화 계획서는 archive로 이동하고, active 계획서 상태를 `Approved`/`Draft`/`tracking` 기준으로 재정렬했다.
  - NLQ Pre-processing Redesign은 계약 변경 범위라 `Draft`를 유지하고 구현 전 보강 필요 항목을 명시했다.

- [x] AI Provider Fallback Mesh
  - Z.AI 무료 Flash 모델을 AI Engine provider mesh에 추가하고 text chain을 Groq/Z.AI/Mistral/Cerebras 축으로 분산했다.
  - Vision fallback은 Gemini → OpenRouter → Z.AI Vision 순서로 확장했고, Z.AI request body에는 `thinking: { type: "disabled" }`를 주입해 tool-calling smoke 기준을 반영했다.
  - Cerebras `llama3.1-8b`는 2026-05-27 종료 전까지 short-context fallback으로 유지하되, 2026-05-16 계정 header 기준 quota를 5 RPM / 30K TPM / 2.4K RPD / 1M TPD로 갱신했다.
  - 검증: Z.AI live text/tool smoke, AI Engine `type-check`/full test, root `type-check`/`lint`/`test:quick`/`test:contract`, docs checks, `git diff --check` 통과.
  - 상세: [archive/ai-provider-fallback-mesh-plan.md](archive/ai-provider-fallback-mesh-plan.md)

### Completed (2026-05-16) — Codex
- [x] AI Assistant 답변 품질 안정화
  - 최근 AI Engine 답변 품질 변경을 재검토하고 SambaNova provider 추가와 Cerebras `llama3.3-70b` 조기 기본 전환은 원상복구했다.
  - 유지한 개선: 내부 판단 절차형 프롬프트 안전화, 인텐트별 LLM 파라미터, tool result 기반 응답 enrichment 보정.
  - 검증: AI Engine targeted 7 files / 154 tests, AI Engine full 126 files / 1224 tests, root `type-check`, `lint`, `test:quick`, `test:contract`, `line-guard`, docs checks, `git diff --check` 통과.
  - 상세: [archive/ai-assistant-response-quality-stabilization-plan.md](archive/ai-assistant-response-quality-stabilization-plan.md)

### Completed (2026-05-15) — Codex
- [x] DashboardClientRuntime anonymous 무한 로딩 수정
  - `490846d7c fix(dashboard): redirect anonymous access checks`
  - release `v8.11.156` 배포 완료, 비인증 `/dashboard` 접근 시 `/` 리다이렉트 경로로 정리

- [x] Follow-up Improvements G2/G4/line-guard closure
  - [archive/follow-up-improvements-plan.md](archive/follow-up-improvements-plan.md) T0~T5 완료 및 archive 이동
  - G2: guidance CTA metadata 보존 + 실제 AI sidebar 렌더러 CTA 버튼/클릭 실행 경로 보정
  - G4: `startChatArtifactGeneration` 단계 메시지 타이머 계약과 회귀 테스트 반영
  - line-guard: 상위 7개 target 파일을 650줄 미만으로 분리하고 component map 갱신
  - release: `v8.11.153`, GitLab tag pipeline `2525981912` success
  - QA: Vercel Playwright MCP targeted run [QA-20260515-0503](../qa/runs/2026/qa-run-QA-20260515-0503.json) PASS, pending 0, expert open gap 0

### Completed (2026-05-15) — Claude
- [x] 계획서 정리 및 잔여 백로그 계획서 승격
  - `artifact-ux-improvement-plan.md` → archive 이동 (T1~T8 모두 완료)
  - `ai-status-diagnostic-command-plan.md` → archive 이동 (Task 0~5 모두 완료)
  - Backlog G2/G4/line-guard를 [follow-up-improvements-plan.md](follow-up-improvements-plan.md)으로 승격 (Status: Approved)
  - v8.11.150 기준 잔여 개선 분석 완료 — 블로킹 이슈 없음, Active Tasks 없음

### Completed (2026-05-09 #322) — Codex
- [x] Dashboard 서버 카드 & 상세 페이지 UX 개선
  - `EnhancedServerModal.tsx` dead shell과 shell 전용 테스트 제거
  - 서버 상세 헤더에 상태 배지와 warning/critical 서버용 "AI에게 물어보기" 액션 추가
  - 후속 제품 포지션 재정렬: per-entity AI CTA는 [archive/dashboard-ai-surface-boundary-plan.md](archive/dashboard-ai-surface-boundary-plan.md)에서 제거/이동 대상으로 재분류
  - Overview 탭 중복 "핵심 성능 지표" 그리드 제거
  - 서버 카드 Progressive Disclosure를 hover 자동 노출 없이 명시적 펼치기 버튼으로 단순화
  - 계획서 archive: [archive/dashboard-server-detail-ux-plan.md](archive/dashboard-server-detail-ux-plan.md)
  - QA 기록: [QA-20260509-0427](../qa/runs/2026/qa-run-QA-20260509-0427.json)

### Completed (2026-05-08 #321) — Claude
- [x] 3일간 변경사항 Playwright Production QA (QA-20260508-0425)
  - 13개 체크: 12 pass, 1 warn, 0 fail. 콘솔 에러/경고 0건
  - 개선 확인: SVG Sparkline(Recharts→Nivo), AI 피드백 제거, raw JSON 억제, Reporter/이상감지 신기능 정상
  - 관찰: 채팅 응답 후 메타데이터 영역 수동 스크롤 필요 (non-blocking)
  - 증거: `reports/qa/evidence/qa-20260508-*.png` (9개)

### Completed (2026-05-08 #320) — Codex
- [x] MSW 테스트 인프라 정합성 개선
  - `test:contract` MSW unhandled request policy를 `error`로 전환
  - `api-contract` inline `global.fetch` mock 제거, MSW route handler 기반 계약 검증으로 전환
  - live connectivity 전용 Vitest config를 `setupFiles: []`로 분리해 기본 gate의 MSW/setup mock과 격리
  - legacy OpenAI/Cohere provider-direct MSW handler 제거, `/api/ai/status` mock provider 이름을 current runtime 정책 기준으로 정렬
  - 상세: [archive/msw-test-infra-integrity-plan.md](archive/msw-test-infra-integrity-plan.md)

### Completed (2026-05-08 #319) — Codex
- [x] 완료 계획서 archive 정리
  - `chart-migration-plan.md` → [archive/chart-migration-plan.md](archive/chart-migration-plan.md)
  - `nivo-chart-ux-fix-plan.md` → [archive/nivo-chart-ux-fix-plan.md](archive/nivo-chart-ux-fix-plan.md)
  - `developer-panel-plan.md` → [archive/developer-panel-plan.md](archive/developer-panel-plan.md)
  - `storybook-ci-guardrail-plan.md` → [archive/storybook-ci-guardrail-plan.md](archive/storybook-ci-guardrail-plan.md)
  - `docs-hygiene-plan.md` → [archive/docs-hygiene-plan.md](archive/docs-hygiene-plan.md)
  - Active/Backlog에는 `MSW 테스트 인프라 정합성 개선`만 구현 대기 항목으로 유지

### Completed (2026-05-08 #318) — Claude
- [x] 작업 계획서 상태 정리 + storybook-ci-guardrail Task 1~2 구현
  - `dependency-config-hygiene-plan.md` archive 이동 (Task 1~6 전체 완료)
  - `nivo-chart-ux-fix-plan.md` + `NivoTimeSeriesChart.tsx` + `useTimeSeriesMetrics.ts` 수정 커밋
  - `.github/README.md` 신규 추가 (historical reference 명시)
  - `package.json` `clean:all` lockfile 보존 수정
  - `.gitlab-ci.yml` storybook 경로 앵커 + `validate_storybook_smoke` job 추가
  - `storybook-ci-guardrail-plan.md` Task 1~2 체크 + WSL2 esbuild SIGBUS 리스크 문서화
  - `TODO.md` dependency hygiene 항목 제거, storybook guardrail In Progress 갱신

### Completed (2026-05-07 #315) — Codex
- [x] Chart 마이그레이션: Recharts → SVG Sparkline + Nivo
  - `MiniLineChart`를 순수 SVG `SvgSparkline`으로 교체하고 Recharts 기반 파일/테스트/타입 선언 삭제
  - `TimeSeriesChart`를 `NivoTimeSeriesChart`로 교체하고 `@nivo/line`, `@nivo/core` 도입
  - `recharts` dependency 제거, Storybook story를 `Shared/SvgSparkline`으로 갱신
  - 검증: targeted Vitest, `type-check`, 추가 gate 실행 결과는 chart plan에 기록

### Completed (2026-05-07 #314) — Claude
- [x] WBS/종료보고서/project 산출물 문서군 정리
  - WBS, requirements, FINAL_QA_REPORT, production-qa, dod-closeout-roadmap, security-qa-backlog, 완료된 plan 2개 삭제
  - QA_TRENDS는 `qa:status -- --write` 생성 산출물로 재동기화
  - definition-of-done.md에 QA Closeout 기준 흡수, docs/status.md 기준 문서 테이블 재구성

### Completed (2026-05-07 #313) — Codex
- [x] Dead code 정리 및 Sentry cleanup closure
  - Sentry integration 제거 후 follow-up dead code A-1~A-7 완료
  - `/api/ai/ask` facade 제거, AI stream endpoint를 `/api/ai/supervisor/stream/v2`로 고정
  - unused store action/helper와 unused shadcn/ui components/stories/tests 제거
  - toast system을 `react-hot-toast`로 단일화하고 shadcn toast/Radix toast 의존성 제거
  - `/api/version`, `/api/servers/[id]`는 운영/계약 surface로 유지하고, 중복 `/api/servers/[id]/processes` mock route는 `/api/servers-unified?action=processes`로 대체
  - 검증: targeted Vitest, `test:quick`, `type-check`, `lint`, `knip:ci`, docs checks, `git diff --check`
  - 상세 plan은 WBS/closeout 문서 정리에서 삭제됨. 완료 요약은 이 항목에 보존.

### Completed (2026-05-07 #312) — Codex
- [x] Cloud Run local Docker Compose drift cleanup
  - `cloud-run/docker-compose.yml`: `APP_VERSION=8.0.0` 제거, `vibe-network` 제거, Docker Compose V2 명령 주석 정리, Gemini env를 `GEMINI_API_KEY`/`GEMINI_API_KEY_PRIMARY` 중심으로 정렬
  - `cloud-run/.env.example`, `cloud-run/README.md`, `cloud-run/ai-engine/README.md`, `docs/development/docker.md`, `docs/development/environment-variables.md`: local Compose / Cloud Build / GitLab shell executor / grouped Secret Manager 경계 정리
  - broad build, Cloud Run deploy, external connectivity, 실 LLM 호출 없이 `docker compose config --quiet`, docs 검증, whitespace 검증으로 완료
  - 상세: [archive/cloud-run-docker-compose-drift-cleanup-plan.md](archive/cloud-run-docker-compose-drift-cleanup-plan.md)

### Completed (2026-05-07 #311) — Codex
- [x] AI 피드백 기능 제거 production closure
  - `v8.11.113` release/tag 배포 후 GitLab tag pipeline `2506061682` success 확인
  - Vercel `/api/ai/feedback` GET/POST 404, Cloud Run `/api/ai/feedback` GET/POST 404 확인
  - AI Assistant production UI에서 👍/👎 feedback action 0개, 복사/재생성 action 유지 확인
  - QA 기록: [QA-20260507-0420](../qa/runs/2026/qa-run-QA-20260507-0420.json)
  - 상세: [archive/ai-feedback-removal-plan.md](archive/ai-feedback-removal-plan.md)

### Completed (2026-05-07 #310) — Codex
- [x] 테스트 방법론 기준 SSOT/스킬 반영
  - `docs/guides/testing/test-strategy.md`: Risk-Based Local-First + Contract-First를 canonical 방법론으로 정리하고 Pareto/Defect Clustering, Pesticide Paradox, Test Pyramid, Test Size, Contract-First, FIRST, 비용/과잉 테스트 금지선을 명문화
  - `docs/guides/ai/ai-standards.md`: 공통 원칙 4를 테스트 전략 SSOT와 연결하고 false-pass 테스트 수정/삭제 우선 기준 추가
  - `config/ai/skill-baselines.json`, `.agents/skills/*`, `.claude/skills/*`: lint-smoke/code-review/qa-ops에 risk-based 대표 테스트, mock integrity, live/external 비용 guardrail, coverage percentage 금지 기준 반영
  - `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`에는 중복 기재하지 않고 기존 SSOT 참조 구조 유지

### Completed (2026-05-07 #309) — Codex
- [x] `.agents/skills` 대화형 AI QA 반영
  - `config/ai/skill-baselines.json`: qa-ops/qa-state baseline에 대화형 AI QA 요구사항 추가
  - `.agents/skills/qa-ops/SKILL.md`: v1.5.0으로 갱신, AI 관련 변경 시 표준 5개 질의 QA 단계 추가
  - `.agents/skills/qa-state/SKILL.md`: qa-ops의 대화형 AI QA 요구사항 보존 규칙 추가
  - 검증: `npm run skills:check`

### Completed (2026-05-07 #308) — Claude
- [x] 대화형 AI QA 프로세스 반영
  - `docs/guides/testing/test-strategy.md`: 테스트 피라미드에 "대화형 AI QA" 레이어 추가 (§ 1.5), 표준 5개 질문 세트, Pass/Warn/Fail 판정 기준, 기록 방법 정의
  - `.claude/skills/qa-ops/SKILL.md`: Workflow 3.5 단계 추가 (v1.5.0), AI 관련 변경 시 필수 실행 기준 명시
  - `reports/planning/TODO.md`: 작업 주체 표기 규칙(`In Progress (Claude/Codex)`) 추가 — 중복 착수 방지

### Completed (2026-05-06 #307)
- [x] AI Engine precomputed-state decoupling
  - `DomainDataSource` / `DomainSnapshot` / `DomainHistoryEntry` 계약을 portable core에 추가하고 `AssistantDomain.dataSource?`로 노출
  - monitoring domain pack이 `getCurrentState()` / `getRecentHistory()`를 소유하는 `monitoringDomainDataSource`를 제공하도록 분리
  - supervisor stream/single-agent → multi-agent request → forced routing/agent stream/reporter pipeline 경로에 domain dataSource를 전달
  - agent runtime의 direct `precomputed-state` import와 `tools-ai-sdk/server-metrics/data` 우회 결합을 contract guard로 차단
  - `getKSTDateTime()`은 `lib/time-utils.ts`로 분리하고 `precomputed-state`는 re-export 호환만 유지
  - 검증: precomputed decoupling contract tests `5 files / 23 tests`, affected agent tests `6 files / 91 tests`, AI Engine `type-check`, AI Engine full test `104 files / 1063 tests`
  - 상세: [archive/ai-engine-precomputed-state-decoupling-plan.md](archive/ai-engine-precomputed-state-decoupling-plan.md)

### Completed (2026-05-06 #306)
- [x] AI Engine domain-owned agent registry
  - `AgentRole` / `AgentRoleRegistry` 계약을 portable core에 추가하고 `AssistantDomain.agentRoles?` 선택 필드로 노출
  - monitoring domain이 7개 agent role manifest(id/name/description/matchPatterns/capabilities/runtimeConfigKey)를 소유하도록 분리
  - `agent-configs.ts`의 monitoring description/matchPatterns를 role manifest에서 파생하고 `orchestrator-factory.ts` display-name helper drift를 제거
  - `AgentFactory.createByDomain()` 추가: monitoring runtime binding, registry 없음 legacy fallback, unknown role, runtime binding 없음 케이스를 deterministic하게 처리
  - sample domain이 monitoring import 없이 2개 registry-only role을 등록하는 portability smoke 추가
  - 검증: failing specs `4 files / 7 failed`, targeted implementation tests `4 files / 40 passed`, AI Engine `type-check`, AI Engine full test `102 files / 1053 tests`, root `type-check`, `lint`, `test:quick`, `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check`
  - 상세: [archive/ai-engine-agent-registry-plan.md](archive/ai-engine-agent-registry-plan.md)

### Completed (2026-05-06 #305)
- [x] AI Engine SDK decoupling
  - `domains/monitoring/tool-registry.ts`의 Vercel AI SDK `ToolSet` type import를 제거하고 `ToolDefinition` registry로 전환
  - `AssistantRuntimeHost`에 `executeLLMStream` / `executeLLMGenerate` adapter boundary를 추가하고 monitoring host가 AI SDK `streamText` / `generateText`를 캡슐화
  - `supervisor-stream.ts` / `supervisor-single-agent.ts`는 직접 LLM execution 호출 대신 runtime host 경유로 전환
  - Task 4.5 후속으로 execution params/result 타입명을 `AiSdkStreamExecutionParams` / `AiSdkGenerateExecutionParams` 계열로 교정하고, `monitoringDomainPack.tools` ↔ production `allTools` drift guard를 contract test로 추가
  - 검증: targeted contract/domain/supervisor tests `4 files / 19 tests`, AI Engine `type-check`, AI Engine full test `102 files / 1046 tests`, root `type-check`, `lint`, `test:quick`, `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check`
  - 상세: [archive/ai-engine-sdk-decoupling-plan.md](archive/ai-engine-sdk-decoupling-plan.md)

### Completed (2026-05-06 #304)
- [x] Dead code and streaming warmup test cleanup
  - `knip --no-exit-code --reporter compact` 기준 미사용 파일 2개(`IncidentTimeline.tsx`, `VirtualizedServerList.tsx`)를 제거
  - 미사용 export/helper/type 정리: `getSeverityLabel`, `isArtifactSchemaSupported`, `createEmptyArtifactWorkspaceSnapshot`, incident-report route legacy response type, unused `AlertHistoryModal` wrapper
  - routed dashboard 구조에 맞지 않는 legacy test mock을 제거하고, `StreamingWarmupIndicator` fake timer cleanup을 `clearAllTimers()`로 정리
  - ADR-002의 서버 카드 렌더링 설명을 현재 `ServerDashboard` 내장 Show More 구현 기준으로 갱신
  - 검증: targeted Vitest `8 files / 49 tests`, `knip:ci`, `docs:budget`

### Completed (2026-05-06 #303)
- [x] AI assistant portable productization and provider policy hardening
  - portable runtime public facade를 `cloud-run/ai-engine/src/core/assistant-runtime/index.ts` 기준으로 고정하고 sample adoption fixture를 `cloud-run/ai-engine/src/test-fixtures/sample-domain-pack.ts`로 유지
  - provider-native `reasoningCapability` 정책 계약과 expired native reasoning disabled helper를 추가해 `analysisMode=thinking`과 provider-native reasoning을 분리
  - adoption guide를 신규 문서가 아닌 기존 AI Engine architecture 문서에 병합해 domain pack 작성, adapter 교체, runtime host 연결 checklist를 기록
  - SDD 순서: plan approve → failing specs → implementation → validation
  - 검증: AI Engine targeted tests `6 files / 30 tests`, AI Engine `type-check`, root `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check`
  - 상세: [archive/ai-assistant-portable-productization-plan.md](archive/ai-assistant-portable-productization-plan.md)

### Completed (2026-05-06 #302)
- [x] Monitoring source error boundary documentation
  - `monitoring source error contract` 적용 범위를 deterministic monitoring routes로 명문화
  - 적용 범위: Cloud Run `/api/ai/monitoring/snapshot`, `/api/ai/monitoring/analyze-batch`, Vercel `/api/ai/intelligent-monitoring` batch pass-through
  - 비적용 범위: Cloud Run `/api/ai/analyze-server`는 generic `handleApiError`, `/api/ai/incident-report`는 보고서 availability를 위한 degraded/tool-based fallback 유지
  - `docs/design/04-error-handling-design.md`, `docs/architecture/04-data-flow.md`, `docs/reference/architecture/data/otel-data-architecture.md`의 용어와 archived plan 링크 정리
  - 검증: `docs:budget`, `docs:ai-consistency`, `git diff --check`

### Completed (2026-05-06 #301)
- [x] MonitoringFactPack consumer/evidence UI expansion
  - Backlog 항목을 Approved plan으로 승격하고 SDD 순서대로 failing spec → implementation → QA record를 분리 커밋
  - Frontend `MonitoringBatchAnalysisResponse`에 public-safe `MonitoringBatchFactPack` 타입/검증 schema를 추가하고 malformed `factPack`은 drop하되 legacy `riskSignals/evidenceRefs` fallback은 유지
  - Monitoring artifact metadata가 fact-pack evidence를 sanitized envelope evidence로 보존하고, artifact card/markdown 렌더링은 `factPack.signals/evidenceRefs`를 legacy payload보다 우선 사용
  - `factPack` unknown field stripping guard를 추가해 새 JSON/export 표면이 raw tool/provider payload를 넓히지 않도록 고정
  - Production targeted QA는 배포가 없어 생략. Local deterministic QA [QA-20260506-0417](../qa/runs/2026/qa-run-QA-20260506-0417.json)에 skip 사유와 검증 결과 기록
  - 검증: targeted artifact tests `17/17`, `type-check`, `lint`, `test:quick`, `test:contract`, `git diff --check`
  - 상세: [archive/monitoring-factpack-consumer-evidence-ui-plan.md](archive/monitoring-factpack-consumer-evidence-ui-plan.md)

### Completed (2026-05-06 #300)
- [x] AI advanced surface targeted QA pack and RAG/Web raw JSON closure
  - Production `v8.11.108` targeted QA에서 Reporter 1회와 anomaly/trend 1회는 pass, RAG/Web 대표 질의는 repeated `searchKnowledgeBase`/`searchWeb` raw tool-call JSON 노출로 fail 확인
  - AI Engine stream text guard가 단일 JSON 객체만 차단하던 한계를 보강해 semicolon-separated repeated tool-call JSON을 첫 완성 객체 기준으로 suppress하고 같은 provider attempt의 후속 raw chunks도 차단
  - `v8.11.109` 배포 후 RAG/Web closure QA에서 rawToolJsonCount `0`, grounded file paths `public/data/otel-data/*`, `src/data/otel-data/index.ts`, `src/services/metrics/MetricsProvider.ts` 반환 확인
  - 검증: AI Engine targeted stream guard/supervisor/orchestrator tests, AI Engine `type-check`, AI Engine full test, root `test:contract`, `git diff --check`, production QA [QA-20260506-0415](../qa/runs/2026/qa-run-QA-20260506-0415.json) / [QA-20260506-0416](../qa/runs/2026/qa-run-QA-20260506-0416.json)

### Completed (2026-05-06 #299)
- [x] AI artifact workspace UI wiring and compare UX
  - AI workspace side context에 `ArtifactWorkspacePanel`을 연결해 replay pack 저장, 목록, JSON 내보내기/가져오기, 비교, 로컬 삭제 UX를 제공
  - renderer registry가 supported `kind` 문자열만으로 typed card를 열지 않고 artifact schema registry payload validation을 통과한 경우에만 supported entry로 분류하도록 보강
  - import/compare workflow는 local/session-first로 유지되며 기본 DB write, network fetch, AI route, LLM/provider 호출 없음
  - 검증: renderer/workspace targeted test, AIWorkspace/SystemContextPanel integration test, `type-check`, `lint`, `test:quick`, `test:contract`, `git diff --check`
  - 상세: [archive/ai-artifact-workspace-ui-wiring-plan.md](archive/ai-artifact-workspace-ui-wiring-plan.md)

### Completed (2026-05-06 #298)
- [x] AI artifact workspace export/import adapter
  - replay pack을 deterministic JSON download payload(`fileName`, `mimeType`, `contents`)로 변환하는 export helper 추가
  - JSON import는 기존 replay pack normalizer를 통과한 supported pack만 session store에 저장하고 invalid/unsupported input은 reject
  - compare UX가 바로 사용할 수 있도록 `matched/missing/added/changed` count summary helper 추가
  - 검증: artifact workspace store targeted test

### Completed (2026-05-06 #297)
- [x] AI artifact workspace store and legacy migration core
  - `createArtifactWorkspaceStore()`를 추가해 replay pack을 session storage 우선으로 저장·복원하고, policy에 `allowsDatabaseWritesByDefault=false`를 명시
  - 손상된 workspace snapshot과 unsupported replay entry는 restore 시 drop/sanitize해 raw unsafe payload를 노출하지 않도록 고정
  - `extractArtifactReplayPackFromChatHistory()`를 추가해 기존 `artifactEnvelopes`와 legacy artifact metadata(`incidentReportArtifact`, `monitoringAnalysisArtifact`, `serverSnapshotArtifact`)를 deterministic replay pack으로 변환
  - 검증: artifact workspace store targeted test

### Completed (2026-05-06 #296)
- [x] AI artifact workspace schema registry and replay pack core
  - monitoring artifact family/version schema registry를 `incident-report`, `monitoring-analysis`, `server-snapshot` 기준으로 추가하고 local/session-first replay policy를 명시
  - `ArtifactReplayPack` create/read/compare core를 추가해 supported artifact envelope만 저장·복원·비교하고 unsupported raw payload는 drop
  - frontend renderer registry가 hardcoded renderer key 목록 대신 같은 schema registry에서 지원 key를 파생하도록 정렬
  - 검증: artifact workspace registry, renderer registry, artifact envelope targeted tests

### Completed (2026-05-06 #295)
- [x] Planner shadow structured telemetry observations
  - `qa:record` 입력과 normalizer에 `plannerShadowObservations`를 추가해 `surface`, `route`, `executionMode`, `latencyMs`, `classification`, `driftReasonCodes`, `source`를 구조화 기록
  - run record와 `qa-tracker.json` run history에 같은 observation payload를 보존하고, `QA_STATUS`/`QA_TRENDS` snapshot에서 최근 24시간 p95 latency와 drift rate를 직접 집계
  - 기존 `npm run qa:planner-shadow` review script는 구조화 observation이 있는 run을 우선 사용하므로 note-derived evidence에서 rollout-gate 가능한 structured evidence로 전환 가능
  - 검증: targeted QA script/trends/planner-shadow review tests

### Completed (2026-05-06 #294)
- [x] AI Engine production supervisor stream domain-agnostic wiring
  - Task 0~6 완료. `AssistantRuntimeHost` execution adapter가 AI SDK `ToolSet`, system prompt, prepare-step boundary를 제공하도록 확장
  - `supervisor-stream.ts`와 `supervisor-single-agent.ts`의 tool/prompt/prepare-step authority를 runtime host로 이동하고, monitoring-specific compatibility는 `monitoring-runtime-host.ts` adapter 내부에 캡슐화
  - `supervisor-mode.ts` artifact kind 판정을 domain artifact registry로 이동하고, `agent-configs.ts` multi-agent tool allowlist resolution을 runtime host 경계로 정렬
  - 검증: AI Engine targeted `3 files / 22 tests`, AI Engine `type-check`, AI Engine full `102 files / 1036 tests`, root `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check`
  - 상세: [archive/ai-engine-supervisor-domain-wiring-plan.md](archive/ai-engine-supervisor-domain-wiring-plan.md)

### Completed (2026-05-06 #293)
- [x] Planner shadow production telemetry review
  - `scripts/qa/planner-shadow-telemetry-review.js`와 `npm run qa:planner-shadow`를 추가해 기존 `reports/qa/runs/**`의 `plannerShadow` 운영 evidence를 live QA/LLM 호출 없이 deterministic하게 집계
  - 현황: runs scanned `418`, plannerShadow evidence run `2`, note-derived samples `3`, structured observation runs `0`, latency avg/p95/max `2ms / 5ms / 5ms`, zero latency samples `1`, drift rate `33.33%`, reason code `execution_mode_mismatch=1`
  - 판정: 운영 QA evidence는 현재 note-derived라 rollout gate로 쓰기에는 부족하며, telemetry adapter gap을 `Planner shadow structured telemetry observations` Backlog로 승격
  - 검증: `npm run qa:planner-shadow`, `npx vitest run tests/unit/qa/planner-shadow-telemetry-review.test.ts`

### Completed (2026-05-06 #292)
- [x] AI assistant portable core/domain pack modularization
  - Task -1~7 전체 완료. current-code boundary guard, scaffold-aware core dependency guard, route/tool trace replay, retrieval evidence recall, stream contract snapshot benchmark를 deterministic Vitest guard로 고정
  - `AssistantDomain`/runtime registry/adapter scaffold와 `monitoringDomainPack`을 추가해 prompt/routing/tool/fact/artifact ownership을 domain pack으로 이관
  - supervisor/job/ask path가 generic runtime host와 monitoring default host를 통해 domain/adapters를 주입받고, public-safe `assistantRuntime` metadata를 보존하도록 정렬
  - frontend artifact renderer registry/host를 추가해 legacy artifact metadata와 generic envelope restore를 registry boundary로 통합하고 unknown envelope safe fallback을 고정
  - mock sample domain pack fixture와 portability smoke로 core 수정 없이 sample routing/tool/artifact/fact pack이 동작함을 검증
  - 최종 검증: root targeted `8 files / 63 tests`, AI Engine targeted `10 files / 100 tests`, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `npm test` `101 files / 1026 tests`, `docs:budget`, `docs:ai-consistency`, `git diff --check`
  - 상세: [archive/ai-assistant-portable-core-domain-pack-plan.md](archive/ai-assistant-portable-core-domain-pack-plan.md)

### Completed (2026-05-05 #291)
- [x] Artifact intent production-sample replay eval
  - 작업 계획서 기준 AI benchmark 잔여를 재분류: Promptfoo golden dataset/A-B eval hardening은 #289에서 완료, artifact intent deterministic corpus `121/121` 이후 남은 항목은 production-style replay guard였음
  - 최근 production QA query와 익명화된 운영자 질의 패턴을 `tests/fixtures/artifacts/intent-production-sample-corpus.ts` 19건 replay fixture로 분리
  - `tests/intent-classifier/intent-classifier.production-replay.test.ts`를 추가해 active classifier rule version 정합성, replay accuracy, class별 precision/recall threshold를 고정
  - AI Assistant 모듈화 문제는 `archive/ai-assistant-architecture-evolution-plan.md`, `archive/ai-assistant-plan-result-facade-plan.md`, `archive/ai-assistant-route-decision-metadata-plan.md`, `archive/ai-assistant-retrieval-multi-agent-refactor-plan.md` 기준 Completed이며 별도 Active plan 없음
  - 검증: `npx vitest run tests/intent-classifier/intent-classifier.production-replay.test.ts tests/intent-classifier/intent-classifier.eval.test.ts tests/artifacts/intent-classifier.bench.ts`

### Completed (2026-05-05 #290)
- [x] v8.11.106 release targeted QA and planning hygiene cleanup
  - `v8.11.106` GitLab tag pipeline `2499937091` success 및 production `/api/version` `8.11.106` 확인
  - Production targeted QA `QA-20260505-0412`에서 dashboard telemetry copy, AI sidebar tool menu, Reporter copy, Intelligent Monitoring RAG copy removal을 재검증
  - QA tracker summary 기준 completed/pending/deferred/wont-fix: `436/0/0/22`
  - 완료된 root plan 파일 23개를 `reports/planning/archive/`로 이동하고 TODO.md의 archive 링크를 보정

### Completed (2026-05-05 #289)
- [x] Promptfoo evaluation hardening & A/B testing
  - `archive/promptfoo-evaluation-hardening-plan.md` Completed 처리
  - 기본 Promptfoo config를 Cerebras/Groq runtime-aligned provider, 25개 golden dataset, deterministic assertion 중심으로 재구성하고 test별 대상 prompt를 명시해 예상 provider call을 `200 → 50`으로 축소
  - `llm-rubric` judge assertion을 main/redteam config 모두 0건으로 낮추고, `javascript` schema-sensitive guard 6건 추가
  - `prompt:eval` / `prompt:redteam` 실행 전 live provider call estimate와 judge ratio를 출력하는 preflight 추가
  - 검증: Promptfoo config contract test, preflight main/redteam, AI Engine `type-check`, AI Engine full test

### Completed (2026-05-05 #288)
- [x] v8.11.97 broad QA remediation residual closure
  - `v8.11.105` GitLab tag pipeline `2499754655` success 및 production `/api/version` `8.11.105` 확인
  - Supabase `knowledge_base`에 `OpenManager OTel 데이터 SSOT 경로` 문서를 seed/upsert하고 KRL OTel fallback query candidate를 추가
  - Production targeted QA `QA-20260505-0410`에서 RAG On 내부 OTel/SSOT 경로 질의가 clarification 없이 실행되고, `public/data/otel-data/*`, `src/data/otel-data/index.ts`, `src/services/metrics/MetricsProvider.ts`, `cloud-run/ai-engine/src/data/precomputed-state.ts`를 반환하는지 확인
  - QA tracker summary 기준 completed/pending/deferred/wont-fix: `433/0/0/22`

### Completed (2026-05-04 #287)
- [x] Formatting-only follow-up context preservation local patch
  - `QA-20260504-0405`에서 확인된 "위 답변을 운영 보고서용 2문장..." 재작성 follow-up이 server-scope clarification에 막히고, skip 후 직전 답변의 서버 ID/수치를 일부 누락하는 문제를 local patch로 보강
  - frontend clarification generator가 formatting-only 재작성 요청은 clarification 없이 streaming 경로로 보내도록 정리
  - Cloud Run Supervisor stream message builder가 재작성 요청의 마지막 user message에 직전 assistant 답변을 명시적으로 포함해 서버 ID/순위/수치/단위 보존 근거를 제공하도록 보강
  - 검증: targeted clarification/query-execution/supervisor-stream-message tests, root `type-check`, `lint`, `test:quick`, AI Engine `type-check`, AI Engine `test`, `git diff --check`
  - 남은 확인: 배포 후 Vercel Playwright MCP에서 `ai-formatting-rewrite-context-preservation-v81196` 재검증

### Completed (2026-05-04 #286)
- [x] Vercel QA follow-up polish
  - `QA-20260504-0404`에서 확인된 비차단 개선 후보 3건을 작은 패치로 정리
  - `plannerShadow.latencyMs`는 `performance.now()` 기반으로 측정해 sub-ms shadow 작업도 `1ms` 관측값으로 남기도록 보강
  - 로그 탐색기 24h 순환 샘플 범위가 날짜 역전처럼 보이지 않도록 range 전용 표시 헬퍼 추가
  - formatting-only 재작성 요청은 stream/single 경로를 유지하되, 직전 답변의 사실·수치·문장 수를 보존하도록 system prompt 품질 규칙 보강
  - 검증: targeted timestamp/supervisor tests, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `test`, `git diff --check`

### Completed (2026-05-04 #285)
- [x] Supervisor deterministic recovery success metadata
  - `v8.11.94` Playwright MCP QA에서 CPU ranking 답변 내용은 정상화됐지만 `data-done.success=false`와 `STREAM_ERROR_OCCURRED` warning이 함께 방출되는 metadata drift 확인
  - tool result 기반 deterministic summary로 정상 복구한 경우 후행 provider stream error를 사용자-facing 실패 metadata로 남기지 않도록 정리
  - 검증: targeted Supervisor stream recovery tests

### Completed (2026-05-04 #284)
- [x] Supervisor stream advanced ranking recovery
  - `v8.11.93` Playwright MCP follow-up에서 `CPU 상위 3개 서버`가 Supervisor single path에서 `getServerMetricsAdvanced`를 호출했지만, 빈 text stream 이후 잘못된 `finalAnswer`(`서버는 없습니다`)가 먼저 복구되는 문제 확인
  - Supervisor stream이 tool result를 deterministic summary fallback으로 먼저 재구성하고, advanced metric ranking이 있으면 `finalAnswer` 복구보다 서버 ID/수치 기반 응답을 우선하도록 보강
  - 검증: targeted Supervisor stream/summary/orchestrator stream tests

### Completed (2026-05-04 #283)
- [x] Advanced metric ranking deterministic answer guard
  - `v8.11.92` Playwright MCP follow-up에서 `CPU 상위 3개 서버` 선행 응답이 서버 ID 없이 `cpu 85%`처럼 값만 나열되는 답변 품질 문제 확인
  - `getServerMetricsAdvanced` current ranking 결과를 deterministic summary payload에 포함해 Top-N 응답이 서버 ID와 현재 수치를 직접 인용하도록 보강
  - formatting-only 재작성 요청은 job/reporter/artifact 경로로 승격하지 않되, 선행 ranking 답변 자체는 deterministic answer guard로 안정화
  - 검증: targeted AI Engine summary/stream/routing tests, AI Engine `type-check`, AI Engine `test`

### Completed (2026-05-04 #282)
- [x] Formatting-only report rewrite routing guard
  - `v8.11.91` Playwright MCP recheck에서 artifact false-positive는 해소됐지만, "운영 보고서용 2문장으로 다시 작성" 같은 재작성 요청이 frontend job queue와 Cloud Run Reporter pipeline으로 과도하게 승격되는 residual 확인
  - frontend complexity/job type inference와 Cloud Run supervisor/pre-filter에 formatting-only guard를 추가해 명시적 보고서 생성이 아닌 재작성 요청은 streaming single-agent/final-answer 경로에 남도록 보강
  - 명시적 `장애 보고서 생성/작성` 경로는 기존 multi-agent/report routing을 유지하고, shadow planner에서도 incident report escalation으로 기록하지 않도록 회귀 테스트 추가
  - 검증: targeted root routing tests, AI Engine supervisor/pre-filter tests

### Completed (2026-05-04 #281)
- [x] Artifact intent formatting-only false-positive guard
  - `v8.11.90` Playwright MCP release QA 중 "운영 보고서용 2문장으로 다시 작성" 같은 재작성 요청이 artifact intent LLM fallback을 거쳐 이상감지/추세 artifact로 승격되는 false-positive 확인
  - `보고서용`/`리포트용`/`다시 작성`/`문장으로` 등 formatting-only 요청은 명시적 artifact 실행 단어가 없으면 local classifier와 LLM fallback gate 모두에서 `none`으로 유지하도록 보강
  - deterministic corpus를 `2026-05-04-v1`로 갱신하고 production 재현 문장 및 유사 formatting-only 케이스 3개를 추가
  - 검증: targeted classifier tests, `type-check`, `lint`, `test:quick`, `test:contract`

### Completed (2026-05-04 #280)
- [x] AI response provider/model QA evidence wiring
  - `AIWorkspace`가 마지막 완료 assistant 응답의 `metadata.provider`/`metadata.modelId`를 계산해 `SystemContextPanel`로 전달하도록 연결
  - `SystemContextPanel`이 마지막 응답 provider chip을 활성 강조하고 `Last response: provider/model`을 표시해 Playwright QA에서 실제 runtime selection을 관측할 수 있게 보강
  - 기존 `AnalysisBasisBadge`의 provider/model/fallback 상세 metadata 경로는 유지하며, 새 LLM/provider 호출이나 routing authority 변경 없음
  - 검증: `npx vitest run src/components/ai/AIWorkspace.test.tsx src/components/ai/SystemContextPanel.test.tsx`

### Completed (2026-05-04 #279)
- [x] AI soft health cold-start observability normalization
  - `/api/health?service=ai&soft=true`가 Cloud Run `/health` timeout을 받으면 `status=degraded`를 유지하되 `latency`, `reasonCode=cloud_run_health_timeout`, `recoverable=true`를 함께 반환하도록 보강
  - `useHealthCheck`, `SystemContextPanel`, `CloudRunStatusIndicator`, `AIDebugPanel`이 recoverable cold-start degraded를 hard error가 아니라 `Warming`/웜업 상태로 표시하도록 정리
  - `SystemBootstrap`이 soft degraded 또는 자체 timeout을 세션 동안 hard failed로 캐시하지 않고 `degraded` 상태로 보존하도록 보정
  - 인프라 증설, always-on warmup, 추가 LLM 호출 없음
  - 검증: targeted health/proxy/UI tests `16/16`, `type-check`, `lint`, `test:quick`, `git diff --check`

### Completed (2026-05-04 #278)
- [x] MonitoringDataSource live-mode error contract hardening
  - 기존 `MonitoringDataSource`/`live-otel` skeleton 범위 안에서 개선. 새 telemetry backend, LLM/provider 호출, route surface 증설 없음
  - `MonitoringDataSourceError`가 `queryAsOf`를 보존하도록 보강해 실제 source 전환 실패도 어느 데이터 슬롯 기준인지 추적 가능하게 정렬
  - Cloud Run `/monitoring/snapshot`, `/monitoring/analyze-batch`가 monitoring source 오류를 generic 500으로 뭉개지 않고 `code`, `sourceMode`, `queryAsOf`, `requestId`, `recoverable`이 포함된 표준 오류 계약으로 반환
  - Vercel `/api/ai/intelligent-monitoring` proxy가 Cloud Run monitoring source 오류를 fallback으로 숨기지 않고 동일한 503/error contract로 pass-through하도록 보강
  - 회귀 테스트: `live-otel` disabled 경로가 Cloud Run snapshot/analyze-batch와 Vercel BFF에서 503 + monitoring error contract로 반환되는지 고정

### Completed (2026-05-03 #277)
- [x] AI Streaming UI 개선 S3 release/deploy QA
  - `v8.11.88` release commit/tag를 GitLab CI 경유로 배포했고, main validation pipeline `2496237525`와 tag deploy pipeline `2496239687` 모두 success 확인
  - production `/api/version`, `/api/health`, Cloud Run `/health`가 `8.11.88`와 commit `4e6c055b572cfba69a37fde203c122001fae9bfb`를 가리키는지 확인
  - Playwright MCP targeted QA 기록: [QA-20260503-0399](../qa/runs/2026/qa-run-QA-20260503-0399.json) `19/19`, [QA-20260503-0400](../qa/runs/2026/qa-run-QA-20260503-0400.json) `5/5`
  - 사이드바 Job SSE, 전체 화면 `/api/ai/supervisor/stream/v2` 직접 질의, fullscreen conversation/analysis basis 복원, Cloud Run free-tier limit(`cpu=1`, `memory=512Mi`) 확인
  - Vercel usage 재확인: effective `1.3446 USD`, billed `0.0000 USD`, chargeCount `1218`

### Completed (2026-05-03 #276)
- [x] AI Streaming UI 개선 S3 local implementation
  - Cloud Run single-agent stream이 AI SDK `fullStream`의 `tool-call` / `tool-result`를 읽어 `agent_step` start/done event를 조기 방출하도록 추가
  - UIMessageStream response 변환에서 `agent_step`을 `data-agent-step`으로 매핑해 underscore event drift를 제거
  - 프론트 `onData` 처리에서 `data-agent-step`을 `InlineAgentStatus`용 `processing` / `completed` 상태로 정규화
  - S3는 Cloud Run runtime 변경이므로 실제 사용 반영에는 GitLab push/deploy와 targeted QA 기록이 추가로 필요

### Completed (2026-05-03 #275)
- [x] AI Streaming UI 개선 S1/S2
  - `AIWorkspaceMessage`가 마지막 완료 assistant 응답을 `TypewriterMarkdown`으로 재생하지 않고 `MarkdownRenderer`로 즉시 표시하도록 변경
  - `TypewriterMarkdown.tsx`는 실제 import 사용처가 0건이 되어 삭제
  - `StreamingWarmupIndicator`가 `estimatedWaitSeconds` 기준 남은 시간 카운트다운과 접근 가능한 `progressbar`를 표시하고, 0초 도달 시 "거의 다 됐습니다"로 전환
  - S3 `agent-step` streaming event는 Cloud Run stream contract 변경이므로 별도 작업으로 유지

### Completed (2026-05-03 #274)
- [x] AI Assistant Architecture Evolution M7 (`MonitoringFactPack` + eval guard)
  - `MonitoringFactPack` builder 추가: 기존 monitoring snapshot의 `sourceMode`, `queryAsOf`, `evidenceRefs`를 보존하고 `cpu/memory/disk/network` severity는 LLM/riskSignals가 아니라 deterministic threshold rule로 재계산
  - replay-json monitoring snapshot에 `factPack`을 붙여 tool result 내부에서 canonical fact bundle을 바로 사용할 수 있게 정렬
  - `evaluateRetrievalRecallGuard()` 추가: Knowledge Retrieval Lite 결과가 최소 evidence 기준 미달이면 `insufficient_evidence` fallback reason을 노출
  - `getStaleProviderModelPolicyFindings()` 추가: 외부 provider 호출 없이 `smokeEvidence` 날짜 기반으로 stale provider policy metadata를 탐지
  - spec/failing test commit 후 구현 commit으로 분리. 신규 LLM/provider 호출, Cloud Run route surface 변경, 인프라 증설 없음

### Completed (2026-05-03 #273)
- [x] AI Assistant Architecture Evolution M6 (`/api/ai/ask` wrapper-only facade)
  - 신규 `/api/ai/ask` POST facade 추가: 기본 `stream`은 기존 `/api/ai/supervisor/stream/v2`, 명시 `job`은 `/api/ai/jobs`, artifact transport는 기존 incident/monitoring route로 위임
  - facade 내부에서 별도 planner/route decision을 만들지 않고 기존 route가 생성/보존하는 `RouteDecision`/`AssistantPlan`/`AssistantResult` metadata를 그대로 전달
  - `NEXT_PUBLIC_AI_ASK_FACADE_ENABLED=true`일 때 streaming frontend path가 `/api/ai/ask`를 쓰도록 opt-in 연결. 기본값은 기존 stream endpoint 유지
  - spec/failing test commit 후 구현 commit으로 분리. 신규 LLM/provider 호출, Cloud Run route 변경, 기존 route 삭제 없음

### Completed (2026-05-03 #272)
- [x] AI Assistant Architecture Evolution M5 review fixes
  - shadow planner request latency 측정을 candidate/drift 생성 이후로 이동해 p95 rollout gate 관측값이 0으로 고정되지 않도록 수정
  - latency 회귀 테스트 추가: planner candidate 생성 중 query content가 실제로 읽힌 뒤의 elapsed time만 `plannerShadow.latencyMs`에 반영
  - 신규 shadow planner mirror 타입을 object type alias로 정리해 assistant contract와 Cloud Run supervisor type style을 일관화

### Completed (2026-05-03 #271)
- [x] AI Assistant Architecture Evolution M5c (thinking route delta measurement)
  - `analysisMode=thinking`을 provider-native reasoning이 아닌 app-level routing-intensity toggle로 명확히 고정
  - frontend route decision helper를 분리해 auto/thinking On-Off corpus를 테스트로 측정: job queue `auto 2/6` → `thinking 4/6`, `streaming → job-queue` 전환 2건
  - Cloud Run supervisor mode corpus를 테스트로 측정: multi `auto 2/6` → `thinking 4/6`, `single → multi` 전환 2건
  - `modeSelectionSource=analysis_mode_thinking`은 thinking 버튼이 실제 승격 원인인 경우에만 표시하고, 원래 multi인 RCA/report/topology 요청은 `auto_complexity`로 유지
  - 신규 LLM/provider 호출, route/API shape 변경, Cloud Run/Vercel surface 변경 없음
  - 검증: targeted route/supervisor suites, root `type-check`, `lint`, `test:quick`, AI Engine targeted supervisor suite

### Completed (2026-05-03 #270)
- [x] AI Assistant Architecture Evolution M5b (shadow planner + drift + escalation)
  - frontend stream transport와 BFF job route가 local `RouteDecision`을 public-safe 형태로 Cloud Run에 전달하도록 연결
  - Cloud Run supervisor가 기존 실행 authority는 바꾸지 않고 `plannerShadow` candidate, `executionMode`, escalation reason, drift reason, latency metadata를 `AssistantPlan`에 보존
  - 단순 metric/server snapshot artifact는 deterministic candidate로 유지하고 RCA/report/advisor/vision만 multi-agent escalation candidate가 되도록 guard 추가
  - M5 rollout 기준 corpus 50개를 unit test로 고정: mismatch 허용치 `≤5/50`, shadow planner latency `≤200ms`, 신규 LLM/provider 호출 없음
  - 검증: root targeted M5b suites, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `test`

### Completed (2026-05-03 #269)
- [x] AI Assistant Architecture Evolution M5a (contract + baseline)
  - `AssistantPlan.executionMode` contract를 `deterministic` / `single-agent` / `multi-agent`로 확장하고 legacy plan normalize는 optional metadata 없이도 유지
  - `escalationReasonCodes`, `plannerShadow`, drift reason normalizer를 public-safe allowlist로 정규화해 owner/internal/provider raw error fragment를 client metadata에서 차단
  - frontend artifact path는 deterministic executionMode를 표시하고, frontend stream/job decision 및 Cloud Run supervisor current behavior baseline을 회귀 테스트로 고정
  - 검증: targeted M5a suites, metadata restore/job SSE suites, root `type-check`, root `lint`, root `test:quick`, root `test:contract`, AI Engine `type-check`, AI Engine `test`

### Completed (2026-05-03 #268)
- [x] AI Assistant Architecture Evolution M5-B work plan
  - 현재 실제 동작 surface를 frontend artifact path, frontend stream/job decision, Cloud Run supervisor mode로 분해해 기존 계획서에 반영
  - M5 구현 전 baseline corpus, `executionMode` contract spec, Cloud Run shadow planner, drift corpus, multi-agent escalation guard, rollout decision 단계 추가
  - 신규 계획서 생성 없이 기존 [ai-assistant-architecture-evolution-plan.md](archive/ai-assistant-architecture-evolution-plan.md)에 작업 계획을 통합
  - 검증: `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check`

### Completed (2026-05-03 #267)
- [x] AI Assistant Architecture Evolution M5-A planning
  - 기존 [ai-assistant-architecture-evolution-plan.md](archive/ai-assistant-architecture-evolution-plan.md)에 multi-agent 유지/축소 판단을 M5 하위 계약으로 편입
  - multi-agent는 폐기하지 않고 RCA/report/vision/advisory/cross-domain evidence용 escalation path로 유지하며, 기본 실행 모델은 deterministic/single로 낮추는 방향을 명시
  - 신규 계획서 생성 없이 기존 M5 Cloud Run Planner shadow mode 범위에 `executionMode`, escalation reason, drift metadata 테스트 시나리오 추가
  - 검증: `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check`

### Completed (2026-05-03 #266)
- [x] AI Assistant Architecture Evolution M4
  - `ArtifactEnvelope`/artifact versioning contract helper 추가: `artifactVersion`, `sourceMode`, `dataSlot`, `traceId`, `evidence`, public-safe `providerSummary`
  - 기존 card payload shape는 유지하고 신규 incident/monitoring/server-snapshot artifact 생성 결과에 envelope-compatible metadata를 부여
  - legacy artifact payload는 `readArtifactEnvelope()`에서 `sourceMode='restored-legacy'`로 정규화
  - 검증: targeted artifact/history/card tests, `type-check`, `lint`, `test:quick`, `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check`

### Completed (2026-05-03 #265)
- [x] AI Assistant Architecture Evolution M3
  - [ai-assistant-architecture-evolution-plan.md](archive/ai-assistant-architecture-evolution-plan.md)를 M3 범위 Approved로 정리하고 기준 문서 정합성 보정
  - `ai-assistant-initial-design-comparison.md`가 M2 실제 read-only `AssistantPlan`/`AssistantResult` contract와 future authoritative planner target을 분리해서 설명하도록 수정
  - 종합 점수 분모를 9개 기준 기준 `/45`로 정정하고 M4~M7 gap table 추가
  - 웹/공식 문서 기준으로 현재 상태를 Option A 개선 중간 단계로 명시하고, AI SDK v6 `Output.object` 방향, Vercel route/runtime duration 표현, tool guardrail/eval/OTel observability/token limit 관점 보강
  - 검증: `npm run docs:budget`, `npm run docs:ai-consistency`, `git diff --check`

### Completed (2026-05-03 #264)
- [x] AI Assistant AssistantPlan/AssistantResult facade M2
  - `AssistantPlan`/`AssistantResult` read-only facade를 `RouteDecision` 위에 추가하고 routing authority는 변경하지 않음
  - frontend artifact/stream/job metadata, BFF job response/Redis metadata, Cloud Run supervisor stream metadata, history/restore/SSE 경로에 facade 보존
  - 검증: root targeted facade suite `144/144`, AI Engine supervisor targeted `1/1`, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `test`

### Completed (2026-05-03 #263)
- [x] AI Assistant routeDecision metadata M1
  - `RouteDecision` read-only contract를 frontend streaming/job/artifact metadata, BFF job metadata, Cloud Run supervisor stream metadata에 연결
  - chat history/message restore, async SSE, stream done metadata에서 routeDecision을 normalize/persist하도록 보강
  - AssistantPlan/AssistantResult facade와 routing authority 이전은 다음 단계로 남기고, 기존 라우팅 동작은 변경하지 않음
  - 검증: root targeted routeDecision suite `100/100`, AI Engine targeted `1/1`, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `test`, `docs:budget`, `docs:ai-consistency`, `git diff --check`

### Completed (2026-05-03 #262)
- [x] Artifact/AI response regression hardening follow-up
  - artifact intent deterministic corpus를 `112 → 121` 케이스로 확장해 server snapshot mixed-language 실행 요청, broad status 질문, snapshot negation/guidance false-positive 방어를 고정
  - server snapshot legacy 복원 payload에서 `summary` 누락 시 Markdown/Card가 `undefined`를 노출하지 않도록 shared summary reader 추가
  - AI response normalizer와 Cloud Run stream text guard가 AI SDK `tool-call` shape를 raw 본문으로 노출하지 않도록 보강하고, provider 내부 오류 JSON은 사용자 본문에서 차단
  - job metadata sanitizer unit test로 owner/internal metadata와 secret-bearing provider error fragment 차단을 고정
  - 검증: targeted root tests 54/54, artifact intent benchmark 121/121, AI Engine targeted 5/5, root `type-check`, `lint`, `test:quick`, `test:contract`, AI Engine `type-check`, AI Engine `test`, `docs:components:verify`, `git diff --check`

### Completed (2026-05-03 #261)
- [x] Server Snapshot Artifact P3 maintenance
  - `generateServerSnapshotArtifact()`가 pre-aborted/mid-flight `AbortSignal`을 `AbortError`로 처리하도록 보강하고, 서버 스냅샷 복원 reader를 export해 Markdown/UI fallback을 공유
  - `ServerSnapshotArtifactCard`는 shared reader를 사용하되 UI 표시 cap(`slice(0, 3)`)은 card 내부에 유지
  - 검증: targeted artifact/chat/card tests 26/26, `type-check`, `lint`, `test:quick`, `test:contract`, `git diff --check`
  - Release/QA: `v8.11.85` GitLab tag pipeline green, production `/api/version` version+commit 확인, [QA-20260503-0395](../qa/runs/2026/qa-run-QA-20260503-0395.json) `13/13`

### Completed (2026-05-02 #260)
- [x] AI Assistant Server Snapshot Artifact Expansion
  - [archive/ai-assistant-artifact-improvement-plan.md](archive/ai-assistant-artifact-improvement-plan.md) Phase 4 완료: `ServerSnapshotArtifact` 타입, `generateServerSnapshotArtifact()`, `ServerSnapshotArtifactCard`, chat/sidebar/workspace/history metadata 연결
  - intent classifier rule version을 `2026-05-02-v2`로 올리고 `server-snapshot` kind + `snapshot-artifact` corpus category 추가
  - broad `서버 상태 알려줘`, `현재 서버 상태 분석해줘`, `CPU 높은 서버 원인 분석해줘`는 일반 채팅으로 유지하고, `서버 상태 스냅샷`, `전체 인프라 상태 카드`, `server snapshot export`처럼 artifact-shaped 요청만 실행
  - 비용/사용량 계약: 신규 LLM/API/Cloud Run/DB write 없음. snapshot generator는 `MetricsProvider`/OTel static data만 read-only 사용
  - 평가 기록: [artifact-intent-benchmark-2026-05-02.md](../docs/artifact-intent-benchmark-2026-05-02.md) `112/112`
  - 검증: targeted artifact suite 59/59, `type-check`, `lint`, `test:quick`, `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check`
  - Production QA: [QA-20260503-0394](../qa/runs/2026/qa-run-QA-20260503-0394.json) `10/10`, Vercel billed `0.0000 USD`, snapshot flow Cloud Run/LLM artifact endpoints 미호출 확인

### Completed (2026-05-02 #259)
- [x] Artifact intent benchmark compatibility and category coverage
  - canonical fixture path `tests/fixtures/artifacts/intent-corpus.ts` 추가 및 기존 `chat-artifact-intent` 경로는 re-export로 호환 유지
  - corpus case에 `category` 필드를 추가하고 guidance/none false-positive 방어 케이스를 `74 → 102`로 확장
  - `tests/artifacts/intent-classifier.bench.ts` wrapper와 class/category별 support + accuracy guard 추가

### Completed (2026-05-02 #258)
- [x] Artifact intent architecture documentation alignment
  - `ai-engine-architecture.md` Module 1 ASCII map을 실제 classifier 순서와 맞춰 guidance priority, negation scope, report action tokens, rule version, eval guard 기준을 보정
  - `frontend-backend-comparison.md`의 분석 일시/버전/SSOT route counts와 artifact intent 전처리 설명을 2026-05-02 기준으로 갱신

### Completed (2026-05-02 #257)
- [x] Artifact intent deterministic local classifier evaluation 추가
  - `ARTIFACT_INTENT_RULE_VERSION=2026-05-02-v1`를 classifier 결과에 포함하고 corpus version과 일치하도록 검증
  - 102개 deterministic seed corpus로 `incident-report`, `monitoring-analysis`, `guidance`, `none` intent를 평가
  - confusion matrix + precision/recall 계산 유틸과 Vitest local classifier guard 추가
  - `incident-report` / `monitoring-analysis` local classifier precision `>= 0.94`를 `test:quick`에서 방어
  - `guidance` / `none` 포함 전체 클래스가 최소 1회 이상 예측되고 precision/recall `>= 0.90`을 유지하도록 drift guard 추가
  - `현재 서버 상태 분석해줘`, `서버 분석해줘`, `CPU 높은 서버 원인 분석해줘` 같은 일반 운영 분석 쿼리는 artifact 실행으로 라우팅하지 않도록 회귀 케이스 추가
  - 평가 결과 기록: [artifact-intent-benchmark-2026-05-02.md](../docs/artifact-intent-benchmark-2026-05-02.md)
  - 검증: artifact intent targeted local classifier evaluation 102/102

### Completed (2026-05-02 #256)
- [x] Mistral fallback 무료 티어 기본값 보정
  - `MISTRAL_MODEL_ID` 기본값을 `mistral-large-latest`에서 `mistral-small-latest`로 낮춰 last-resort fallback의 무료 티어 소모를 줄임
  - Mistral 모델 목록/직접 호출 확인 결과를 반영해 런타임 메타데이터, provider route, AI provider UI copy, free-tier/architecture/resilience 문서를 정렬
  - Groq Llama 4 Scout 무료 한도 문서 오기(`500K TPM`)를 `30K TPM / 500K TPD`로 수정
  - 아티팩트 LLM fallback 앞에 로컬 후보 게이트를 추가해 일반 채팅이 추가 분류기 호출을 만들지 않도록 보정
  - `/api/ai/artifact-intent`에 AI rate limiter, deterministic structured output 옵션, route regression tests를 추가하고 intent 분류 중 중복 전송을 차단
  - Vercel env sync 경로에 `MISTRAL_API_KEY`를 optional로 추가하고, GCP 소액 과금 원인을 Secret Manager active versions 초과 가능성으로 문서화
  - Follow-up review: LLM intent 분류 중 artifact loading UI가 켜지지 않도록 조정하고, `MISTRAL_MODEL_ID`가 Cloud Run 전용 override임을 env 문서에 명시
  - Architecture docs/tests follow-up: Artifact Intent / Provider Fallback / Multi-Agent 3개 기능 모듈 ASCII 맵 추가, provider routing stale copy 보정, classifier pending loading 회귀 테스트 추가

### Completed (2026-05-02 #255)
- [x] AI Assistant 아티팩트 intent reason code 보강
  - `artifactIntentReason` metadata를 아티팩트 실행/가이던스 응답에 보존해 QA와 디버깅에서 분기 원인 추적 가능
  - `추세` 단독은 일반 채팅으로 유지하고, `추세 분석` 같은 artifact-shaped phrase만 implicit 실행하는 비대칭 정책 주석 추가
  - 검증: artifact intent, chat core, message metadata/history targeted tests 55/55

### Completed (2026-05-02 #254)
- [x] AI Assistant 아티팩트 intent 키워드형 요청 보강
  - `장애보고서`, `장애 보고서 부탁`, `추세 분석`, `이상감지`, `장애 예측 추세 분석`처럼 짧은 키워드형 요청도 실행 intent로 분류
  - `작성 방법`, `파일 형식 설명`, `기능 설명` 같은 안내 요청은 guidance로 유지해 불필요한 API 호출 방지
  - 검증: targeted artifact intent/chat/card/input tests 27/27, `type-check`, `lint:changed`

### Completed (2026-05-02 #253)
- [x] AI Assistant 아티팩트 guardrail 보강
  - 공식 문서 기준으로 Route Handler surface, 런타임 응답 검증, 중복 제출 방지, persisted metadata 복원 내성을 재점검
  - 아티팩트 생성 중 `isLoading`/disabled/in-flight guard와 fetch abort를 연결해 중복 Cloud Run 호출을 차단하고 중단 버튼 의미를 정렬
  - 이상감지/추세 아티팩트 응답을 카드가 사용하는 `slot`, `evidenceRefs`, `dataFreshness`까지 Zod로 검증하고 legacy 복원 payload는 안전 fallback으로 렌더링
  - 모호한 기능 설명 질문은 외부 API 호출 없이 guidance로 처리하고, incident-report API 카탈로그를 실제 POST-only route surface와 동기화
  - 검증: targeted artifact/chat/input/API-doc tests 30/30, `type-check`, `lint:changed`, `test:quick`, `test:contract`, `docs:budget`, `lint`, `docs:components:map`, `docs:components:verify`

### Completed (2026-05-02 #252)
- [x] 주기 작업/Cron 운영 계약 정리
  - Vercel Cron, Cloud Scheduler, Cloud Run Jobs, Supabase pg_cron 비활성 상태와 Cloud Tasks request-driven 경계를 free-tier/architecture/requirements 문서에 반영
  - GitHub scheduled workflow는 `ENABLE_ACTIONS_SCHEDULES` opt-in guard가 필요하고, GitLab schedule rule은 Artifact Registry cleanup 관측 전용임을 명확화
  - 랜딩 클라우드 카드/기술 스택/다이어그램에 Cloud Tasks를 요청 기반 AI job delivery 큐로 추가
  - `periodic-jobs-contract` 회귀 테스트 추가로 Vercel cron 비활성, GitHub schedule guard, GitLab schedule 범위 유지 검증
  - 컴포넌트 맵 검증 스크립트가 dirty-but-current 생성물을 false negative로 실패시키던 문제를 수정하고 회귀 테스트 추가
  - 검증: `test:contract`, `docs:components:map`, `docs:components:verify`, `docs:budget`, targeted component-map/periodic tests, `type-check`, `lint`, `test:quick`, `git diff --check`

### Completed (2026-05-02 #251)
- [x] 랜딩 카드 아티팩트/검색/배포 설명 정합성 보정
  - 4개 소개 카드의 AI 아티팩트, Knowledge Retrieval Lite, GitLab CI 배포 권한 문구를 현재 런타임 기준으로 정리
  - card modal/architecture diagram/요구사항/free-tier 문서의 `pgVector`/하이브리드 RAG/자동 배포 표현을 BM25 RPC, 요청 기반 Web Search, GitLab CI deploy gate 기준으로 동기화
  - 랜딩 데이터 회귀 테스트 추가로 오래된 검색·배포·버전 문구 재유입 방지
  - 검증: feature card targeted tests 7/7, `npm run docs:budget`, `npm run docs:ai-consistency`, `npm run type-check`, `npm run lint`, `npm run test:quick`, `git diff --check`

### Completed (2026-05-02 #250)
- [x] AI Assistant 아티팩트 client-only 강화
  - 장애 보고서 아티팩트 카드에 영향 서버 상세 링크, 권장 조치, 이상 징후, 타임라인 요약 표시 추가
  - 이상감지/추세 아티팩트 카드에 source/기준 시각, 위험 신호, 근거 요약, 서버 상세 링크 표시 추가
  - 기존 `IncidentReportArtifact` / `MonitoringAnalysisArtifact` metadata만 사용해 추가 AI/API/DB 호출 없이 렌더링
  - 검증: artifact card targeted tests 4/4, artifact/chat/history/route targeted tests 42/42, `npm run test:quick`, `npm run type-check`, `npm run lint`

### Completed (2026-05-02 #249)
- [x] 장애 보고서 free-tier 단순화
  - `/api/ai/incident-report`를 POST `generate` 전용으로 정리하고 GET 히스토리/PATCH 해결 API surface 제거
  - Cloud Run 보고서 생성 결과의 Supabase `incident_reports` 저장을 제거해 DB write/read/update 부담 제거
  - Auto Report 페이지에서 히스토리 탭과 DB 기반 history table/filter hook 제거, 해결 완료는 세션 내 상태만 변경
  - free-tier 문서와 요구사항 문서에 "세션 내 아티팩트 + 다운로드" 운영 결정을 반영
  - 검증: targeted route/AutoReport/artifact tests 40/40, type-check, lint, test:quick, test:contract, docs:budget, docs:ai-consistency, `git diff --check`

### Completed (2026-05-02 #248)
- [x] AI Assistant 사용자-facing 아티팩트 개선
  - 채팅에서 명시적인 장애 보고서 작성/다운로드 요청을 일반 LLM 응답 대신 기존 `/api/ai/incident-report` 1회 호출로 전환
  - 채팅에서 명시적인 이상감지/추세 분석 요청을 기존 `/api/ai/intelligent-monitoring` batch 1회 호출로 전환
  - 사이드바/전체 페이지 공통 메시지에 장애 보고서 및 이상감지/추세 아티팩트 카드, MD/TXT/JSON 다운로드, 기능 화면 이동 액션 추가
  - 모호한 기능 문의는 외부 API 호출 없이 사용 안내만 응답하도록 분리해 사용량 증가를 제한
  - 검증: targeted artifact/chat/history tests 22/22, type-check, lint, test:quick, test:contract, `git diff --check`

### Completed (2026-05-02 #247)
- [x] Cerebras finalAnswer schema tolerance
  - Cerebras 공식 Chat Completions/tool-use/rate-limit 문서와 직접 REST/AI SDK 스모크로 원인 재분류: RPM quota가 아니라 `finalAnswer.toolsUsed` 배열 필드가 JSON 문자열로 들어오는 tool-call schema drift 확인
  - `finalAnswer` 도구 입력에서 `toolsUsed` JSON 문자열 배열 및 comma-separated 문자열을 `string[]`로 정규화해 tool-error/empty response fallback 가능성 축소
  - 회귀 테스트 추가: `cloud-run/ai-engine/src/tools-ai-sdk/final-answer.test.ts`
  - 검증: Cerebras direct REST/AI SDK smoke, `cloud-run/ai-engine npx vitest run src/tools-ai-sdk/final-answer.test.ts`, `cloud-run/ai-engine npm run type-check`, `cloud-run/ai-engine npm run test`

### Completed (2026-05-02 #246)
- [x] AI provider fallback observability hardening
  - Redis quota atomic reservation Lua script에서 예약어 `until` dot access를 bracket access로 수정해 `EVAL` syntax error 제거
  - Async job SSE 결과의 `provider`, `modelId`, `providerAttempts`, `usedFallback`, `fallbackReason`, `ttfbMs`를 assistant metadata까지 보존
  - 클라이언트 전달 metadata sanitizer에서 provider attempt 오류 메시지의 bearer/API-key 형태 토큰 redaction 및 길이 제한 적용
  - 분석 근거 디버그 탭에 provider 시도 순서, 최종 provider/model, fallback 여부, 전환 사유, TTFB를 표시해 Cerebras/Groq/Mistral 전환 원인 확인 가능
  - 검증: targeted SSE/message/analysis-basis/stream route tests, AI Engine quota targeted test, root/AI Engine type-check, `npm run lint`, `npm run test:quick`, `npm run test:contract`, `cloud-run/ai-engine npm test`

### Completed (2026-05-02 #245)
- [x] AI Chat multi-agent raw tool-call JSON/blank response residual fix
  - Production v8.11.78 재현에서 raw JSON 직접 노출은 사라졌으나 두 번째 질문 job result가 raw function-call JSON으로 저장되고 UI 응답 본문이 빈 상태로 표시되는 잔여 증상 확인
  - multi-agent `orchestrator-agent-stream`에도 structured text guard를 적용해 raw function/tool-call JSON 텍스트 델타 suppress 및 provider fallback 처리
  - frontend fallback을 빈 문자열 대신 안전 안내문으로 전환해 legacy/cached job result에서도 빈 assistant 버블 방지
  - 검증: targeted normalizer/orchestrator-agent-stream tests, root/AI Engine type-check, `npm run lint`, `npm run test:quick`, `npm run test:contract`, `cloud-run/ai-engine npm test`

### Completed (2026-05-02 #244)
- [x] AI Chat raw tool-call JSON 노출 방지
  - Cloud Run supervisor stream에 structured text guard를 추가해 raw function/tool-call JSON 텍스트 델타 suppress 및 provider fallback 처리
  - frontend `normalizeAIResponse`에도 동일 payload 표시 차단 fallback 추가
  - 검증: targeted normalizer/message helper/AI Engine stream guard tests, root/AI Engine type-check, `npm run lint`, `npm run test:quick`, `npm run test:contract`, `cloud-run/ai-engine npm test`

### Completed (2026-05-01 #243)
- [x] 제품 외 보조 route 정리
  - `/validation` QA evidence page 제거, post-deploy smoke HTML 확인 대상을 `/login`으로 전환
  - `/auth/success` 레거시 OAuth 성공 페이지 제거, 현재 OAuth 표준 경로 `/auth/callback` 유지
  - validation page 전용 컴포넌트/테스트/상수 제거 및 CI/CD/public README 문구 정리
  - 검증: route cleanup targeted tests 16/16, `npm run type-check`, `npm run lint:changed`, `npm run test:quick`, `npm run docs:budget`, `npm run docs:ai-consistency`, `npm run docs:components:map`, `git diff --check`

### Completed (2026-05-01 #242)
- [x] Dashboard 알림 로딩 상태 및 모바일 내비게이션 접근성 보강
  - `ActiveAlertsPanel` 로딩/에러/empty 상태를 분리하고 알림 route에서 monitoring loading/error props 전달
  - 활성 알림 초기 로딩을 중앙 스피너 대신 skeleton row로 전환해 체감 대기 시간 개선
  - 모바일 drawer ESC 닫기, focus trap, 닫힘 후 메뉴 버튼 focus 복귀 보강
  - 테스트 보강: ActiveAlertsModal 로딩/에러 상태, DashboardRoutedContent active alert panel 상태 전달, DashboardNavigation mobile a11y
  - 검증: targeted dashboard tests 15/15, `npm run type-check`, `npm run lint:changed`, `npm run test:quick`, `npm run docs:budget`, `npm run docs:ai-consistency`, `npm run docs:components:verify`, `git diff --check`

### Completed (2026-05-01 #241)
- [x] Dashboard Log→Alert 역방향 크로스링크
  - Plan completed: [dashboard-log-alert-crosslink-plan.md](archive/dashboard-log-alert-crosslink-plan.md)
  - `AlertHistoryPanel`에 `initialServerId` 계약을 추가하고 `/dashboard/alerts?server=...` 및 legacy `serverId` query를 초기 서버 필터로 연결
  - `LogExplorerModal` 로그 행/반복 그룹 상세 행에 서버별 "알림" 버튼 추가, URL encoding 및 no-param fallback 테스트 보강
  - 서버 상세 `로그 & 네트워크` 탭에 같은 서버 알림 이력 이동 버튼 추가
  - 검증: targeted tests 23/23, `npm run type-check`, `npm run lint`, `npm run test:quick`, `git diff --check`, local browser QA 통과

### Completed (2026-05-01 #240)
- [x] 서버 상세 페이지 2가지 버그 수정
  - Plan completed: [dashboard-server-detail-fix-plan.md](archive/dashboard-server-detail-fix-plan.md)
  - `LogsTab.parts`의 LegacyLogView/StreamsView dark 배경 잔재를 white UI로 정리하고 Streams empty state를 한국어로 통일
  - `normalizeServerData`에 서버 ID 기반 타입 추론 fallback 추가, `ServerDetailView` 헤더 타입 라벨 표시 개선
  - Next.js 16 `cacheComponents` 환경에서 `/dashboard/servers/{serverId}` 상세 route가 404/500으로 흔들리지 않도록 registry 기반 `generateStaticParams` 추가
  - 검증: targeted tests 44/44, `npm run type-check`, `npm run lint:changed`, `git diff --check`, Chrome DevTools UI 확인 통과

### Completed (2026-05-01 #239)
- [x] orchestrator-summary-fallback operational/status builder 분리
  - Plan completed: [ai-engine-code-quality-plan.md](archive/ai-engine-code-quality-plan.md) Task 3-B.3
  - operational characterization tests 보강: critical 우선순위, offline operational section, metric ranking drift 방지
  - `orchestrator-summary-operational.ts` 추가: status/explicit-server operational predicates, action/recommendation/trend/summary builders 분리
  - `orchestrator-summary-fallback.ts`는 deterministic facade와 metric/operational builder dispatch만 유지
  - SDD 선행 테스트 커밋: `8fac9e02c test(spec): characterize summary operational builders`
  - 구현 커밋: `53f90b623 refactor(ai-engine): extract summary operational builders`
  - 검증: summary/routing/stream targeted tests 56/56, AI Engine type-check, AI Engine test 951/951, `lint:changed`, `git diff --check` 통과

### Completed (2026-05-01 #238)
- [x] orchestrator-summary-fallback metric builder 분리
  - Plan partial completed: [ai-engine-code-quality-plan.md](archive/ai-engine-code-quality-plan.md) Task 3-B.2
  - metric characterization tests 보강: partial filter summary, trusted filter rows, network ranking, ascending CPU ranking
  - `orchestrator-summary-metric.ts` 추가: metric threshold/ranking builders and private metric helpers 분리
  - `orchestrator-summary-fallback.ts`는 public facade와 operational/status renderer 유지
  - SDD 선행 테스트 커밋: `a3e9de9aa test(spec): characterize summary metric builders`
  - 구현 커밋: `0ee776526 refactor(ai-engine): extract summary metric builders`
  - 검증: summary/routing/stream targeted tests 54/54, AI Engine type-check, AI Engine test 949/949, `lint:changed`, `git diff --check` 통과

### Completed (2026-05-01 #237)
- [x] orchestrator-summary-fallback payload adapter 분리
  - Plan partial completed: [ai-engine-code-quality-plan.md](archive/ai-engine-code-quality-plan.md) Task 3-B.1
  - public facade characterization tests 보강: payload precedence, malformed getServerMetrics, empty status filter summary
  - `orchestrator-summary-payload.ts` 추가: payload types, tool result parsing, current-state payload construction, evidence count helper 분리
  - `orchestrator-summary-fallback.ts`는 기존 public facade와 renderer/query builder 로직 유지
  - SDD 선행 테스트 커밋: `8258a3700 test(spec): characterize summary fallback payload behavior`
  - 구현 커밋: `3d32ca798 refactor(ai-engine): extract summary payload adapter`
  - 검증: summary/routing/stream targeted tests 50/50, AI Engine type-check, AI Engine test 945/945, `lint:changed`, `git diff --check` 통과

### Completed (2026-05-01 #236)
- [x] orchestrator-routing AgentFactory 경로 분리
  - Plan partial completed: [ai-engine-code-quality-plan.md](archive/ai-engine-code-quality-plan.md) Task 3-A
  - `executeWithAgentFactory`, `getAgentTypeFromName`을 `orchestrator-factory.ts`로 이동
  - `orchestrator-routing.ts`는 기존 import/mock 호환을 위해 re-export 유지
  - SDD 선행 테스트 커밋: `88e5ff5ae test(spec): orchestrator factory split contract`
  - 구현 커밋: `ae8aef08d refactor(ai-engine): extract orchestrator factory execution`
  - 검증: targeted routing/factory/stream tests 43/43, AI Engine type-check, AI Engine test 942/942, `lint:changed`, `git diff --check` 통과

### Completed (2026-05-01 #235)
- [x] quota-tracker.ts 레이어 분리
  - Plan partial completed: [ai-engine-code-quality-plan.md](archive/ai-engine-code-quality-plan.md) Task 2
  - `quota-types.ts`, `quota-store-memory.ts`, `quota-store-redis.ts` 추가
  - `quota-tracker.ts`는 기존 public facade와 core API를 유지하고 내부 store/config 의존만 분리
  - Redis reservation/reconcile은 memory store에 숨은 write를 하지 않고 facade가 동기화하도록 정렬
  - SDD 선행 테스트 커밋: `5844bb989 test(spec): quota tracker layer split contracts`
  - 구현 커밋: `02685431b refactor(ai-engine): split quota tracker layers`
  - 검증: quota targeted 37/37, facade importer targeted 49/49, AI Engine type-check, AI Engine test 941/941, `lint:changed`, `git diff --check` 통과

### Completed (2026-05-01 #234)
- [x] Dashboard Server & Log UX 개선
  - Plan completed: [dashboard-server-log-ux-plan.md](archive/dashboard-server-log-ux-plan.md)
  - Phase 1: 서버 카드 상태 accent, 임계치 메트릭 강조, 로그 ERROR 행/통계 필터 정렬 완료
  - Phase 2: 서버 리스트/그리드 보기 토글, 정렬 셀렉트, 로그 1줄 압축/확장 완료
  - Phase 3: 서버 카드 로그 cross-link, URL 기반 서버 필터, 반복 로그 그룹핑, 50개 청크+페이지 로드 완료
  - QA 보정: 로그 통계 필터 버튼을 44px touch target으로 보강
  - SDD 선행 테스트 커밋: `1fb32767b test(spec): dashboard server log phase3 contracts`
  - 구현 커밋: `73eda44f9 feat(dashboard): implement server log phase3 interactions`
  - QA 보정 커밋: `94487ec80 fix(dashboard): improve stat filter touch targets`
  - 검증: targeted dashboard/log tests 64/64, QA 보정 targeted tests 13/13, root type-check, `lint:changed`, `test:quick`, `git diff --check`, local Playwright MCP QA 통과

### Completed (2026-04-30 #233)
- [x] approval write 레이어 제거
  - Plan completed: [ai-engine-code-quality-plan.md](archive/ai-engine-code-quality-plan.md) Task 1
  - `ApprovalStore` class, Memory Map, Redis sync, TTL cleanup, pending/decision write APIs 제거
  - `/approval/history`, `/approval/history/stats`는 Supabase read 함수 직접 호출로 정렬
  - `approval-store.ts`는 `fetchApprovalHistory`, `fetchApprovalHistoryStats` read-only facade로 축소
  - SDD 선행 테스트 커밋: `19aefcc0b test(spec): approval store add read-only contract specs`
  - 구현 커밋: `862571a4f refactor(ai-engine): remove approval write layer`
  - 검증: targeted approval tests 9/9, AI Engine type-check, `cloud-run/ai-engine npm test` 938/938 통과

### Completed (2026-04-30 #232)
- [x] Cerebras Qwen deprecation 대응
  - Plan completed: [ai-engine-code-quality-plan.md](archive/ai-engine-code-quality-plan.md) Task 4
  - Cerebras runtime default를 `llama3.1-8b`로 전환하고 Qwen 235B Preview는 excluded metadata/override 감지용으로만 유지
  - 16K/32K context 요구 경로는 8K Cerebras runtime을 건너뛰고 Groq/Mistral fallback으로 이동하도록 capability gate 정렬
  - Cloud Run deploy env에 `CEREBRAS_MODEL_ID=llama3.1-8b`, 빈 `CEREBRAS_FALLBACK_MODEL_IDS` 명시
  - Release: `v8.11.76`, GitLab tag pipeline `2491551446` success, Cloud Run revision `ai-engine-00391-qvf`, Vercel deployment `dpl_5FNfh7toXujQ6CiE4XUsCFtKSDLg`
  - QA: `QA-20260430-0385` targeted release-facing smoke, 7/7 pass, model drift `[]`

### Completed (2026-04-30 #231)
- [x] Dashboard app shell + modal-to-route refactor
  - Plan completed: [dashboard-app-shell-navigation-refactor-plan.md](archive/dashboard-app-shell-navigation-refactor-plan.md)
  - `/dashboard` 좌측 navigation rail과 모바일 drawer 추가, 우측 AI sidebar/session/auto-shutdown 흐름 유지
  - `/dashboard/servers`, `/dashboard/servers/[serverId]`, `/dashboard/alerts`, `/dashboard/logs`, `/dashboard/topology` route 추가
  - Active Alerts, Alert History, Log Explorer, Topology, Server Detail 모달 본문을 page-ready panel/view로 분리하고 기존 modal wrapper는 호환 유지
  - Overview summary/server/top-alert 액션을 모달 상태 대신 route navigation으로 전환
  - `/dashboard?serverId=<id>` legacy deep link를 `/dashboard/servers/<id>`로 redirect
  - 검증: route/unit targeted 18/18, modal panel targeted 22/22, Playwright dashboard targeted 12/12, type-check, test:quick, lint, build, `git diff --check` 통과

### Completed (2026-04-30 #230)
- [x] Monitoring AI data source / Reporter-Analyst grounding
  - Plan completed: [monitoring-ai-data-source-plan.md](archive/monitoring-ai-data-source-plan.md)
  - Cloud Run `MonitoringDataSource` 계약, replay-json provider, live-otel disabled skeleton 추가
  - `/api/ai/monitoring/snapshot`, `/api/ai/monitoring/analyze-batch` endpoint 및 AI SDK monitoring tools 추가
  - Intelligent Monitoring 전체 분석을 Vercel 서버별 fan-out에서 Cloud Run batch proxy 1회 호출로 전환
  - Reporter 결과와 prompt에 monitoring `sourceMode`, `queryAsOf`, `evidenceRefs`, `monitoringTimeline` grounding 추가
  - Side-effect review 보강: Vercel cache key에 `sourceMode`/slot 포함, Analyst/Reporter page와 fullscreen handoff에 dashboard `queryAsOfDataSlot` 전달, metric/log 조회 범위 반영
  - 검증: AI Engine targeted 44/44, Vercel route/UI targeted 39/39, root/AI Engine type-check, lint, `test:quick`, `test:contract` 통과

### Completed (2026-04-30 #229)
- [x] Codex subagent workflow guidance
  - OpenAI Codex 공식 subagents/AGENTS.md guidance 기준으로 `AGENTS.md`에 제한적 subagent 활용 규칙 추가
  - `.codex/config.toml`에 `[agents] max_threads=6`, `max_depth=1` 명시해 병렬 thread cap과 재귀 fan-out 제한을 고정
  - `.codex/backups/subagents-20260430-before.md`에 적용 전 상태와 rollback 절차 기록
  - custom agent TOML은 아직 만들지 않음: 현재는 built-in `explorer`/`worker`/`default`로 충분하고, 역할이 반복적으로 안정화된 뒤 추가하는 쪽이 비용/복잡도 측면에서 안전

### Completed (2026-04-30 #228)
- [x] Generate service quota admission fallback
  - `/api/ai/generate` raw Cerebras-only path를 shared `generateTextWithRetry()` 경로로 전환
  - Cerebras → Groq → Mistral provider fallback, quota admission reservation/reconcile, cooldown 경로를 legacy generate endpoint에도 적용
  - `topP`와 explicit Cerebras `options.model` override를 shared retry helper에서 보존
  - `generate/stream`은 동일 quota-aware generation path를 재사용해 raw Cerebras stream 우회를 차단
  - 회귀 테스트: `generate-service.test.ts`, `generate.test.ts`, `retry-with-fallback.test.ts` targeted 23/23 통과

### Completed (2026-04-30 #227)
- [x] Frontend unused API config cleanup
  - knip가 unused file로 탐지한 `src/lib/api/api-config.ts` 제거
  - health route가 자체 runtime config를 사용하도록 바뀐 뒤 남아 있던 stale `api-config` test mock 제거
  - `generate`/`approval` 라우트와 RAG merge planner는 실제 server route/script 계약에 묶여 있어 이번 dead-code 삭제 범위에서 제외

### Completed (2026-04-29 #226)
- [x] Redis Circuit Breaker + health endpoint degraded 상태 노출
  - `redis-client.ts`에 Circuit Breaker 내장: 연속 3회 실패 → 30초 OPEN → HALF-OPEN probe → 자동 복구
  - OPEN 상태에서 `fetchRedis()` 즉시 null 반환 → 1초 timeout 낭비 없이 in-memory fallback 즉시 진입
  - `isRedisDegraded()` export → `quota-tracker.ts`에서 degraded 진입 시 warn 로그
  - `RedisClient.set()`/`redisSet()`이 circuit open 또는 Redis SET 실패를 `false`로 반환하도록 정렬해 job result 저장 실패 오판을 차단
  - `/health` 응답을 `redis: boolean` → `redis: { configured, degraded, state, retryAfterMs }` 로 구조화하여 운영 가시성 확보
  - `ai-engine-architecture.md` Resilience 섹션: Quota Admission Gate 상세, Redis Circuit Breaker 동작, 장애 시나리오표 갱신
  - 검증: `redis-client.test.ts` Circuit Breaker/write-result 케이스 추가, `job-notifier.test.ts`, `quota-tracker.test.ts` mock 보완, targeted 54/54, `cloud-run/ai-engine npm test` 933/933 통과

### Completed (2026-04-29 #225)
- [x] Provider quota admission gate + cooldown
  - LLM 호출 전에 provider/model별 예상 token과 request를 예약하는 quota admission gate를 추가해 Qwen/Groq/Mistral의 RPM/TPM/RPD 초과 시도를 사전 차단
  - Redis가 가용하면 `EVAL` 기반 atomic reservation/reconcile로 `read → check → reserve → token delta 보정`을 원자화해 Cloud Run multi-instance race를 완화
  - `queue_exceeded`/429 계열 오류가 발생한 provider/model에 90초 cooldown을 기록하고, cooldown 중에는 quota가 남아도 다음 provider로 전환
  - Multi-agent stream 경로와 `generateTextWithRetry` 경로 모두에 gate를 연결하고, 성공/실패 후 예약 token을 실제 usage 또는 0으로 보정
  - 검증: targeted quota/fallback/stream tests 70/70, `cloud-run/ai-engine npm test` 923/923, `cloud-run/ai-engine npm run type-check`, `npm run lint:changed`, `git diff --check` 통과

### Completed (2026-04-29 #224)
- [x] Metric-aware deterministic routing + query hardcode cleanup + stream visibility repair
  - Deterministic formatter가 `cpu/memory/disk/network/status` metric-aware filter/ranking을 지원하고, `filterServers` empty result를 0건 답변으로 포맷
  - `orchestrator-query-intent.ts`가 metric/operator/threshold/rank/status metadata를 반환하도록 보강해 `MEM 90% 이상`, `DISK top N`, `status: warning` 회귀 차단
  - `query-type-classifier.ts` 제거, NLQ instruction layering을 `classifyQueryIntent()` 기반으로 통합
  - `supervisor-routing.ts`의 direct server ID 감지를 resource-catalog 기반 lazy pattern으로 전환하고 metric ranking 강제 라우팅을 intent classifier에 위임
  - Tool 결과가 있는데 모델 본문이 제목/골격만 반환하는 경우 `LOW_INFORMATION_RESPONSE`로 감지해 summarization fallback을 추가 전송
  - Plan completed: [query-routing-hardcode-cleanup-plan.md](archive/query-routing-hardcode-cleanup-plan.md)
  - 검증: `orchestrator-agent-stream.test.ts` 12/12, `cloud-run/ai-engine npm test` 913/913, `cloud-run/ai-engine npm run type-check`, `git diff --check`, `npm run lint:changed` 통과

### Completed (2026-04-29 #223)
- [x] Query intent classifier + queryAsOf slot contract + deterministic routing refactor
  - `orchestrator-query-intent.ts` 신규: regex 3개(한국어/영어 모니터링 키워드) → 6-category 구조적 의도 분류(`data-lookup/filter/ranking` vs `causal-analysis/predictive/advisory`)
  - Deterministic routing 판단 시점을 툴 실행 전 → 후로 이동. intent + tool result server count 기반으로 LLM 우회 여부 결정
  - `query-as-of-context.ts` 신규: AsyncLocalStorage 기반 KST 10분 OTel 슬롯 실행 컨텍스트. 비동기 job의 슬롯 드리프트 방지
  - Provider fallback 강화: `queue_exceeded` / `high traffic` 감지 추가, `maxRetries: 0`으로 재시도 증폭 차단
  - 검증: `orchestrator-summary-fallback.test.ts` 9/9, `jobs.test.ts` 18/18, `server-metrics.test.ts` 22/22, `tsc --noEmit` 통과

### Completed (2026-04-29 #221)
- [x] Vercel Google font build-fetch regression guard
  - `next/font/google` 재도입 시 GitLab self-hosted runner의 build-time `fonts.gstatic.com` fetch 실패가 Vercel prebuilt deploy를 막을 수 있어, active `src` 소스에서 해당 참조를 차단하는 quick test guard를 추가
  - 기존 system/CSS font fallback은 유지하고, 실제 font asset이 필요하면 `next/font/local`로 vendoring하는 정책을 고정
  - 검증: targeted Vitest, `test:quick`, targeted Biome check 통과

### Completed (2026-04-29 #220)
- [x] Deployment drift guard and AI deploy skip
  - Plan completed: [deployment-drift-guard-plan.md](archive/deployment-drift-guard-plan.md)
  - `/api/version`에 `commitSha`, `shortCommitSha`, `releaseTag`, `pipelineUrl`, `deploymentProvider` 메타데이터 추가
  - Vercel post-deploy smoke가 release version과 GitLab commit SHA를 함께 검증하도록 확장
  - QA용 `check-vercel-deployment-drift.mjs` preflight 추가: version/tag/commit mismatch를 deployment drift로 분리
  - semver tag pipeline의 `deploy_ai_engine`/AI smoke가 `cloud-run/ai-engine/**` 변경이 없으면 GCP auth/Cloud Run deploy 전 no-op 처리
  - SDD gate followed: failing tests were committed before implementation
  - 검증: targeted Vitest 17/17, `test:contract`, `test:node:infra:smoke`, `type-check`, `lint`, `test:quick`, GitLab main pipeline `2486506961` success

### Completed (2026-04-29 #219)
- [x] Dashboard modal/search display hardening
  - Plan completed: [dashboard-modal-search-hardening-plan.md](archive/dashboard-modal-search-hardening-plan.md)
  - 랜딩페이지 금지 경로를 제외하고 대시보드 모달만 개선
  - `TopologyModal`, `AILoginRequiredModal` shell을 light mode로 정렬하고 graph/terminal dark 예외를 분리
  - 로그 탐색기 필터 summary/reset, 로그 terminal 높이/줄바꿈, 알림 이력 row wrapping, 서버 상세 metrics/logs panel wrapping 보강
  - OTel 표기를 Vercel public static + KST 24h rotating slot 모델로 정리
  - QA 기록: `QA-20260429-0362`; targeted Vitest 31/31, local Playwright dashboard alerts/logs 6/6, type-check/lint/test:quick 통과

### Completed (2026-04-29 #218)
- [x] AI Assistant mobile full-page de-scope
  - 모바일 `/dashboard/ai-assistant` 진입 시 별도 전체 페이지 워크스페이스를 유지하지 않고 `/dashboard`의 AI 사이드바로 handoff
  - `AIWorkspace`의 모바일 전체페이지 전용 header/function nav 마크업 제거
  - 모바일 사이드바 기능 레일에서는 불필요한 "전체 화면으로 열기" 버튼 숨김
  - 기존 pending draft/function/analysisMode를 보존하면서 `fullscreen` target entry를 `sidebar` target으로 retarget
  - 회귀 테스트: `AIWorkspace` 모바일 handoff, pending fullscreen entry 보존, `AISidebarV4` 모바일 fullscreen button 비노출

### Completed (2026-04-29 #217)
- [x] AI Assistant UX polish
  - Plan completed: [ai-assistant-ux-polish-plan.md](archive/ai-assistant-ux-polish-plan.md)
  - SDD gate followed: failing tests were committed before implementation
  - Typography scale, desktop/mobile target sizes, fullscreen light theme, System Context AI Engine status consolidation, and provider routing active-chip contract implemented
  - Production QA `QA-20260429-0360` passed on `v8.11.57`: desktop body/html light background, mobile 44px action targets, desktop 24px targets, health/version endpoints, GitLab main/tag pipelines, Vercel usage normal
  - QA found and fixed two release-candidate regressions before final pass: global dark body token on `v8.11.55`, and mobile input action buttons at 36px on `v8.11.56`

### Completed (2026-04-28 #216)
- [x] Cloud Tasks dispatch follow-up hardening and health route import safety
  - Cloud Tasks task header forwarding을 allowlist로 전환해 `X-Rate-Limit-Identity`만 보존하고 민감 header 전파를 차단
  - Cloud Tasks `createTask` 429/5xx 등 transient 실패에 1회 jitter retry 추가
  - `/api/health?service=ai` production 500 원인을 strict env/config import-time 의존성으로 좁히고, health route가 단순 ping/Cloud Run health 분기 전에 `@/env`를 로드하지 않도록 정리
  - 회귀 테스트: Cloud Tasks header/retry, health route import-safety

### Completed (2026-04-28 #215)
- [x] Cloud Tasks Job Queue production HTTPS target hardening
  - Production smoke에서 `http://*.run.app/api/jobs/process` target이 Cloud Run `302` 후 `GET /api/jobs/process` 404로 변하는 side effect를 확인
  - Cloud Tasks worker target URL을 non-local 환경에서는 HTTPS로 고정하고, local host에서만 HTTP를 허용하도록 보강
  - `X-Forwarded-Proto: http`가 non-local target을 HTTP로 downgrade하지 못하도록 회귀 테스트 추가
  - `v8.11.52` production smoke `QA-20260428-0358`: `/api/jobs/dispatch` 202 → Cloud Tasks → `/api/jobs/process` POST 200 → job completed
  - 추가 downgrade guard는 `v8.11.53`으로 배포 완료
  - GitLab tag pipeline `2485605736` success: `deploy`, `deploy_ai_engine`, `post_deploy_smoke`, `post_deploy_ai_engine_smoke`

### Completed (2026-04-28 #214)
- [x] Cloud Tasks Job Queue production activation
  - `cloudtasks.googleapis.com` API 활성화 및 `asia-northeast1/openmanager-ai-jobs` queue 생성
  - Queue dispatch 제한을 `1/s`, concurrent `2`, retry `3회`로 보수화해 Cloud Run max instance 1 / Job write cap과 정렬
  - Cloud Run runtime service account에 queue-level `roles/cloudtasks.enqueuer` 부여
  - GitLab CI `CLOUD_TASKS_ENABLED=true`, Vercel production `AI_JOB_TRIGGER_MODE=cloud-tasks` 설정
  - Production 적용은 `v8.11.51` deploy 후 `v8.11.52` HTTPS target hardening smoke로 최종 검증 완료

### Completed (2026-04-28 #213)
- [x] Cloud Tasks Job Queue async execution
  - Vercel `AI_JOB_TRIGGER_MODE=cloud-tasks` 선택 시 기존 long `/api/jobs/process` 직접 호출 대신 짧은 `/api/jobs/dispatch` 호출로 전환
  - Cloud Run Hono `/api/jobs/dispatch`가 Cloud Tasks HTTP task를 생성해 `/api/jobs/process`를 비동기로 호출하도록 구현
  - 기존 direct trigger는 기본값으로 유지하고, retry route도 같은 trigger mode와 source/thinking 옵션 보존 적용
  - Cloud Tasks 설정/env/docs/deploy script 반영. GCP queue/IAM 생성 및 production 활성화는 별도 운영 단계로 남김
  - Plan completed: [cloud-tasks-job-queue-plan.md](archive/cloud-tasks-job-queue-plan.md)

### Completed (2026-04-28 #212)
- [x] Supabase free-tier hardening
  - service-role runtime 기준으로 `search_knowledge_text`와 legacy RAG/vector/approval RPC의 anon/authenticated execute 권한 제거
  - 서버 경유로만 사용하는 public table/view direct privilege를 service role 전용으로 정리
  - unused vector-era index `idx_knowledge_base_embedding_hnsw`, `idx_knowledge_base_content_trgm`, `idx_command_vectors_embedding_hnsw` 제거, BM25 `idx_knowledge_base_search_vector` 유지
  - 원격 Supabase migration 적용 및 live 검증 완료: RPC/table 권한, index 상태, KRL RPC smoke 3건 반환
  - Plan completed: [supabase-free-tier-hardening-plan.md](archive/supabase-free-tier-hardening-plan.md)

### Completed (2026-04-28 #211)
- [x] AI Workspace mobile function nav parity
  - 코드리뷰 결과 전체 화면 모바일에서 Chat/Reporter/Analyst 기능 전환 진입점이 없는 P1 UX 회귀를 확인
  - 전체 화면 모바일 헤더 아래에 기능 전환 rail을 추가하고, 이미 전체 화면인 상태에서는 fullscreen handoff 버튼을 숨김
  - 회귀 테스트: `AIWorkspace` 모바일 기능 전환 nav 렌더링 및 Reporter 전환, `AIAssistantIconPanel` fullscreen 버튼 숨김 옵션

### Completed (2026-04-28 #210)
- [x] AI Assistant source mode contract 정리
  - `RAG 검색`/`Web 검색` 명칭은 유지하고 `RAG 검색 (내부 지식)`, `Web 검색 (외부 웹)` 괄호 설명으로 보강
  - UI 선택지를 `Auto / On`으로 단순화하고 `Off`는 노출하지 않음
  - Auto 상태에서는 `enableRAG`/`enableWebSearch`를 요청에서 생략해 Cloud Run conservative auto-detection을 사용
  - Streaming, Job Queue, local dev fallback, stream redirect Job Queue 경로의 source option 생성 로직을 공통화
  - Plan completed: [ai-assistant-source-mode-plan.md](archive/ai-assistant-source-mode-plan.md)

### Completed (2026-04-28 #209)
- [x] AI Provider 재배치 및 응답 품질 강화 완료 (v8.11.46)
  - Phase 1/1.5/1.6: Advisor/Verifier context guard, Mistral-first summarization fallback, embedding legacy 삭제, provider metadata/docs 정렬
  - Phase 2/3/4: NLQ 프롬프트 계층화, response quality flag 보강, Supervisor 라우팅 힌트 추가
  - Phase 3.5/4.1: AI SDK timeout abortSignal 전달, forced-routing context floor 보강
  - Production QA `QA-20260428-0356`: Analyst/Reporter/Advisor 실제 응답 3/3 pass, Analyst/Advisor 8K Cerebras fallback 및 function-call JSON 노출 회귀 해소
  - GitLab tag pipeline `2484111299` success: `deploy`, `deploy_ai_engine`, `post_deploy_smoke`, `post_deploy_ai_engine_smoke`
  - Plan completed: [ai-provider-quality-plan.md](archive/ai-provider-quality-plan.md)

### Completed (2026-04-27 #208)
- [x] AI Provider 분산 배치 (Spider-Web) 완료 (v8.11.38)
  - 당시 정책: Analyst/Reporter/Verifier → Cerebras 1순위, NLQ/Supervisor/Advisor → Groq 1순위 유지
  - Groq 1K RPD를 Group A 3개 에이전트만 사용 → 실질 ~333회/에이전트/일 (2배 개선)
  - Cerebras Qwen/llama 2026-05-27 종료 대응: runtime replacement=Groq 확정
  - Production QA-20260427-0354: 7/7 pass, 콘솔 에러 0건
  - Plan archived: [archive/ai-provider-distribution-plan.md](archive/ai-provider-distribution-plan.md)

### Completed (2026-04-27 #207)
- [x] AI Assistant Analyst/Reporter quality improvement 완료 (v8.11.38)
  - Analyst T0~T4: 예측값 없음 표시 개선, severity/threshold 기반 주요 이슈 정렬, 각 이슈 기준/근거 명시
  - Reporter T5~T6: 접힌 카드 원인/영향/다음 조치 표시, 탭 전환 후 캐시 보존
  - Production QA-20260427-0353: 12 checks, 10 pass, 2 warn(Cerebras transient), 콘솔 에러 0건
  - Plan archived: [archive/ai-assistant-analyst-reporter-quality-plan.md](archive/ai-assistant-analyst-reporter-quality-plan.md)

### Completed (2026-04-27 #206)
- [x] Codex MCP env allowlist hardening
  - `codex-local.sh`와 MCP health check가 `.env.local` 전체가 아니라 MCP allowlist token만 상속하도록 `codex-mcp` loader mode 적용
  - `.env.local` parser가 `KEY = value`, quoted value trailing comment, unquoted inline comment를 정리하도록 보강
  - 삭제된 Codex launcher marker 감지는 stale user shim 회피용 legacy compatibility 주석으로 명확화

### Completed (2026-04-27 #205)
- [x] Codex GitHub MCP env 로딩 단순화
  - GitHub 전용 MCP auth sync 스크립트와 선택형 Codex launcher 설치 래퍼 제거
  - `run-with-project-env.sh`를 source 가능한 공용 `.env.local` 로더로 정리해 `codex-local.sh`와 MCP health check가 같은 경로로 `GITHUB_PERSONAL_ACCESS_TOKEN`을 사용하도록 통일
  - Codex TOML에는 토큰 값을 넣지 않고 `bearer_token_env_var`만 유지

### Completed (2026-04-27 #204)
- [x] 작업 계획서 마무리 처리
  - `ai-assistant-retrieval-multi-agent-refactor-plan.md`: Status `Approved` → `Completed` 변경 후 `archive/` 이동
  - `ai-sidebar-tool-ux-simplification-plan.md`: `archive/` 이동
  - TODO.md Backlog의 retrieval refactor 항목 완료(~~취소선~~) 처리

### Completed (2026-04-27 #203)
- [x] AI sidebar tool/UX simplification release QA 완료
  - `v8.11.35` patch release commit/tag를 생성하고 GitLab canonical remote에 push
  - protected semver tag pipeline이 `wsl2-docker` runner를 사용할 수 있도록 runner `access_level=ref_protected`로 정렬
  - GitLab tag pipeline `2480658654` 성공 확인: `deploy`, `deploy_ai_engine`, `post_deploy_smoke`, `post_deploy_ai_engine_smoke` 모두 통과
  - Vercel production `/api/version`이 `8.11.35`를 반환하는 것을 release smoke에서 확인
  - Production Playwright targeted smoke `QA-20260427-0349` 기록:
    - guest login → dashboard
    - AI sidebar open
    - RAG/Web/심층 분석 enabled badges
    - 18대 서버 기준 AI 답변
    - analysis basis 및 fullscreen handoff 보존
  - Vercel usage check: effective `$17.0653`, billed `$0.0000`, unexpected billed usage 없음
  - QA tracker: completed `340`, pending `0`, active gate warning 없음
  - Evidence audit: missing artifact `0`, recent counted run artifact warning `0`, 기존 storage size warning만 유지

### Completed (2026-04-26 #202)
- [x] Post-review AI contract hardening
  - AgentFactory 경로가 `searchKnowledgeBase` tool result의 `ragSources`, `EvidenceCard[]`, `metadata.retrieval`을 보존하도록 `BaseAgent`와 `executeWithAgentFactory` propagation 보강
  - `AgentToolName`/tool registry를 실제 tool registry와 맞추고 Advisor Agent에 `getServerLogs`를 추가해 로그 기반 조치 추천 경로를 복구
  - Knowledge Retrieval Lite Redis connection fallback을 memory/OOM 신호와 분리해 `redis 연결 실패` 계열 쿼리가 적절한 후보로 재시도되도록 조정
  - `search_knowledge_text` metadata boost dead-code 지적은 `20260426181500_extend_search_knowledge_text_contract.sql` migration 및 remote 적용 기록으로 stale finding임을 확인
  - forced-routing summarization fallback의 2차 LLM 호출 비용/latency 상한을 `10s / 768 output tokens / 1,000 chars per tool result`로 축소
  - `useAIChatSurface` Web/RAG toggle을 함수형 store update로 전환해 연속 클릭 stale closure 가능성을 제거
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/lib/ai-sdk-utils.test.ts src/services/ai-sdk/agents/base-agent.test.ts src/services/ai-sdk/agents/orchestrator-routing.test.ts src/lib/knowledge-retrieval-lite.test.ts src/services/ai-sdk/agents/config/agent-runtime-policy.test.ts`
    - `npx vitest run src/stores/useAISidebarStore.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `npm run type-check`
    - `npm run lint:changed`

### Completed (2026-04-26 #201)
- [x] Sidebar mobile residual completion
  - 모바일 sidebar의 기능 전환 패널을 chat/non-chat 공통 상단 영역으로 이동해 chat 입력 하단과 충돌하지 않게 정리
  - 모바일 chat 화면에서도 Reporter/Analyst 기능 전환 진입점이 유지되는 회귀 테스트를 추가
  - 선택지 B(Chat-first sidebar 재구조화)는 현재 로컬 검증 기준 별도 승격하지 않고, 다음 release/tag production smoke에서 실제 조잡함이 확인될 때만 분리하기로 결정
  - Vercel/Playwright QA는 현재 미배포 로컬 변경에 반복 실행하지 않고 다음 release/tag 배포 후 단일 smoke로 제한
  - 검증:
    - `npx vitest run src/components/ai-sidebar/AISidebarV4.test.tsx`
    - `npm run type-check`

### Completed (2026-04-26 #200)
- [x] Plan residual guard completion
  - 서버 수/role/AZ/status 질문은 `searchKnowledgeBase` RAG 문서가 아니라 `resource-catalog + precomputed-state` 기반 deterministic topology boundary path를 우선 사용하도록 보강
  - Cerebras long-context capability를 provider 전체 하드코딩에서 Qwen/`llama3.1-8b` model policy 기준으로 보수화
  - `CEREBRAS_LONG_CONTEXT_ENABLED=false` kill switch와 long prompt `minContextTokens` guard를 추가해 short-context fallback 모델이 긴 RAG prompt를 받지 않도록 고정
  - 환경변수 문서와 `cloud-run/ai-engine/.env.example`에 Qwen primary, llama fallback, long-context gate를 반영
  - Cloud Run 현재 env를 확인해 비밀 값은 출력하지 않고 env 이름만 점검했으며, 다음 배포부터 `CEREBRAS_TOOL_CALLING_ENABLED`/`CEREBRAS_LONG_CONTEXT_ENABLED`가 `deploy.sh`로 명시 주입되도록 정리
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/provider-capabilities.test.ts src/services/ai-sdk/agents/config/agent-model-selectors.test.ts src/services/resilience/retry-with-fallback.test.ts src/lib/config-parser.test.ts src/services/ai-sdk/agents/orchestrator-routing.test.ts src/services/ai-sdk/agents/base-agent.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `cd cloud-run/ai-engine && npm run test`
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`
    - `npm run test:contract`

### Completed (2026-04-26 #199)
- [x] Retrieval guard 후속 테스트 및 계획서 상태 정렬
  - Qwen/Cerebras forced tool-call 이후 final text가 비어도 deterministic empty-response fallback과 `fallbackReason=EMPTY_RESPONSE`가 반환되는 계약 테스트를 추가
  - active docs/data에 `Native GraphRAG`, `Mistral + RAG`, 강제 `useGraphRAG: true` stale 표현이 재도입되면 실패하는 guard 테스트를 추가
  - `ai-sidebar-tool-ux-simplification-plan.md`의 실제 완료 체크박스를 코드 현실에 맞게 보정하고, fullscreen handoff 문서화는 잔여 항목으로 유지
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/base-agent.test.ts`
    - `npx vitest run tests/unit/dev/ai-retrieval-legacy-drift.test.ts tests/unit/dev/ai-provider-model-drift.test.ts`

### Completed (2026-04-26 #198)
- [x] Cloud Run supervisor Knowledge Retrieval Lite smoke 후속 수정
  - 실환경 `enableRAG=true`, `enableWebSearch=false` topology 질의로 deterministic `searchKnowledgeBase` direct path가 동작함을 확인
  - direct KB 응답의 legacy `vector/graph` 근거 문구를 Knowledge Retrieval Lite 기준의 `운영 지식/장애 이력/런북/웹` 문구로 교체
  - multi-agent 결과의 `evidenceCards`와 `metadata.retrieval`이 supervisor JSON 응답까지 전달되도록 propagation 보강
  - 회귀 테스트: direct KB path의 GraphRAG 용어 재출현 방지, evidence card/retrieval metadata propagation 추가

### Completed (2026-04-26 #197)
- [x] Supabase remote Knowledge Retrieval Lite RPC contract 적용
  - dry-run에서 pending migration이 `20260426181500_extend_search_knowledge_text_contract.sql` 1건뿐임을 확인 후 remote Supabase에 적용
  - `supabase migration list --linked` 기준 local/remote migration version이 `20260426181500`까지 일치함을 확인
  - 원격 `knowledge_base` 52건 기준 `search_knowledge_text` RPC smoke를 실행해 `severity`, `related_server_types`, `metadata` 반환 필드가 실제 응답에 포함됨을 검증
  - GitLab CI는 Supabase migration 자동 적용을 수행하지 않으므로 DB contract 변경은 별도 `supabase db push` 운영 절차로 처리

### Completed (2026-04-26 #196)
- [x] Knowledge Retrieval Lite SQL RPC 계약 정렬
  - `search_knowledge_text` migration을 추가해 `severity`, `related_server_types`, `metadata`를 반환하도록 확장
  - incident/troubleshooting 검색이 `incident`, `troubleshooting`, `best_practice` 인접 카테고리 evidence를 함께 찾도록 SQL 필터 정책을 보강
  - migration contract test를 추가해 RPC 반환 필드와 incident/runbook adjacency가 깨지면 실패하도록 고정
  - 기존 KRL unit test의 metadata/severity boost fixture가 실제 RPC schema와 맞도록 계약 보강 완료

### Completed (2026-04-26 #195)
- [x] Retrieval Lite conditional review P2 수정
  - `searchKnowledgeBase` no-Supabase branch가 `retrieval.suppressedReason=unavailable`과 빈 `evidenceCards`를 반환하도록 통일
  - `rebalanceRagResultsForMonitoring` 후 `results`, `evidenceCards`, `retrieval.evidenceCount`, `totalFound`가 같은 filtered evidence set을 가리키도록 정리
  - Cerebras Qwen/llama 동일 deprecation date 모델이 서로 replacement로 순환하지 않도록 Groq primary fallback replacement 정책으로 변경
  - 회귀 테스트: no-Supabase retrieval metadata, destructive command evidenceCard filtering, deprecation replacement non-circular guard 추가

### Completed (2026-04-26 #194)
- [x] AI retrieval refactor Task 8 deterministic validation 완료
  - root `npm run test:quick`, `npm run type-check`, `npm run lint`, `npm run test:contract` 통과
  - Cloud Run AI Engine `npm run type-check`, `npm run test` 통과 (`83 files / 864 tests`)
  - `npm run docs:lint:changed`, `npm run docs:budget`, targeted markdownlint, `git diff --check` 통과
  - UI/production behavior 직접 변경이 아니라 Cloud Run retrieval + docs 정리이므로 Vercel/Playwright QA는 실행하지 않음

### Completed (2026-04-26 #193)
- [x] Knowledge Retrieval Lite deterministic query fallback 보강
  - exact BM25 검색이 0건일 때만 Redis memory, DB connection, Nginx/gateway, CPU high-load 계열 후보 쿼리를 순차 재시도
  - PostgreSQL `plainto_tsquery`의 AND 동작 때문에 동의어를 한 쿼리에 덧붙이지 않고 fallback query 후보로 분리
  - fallback으로 선택된 evidence에는 `query-fallback:<candidate>` reason을 남겨 왜 해당 문서가 선택됐는지 추적 가능
  - 외부 embedding, LLM rerank/query expansion, Tavily fallback 없이 Supabase text RPC만 사용

### Completed (2026-04-26 #192)
- [x] AI retrieval stale docs/data 정리
  - `ai-engine-architecture`, `rag-knowledge-engine`, `dev-tools`, `system-architecture-current`, `free-tier-optimization`, `wbs`의 active GraphRAG/Mistral RAG 설명을 Knowledge Retrieval Lite 기준으로 갱신
  - `/api/ai/graphrag/*`를 runtime 검색 API가 아닌 legacy 410 shim으로 명시하고 실제 검색 검증 경로를 `/api/ai/supervisor` + `enableRAG: true` + `searchKnowledgeBase`로 정리
  - provider 문서화를 Cerebras Qwen primary, `llama3.1-8b` intra-fallback, Mistral text last-resort fallback 기준으로 맞춤
  - 15대 topology 잔여 표현을 18대 synthetic topology 기준으로 정리

### Completed (2026-04-26 #191)
- [x] AI retrieval legacy compatibility boundary 정리
  - `legacy-contracts` SSOT를 추가해 `/api/ai/graphrag/*` gone shim, `searchKnowledgeBase.useGraphRAG` compat-only 입력, `ragSources` migration bridge 상태를 한 곳에 등록
  - `/graphrag/*` 410 응답과 `useGraphRAG` schema 설명이 legacy contract를 참조하도록 정리
  - active runtime에서 `useGraphRAG`와 `GRAPH_RAG_TELEMETRY_SAMPLE_RATE`가 허용 경계 밖으로 재침투하지 못하도록 cleanup guard 테스트 추가

### Completed (2026-04-26 #190)
- [x] frontend retrieval status contract 도입
  - `retrieval-status` 타입/유틸을 추가해 RAG/Web/심층 분석 상태를 `enabled`, `used`, `suppressed`, `unavailable`, `disabled`로 분리
  - `AnalysisBasis`에 `retrieval`과 `featureStatus`를 보존하고 message transform이 metadata 또는 `searchKnowledgeBase` tool result에서 retrieval 상태를 파생
  - streaming done, async job result, chat history restore 경로에서 retrieval metadata를 유지하도록 frontend pipeline을 보강
  - Cloud Run jobs 저장 metadata에도 `retrieval`을 보존해 async job SSE가 frontend status contract를 받을 수 있게 정리
  - `AnalysisBasisBadge`와 `SidebarMessage`가 `RAG 허용`, `RAG 사용됨`, `RAG 생략됨`, `RAG 사용 불가` 및 Web/심층 분석 상태를 구분 표시

### Completed (2026-04-26 #189)
- [x] provider model policy SSOT 도입
  - `provider-model-policy.ts`를 추가해 Cerebras Qwen/8B/GPT-OSS model role, lifecycle, quota, deprecation, smoke status를 한 곳에서 관리
  - Qwen은 primary, `llama3.1-8b`는 intra-Cerebras fallback, GPT-OSS는 free-tier 제외 모델로 계약 고정
  - `provider-model-metadata`와 `quota-tracker`가 policy SSOT를 참조하도록 정리해 quota/metadata drift를 줄임
  - `providers` route와 AI tech stack의 Mistral 설명을 RAG/embedding 담당이 아닌 text last-resort fallback 기준으로 갱신
  - 삭제 파일이 섞인 refactor 중에도 provider model drift guard가 missing tracked file에서 실패하지 않도록 보강

### Completed (2026-04-26 #188)
- [x] multi-agent runtime policy SSOT 도입
  - `agent-runtime-policy.ts`를 추가해 agent별 provider order, maxSteps, evidence budget, tool allowlist를 한 곳에서 관리
  - `AGENT_CONFIGS`의 tool map을 runtime policy allowlist에서 생성하도록 정리해 agent config와 정책 drift를 차단
  - text agent는 `Groq -> Cerebras -> Mistral`, Orchestrator는 `Cerebras -> Groq -> Mistral`, Vision은 `Gemini -> OpenRouter` 계약을 테스트로 고정
  - topology direct KB path는 Knowledge Retrieval Lite 인자를 사용하고 `useGraphRAG`를 재도입하지 않도록 회귀 assertion 보강
  - Mistral은 text last-resort fallback으로만 유지하고 RAG provider 설명/주석에서 제거

### Completed (2026-04-26 #187)
- [x] custom GraphRAG runtime 제거
  - `/graphrag/extract`, `/graphrag/stats`, `/graphrag/related/:nodeId`를 호환 410 응답으로 고정해 legacy client에는 명시적 replacement를 반환
  - `graphrag-service.ts`, `graphrag-graph.ts`, `graphrag-types.ts` 및 관련 service test를 삭제해 request path에서 graph traversal/RPC 호출 경로 제거
  - topology direct KB path에서 `useGraphRAG: true` 강제 플래그를 제거하고 Knowledge Retrieval Lite direct path만 사용하도록 계약 테스트 추가
  - `searchKnowledgeBase` tool 설명을 Knowledge Retrieval Lite 기준으로 정리하고 stale graph service mock 제거
  - 검증:
    - `cd cloud-run/ai-engine && npm run test -- src/routes/graphrag.test.ts src/lib/graphrag-runtime-removal.test.ts src/services/ai-sdk/agents/orchestrator-routing.test.ts src/tools-ai-sdk/reporter-tools.test.ts src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `cd cloud-run/ai-engine && npm run test` (`79 files / 850 tests`)
    - `npm run test:contract`
    - `npx markdownlint-cli2 "reports/planning/TODO.md" "reports/planning/ai-assistant-retrieval-multi-agent-refactor-plan.md"`
    - `git diff --check`

### Completed (2026-04-26 #186)
- [x] Knowledge Retrieval Lite service + `searchKnowledgeBase` adapter 도입
  - `retrieveKnowledgeEvidence`를 추가해 `search_knowledge_text` RPC 기반 BM25 retrieval과 tag/metadata boost re-ranking을 구현
  - `searchKnowledgeBase` tool 이름과 legacy boolean input은 유지하되 내부 GraphRAG/vector/Tavily fallback 경로를 제거하고 Lite retrieval adapter로 교체
  - RAG runtime에서 Mistral embedding, `hybridGraphSearch`, `traverse_knowledge_graph`, Tavily 내부 fallback을 호출하지 않는 계약 테스트 추가
  - retrieval metadata(`retrievalEnabled`, `retrievalUsed`, `retrievalMode`, `suppressedReason`, `evidenceCount`, `webUsed`)와 `EvidenceCard[]`를 tool result에 포함
  - Cloud Run 스펙 증설, background worker, live provider key 추가 없이 deterministic local test로 검증
  - 검증:
    - `cd cloud-run/ai-engine && npm run test -- src/lib/knowledge-retrieval-lite.test.ts src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `cd cloud-run/ai-engine && npm run test` (`79 files / 850 tests`)

### Completed (2026-04-26 #185)
- [x] AI assistant 18대 topology contract 확정
  - OTel resource catalog, hourly data, AI Engine precomputed state, infrastructure topology diagram을 18대 관측 inventory 기준으로 정렬
  - role별 3대(Web/API/DB/Redis/Storage/LB)와 AZ별 6대(`DC1-AZ1/2/3`) 균등 분포를 계약 테스트로 고정
  - active docs/UI/test fixture의 현재형 `15대 서버` 표현을 18대 관측 데이터셋 기준으로 갱신
  - OTel/Loki식 로그에 root-cause/topology answer label이 누출되지 않도록 `data:verify`에 guard 추가
  - `tsx`를 devDependency로 고정하고 `data:*` 스크립트를 로컬 binary 실행으로 정리
  - 검증:
    - `npm run data:precomputed:build`
    - `npm run data:verify` (`54 passed / 0 failed`)
    - `./node_modules/.bin/vitest run tests/unit/otel-topology-precomputed-state-sync.contract.test.ts tests/unit/otel-topology-phase3-lb-az2.contract.test.ts tests/unit/otel-topology-phase3-cache-az3.contract.test.ts tests/unit/otel-topology-phase3-storage-standby.contract.test.ts`
    - `npx markdownlint-cli2 "reports/planning/TODO.md" "reports/planning/ai-assistant-retrieval-multi-agent-refactor-plan.md" "docs/guides/ai/ai-standards.md"`
    - `git diff --check`

### Completed (2026-04-26 #184)
- [x] AI assistant retrieval contract/type 추가
  - Cloud Run AI Engine에 `retrieval-contract` SSOT를 추가해 `EvidenceCard`, `RetrievalMetadata`, `RetrievalMode`, suppressed reason union을 고정
  - 기존 `ragSources`를 즉시 제거하지 않고 병행 운용할 수 있도록 legacy `ragSources` → `EvidenceCard[]` adapter 추가
  - `SupervisorResponse`와 `MultiAgentResponse`에 `evidenceCards`와 `metadata.retrieval` 타입 계약을 추가해 frontend/Langfuse propagation 표면을 고정
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/lib/retrieval-contract.test.ts src/lib/ai-sdk-utils.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `cd cloud-run/ai-engine && npm run test` (`78 files / 847 tests`)
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`
    - `npm run test:contract`
    - `npx markdownlint-cli2 "reports/planning/TODO.md" "reports/planning/ai-assistant-retrieval-multi-agent-refactor-plan.md"`
    - `git diff --check`

### Completed (2026-04-26 #183)
- [x] AI assistant Cerebras Qwen model policy 구현
  - Cerebras 기본 모델을 `qwen-3-235b-a22b-instruct-2507`로 전환하고 `llama3.1-8b`를 intra-Cerebras fallback으로 고정
  - `gpt-oss-120b`는 무료 티어 미포함/현재 키 404 근거로 runtime 후보에서 제외
  - Cerebras 모델별 quota와 usage key를 계정 Limits 기준으로 분리해 Qwen `5 RPM / 30K TPM`, llama `30 RPM / 60K TPM`을 보수 적용
  - Qwen quota가 pre-emptive threshold에 걸리면 Cerebras 전체를 건너뛰지 않고 `llama3.1-8b`를 먼저 선택하도록 보강
  - provider metadata/deprecation guard를 date-aware로 변경해 2026-05-27 이후 Qwen/llama 교체 필요성을 감지
  - `retry-with-fallback`와 agent model selector가 provider 내부 model fallback을 먼저 시도한 뒤 다음 provider로 이동하도록 계약을 고정
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/lib/config-parser.test.ts src/services/ai-sdk/provider-model-metadata.test.ts src/services/resilience/quota-tracker.test.ts src/services/ai-sdk/agents/config/agent-model-selectors.test.ts src/services/resilience/retry-with-fallback.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `cd cloud-run/ai-engine && npm run test` (`77 files / 840 tests`)
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`
    - `npm run test:contract`
    - `npx markdownlint-cli2 "reports/planning/TODO.md" "reports/planning/ai-assistant-retrieval-multi-agent-refactor-plan.md"`
    - `git diff --check`

### Completed (2026-04-25 #181)
- [x] AI sidebar icon rail 시각 신호 단순화
  - `AIAssistantIconPanel`의 선택 상태를 gradient/color rail에서 단색 border 기반 navigation state로 단순화
  - 기능 tooltip의 emoji와 실제 상태처럼 보이는 `AI 활성` pulse 표시를 제거
  - icon-only 기능 버튼과 fullscreen 버튼에 `aria-label`/`aria-pressed`를 추가해 접근성 보강
  - 단독 panel 테스트를 추가해 장식 pulse 제거, tooltip copy, 기능 전환/fullscreen handoff를 고정
  - 검증:
    - `npx vitest run src/components/ai/AIAssistantIconPanel.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx src/components/ai/AIWorkspace.test.tsx`
    - `npm run type-check`
    - `npm run lint:changed`
    - `bash scripts/dev/biome-wrapper.sh check src/components/ai/AIAssistantIconPanel.tsx src/components/ai/AIAssistantIconPanel.test.tsx`

### Completed (2026-04-25 #182)
- [x] SambaNova 제거 + Cerebras tool-calling fallback 활성화
  - 최종 text fallback chain을 `Groq → Cerebras → Mistral` 3-way로 정리
  - SambaNova는 live smoke에서 API key 인증 실패가 확인됐고, Free Tier `20 RPD / 200K TPD`가 운영 fallback으로 낮아 runtime chain에서 제거
  - Cerebras 기본 모델은 현재 키에서 AI SDK direct/tool-calling smoke가 통과한 production `llama3.1-8b`로 보수화
  - `gpt-oss-120b`는 현재 키의 chat completions smoke가 404였고, 이후 무료 티어 모델 목록 미포함으로 runtime 후보에서 제외
  - Orchestrator는 text agent와 분리해 `Cerebras → Groq → Mistral` structured-output chain으로 정렬
  - `llama3.1-8b`와 Groq Scout 모두 Orchestrator `generateObject` smoke가 통과했고, Mistral은 2 RPM 병목 때문에 last resort로 배치
  - `config-parser.ts`, `model-provider-core.ts`, `model-provider-status.ts`, `model-provider.types.ts`, `provider-capabilities.ts`, `quota-tracker.ts`의 SambaNova runtime 경로 제거
  - `CEREBRAS_TOOL_CALLING_ENABLED=true` 기본 예시로 Cerebras tool-calling fallback 활성화
  - `provider-model-metadata.ts`: Groq Scout는 공식 Preview로 유지하고, Cerebras `llama3.1-8b` current fallback metadata 유지. `gpt-oss-120b` metadata는 후속 Qwen policy cleanup 대상
  - `retry-with-fallback.test.ts`: Groq/Cerebras 실패 후 Mistral last-resort fallback 계약 고정
  - `src/config/ai-providers.ts`: UI에서 SambaNova provider 표시 제거
  - 검증:
    - `npx tsc --noEmit -p cloud-run/ai-engine/tsconfig.json` ✅
    - `npm run type-check` ✅
    - `npx vitest run tests/unit/dev/ai-provider-model-drift.test.ts` ✅
    - `provider-model-metadata.test.ts` ✅

### Completed (2026-04-25 #180)
- [x] `qa-state` skill 중복 축소
  - `.agents/skills/qa-state`와 `.claude/skills/qa-state`를 `state-triage` → `qa-ops` 순서만 조율하는 thin wrapper로 정리
  - 상세 triage/QA 실행 규칙은 각각 `state-triage`, `qa-ops`에 남기고 `qa-state`의 중복 절차를 제거
  - `.agents/skills/qa-state/agents/openai.yaml`을 추가해 Codex/Gemini UI metadata 누락을 보강
  - `config/ai/skill-baselines.json`의 `qa-state` purpose/invariant를 wrapper 역할에 맞게 갱신
  - 검증:
    - `npm run qa:status`
    - `npm run skills:check`
    - `npm run docs:ai-consistency`
    - `npx markdownlint-cli2 ".agents/skills/qa-state/SKILL.md" ".agents/skills/qa-state/agents/openai.yaml" ".claude/skills/qa-state/SKILL.md" "config/ai/skill-baselines.json" "reports/planning/TODO.md"`
    - `git diff --check`

### Completed (2026-04-25 #179)
- [x] AI skill system P1 drift 정리
  - `cloud-run` skill에 GitLab CI `deploy_ai_engine` production deploy authority와 runner health/pipeline 확인 흐름 반영
  - Claude `state-triage`, `env-sync`, `qa-state`의 hardcoded Cloud Run URL을 `CLOUD_RUN_AI_URL`/`gcloud` 조회 기준으로 제거
  - Claude `git-workflow` push 단계에 pushed `HEAD` GitLab pipeline 확인과 `id/status/url` 보고 규칙 추가
  - `config/ai/skill-baselines.json`에 CI deploy authority, dynamic Cloud Run URL, push 후 pipeline verification invariant 반영
  - 검증:
    - `npm run skills:check`
    - `npm run docs:ai-consistency`
    - `npx markdownlint-cli2 ".agents/skills/cloud-run/SKILL.md" ".agents/skills/git-workflow/SKILL.md" ".claude/skills/cloud-run/SKILL.md" ".claude/skills/git-workflow/SKILL.md" ".claude/skills/state-triage/SKILL.md" ".claude/skills/env-sync/SKILL.md" ".claude/skills/qa-state/SKILL.md" "reports/planning/TODO.md"`
    - hardcoded Cloud Run URL/stale provider assertion grep

### Completed (2026-04-25 #178)
- [x] JS/TS 사용 기준 및 배포/개발 철학 문서 정렬
  - TypeScript 기본 원칙과 JavaScript 예외 사용 기준을 `coding-standards`와 `scripts/README`에 명시
  - GitLab CI semver tag deploy, Vercel Git Integration 해제, GitHub public snapshot 역할을 주요 운영 문서에 재정렬
  - route count, Zustand store count, RAG/data source path, active doc budget 같은 stale 문서 값을 현재 코드 기준으로 갱신
  - 의도치 않게 시작된 Vercel deployment `dpl_ASxmWrWVRV8RsxHe5dF8BxmkPorM`은 즉시 제거 완료
  - 검증:
    - `npm run docs:lint:changed`
    - `npm run docs:budget`
    - `npm run docs:ai-consistency`
    - `npm run docs:links:internal`

### Completed (2026-04-25 #177)
- [x] Codex MCP token backup hardening 및 검색 MCP 도입 기준 정리
  - `.codex/config.toml.bak.*`에 남아 있던 legacy MCP token 값을 local redaction 처리
  - `setup-codex-project-config.sh`가 timestamp backup을 생성할 때 GitHub/Supabase/Tavily/Brave/Vercel 계열 secret pattern을 redaction하도록 개선
  - `codex:check`에 local Codex TOML secret pattern 검사를 추가해 재발을 차단
  - Tavily/Brave Search MCP는 Codex 내장 웹 검색으로 충분한 일반 리서치에는 상시 등록하지 않고, 교차 에이전트 재현성·extract/crawl·JSON 검색 계약이 필요할 때만 온디맨드 검토하도록 문서화
  - 검증:
    - `npm run codex:check`
    - `bash scripts/mcp/mcp-health-check-codex.sh --no-live-probe`
    - `npm run docs:ai-consistency`
    - `npm run docs:budget`
    - `npm run docs:lint:changed`

### Completed (2026-04-24 #176)
- [x] Supabase RAG extension search_path repair 완료
  - remote `20260416225546_move_extensions_to_extensions_schema`와 local migration timestamp 불일치를 정렬
  - `vector`/`pg_trgm` extension 이동 후 RAG/vector RPC가 `extensions` schema를 찾지 못하던 `42883` 오류를 `search_path` repair migration으로 해소
  - 수동 검증용 `npm run supabase:rag:smoke` 추가
  - 상세 계획/계약: [archive/supabase-rag-extension-search-path-plan.md](archive/supabase-rag-extension-search-path-plan.md)
  - 검증:
    - `supabase db push --dry-run`
    - `supabase db push --yes`
    - `npm run supabase:rag:smoke`
    - `supabase db lint --linked`
    - `supabase migration list`
    - production `/api/health`, `/api/database`

### Completed (2026-04-24 #175)
- [x] QA WONT-FIX Policy Missing 정리
  - `obs-fp-fn-weekly-report`에 명시적 WONT-FIX 수용 근거를 추가해 `Policy Missing` 1건을 `Portfolio Deferral`로 재분류
  - `qa:status` 기준 WONT-FIX reason category에서 `Policy Missing`이 더 이상 출력되지 않음을 확인
  - 검증:
    - `npm run qa:status -- --write`

### Completed (2026-04-24 #174)
- [x] QA WONT-FIX reason category 출력 개선
  - `qa:status`와 `QA_STATUS.md`에서 WONT-FIX 항목을 `Policy Missing`, `Platform Constraint`, `Free Tier Tradeoff`, `Historical Obsolete`, `Portfolio Deferral`, `Accepted Debt`로 분류해 표시
  - P1 WONT-FIX 항목이 실제 release blocker처럼 보이는 혼동을 줄이고, 명시적 수용 근거가 없는 `Policy Missing` 항목을 재검토 대상으로 드러냄
  - 검증:
    - `npx vitest run tests/unit/qa/qa-wont-fix-classification.test.ts tests/unit/qa/qa-trends.test.ts tests/unit/qa/qa-scripts.test.ts`
    - `npm run qa:status -- --write`

### Completed (2026-04-24 #173)
- [x] QA residual risk improvement 완료
  - `data-metrics-quality` 잔여 gap을 dashboard snapshot `dataSource`/`dataSlot` provenance evidence와 targeted production AI parity QA로 정리
  - `qa:evidence:audit`에 run-level artifact footprint summary와 run/file soft budget warning을 추가해 신규 evidence 비대화 감시 가능
  - `qa:status`/trend 출력에서 Active Gate Warnings와 Historical Trend Warnings를 분리해 `gate-window-regression-open`을 현재 release blocker로 오해하지 않도록 개선
  - 상세 계획/계약: [archive/qa-residual-risk-improvement-plan.md](archive/qa-residual-risk-improvement-plan.md)
  - 검증:
    - `npx vitest run tests/unit/playwright/dashboard-ai-parity.test.ts tests/unit/qa/qa-evidence-audit.test.ts tests/unit/qa/qa-trends.test.ts`
    - `npx vitest run tests/unit/playwright/dashboard-ai-parity.test.ts tests/unit/qa/qa-evidence-audit.test.ts tests/unit/qa/qa-trends.test.ts tests/unit/qa/qa-scripts.test.ts`
    - `npm run test:quick`
    - `npm run type-check`
    - `npm run lint`
    - `npm run check:usage:vercel`
    - `PLAYWRIGHT_SKIP_SERVER=1 PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_HEADLESS=true PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-ai-chat.spec.ts --config playwright.config.ts`
    - `npm run qa:record -- --input /tmp/qa-run-input-20260424-ai-slot-provenance.json` → `QA-20260424-0348`
    - `npm run qa:evidence:audit`
    - `npm run qa:status`

### Completed (2026-04-24 #172)
- [x] AI starter summary parity guard 완료
  - Vercel MCP QA `QA-20260424-0343`에서 관찰된 starter/복원 메시지와 현재 dashboard count 불일치 가능성을 E2E guard로 보강
  - `dashboard-ai-chat.spec.ts` starter prompt 및 직접 질의 플로우가 AI 응답 수신만 확인하지 않고, 방금 생성된 응답의 `전체/정상(온라인)/경고/위험/오프라인` count가 dashboard snapshot과 일치하는지 검증하도록 개선
  - 상세 계획/계약: [archive/ai-starter-summary-parity-guard-plan.md](archive/ai-starter-summary-parity-guard-plan.md)
  - 검증:
    - `npx vitest run tests/unit/playwright/dashboard-ai-parity.test.ts`
    - `npm run type-check`
    - `npm run lint`
    - `npm run docs:lint:changed`
    - `npm run docs:budget`
    - `npm run docs:ai-consistency`
    - `PLAYWRIGHT_SKIP_SERVER=1 PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_HEADLESS=true PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-ai-chat.spec.ts --config playwright.config.ts`
    - `npm run qa:record -- --input /tmp/qa-run-input-20260424-ai-parity-guard.json` → `QA-20260424-0344`
    - `npm run qa:record -- --input /tmp/qa-run-input-20260424-ai-parity-guard-final.json` → `QA-20260424-0345`
    - `npm run qa:evidence:audit`

### Completed (2026-04-23 #171)
- [x] dashboard-worker-console-fallback 로컬 회귀 검증
  - `/dashboard/ai-assistant -> /dashboard` 복귀 경로에서 worker lifecycle 종료가 production-style console error로 승격되지 않도록 `useWorkerStats` fallback logging을 정리
  - unmount 중 stats 계산이 fallback으로 복구되고 `error` 대신 `debug`만 남기는 회귀 테스트를 추가
  - local Next.js MCP + browser automation 기준 동일 경로 재현 시 runtime error `0`, console error `0` 확인
  - 검증:
    - `npx vitest run src/hooks/useWorkerStats.test.ts src/hooks/dashboard/useServerStats.test.ts`
    - `npm run test:quick`
    - `npm run type-check`
    - `npm run lint`
    - `npm run qa:record -- --input /tmp/qa-run-input-20260422-local-worker-fallback.json`
    - `npm run qa:status -- --write`

### Completed (2026-04-22 #170)
- [x] root-shell-startup-trace 해결
  - root CSS, auth/session lazy import, 그리고 Tailwind source scope를 단계적으로 좁혀 local dev Turbopack cold compile 병목을 해소
  - 최종 원인은 `src/app/globals.css`의 Tailwind v4 automatic source detection이었고, `source(none)` + explicit `src` code directories로 전환 후 cold route compile이 `/` `198s -> 18s`, `/dashboard` `196s -> 17s`로 감소
  - 보조 개선으로 `useInitialAuth`, `useAuth`, `useSupabaseSession`, `useUnifiedAdminStore`에서 auth/session/browser-notification import를 async boundary 뒤로 옮겨 `/api/version` cold startup도 `78s -> 49s`로 감소
  - 검증:
    - `npm run type-check`
    - `npm run lint`
    - `rm -rf .next && NEXT_DEV_TRACE_CURL_TIMEOUT_S=180 bash scripts/dev/collect-next-dev-trace.sh --path=/ --timeout=240`
    - `rm -rf .next && NEXT_DEV_TRACE_CURL_TIMEOUT_S=180 bash scripts/dev/collect-next-dev-trace.sh --path=/dashboard --timeout=240`
    - `npm run qa:record -- --input /tmp/qa-run-input-root-shell-20260422-1738.json`
    - `npm run qa:status -- --write`

### Completed (2026-04-22 #169)
- [x] CI node/dom suite stabilization 완료
  - root `test:node` / `test:dom` full-suite에서만 재현되던 dashboard/auth/global-error 계열 불안정 테스트를 mock/cache/timing 계약 기준으로 정리
  - clarification/off-domain loading 관련 follow-up까지 포함해 `npm run ci:local:docker` 전체 green 복구
  - 상세 계획/계약: [archive/ci-node-dom-suite-stabilization-plan.md](archive/ci-node-dom-suite-stabilization-plan.md)
  - 검증:
    - `bash scripts/dev/biome-wrapper.sh check src/hooks/ai/core/useQueryExecution.ts tests/ai-sidebar/useHybridAIQuery.clarification.test.ts src/components/dashboard/ActiveAlertsModal.test.tsx src/components/shared/AuthLoadingUI.tsx`
    - `node scripts/dev/vitest-main-wrapper.js run --config config/testing/vitest.config.dom.ts tests/ai-sidebar/useHybridAIQuery.clarification.test.ts`
    - `node scripts/dev/vitest-main-wrapper.js run --config config/testing/vitest.config.dom.ts`
    - `npm run ci:local:docker`

### Completed (2026-04-22 #168)
- [x] line-guard hotspot fail 3건 해소 및 CI 게이트 복구
  - `message-helpers`, `AnalysisBasisBadge`, `orchestrator-execution`를 helper/subcomponent 단위로 분해해 fail threshold `800+`를 모두 제거
  - 최종 `npm run line-guard` 결과는 warning `25`, fail `0`
  - 상세 계획/계약: [archive/line-guard-hotspots-refactor-plan.md](archive/line-guard-hotspots-refactor-plan.md)
  - 검증:
    - `npx vitest run src/hooks/ai/utils/message-helpers.test.ts`
    - `npx vitest run src/components/ai/AnalysisBasisBadge.test.tsx`
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`
    - `npm run line-guard`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `cd cloud-run/ai-engine && npm test`

### Completed (2026-04-22 #167)
- [x] chrome-devtools 테스트 기반 개선 계획 마감 및 archive 이동
  - CLS/a11y/API/UI 개선 항목과 headed trace 검증을 완료하고 plan `Status`를 `Completed`로 전환
  - desktop/mobile trace 결과를 계획서에 반영: desktop `CLS 0.08`, mobile `CLS 0.07`, console error `0`
  - 상세 계획/계약: [archive/chrome-devtools-improvements-plan.md](archive/chrome-devtools-improvements-plan.md)
  - 검증:
    - `npm run type-check` (85.7s, pass)
    - `npm run lint` (pass, `qa-tracker.json` maxSize info 1건)
    - `new_page("https://openmanager-ai.vercel.app")` + `take_screenshot` (`/tmp/openmanager-vercel-headed-check.png`)

### Completed (2026-04-21 #166)
- [x] AI Domain Boundary Phase 3 broad reference refresh 완료
  - production `v8.11.25` (`dpl_643GY6xfecoQXhCqzRUnE4TNajmF`)에서 broad rerun `QA-20260421-0324`를 기록하고, `production-console-init-cleanliness`와 `off-domain-relative-date-grounding` blocker 2건을 완료 처리
  - landing/privacy/login/dashboard/ai-assistant core route에서는 더 이상 production chunk init TypeError가 재현되지 않았고, `서울 오늘 날씨 알려줘` off-domain 질의도 disclaimer를 유지하면서 stale `2023년` absolute date를 누출하지 않음
  - 상세 계획/계약: [archive/ai-domain-boundary-analysis-mode-plan.md](archive/ai-domain-boundary-analysis-mode-plan.md)
  - 검증:
    - `npm run check:usage:vercel`
    - `npm run qa:record -- --input /tmp/qa-run-input-20260421-domain-boundary-v81125.json`
    - `npm run qa:status -- --write`
    - `npm run qa:evidence:audit`

### Completed (2026-04-21 #165)
- [x] 완료된 plan root/archive 정리
  - root `reports/planning/`에 남아 있던 완료 plan 6개를 `archive/`로 이동해 active surface를 `ai-domain-boundary` 1개로 축소
  - `otel-data-simulation-v2`, `analysis-basis-badge-tab-ux`는 실제 완료 상태에 맞춰 metadata를 보정한 뒤 archive로 이동
  - 검증:
    - `npm run docs:budget`

### Completed (2026-04-21 #164)
- [x] Multi-agent `finalAnswer` loop cap 단순화
  - `orchestrator-agent-stream`도 `getAgentMaxSteps()`를 공유하도록 바꿔, multi-agent 기본 cap은 `7`로 낮추고 복합 tool workflow가 잦은 Analyst/Reporter만 `10`을 유지
  - routing/stream 테스트에 max step 회귀 검증을 추가하고, 아키텍처/상태 문서의 `finalAnswer` 설명을 실제 동작 기준으로 갱신
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-routing.test.ts src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`

### Completed (2026-04-21 #163)
- [x] Vision 최신 production latency 표본 보강
  - production `v8.11.24`에서 guest session bootstrap 후 `/dashboard/ai-assistant` Vision 경로를 targeted QA로 재검증하고, synthetic screenshot prompt 기준 `12723ms` latency sample 1건을 추가 확보
  - `qa:record` / `qa:status -- --write`로 `QA-20260421-0322` 런, `QA_STATUS.md`, `QA_TRENDS.md`, `latest-qa-trends.json`을 갱신
  - direct legacy JSON `/api/ai/supervisor` 이미지 경로는 fallback 응답을 반환해 이번 표본에서는 제외했고, production login/assistant chunk `init` console error는 non-blocking 관찰사항으로만 기록
  - 검증:
    - `npm run check:usage:vercel`
    - `npm run qa:record -- --input /tmp/qa-run-input-20260421-vision.json`
    - `npm run qa:status -- --write`

### Completed (2026-04-21 #162)
- [x] `multi-agent` semantics UI/문서 정렬
  - `resolvedMode=multi`를 UI에서 `오케스트레이션 협업 경로`로 표시하고, orchestrator + specialist/tool handoff를 포함하는 의미를 설명 텍스트로 고정
  - 아키텍처 문서에서도 같은 해석 기준을 추가하고, 이미 완료된 pending 항목(`Advisor tail latency`, `multi-agent semantics`)을 정리
  - 상세 계획/계약: [archive/multi-agent-semantics-plan.md](archive/multi-agent-semantics-plan.md)
  - 검증:
    - `npx vitest run src/components/ai/AnalysisBasisBadge.test.tsx`
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`

### Completed (2026-04-21 #161)
- [x] Advisor tail latency 축소
  - Advisor Agent가 `MISSING_COMMAND_BLOCK`만 이유로 재시도하던 경로에 latency guard를 추가해, 이미 `LATENCY_SLOW`/`LATENCY_VERY_SLOW`인 응답은 추가 provider retry를 수행하지 않도록 조정
  - hard failure retry(`EMPTY_RESPONSE`, `NO_OUTPUT`, meaningful content가 없는 `TOO_SHORT`)는 기존 동작 유지
  - 상세 계획/계약: [archive/advisor-tail-latency-plan.md](archive/advisor-tail-latency-plan.md)
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/supervisor-quality-retry.test.ts src/services/ai-sdk/agents/response-quality.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check`
    - `cd cloud-run/ai-engine && npm run test`

### Completed (2026-04-21 #160)
- [x] 보안 P2 하드닝 2건 마감
  - `guest-login`이 클라이언트 제공 `sessionId`를 그대로 세션 쿠키/증명에 재사용하던 경로를 제거하고, 서버 발급 랜덤 ID만 사용하도록 보정
  - `wake-up` 엔드포인트를 `withAuth` 경계 안으로 이동해 익명 warmup trigger를 차단
  - 검증:
    - `npx vitest run src/app/api/auth/guest-login/route.test.ts src/app/api/ai/wake-up/route.auth.test.ts`

### Completed (2026-04-20 #159)
- [x] 서버 카드 IP 주소 표시 위치 이동
  - 카드 hover 상세에서 내부 IP 표시를 제거하고, 서버 상세 모달의 시스템 정보/IP 섹션만 canonical 노출 지점으로 유지
  - 카드 정보는 OS, Uptime, 위치 중심으로 정리해 시각적 잡음을 줄임
  - 검증:
    - `npx vitest run src/components/dashboard/DashboardSummary.test.tsx src/components/dashboard/ImprovedServerCard.test.tsx`
    - `npm run stitch:check`
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`

### Completed (2026-04-20 #158)
- [x] 대시보드 상태 헤더 버튼 그룹 UX 개선
  - 상태 헤더의 `알림 / 이력 / 로그` 액션을 하나의 semantic group으로 묶고, 개별 버튼 경계를 divider로 정리
  - 모바일에서는 레이블을 숨기고 아이콘과 카운트만 유지해 클릭 타깃은 그대로 두되 시각적 복잡도는 낮춤
  - 검증:
    - `npx vitest run src/components/dashboard/DashboardSummary.test.tsx`
    - `npm run stitch:check`
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`

### Completed (2026-04-20 #157)
- [x] Reporter 고도화 (로그 타임라인 / 연관 서버 / Postmortem)
  - Reporter 카드에 `LogTimeline`, `연관 서버`, `Postmortem` 섹션을 연결하고 다운로드 포맷을 `incident-YYYYMMDD-HHMMSS.*` 규칙으로 정렬
  - AI Engine incident report 계약에 `affectedServers` 상세 배열과 `postmortem` 출력을 반영
  - `/dashboard?serverId=...` 경유로 연관 서버 클릭 시 해당 서버 상세 모달 자동 포커스를 연결
  - 검증:
    - `npx vitest run src/components/ai/pages/AutoReportPage.test.tsx src/components/ai/pages/auto-report/LogTimeline.test.tsx src/components/ai/pages/auto-report/formatters.test.ts`
    - `cd cloud-run/ai-engine && npx vitest run src/routes/analytics-report-utils.test.ts src/routes/analytics.test.ts`
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`
    - `npm run test:contract`
    - `cd cloud-run/ai-engine && npm run type-check`
### Completed (2026-04-19 #156)
- [x] AI latency rollup 리포트 (`avg/p95` by agent/provider`)
  - `qa:record` 입력에 `aiLatencyObservations` structured schema를 추가하고 run JSON / tracker `runs[]`에 보존
  - `QA_STATUS.md`, `QA_TRENDS.md`, `latest-qa-trends.json`에 최신 recorded run 기준 최근 24h `agent/provider`별 `avg/p95` latency rollup 섹션 추가
  - `qa:status` CLI 요약에 latency rollup sample/bucket/runs 카운트를 노출
  - 검증:
    - `npx vitest run tests/unit/qa/qa-trends.test.ts tests/unit/qa/qa-scripts.test.ts`
    - `node scripts/qa/print-qa-status.js --write`
    - `npm run docs:lint:changed`

### Completed (2026-04-19 #155)
- [x] AnalysisBasisBadge 탭 UX 리팩토링
  - `AnalysisBasisBadge` 확장 패널에 `과정 / 상세` 탭을 추가하고, 사용자 요약과 기술 상세를 분리
  - `[과정]` 탭에서는 technicalName과 디버그 복사 버튼을 숨기고, `[상세]` 탭에서만 trace/debug/raw path를 노출
  - 탭 패널에 `min-h-[18rem]`을 적용해 전환 시 높이 흔들림을 줄임
  - 검증:
    - `npx vitest run src/components/ai/AnalysisBasisBadge.test.tsx`
    - `npm run stitch:check`
    - `npm run type-check`
    - `npm run lint`
    - `npm run test:quick`

### Completed (2026-04-19 #154)
- [x] OTel 데이터 시뮬레이션 고도화 v2 Phase C MVP
  - `scripts/data/otel-fix.ts`에 scenario server 전용 `ServerSimState` / `TransitionProfile` 기반 continuity 적용
  - 대표 시나리오 서버(`db-mysql-dc1-primary`, `cache-redis-dc1-01`)의 recovery bridge / adjacent drift / hour carry-over 계약 추가
  - generated data를 재생성하고 topology contract + `otel-verify` 기준으로 회귀 확인
  - 검증:
    - `node_modules/.bin/jiti scripts/data/otel-fix.ts`
    - `npx vitest run tests/unit/otel-simulation-v2.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - `node scripts/data/otel-verify.ts`

### Completed (2026-04-19 #153)
- [x] AI Engine validate CI 회귀 복구
  - GitLab pipeline `#2462901012`의 `validate_ai_engine`가 `TrendPredictor.test.ts`의 잘못된 horizon 가정으로 실패한 원인을 확인
  - `cpu` metric이 enhanced predictor 내부에서 `0..100`으로 clamp되는 특성을 반영해, horizon 차이 비교 테스트를 clamp 영향이 없는 `latency` metric 기준으로 안정화
  - 수정 커밋: `608600abe` (`test(ai-engine): stabilize trend predictor horizon assertion`)
  - 복구 확인:
    - failing pipeline: `#2462901012` (`validate_ai_engine` failed)
    - recovery pipeline: `#2462916063` (`validate_ai_engine` success)
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/lib/ai/monitoring/TrendPredictor.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #152)
- [x] All-server anomaly external cache key isolation
  - `detectAnomaliesAllServers`가 external payload를 generic `metricType:external`로만 캐싱하던 경로를 payload fingerprint 기반으로 분리
  - 서로 다른 외부 서버셋/히스토리 입력이 같은 분석 캐시를 재사용하지 않도록 보정
  - 회귀 테스트 추가:
    - 동일 metricType + 상이한 external server payload 두 개가 서로 다른 `externalCacheFingerprint`를 쓰는지 검증
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/analyst-tools.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #151)
- [x] Analyst trend/anomaly generic-input refinement
  - `predictTrends`가 `predictionHours`를 실제 horizon(ms)로 반영하도록 `TrendPredictor.predictEnhanced()` 경로를 정렬
  - single-server `detectAnomalies` / `predictTrends`가 `history`와 `currentMetrics` 주입을 받아 synthetic OTel 외 입력에도 같은 계산 원리를 재사용할 수 있게 보강
  - `predictTrends` 설명/에러 문구와 내부 tool label을 `트렌드 예측`보다 낮은 의미의 `단기 위험 추세`로 정리
  - 회귀 테스트 추가:
    - tool 레벨: injected history 사용, horizon 전달
    - predictor 레벨: horizon 변경 시 projected value/threshold breach 결과 차이 검증
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/tools-ai-sdk/analyst-tools.test.ts src/lib/ai/monitoring/TrendPredictor.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #150)
- [x] Structured-output fallback alignment
  - `generateObjectWithFallback()`가 provider 전환 시 공통 retry budget / fallback jitter helper를 재사용하도록 정렬
  - structured-output provider 실패와 text fallback parse 실패 모두 동일한 anti-amplification guard를 적용
  - 기존 `retry-with-fallback`도 같은 shared helper를 쓰도록 정리해 budget state와 delay 계산을 일원화
  - 회귀 테스트 추가:
    - structured-output provider 실패 시 delay 후 fallback
    - structured-output fallback budget 소진 시 fail-fast
    - text fallback parse 실패 시 동일 delay 적용
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-object-fallback.test.ts src/services/resilience/retry-with-fallback.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #149)
- [x] Frontend lint dependency cleanup
  - `AutoResizeTextarea`의 controlled value 리사이즈 effect를 `useLayoutEffect`로 정리해 value 변경 직후 높이 보정과 dependency contract를 일치시킴
  - `useChatHistory`의 metadata builder를 `useCallback`으로 안정화하고 restore effect dependency에 명시해 stale closure 경고를 제거
  - 검증:
    - gate: `npm run test:quick`
    - gate: `npm run type-check`
    - gate: `npm run lint`

### Completed (2026-04-18 #148)
- [x] Client-side Retry-After enforcement
  - `useHybridAIQuery`가 마지막 `rate-limit` error details의 `retryAfter/resetAt`을 메모리 ref로 유지하고, cooldown 만료 전에는 `sendQuery` / `executeQuery`를 fail-fast 차단
  - UI dismiss, 동일 에러 문자열 재발, 수동 retry 경로에서도 서버가 준 cooldown을 우회하지 못하도록 정렬
  - 만료된 cooldown ref는 자동 해제해 정상 스트리밍 재개를 허용
  - 회귀 테스트 추가:
    - active cooldown 시 `sendQuery` 차단
    - expired cooldown 자동 해제 후 streaming 재개
  - 검증:
    - targeted: `npx vitest run src/hooks/ai/core/useQueryExecution.test.ts`
    - gate: `npm run type-check && npm run lint && npm run test:quick`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #147)
- [x] Jittered Retry-After 정렬 (Cloud Run + frontend gateway)
  - Cloud Run `rate-limiter`의 `minute` / `concurrency` 429 응답에 `+0~2s` jitter를 적용해 동시 재시도 파동을 완화
  - `daily` 429는 사용자 안내 정확도를 위해 jitter 없이 정확한 reset 기준 유지
  - frontend `withRateLimit`도 동일 규칙으로 맞춰 엣지/Cloud Run 429 계약을 정렬
  - 회귀 테스트 추가:
    - Cloud Run write minute bucket jitter 범위
    - Cloud Run concurrency overload jitter 고정값
    - Cloud Run daily 429 no-jitter
    - frontend gateway minute 429 jitter / daily 429 no-jitter
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts`
    - targeted: `npx vitest run src/lib/security/rate-limiter.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - gate: `npm run type-check && npm run test:quick`

### Completed (2026-04-18 #146)
- [x] Vision timeout-stream fallback parity 보강
  - `executeMultiAgentStream`의 LLM routing timeout fallback 분기에서도 `resolveVisionFallbackAgent`를 적용해 Vision 미가용 시 `Analyst Agent`로 일관 degrade
  - 기존 forced/LLM/fallback 분기와 동일한 `agent_status` 알림(`Vision Agent 사용 불가`)을 emit 하도록 정렬
  - 회귀 테스트 1건 추가:
    - routing timeout + suggested Vision + model unavailable 시 stream이 `Analyst Agent`로 라우팅되는지 검증
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-execution.timeout.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #145)
- [x] Retry amplification guard 추가 (process-wide retry budget)
  - `retry-with-fallback`에 `retryBudgetPerMinute=120` 기본값을 추가해 provider 전환/추가 재시도의 분당 총량을 제한
  - 예산 소진 시 fail-fast로 종료해 장애 시 retry storm(cascading failure) 증폭을 억제
  - 회귀 테스트 2건 추가:
    - same-provider retry budget 소진 시 재시도 차단
    - provider fallback budget 소진 시 전환 차단
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/resilience/retry-with-fallback.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #144)
- [x] Vision fallback routing consistency 보강 (OpenRouter 포함)
  - `executeMultiAgent` fallback 경로에서 `suggestedAgent='Vision Agent'`일 때 `executeForcedRouting` 대신 `executeVisionOrFallback`을 사용하도록 정렬
  - routing timeout / LLM inconclusive / selectedAgent handoff 메타데이터에서 실제 `finalAgent` 기준으로 저장/기록하도록 보정
  - `executeMultiAgentStream`의 Vision 관련 3개 분기(강제 라우팅, LLM routing, fallback routing)를 공통 Vision availability 판정으로 통일하고, 미가용 시 `Analyst Agent`로 degrade
  - Vision 미가용 로깅 문구를 `Gemini unavailable`에서 `Vision providers unavailable (Gemini/OpenRouter)`로 정정
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-execution.timeout.test.ts src/services/ai-sdk/agents/orchestrator.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #143)
- [x] AI surge-defense hardening (Cloud Run + provider fallback jitter)
  - Cloud Run AI Engine `rate-limiter`에 endpoint group별 in-flight cap(load shedding) 추가
    - `supervisor` max in-flight `4`
    - `jobs/process` max in-flight `2`
    - `embedding` max in-flight `6`
  - 과부하 시 즉시 `429` + `Retry-After=2` + `limitScope=concurrency` 반환으로 provider burst 완화
  - `retry-with-fallback`, `supervisor-stream`, `orchestrator-agent-stream` provider fallback 경로에 jitter delay를 추가해 동시 재시도 파동(thundering herd) 완화
  - Cloud Run 배포 설정 동시성 `80 → 16` 하향(이미 워크트리 반영된 deploy/cloudbuild 변경 포함)
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/services/resilience/retry-with-fallback.test.ts src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts src/services/ai-sdk/supervisor-multi-fallback.test.ts`
    - gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #142)
- [x] AI stream timeout/TTFB 후속 정리
  - Multi-agent 경로에 provider-attempt 기준 `ttfbMs` 계측을 추가하고 done metadata에 반영
  - Single stream warning threshold를 `warningStreaming`으로 분리해 `hardStreaming(120s)` 스케일(`96s`)과 정렬
  - `P2-8(stepCountIs(10))`은 기능 회귀를 막기 위해 즉시 축소 대신 backlog tracking-only로 전환
  - 검증:
    - `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts src/services/ai-sdk/supervisor-multi-fallback.test.ts`
    - `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #141)
- [x] QA evidence top-run manual triage 기록
  - `QA-20260330-0197` / `0198` run pair는 shared legacy bundle은 크지만 unique footprint가 각각 `890.36KiB`, `870.54KiB`로 낮아 ref 정리만으로는 저장소 절감 효과가 작다고 판단
  - `QA-20260404-0228`은 `3.35MiB` unique footprint이지만 active alerts, topology, server detail tabs, log explorer, analyst/reporter, full-screen AI, 404, console까지 모두 고유 surface proof라 duplicate landing cleanup 규칙에 해당하지 않음
  - 결과적으로 현재 top offenders 중 explicit override batch를 바로 열 안전한 후보는 없다고 판단하고 backlog를 tracking-only로 유지
  - 검증:
    - `sed -n '1,180p' reports/qa/runs/2026/qa-run-QA-20260330-0197.json`
    - `sed -n '1,180p' reports/qa/runs/2026/qa-run-QA-20260330-0198.json`
    - `sed -n '1,220p' reports/qa/runs/2026/qa-run-QA-20260404-0228.json`
    - `du -h reports/qa/evidence/legacy/2026/qa-20260330-0197-* reports/qa/evidence/legacy/2026/qa-20260330-0198-*`

### Completed (2026-04-18 #140)
- [x] QA evidence audit unique-footprint 가시성 개선
  - `qa:evidence:audit`에 `Top unique legacy run footprints` 섹션을 추가해 각 run이 혼자 보유하는 legacy artifact의 실제 디스크 footprint를 바로 확인할 수 있게 정리
  - `shared bundle`로 커 보여도 실제 절감 가능 용량은 작은 run을 구분할 수 있도록 README 해석 규칙을 보강
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #139)
- [x] QA evidence audit shared-legacy bundle 가시성 개선
  - `qa:evidence:audit`에 `Top shared legacy run bundles` 섹션을 추가해 여러 run이 같은 legacy artifact를 공동 참조하는 개선 묶음을 바로 확인할 수 있게 정리
  - `QA-20260330-0197` / `0198`처럼 같은 proof를 재사용하는 run 관계를 manual override triage 대상으로 더 쉽게 식별하도록 README 해석 규칙을 보강
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #138)
- [x] QA evidence audit legacy-run triage 가시성 개선
  - `qa:evidence:audit`에 `Top referenced legacy runs` 섹션을 추가해 어떤 QA run 묶음이 가장 많은 tracker-referenced legacy proof를 보유하는지 바로 확인할 수 있게 정리
  - 이 목록은 explicit override 검토용 수동 triage 출력이며, 자동 archive 후보가 아니라는 해석 규칙을 README에 명시
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #137)
- [x] QA evidence audit legacy-reference 가시성 개선
  - `qa:evidence:audit` 출력에 `referenced legacy evidence` 개수/용량을 추가해 size warning 중 실제 tracker-referenced legacy proof 비중을 바로 확인할 수 있게 정리
  - helper를 분리해 unit test로 고정하고, README에 새 출력의 해석 규칙을 추가
  - 검증:
    - `npx vitest run tests/unit/qa/qa-evidence-audit.test.ts`
    - `npm run qa:evidence:audit`
    - `npm run docs:lint:changed`

### Completed (2026-04-18 #136)
- [x] QA evidence 저장소 용량 tracking 갱신
  - `npm run qa:evidence:audit` 기준 `reports/qa=61.12MiB`, `reports/qa/evidence=56.45MiB / 233파일`로 증가 상태를 재확인
  - orphan durable evidence, missing artifact path, archive candidate가 모두 `0`이라 cleanup 대상은 없다고 판단
  - `qa-evidence-size` 경고만 남아 있어 `reports/qa/README.md` 정책에 따라 policy-protected evidence backlog로 유지
  - 검증:
    - `npm run qa:evidence:audit`

### Completed (2026-04-18 #135)
- [x] AI Response Visibility - write bucket 재평가 종료
  - frontend와 Cloud Run write 경로는 이미 `supervisor 10/min`, `jobs/process 5/min`, `daily 100`으로 정렬돼 있음을 재확인
  - provider 비용을 직접 태우지 않는 read-only 경로는 이미 `120/min`으로 분리됐고, write bucket 추가 완화 근거는 없다고 판단
  - `supervisor` write minute bucket을 `10/min`으로 고정하는 회귀 테스트 추가
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #134)
- [x] Storybook circular chunk warning backlog 정리
  - `npm run storybook:build:ci` 재검증 결과 Storybook static build 성공
  - circular chunk warning은 재현되지 않았고, `.storybook/main.ts`의 warning suppression/manual chunk 정리가 현재 상태와 일치함을 확인
  - backlog 항목은 stale로 판단해 제거
  - 검증:
    - `npm run storybook:build:ci`

### Completed (2026-04-18 #133)
- [x] AI Response Visibility - Cloud Run read-only window alignment 완료
  - `GET /api/ai/supervisor/health`와 `GET /api/jobs/:id*` read-only bucket을 `60/min`에서 `120/min`으로 완화
  - `supervisor` write `10/min`, `jobs/process` write `5/min`, daily `100` semantics는 유지
  - read-only fallback/direct polling에서 minute window 경계 false 429를 줄이도록 `X-RateLimit-Limit` 계약을 상향 고정
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #132)
- [x] AI Response Visibility - Cloud Run supervisor health limiter split 완료
  - `GET /api/ai/supervisor/health`를 별도 health/read bucket으로 분리해 smoke/health 확인이 strict `supervisor 10/min` write bucket을 잠식하지 않게 조정
  - `POST /api/ai/supervisor*` write semantics와 Cloud Run daily semantics는 그대로 유지
  - Redis unavailable 시에도 in-memory fallback key가 `keyPrefix`를 포함하도록 보강해 health/read bucket과 write bucket이 충돌하지 않게 수정
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #131)
- [x] AI Response Visibility - Cloud Run daily semantics alignment 완료
  - Cloud Run `supervisor`와 `jobs/process` write bucket에 `daily=100` semantics 추가
  - `X-RateLimit-Daily-*` 헤더와 `limitScope=daily`, `dailyLimitExceeded=true` payload를 Cloud Run 429에도 일관되게 제공
  - `jobs` polling read bucket은 daily 제외로 유지
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #130)
- [x] AI Response Visibility - Cloud Run jobs read/write limiter split 완료
  - Cloud Run `/api/jobs/process`는 기존 strict `5/min` write bucket을 유지
  - Cloud Run `GET /api/jobs/:id`, `GET /api/jobs/:id/progress`는 별도 read bucket으로 분리
  - job progress polling이 write bucket을 잠식하던 정책 drift를 제거
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts src/routes/jobs.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-18 #129)
- [x] OTel topology improvement - precomputed-state sync 완료 및 계획서 archive 이동
  - AI Engine bundled `precomputed-states.json`을 18대 inventory 기준으로 재생성해 root OTel SSOT와 drift를 해소
  - `tests/unit/otel-topology-precomputed-state-sync.contract.test.ts`로 AI Engine precomputed-state / bundled inventory 계약을 고정
  - 18대 inventory 증가로 깨진 topology RAG governance chunk 예산을 짧은 운영 메모로 재조정
  - 계획서 archive 이동: `reports/planning/archive/otel-topology-improvement-plan.md`
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-precomputed-state-sync.contract.test.ts`
    - root gate: `npm run docs:lint:changed && npm run type-check && npm run lint && npm run test:quick`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`75 files`, `783 tests`)

### Completed (2026-04-18 #128)
- [x] OTel topology improvement - Phase 3-C AZ2 NFS standby 완료
  - `storage-nfs-dc1-02`를 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 추가
  - `server.purpose=hot-standby`, `server.notes=nfs failover target` 메타데이터 추가
  - `otel-fix.ts`에 AZ2 NFS standby datapoint/timeseries 보정 helper 추가
  - `otel-verify.ts`에 Phase 3-C inventory 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-phase3-storage-standby.contract.test.ts tests/unit/otel-topology-phase3-cache-az3.contract.test.ts tests/unit/otel-topology-phase3-lb-az2.contract.test.ts tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `node_modules/.bin/jiti scripts/data/otel-verify.ts` (`45 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #127)
- [x] OTel topology improvement - Phase 3-B AZ3 Redis 완료
  - `cache-redis-dc1-03`를 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 추가
  - `otel-fix.ts`에 AZ3 Redis datapoint/timeseries 보정 helper 추가
  - `otel-verify.ts`에 Phase 3-B inventory 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-phase3-cache-az3.contract.test.ts tests/unit/otel-topology-phase3-lb-az2.contract.test.ts tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (`39 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #126)
- [x] OTel topology improvement - Phase 3-A AZ2 LB 완료
  - `lb-haproxy-dc1-03`를 `resource-catalog`, `server-registry`, 24개 hourly, `timeseries`에 추가
  - `otel-fix.ts`에 AZ2 LB datapoint/timeseries 보정 helper 추가
  - `otel-verify.ts`에 Phase 3-A inventory 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-phase3-lb-az2.contract.test.ts tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (`34 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #125)
- [x] OTel topology improvement - baseline debt cleanup 완료
  - `hour-23 storage-s3gw-dc1-01` network drift를 storage baseline 범위 안으로 조정
  - anomaly-heavy 시간대에 deterministic extra error 로그를 추가해 `ERROR > 3%` severity baseline 복구
  - `otel-fix.ts` generator와 baseline debt contract test를 위 기준에 맞게 동기화
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-baseline-debt.contract.test.ts tests/unit/otel-topology-backup.contract.test.ts tests/unit/otel-topology-redis-cross-az.contract.test.ts tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (`29 passed, 0 failed`)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #124)
- [x] OTel topology improvement - NFS SPOF 완료
  - `hour-02~04`에 `storage-nfs-dc1-01` disk/cpu saturation과 `api-was-*` response duration cascade 추가
  - `storage-nfs-dc1-01`, `api-was-*` 로그에 NFS 병목 원인 문구 추가
  - `timeseries.json`의 같은 구간 WAS response duration 동기화
  - `otel-fix.ts`, `otel-verify.ts`에 S7 계약 반영
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-nfs-spof.contract.test.ts`
    - targeted: `npm run data:verify` (신규 S7 항목 통과, 기존 baseline 실패 2건은 유지: storage network range, ERROR 비율)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #123)
- [x] OTel topology improvement - Redis cross-AZ latency 완료
  - `hour-13~15`에 `api-was-dc1-03` response duration spike 추가
  - `api-was-dc1-03`, `cache-redis-dc1-01` 로그에 `remote AZ cache` 원인 문구 추가
  - `timeseries.json`의 같은 구간 response duration 동기화
  - `otel-fix.ts`, `otel-verify.ts`에 S6 계약 반영
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-redis-cross-az.contract.test.ts`
    - targeted: `npm run data:verify` (신규 S6 항목 통과, 기존 baseline 실패 2건은 유지: storage network range, ERROR 비율)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #122)
- [x] OTel topology improvement - backup realism 완료
  - `db-mysql-dc1-backup`을 `8c / 32GB / 1TB` backup 노드로 현실화
  - `server.purpose=cold-standby`, `server.notes=daily snapshot target` 메타데이터 추가
  - `hour-23` backup 메트릭을 `disk-heavy / low-cpu / low-memory` 패턴으로 조정하고 `timeseries.json`에도 동기화
  - `otel-fix.ts` 시나리오와 `otel-verify.ts` backup realism 검증 항목 추가
  - 검증:
    - targeted: `npx vitest run tests/unit/otel-topology-backup.contract.test.ts`
    - targeted: `npm run data:verify` (backup realism 항목 통과, 기존 baseline 실패 2건은 유지: storage network range, ERROR 비율)
    - root gate: `npm run type-check && npm run lint && npm run test:quick`

### Completed (2026-04-18 #121)
- [x] AI Response Visibility - retry limiter alignment 완료
  - `/api/ai/jobs/[id]/retry`를 `aiJobCreation(5/min)` limiter에 정렬
  - queue 생성과 retry가 동일한 Cloud Run `jobs/process` workload를 호출할 때 같은 edge fail-fast semantics를 사용하도록 계약 고정
  - `withRateLimit()`가 dynamic route `params` 시그니처를 보존하도록 generic tuple typing 보강
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/jobs/[id]/retry/route.rate-limit-contract.test.ts src/app/api/ai/jobs/[id]/retry/route.test.ts src/app/api/ai/jobs/route.rate-limit-contract.test.ts src/lib/security/rate-limiter.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-18 #120)
- [x] AI Response Visibility - Cloud Run forwarded identity 완료
  - frontend AI proxy가 session-aware limiter identity를 `X-Rate-Limit-Identity` 헤더로 Cloud Run에 전달하도록 정리
  - 적용 경로: primary `stream/v2`, `jobs/process`, `jobs retry`, legacy supervisor proxy
  - Cloud Run limiter가 shared `X-API-Key`보다 forwarded end-user identity를 우선 사용하도록 계약 고정
  - 이로써 service secret 하나로 모든 사용자가 같은 Cloud Run limiter bucket을 공유하던 문제를 해소
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/supervisor/stream/v2/route.test.ts src/app/api/ai/jobs/route.trigger.test.ts src/app/api/ai/supervisor/cloud-run-handler.test.ts`
    - ai-engine targeted: `cd cloud-run/ai-engine && npx vitest run src/middleware/rate-limiter.test.ts`
    - root/ai-engine gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract && cd cloud-run/ai-engine && npm run type-check && npm run test`

### Completed (2026-04-18 #119)
- [x] AI Response Visibility - daily-limit semantics 완료
  - `buildRateLimitErrorDetails()`가 `X-RateLimit-Daily-Remaining`, `X-RateLimit-Daily-Reset` 헤더만으로도 `daily` 초과를 복원하도록 보강
  - body가 generic해도 `scope=daily`, `dailyLimitExceeded=true`, `resetAt=daily reset`을 표준 에러 모델로 유지
  - 검증:
    - targeted: `npx vitest run src/lib/ai/error-details.test.ts src/components/ai-sidebar/chat/ColdStartErrorBanner.test.tsx`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-18 #118)
- [x] AI Response Visibility - session-aware limiter identity 완료
  - frontend AI gateway limiter identifier를 IP-only에서 session-aware identity로 보강
  - 우선순위: `auth context user/key` → `guest session cookie` → `supabase auth cookie` → `API key/test secret` → `IP+UA fingerprint`
  - In-Memory fallback과 Redis limiter가 같은 identity semantics를 사용하도록 공통 helper로 정리
  - same-IP 환경에서도 guest session cookie가 다르면 서로 다른 limiter bucket을 사용한다는 계약 고정
  - 검증:
    - targeted: `npx vitest run src/lib/security/rate-limiter.runtime.test.ts src/lib/security/rate-limiter.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-18 #117)
- [x] AI Response Visibility - limiter alignment (`/api/ai/jobs` POST) 완료
  - 프론트 gateway에 `aiJobCreation` limiter 추가 (`5/min`, daily `100`)
  - `/api/ai/jobs` POST가 기존 `aiAnalysis(10/min)` 대신 `aiJobCreation(5/min)`을 사용하도록 정렬
  - Cloud Run `/api/jobs*`의 stricter minute window와 edge fail-fast 정책을 맞춰 중첩 limiter 체감 drift를 축소
  - TDD 커밋:
    - failing test: `/api/ai/jobs` POST가 `5/min` limiter를 바인딩해야 한다는 route contract 고정
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/jobs/route.rate-limit-contract.test.ts src/lib/security/rate-limiter.test.ts src/app/api/ai/jobs/route.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-17 #115)
- [x] AI Response Visibility - 429 UX source-hardening 완료
  - provider 이름이 포함된 plain 429 메시지(`Groq`, `Mistral`, `Cerebras`, `Gemini`, `OpenRouter`)를 `upstream-provider`로 안정 분류
  - `ColdStartErrorBanner`가 plain error만 받아도 upstream-provider title(`AI 제공자 요청 제한이 발생했습니다`)을 올바르게 렌더링하는 계약 고정
  - TDD 커밋:
    - `f2a040e3c` → implementation commit
  - 검증:
    - targeted: `npx vitest run src/lib/ai/error-details.test.ts src/components/ai-sidebar/chat/ColdStartErrorBanner.test.tsx`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`

### Completed (2026-04-17 #116)
- [x] AI Response Visibility - Job Queue agent-path slice 정리 완료
  - Cloud Run jobs route가 `agent_status`/`handoff`/`done.metadata.handoffs`에서 `executionPath`, `handoffFrom`, `handoffTo`, `handoffCount`, `stageDetail`을 이미 수집·저장하고 있음을 재검증
  - Next `/api/ai/jobs/[id]/stream` route가 위 metadata를 progress SSE로 보존하는 계약을 재확인
  - `asyncQuerySSE` progress callback이 agent-path metadata를 그대로 전달하는 regression test 추가
  - 검증:
    - targeted: `npx vitest run src/hooks/ai/core/asyncQuerySSE.test.ts src/app/api/ai/jobs/[id]/stream/route.test.ts src/components/ai-sidebar/JobProgressIndicator.test.tsx`

### Completed (2026-04-17 #114)
- [x] AI Stream Route Contract - observability/caching 설명 정리 완료 및 계획서 archive 이동
  - primary request flow 문서를 `/api/ai/supervisor/stream/v2` 기준으로 정렬
  - `/api/ai/supervisor`는 legacy JSON/text proxy + cache/plain callers 경로로만 설명되도록 정리
  - legacy response cache와 v2 resumable stream state를 별도 caching semantics로 분리 설명
  - observability 문서에서 `W3C Trace Context propagation`과 `full OTLP distributed tracing`을 구분
  - stale timeout 설명(`Orchestrator 45s`)을 current config 기준으로 교정
  - 계획서 archive: `reports/planning/archive/ai-stream-route-contract-plan.md`
  - 검증:
    - `npm run docs:lint:changed`
    - `git diff --check`

### Completed (2026-04-17 #113)
- [x] AI Stream Route Contract - legacy role-tagging 완료
  - `/api/ai/supervisor`를 삭제하지 않고 legacy contract route로 명시
  - 응답 헤더 추가:
    - `X-AI-Route-Contract=legacy-supervisor`
    - `X-AI-Primary-Route=/api/ai/supervisor/stream/v2`
    - `X-AI-Transport=json|text`
  - local dev fallback 주석과 architecture/API docs를 current reality 기준으로 정리
  - TDD 커밋:
    - `5843a8e4a` → `6e667682c`
  - 검증:
    - targeted: `npx vitest run src/app/api/ai/supervisor/cloud-run-handler.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - docs: `npm run docs:lint:changed`

### Completed (2026-04-17 #112)
- [x] AI Stream Route Contract - warning semantics alignment 완료
  - multi-agent `SLOW_PROCESSING` warning payload를 single-agent와 같은 shape로 정렬 (`threshold` 포함)
  - warning message를 stale `25초`에서 실제 orchestrator threshold 기반 문자열로 수정
  - frontend warning 타입 주석을 path-local threshold semantics 기준으로 일반화
  - TDD 커밋:
    - `7fb0ad86a` → `7fc5c740a`
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `782 tests`)

### Completed (2026-04-17 #111)
- [x] AI Stream Route Contract - multi-agent provider fallback visibility 완료
  - AI SDK best practice 기준으로 transient retry state는 final metadata가 아니라 stream `agent_status`로 즉시 노출하도록 정렬
  - `executeAgentStream()`에서 다음 provider 재시도 직전에 상태 이벤트 추가:
    - `No output generated`
    - empty response
    - generic provider error
  - 기존 `done.metadata` / `usage.totalTokens` 계약은 유지
  - TDD 커밋:
    - `ca3944e3b` → `d06ef316e`
  - 검증:
    - targeted: `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/agents/orchestrator-agent-stream.test.ts`
    - ai-engine gate: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `781 tests`)

### Completed (2026-04-17 #110)
- [x] AI Response Visibility - handoff persistence contract 완료
  - `handoffHistory: []`를 stream `data-done`, job queue result metadata, assistant message hydration, chat history save/restore 전반에서 보존
  - `handoff 있음` / `handoff 없음` / `legacy/미기록` semantics를 계약 수준으로 고정
  - TDD 커밋:
    - `2e00d4e42` → `d41bc0ee7`
  - 검증:
    - root targeted: `66/66` pass
    - AI Engine targeted: `14/14` pass
    - root gate: `npm run type-check && npm run lint && npm run test:quick && npm run test:contract`
    - ai-engine gate: `npm run type-check && npm run test` (`74 files`, `779 tests`)

### Completed (2026-04-17 #109)
- [x] AI Chat Improvement Sprint 4 완료 및 계획서 archive 이동
  - non-stream routing timeout 시 `suggestedAgent` fallback 유지
  - structured-output provider fallback / invalid JSON fallback recovery 보강
  - decomposition stream `usage.totalTokens`, `failedCount`, `failedAgents` 계약 고정
  - sequential stream subtask timeout contract 완료: timeout된 subtask는 `null` 처리하고 partial success 유지, 전부 timeout 시 `ALL_SUBTASKS_FAILED`
  - TDD 커밋:
    - `94c62acfd` → `71b6b90d4`
    - `f5df3bd3a` → `721b84bce`
    - `083a23257` → `b442aac7c`
    - `68250484f` → `b724c3412`
    - `a7eb7c416` → `4c9cdb00c`
    - `5cf4b1d80` → `9ccc20d38`
    - `6f7e9156e` → `e25ba794e`
  - 검증: `cd cloud-run/ai-engine && npm run type-check && npm run test` (`74 files`, `778 tests`)
  - archive: `reports/planning/archive/ai-chat-improvement-plan.md`

### Completed (2026-04-17 #108)
- [x] AI Assistant Surface Parity Refactor 완료 (Task 0~5 전체)
  - `useAIEntryController.ts` 신규: sidebar/fullscreen 진입 경로 단일화
  - `pendingEntryState` store 추가: draft/prefill/analysisMode one-shot handoff
  - `AIWorkspace` fullscreen parity: `analysisMode` 표시·변경, shared props
  - `mode="sidebar"` 레거시 분기 완전 제거 (`ce0d3a659`, -131줄)
  - 테스트 50개 통과 (AIWorkspace, AISidebarV4, useAISidebarStore)
  - 계획서 archive 이동: `reports/planning/archive/ai-assistant-surface-parity-refactor-plan.md`

### Completed (2026-04-17 #107)
- [x] active-alert `:9100` 포트 오염 근본 원인 수정 + targeted production QA 완료 (`v8.11.19`)
  - **근본 원인**: `AlertManager.ts`, `MetricsAggregator.ts`, `otel-log-views.ts` 3곳에서 `:9100` suffix 하드코딩 생성 → `instance: server.serverId` (포트 없음)로 전체 수정
  - **AIDebugPanel** 293줄 → 75줄 단순화 (Start+Check 2버튼 → 단일 "상태 확인", Log Level 섹션 제거)
  - `server-data-transformer.ts` dead code (`_targetToRawServerData`) 제거
  - 회귀 테스트 갱신: `MetricsAggregator.test.ts`, `otel-log-views.test.ts`, `monitoring-pipeline.test.ts`
  - production `v8.11.19` 배포 확인 + `QA-20260417-0302` 기록 (`4/4` pass)
  - detectAnomalies 직접 성공 확인: 실제 데이터(평균 64.9%→82% 급증) 기반 응답, 신뢰도 95%

### Completed (2026-04-17 #106)
- [x] root layout font preload warning cleanup broad production QA 완료
  - release `v8.11.17` / production deployment `dpl_sRuuaBX32ZL4rGggN552bJqcL2th` live 확인
  - `QA-20260417-0300` 기록 (`18/18` pass): landing/login/privacy/404/system-boot/dashboard/AI/fullscreen/API/console 전부 green
  - `/dashboard` + `/dashboard/ai-assistant` 경로의 `next/font preload unused` warning 재현 종료, broad reference를 `QA-20260417-0300`으로 갱신
  - Vercel usage check 정상: effective `9.7924 USD`, billed `0.0000 USD`, chargeCount `9135`

### Completed (2026-04-17 #105)
- [x] AI Domain Boundary Phase 2 production targeted QA + copy trim verification
  - production deployment `dpl_8RCgJKU4HmRuGrJUaDBUgEQYFhom` / commit `b1469ce44` (`v8.11.16`) live 확인
  - `QA-20260417-0298` 기록 (`10/10` pass): landing copy, system start → dashboard, AI sidebar welcome/placeholder, starter prompt 응답, analysis basis, `/api/version`, `/api/health`, console `0 error / 0 warning`
  - 범위 밖 surface (`fullscreen`, `Reporter/Analyst`, `observability/security`)는 targeted run 특성상 의도적으로 제외

### Completed (2026-04-16 #104)
- [x] 계획서 평가 및 개선 사이클
  - **Stream Route Contract Phase 1**: `useHybridAIQuery.ts` JSDoc 교정 (threshold 45→실제값 19 맥락 명시), `frontend-backend-comparison.md` 복잡도 라우팅 표 수정
  - **AI Domain Boundary Phase 1 완료**: `query-classifier.ts` `off-domain` intent + `isOffDomain` 플래그, `useQueryExecution.ts` 오프도메인 disclaimer warning 주입, `ChatInputArea.tsx` placeholder 도메인 안내 추가
  - **NLP/아키텍처 문서 반영**: `ai-engine-architecture.md` "NLP 엔진: 자체 구현 없음" 사실 오류 수정, `frontend-backend-comparison.md §2.3-A` NLP 전처리 파이프라인 상세 추가
  - **knowledge-base corpus drafts**: archive 이동 (실행 계획 없는 초안 모음)
  - **Backlog 재정렬**: Domain Boundary Phase 2, Sprint 4 순서 명확화

### Completed (2026-04-16 #100)
- [x] P1 `ai-workspace-analysis-basis-hydration-drift` 완전 종료
  - `stream-data-handler.ts` `data-done` 핸들러에 `toolsCalled` → deferred metadata 저장 누락 수정. `ac18ca2f9`.
  - 회귀 테스트 2케이스 추가 (deferred 경로 + pending 경로).
  - preview QA pass (sidebar→fullscreen parity 유지 확인).
  - v8.11.13 release + production QA-20260416-0294 pass (7/7, Reporter/Analyst/feedback).

### Completed (2026-04-16 #103)
- [x] Vibe Coding 공개 카피 정리
  - `feature-cards.data.ts`, `vibe-coding.ts` 수정: 모델 SKU(`claude-sonnet-4-6`) 제거, `99% 주도` → 중립 문구, Google Antigravity implementation 사용 맥락 분리, Cursor stage label 완화.
  - `docs/status.md`: Claude Code 모델 버전 `Opus 4.6` → `Sonnet 4.6` 수정.
  - 타입 체크 ✅ / 정적 검증 ✅ (Playwright WSL2 네트워크 격리로 로컬 UI 직접 검증 불가 — 다음 배포 후 production 확인).
  - 커밋: `8f9babff8`, `7ef048999`.

### Completed (2026-04-16 #102)
- [x] 계획서 archive 정리 (2차)
  - `completion-review.md`, `wbs.md`, `knowledge-base-corpus-expansion-plan.md`, `supabase-migration-ledger-repair-plan.md` → archive 이동.
  - `ai-response-visibility-rate-limit-plan-2026-04-08.md`: 메타데이터 헤더 추가 + Backlog 등록.
  - `knowledge-base-corpus-candidate-drafts.md`: Owner `platform-data` → `project` 수정.
  - 잔여 활성 plan 파일: `vibe-coding-public-copy-plan.md`, `ai-chat-improvement-plan.md`, `ai-response-visibility-rate-limit-plan-2026-04-08.md`, `knowledge-base-corpus-candidate-drafts.md`.

### Completed (2026-04-16 #101)
- [x] 계획서 디렉토리 정리 (이번 세션)
  - `approval-history-restore-plan.md`, `orphan-function-cleanup-plan.md`, `ai-user-feedback-cleanup-plan.md` → archive 이동.
  - `next-tasks-plan.md` Task 5·6 완료 처리 후 archive 이동.
  - `TODO.md` 슬림화: #1~#89 완료 이력 → `archive/todo-history-to-2026-04-13.md` 분리.
  - 잔여 Active plan (`vibe-coding-public-copy-plan.md`) Active Tasks에 등록.

### Completed (2026-04-15 #99)
- [x] AI SDK 버전 재조사 완료 — root + ai-engine 모두 `ai ^6.0.156`, `@ai-sdk/react ^3.0.140` 확인. `ai@latest` 호환성 blocker 재분류 → stale 정리로 닫음.

### Completed (2026-04-15 #98)
- [x] production release-gate QA refresh — Vercel production landing→AI sidebar 흐름 `8/8` green. `QA-20260415-0287`.

### Completed (2026-04-15 #97)
- [x] zero-backlog planning 정합성 반영 — TODO.md Active Tasks / Backlog 문구 실제 상태 반영.

### Completed (2026-04-15 #96)
- [x] QA trend metadata sync — `QA_TRENDS.md`, `QA_STATUS.md` `QA-20260415-0286` 기준으로 갱신.

### Completed (2026-04-15 #95)
- [x] mixed advisory residual follow-up — OOM/CPU+memory 혼합 3건 재검증. `no-tool` drift 미재현. non-blocking latency watch 유지.

### Completed (2026-04-15 #94)
- [x] `src/types/README.md` 필요성 재평가 → 신규 문서 불필요 판단. 기존 canonical reference로 커버 충분.

### Completed (2026-04-15 #93)
- [x] Graph traversal production 재평가 → `KEEP` 결정. topology `vector 3 + graph 1`, incident `graph 3 + vector 0` 확인. `QA-20260415-0285`.

### Completed (2026-04-15 #92)
- [x] Storybook `experimentalComponentsManifest` flag 유지 판단 고정. stable 승격 전 변경 없음.

### Completed (2026-04-15 #91)
- [x] topology duplicate invocation dedupe — `supervisor-routing.ts` step 0 이후 강제 도구 재노출 차단. revision `ai-engine-00317-sss`. `QA-20260415-0284`.

### Completed (2026-04-15 #90)
- [x] Advisor Agent P1 수정 완료 (Task 1~4) — latency 임계값 보정, 프롬프트 포맷 강화, quality-retry 트리거 추가, Cloud Run 재배포. revision `ai-engine-00316-l67`. `QA-20260415-0283`.

### Completed (2026-04-13 #89)
- [x] variant direct path 안정화 패치 — `orchestrator-web-search.ts`, `supervisor-routing.ts`, `supervisor-quality-retry.ts` 보강. revision `ai-engine-00308-6qw`. `QA-20260413-0280`.
