# Supabase Migration Ledger Repair Plan

- 상태: 완료
- 작성일: 2026-04-11
- 목표: Supabase CLI direct DB auth 복구 이후 확인된 local/remote migration ledger drift를 안전하게 정렬하고, `supabase db pull`/`supabase db push`를 다시 예측 가능하게 복구한다.

## 배경

- `npm run supabase:check:db-auth`는 현재 통과한다.
- `supabase migration list`도 성공하지만, local `supabase/migrations/`와 remote migration history가 서로 다른 체계로 누적되어 있다.
- local ledger는 `YYYYMMDD_*` 기반의 압축된 파일 집합이다.
- remote ledger는 `YYYYMMDDHHMMSS_*` 기반의 세분화된 실행 이력이다.
- 안전한 임시 worktree에서 `supabase db pull inspect_remote_schema_drift --linked --schema public`를 실행한 결과, migration history mismatch 때문에 pull이 시작되기 전에 차단됐다.
- 따라서 현재 blocker는 인증이 아니라 migration ledger parity다.

## 현재 사실

### Local examples

- `20250127_enable_pgvector.sql`
- `20250819_enhanced_security_hardening.sql`
- `20260213_simplify_rag_for_free_tier.sql`
- `20260410_restore_security_audit_logs_minimal.sql`

### Remote examples

- `20250731085344 create_mcp_monitoring_schema_fixed`
- `20250805083817 create_server_metrics_table`
- `20260213122551 simplify_rag_for_free_tier`
- `20260410140028 restore_security_audit_logs_minimal`

### 해석

- 최신 `20260410_restore_security_audit_logs_minimal.sql`처럼 논리적으로 대응되는 migration도 local/remote version id가 다르다.
- 일부 시기(`20260213_*`)는 local과 remote의 이름 계열이 비슷하지만 version id가 다르다.
- 더 이른 시기(`20250805_*`)는 remote가 더 세분화되어 있어 단순 rename으로 맞추기 어렵다.
- 따라서 현재 mismatch는 "파일 몇 개 누락"이 아니라 "ledger 모델이 다름"에 가깝다.

## 범위

### 포함

- `supabase/migrations/` ledger 정렬 전략
- remote migration history와 local SQL 파일의 대응 관계 정리
- safe worktree 기준 `db pull`/`migration repair` 재검증

### 제외

- application schema redesign
- RAG 데이터 품질 개선
- Edge Function 배포 체계 변경

## 원칙

1. 메인 저장소에서 `supabase db pull` 또는 `supabase migration repair`를 바로 실행하지 않는다.
2. drift 정렬 작업은 전용 worktree 또는 별도 브랜치에서만 수행한다.
3. 실제 실행 이력의 정확성을 해치는 "무분별한 repair"를 피한다.
4. 앞으로의 운영 기준은 "CLI가 다시 동작한다"보다 "repo ledger와 remote ledger의 권위가 일치한다"를 우선한다.

## 전략 옵션

### 옵션 A: Remote timestamp ledger를 정본으로 채택

장점:
- 실제 실행 이력과 일치한다.
- 향후 `supabase migration list`/`db pull`/`db push`가 가장 자연스럽게 맞춰진다.
- audit trail 왜곡이 없다.

단점:
- local migration 파일 rename/split/archive가 크게 발생할 수 있다.
- 기존 date-only 파일을 기준으로 한 내부 문맥과 commit history가 흔들린다.

### 옵션 B: Local compressed ledger를 정본으로 유지하고 remote history를 repair

장점:
- repo churn이 가장 작다.
- 현재 local SQL 파일 집합을 유지할 수 있다.

단점:
- remote execution history를 인위적으로 수정하게 된다.
- 실제로 실행된 세분화 migration의 audit trail이 손상된다.
- 향후 운영자가 실제 원격 이력을 해석하기 어려워진다.

### 옵션 C: 정렬을 보류하고 MCP/수동 SQL만 사용

장점:
- 지금 당장 가장 안전하다.
- 실서비스 schema 변경은 계속 가능하다.

단점:
- `db pull`/`db push` blocker가 계속 남는다.
- drift가 커질수록 나중에 정렬 비용이 더 커진다.

## 권장 방향

- 기본 권장: **옵션 A (remote timestamp ledger 정본화)**.
- 이유:
  - 현재 문제의 본질은 schema drift보다 ledger drift다.
  - 실제 실행 이력을 지우는 repair보다, repo가 원격 실행 이력을 따라가게 만드는 편이 장기적으로 더 일관된다.
  - 이미 `db pull`이 mismatch에서 멈추는 만큼, CLI 복구를 원하면 결국 version id 정렬이 필요하다.

## 단계

### Phase 1. 대응 관계 테이블 작성

- [x] local file ↔ remote version/name 대응 관계를 1차 표로 정리한다.
- [x] `1:1 rename 가능`, `1:N split 필요`, `deprecated/archive 가능` 세 분류로 나눈다.
- [ ] 특히 `20250801~20250806`, `20251217~20251231`, `20260213`, `20260410` 구간을 우선 검토한다.

#### Phase 1 1차 결과

### A. 1:1 rename 가능 후보

| Local file | Remote version/name | 판단 | 근거 |
|------------|---------------------|------|------|
| `20260410_restore_security_audit_logs_minimal.sql` | `20260410140028 restore_security_audit_logs_minimal` | rename 가능 | 이름이 사실상 동일하고, 최근 remote hotfix를 repo에 역반영한 케이스다. |
| `20260213_harden_rag_functions_and_incident_fk_indexes.sql` | `20260213121317 harden_rag_functions_and_incident_fk_indexes` | rename 가능 | suffix exact match |
| `20260213_optimize_rls_and_search_path.sql` | `20260213121427 optimize_rls_and_search_path` | rename 가능 | suffix exact match |
| `20260213_simplify_rag_for_free_tier.sql` | `20260213122551 simplify_rag_for_free_tier` | rename 가능 | suffix exact match |
| `20260213_lockdown_command_vectors_rls.sql` | `20260213123230 lockdown_command_vectors_rls` | rename 가능 | suffix exact match |
| `20260213_harden_feedback_and_server_logs_rls.sql` | `20260213124757 harden_feedback_and_server_logs_rls` | rename 가능 | suffix exact match |
| `20260213_refine_rag_command_quality.sql` | `20260213125804 refine_rag_command_quality` | rename 가능 | suffix exact match |
| `20260213_enrich_command_docs_for_monitoring_rag.sql` | `20260213131037 enrich_command_docs_for_monitoring_rag` | rename 가능 | suffix exact match |
| `20251223_create_server_metrics_history.sql` | `20251223230632 create_server_metrics_history` | rename 가능 | 이름이 동일하고 시각 차이만 있다. |
| `20251223_create_conversation_history.sql` | `20251223230707 create_conversation_history` | rename 가능 | 이름이 동일하고 시각 차이만 있다. |
| `20251226_create_approval_history.sql` | `20251225232745 create_approval_history` | rename 가능 | 하루 이내 시차만 존재 |
| `20260103_create_server_logs.sql` | `20260102152526 create_server_logs` | rename 가능 | 하루 이내 시차만 존재 |
| `20251217_create_knowledge_base_table.sql` | `20251216233232 create_knowledge_base_table` | rename 가능 | 수 시간 시차만 있는 동일 명명 |
| `20251231_migrate_to_mistral_embed.sql` | `20251231074458 migrate_to_mistral_1024d_embeddings` | semantic rename 가능 | SQL 목적이 동일하다. knowledge_base 1024d 전환 + 관련 함수 갱신 |
| `20251231_add_missing_rag_functions.sql` | `20251231110018 add_missing_rag_functions_v2` | semantic rename 가능 | SQL 목적이 동일하다. RAG 누락 함수 + 하이브리드 함수 보강 |

### B. 1:N split 필요 후보

| Local file | Remote versions | 판단 | 근거 |
|------------|-----------------|------|------|
| `20251218_create_knowledge_relationships.sql` | `20251217182536 create_knowledge_relationships`, `20251217182600 create_graph_traversal_functions`, `20251217182619 create_hybrid_graph_vector_search`, `20251217182637 add_knowledge_relationships_rls` | split 필요 | local SQL 하나에 테이블, traversal 함수, hybrid search, RLS가 함께 들어 있다. |
| `20250806_pgvector_native_functions.sql` | `20250805061846 drop_existing_pgvector_functions`, `20250805061916 create_pgvector_functions_optimized`, `20250805062104 fix_pgvector_functions_text_id`, `20250805114205 create_vector_stats_view` | split 필요 | local은 command_vectors 전용 함수 묶음이고, remote는 drop/create/fix/view로 나뉘어 있다. |

### C. deprecated/archive 또는 manual review 우선 후보

| Local file | Remote context | 판단 | 근거 |
|------------|----------------|------|------|
| `20250805_create_server_metrics.sql` | `20250805083611~20250805114205` 구간 | manual review 우선 | local은 `server_metrics` + 요약 함수 + view + sample data까지 포함한 대형 압축본이다. remote는 servers/metrics/query/vector가 분리되어 있다. |
| `20250819_enhanced_security_hardening.sql` | `20250821044800~20250821045004` 구간 + `20260410140028` | manual review 우선 | local SQL은 `security_audit_logs`, `security_threats`, `data_access_patterns`, `user_profiles` 참조까지 포함한 broad hardening이다. remote에는 최소 audit 복구만 반영돼 있다. |
| `20251204_create_ai_feedback_table.sql` | `20251207081042 create_ai_feedback_table`, `20260214123057 create_ai_feedback_table` | rename 금지 | local 파일명은 `ai_feedback`이지만 실제 SQL은 `ai_user_feedback`를 만든다. 이름과 내용이 어긋난다. |
| `20251017_simplified_server_schema.sql` | `20251201203144 create_essential_tables_cleanup`, `20251201211731 create_server_metrics_table`, `20251228073223 sync_servers_with_vercel_json` 등 | manual review 우선 | local은 `servers` + `server_alerts` + seed data 중심의 재설계본이다. remote의 점진 이력과 1:1 대응되지 않는다. |
| `20260126_drop_ai_jobs_table.sql` | `20251223000507 create_ai_jobs_table`, `20260111102629 drop_unused_empty_tables` 외 | manual review 우선 | local은 ai_jobs 전용 삭제본이고, remote는 broader cleanup 묶음으로 진행됐다. |

#### 현재 판단

- `20260213_*`, `20260410`, `20251223`, `20260103`, `20251217`, `20251231` 일부는 remote-first rename 정렬 가능성이 높다.
- `20250805`, `20250819`, `20251017`, `20251204`, `20260126`은 단순 rename으로 맞추면 ledger만 맞고 의미는 더 어긋날 위험이 높다.
- 따라서 next action은 전체 repair가 아니라 **rename-safe set과 manual-review set을 분리한 worktree 시뮬레이션**이다.

### Phase 2. Worktree에서 remote-first ledger 시뮬레이션

- [x] 전용 worktree를 만들고 local migration 파일을 remote version 체계에 맞춰 rename-safe 초안을 만든다.
- [x] 메인 저장소는 건드리지 않은 상태에서 `supabase migration list`와 `supabase db pull` 재시도 결과를 확인한다.
- [ ] pull이 통과해도 생성 SQL diff가 과도하면 다시 중단한다.

#### Phase 2 1차 결과

- 임시 worktree `/tmp/openmanager-ledger-sim.ohJVoC`에서 rename-safe set만 timestamp version으로 맞췄다.
- 메인 저장소는 오염하지 않았다.
- `supabase migration list` 결과:
  - exact match `0 -> 15`로 증가
  - remaining local-only `17`
  - remaining remote-only `51`
- exact match로 회복된 대표 항목:
  - `20251216233232 create_knowledge_base_table`
  - `20251223230632 create_server_metrics_history`
  - `20251223230707 create_conversation_history`
  - `20251231074458 migrate_to_mistral_1024d_embeddings`
  - `20251231110018 add_missing_rag_functions_v2`
  - `20260102152526 create_server_logs`
  - `20260213121317~20260213131037`
  - `20260410140028 restore_security_audit_logs_minimal`
- `supabase db pull inspect_after_safe_renames --linked --schema public`는 여전히 mismatch에서 차단됐다.
- 따라서 blocker는 rename-safe set이 아니라 **manual-review set과 split-required set**이다.

#### Phase 2 해석

- remote-first 정렬 전략 자체는 유효하다. 적어도 일부 구간은 rename만으로 ledger를 회복할 수 있다.
- 그러나 `20250805~20250819`, `20251017`, `20251124`, `20251204`, `20251218`, `20251219`, `20251231 일부`, `20260126` 구간은 아직 자동화 대상으로 보기 어렵다.
- 다음 단계는 rename-safe set 확대가 아니라, 남은 `17 local-only / 51 remote-only` 항목을 그룹별로 더 세분화하는 것이다.

#### Phase 2 2차 결과 (Bucket 5 한정 시뮬레이션)

- 같은 worktree에서 다음 ledger-only 시뮬레이션을 추가 적용했다.
  - `20251219_add_bm25_text_search.sql` → `20251217203434_add_bm25_text_search.sql`
  - `20251218_unify_server_data_with_vercel.sql` → `20251228073223_sync_servers_with_vercel_json.sql`
  - `20251218_create_knowledge_relationships.sql` → 아래 4개 remote version으로 split-only 복제
    - `20251217182536_create_knowledge_relationships.sql`
    - `20251217182600_create_graph_traversal_functions.sql`
    - `20251217182619_create_hybrid_graph_vector_search.sql`
    - `20251217182637_add_knowledge_relationships_rls.sql`
- 결과:
  - exact match `15 -> 21`
  - remaining local-only `14`
  - remaining remote-only `45`
- `supabase db pull inspect_after_bucket5 --linked --schema public`는 여전히 mismatch에서 차단됐다.

#### Phase 2 2차 해석

- `Bucket 5` 안에서도 `20251218/20251219/20251228073223` 축은 remote-first 정렬 가능성이 높다.
- 반면 아래 remote-only 항목은 local 파일 자체가 없어서 rename/split만으로는 해소되지 않는다.
  - `20251217163520 create_incident_reports_table`
  - `20251219101716 create_system_rules_table`
  - `20251222061727 add_checkpoint_blobs_and_writes`
  - `20251223000507 create_ai_jobs_table`
  - `20251223031738 create_agent_context_table`
  - `20251224104744`, `20251224104809`, `20251224104917`, `20251224104945`
  - `20251231074334 add_metadata_column_to_knowledge_base`
  - `20260214123057 create_ai_feedback_table`
- `rg` 기준 local migration에는 `incident_reports`, `system_rules`, `agent_context`, `ai_jobs`, `checkpoint` 생성 SQL이 없다.
- 따라서 다음 단계의 핵심은 split 시뮬레이션이 아니라 **import-required remote-only set 판정**이다.

#### current-schema-critical import candidates (3차 판정)

### 1. Repo ledger에 import 또는 별도 timestamp migration 반영이 필요한 후보

| Remote migration | 현재 remote schema | 로컬 근거 | 판정 |
|------------------|--------------------|----------|------|
| `20251217163520 create_incident_reports_table` | `public.incident_reports` 존재, app/ai-engine에서 적극 사용 | `src/database/migrations/003_create_incident_reports_table.sql`에 유사 SQL 존재 | import-required |
| `20251219101716 create_system_rules_table` | `public.system_rules` 존재, `src/config/rules/loader.ts`가 직접 사용 | `supabase/migrations/` 내 생성 SQL 부재 | import-required |
| `20251231074334 add_metadata_column_to_knowledge_base` | `public.knowledge_base.metadata` 존재 | local `20251217_create_knowledge_base_table.sql`에는 `metadata` 컬럼이 없음 | import-required |
| `20260214123057 create_ai_feedback_table` | `public.ai_feedback` 존재, `src/app/api/ai/feedback/route.ts`가 직접 사용 | local에는 `ai_user_feedback` 생성본만 존재 | import-required |

### 2. 역사적(remote-only) 이력으로 보고 ledger-only 반영 여부만 판단할 후보

| Remote migration | 현재 remote schema | 판단 |
|------------------|--------------------|------|
| `20251222061727 add_checkpoint_blobs_and_writes` | `checkpoint_blobs`, `checkpoint_writes` 부재 | history-only 가능성 높음 |
| `20251223000507 create_ai_jobs_table` | `ai_jobs` 부재, local에 drop만 존재 | history-only 가능성 높음 |
| `20251223031738 create_agent_context_table` | `agent_context` 부재 | history-only 가능성 높음 |
| `20251224104744`, `20251224104809`, `20251224104917`, `20251224104945` | checkpoint/function hardening 계열로 추정 | 관련 table 부재, history-only 우선 |

### 3. alternate source가 있는 후보

- `incident_reports`는 `supabase/migrations/`에는 없지만 [src/database/migrations/003_create_incident_reports_table.sql](/mnt/d/dev/openmanager-ai/src/database/migrations/003_create_incident_reports_table.sql:1)에 생성 SQL이 있다.
- 따라서 `import-required`라고 해도 "완전히 새로 작성"할 필요는 없다. 다만 Supabase ledger용 timestamp migration으로 재구성할지, reference-only로 둘지 결정해야 한다.

#### 3차 해석

- 이제 drift의 본질은 두 갈래다.
  1. rename/split로 회복 가능한 ledger mismatch
  2. repo `supabase/migrations/`에 실제 timestamp migration이 없는 current-schema-critical objects
- 다음 실행 우선순위는 `current-schema-critical import candidates` 4건이다.
- 반대로 `ai_jobs`, `agent_context`, checkpoint 계열은 현재 schema에 남아 있지 않으므로, import보다는 history-only 취급이 맞는지 먼저 판단해야 한다.

#### import 후보별 실행 방식 (4차 판정)

| Candidate | 권장 방식 | 이유 |
|-----------|-----------|------|
| `20251217163520 create_incident_reports_table` | alternate-source import | `supabase/migrations/`에는 없지만 [003_create_incident_reports_table.sql](/mnt/d/dev/openmanager-ai/src/database/migrations/003_create_incident_reports_table.sql:1)에 생성 SQL이 있다. current remote schema와 앱 사용처도 명확하다. |
| `20251219101716 create_system_rules_table` | remote-schema recreate | local 생성본이 없다. 하지만 current remote schema와 [loader.ts](/mnt/d/dev/openmanager-ai/src/config/rules/loader.ts:8) 사용 계약이 명확하므로, remote schema를 기준으로 timestamp migration을 재구성하는 것이 맞다. |
| `20251231074334 add_metadata_column_to_knowledge_base` | additive patch import | 전체 table recreate가 아니라 local `20251217_create_knowledge_base_table.sql` 이후에 `metadata jsonb default '{}'::jsonb`만 추가하는 patch 성격이다. |
| `20260214123057 create_ai_feedback_table` | runtime-contract recreate | 현재 app은 [route.ts](/mnt/d/dev/openmanager-ai/src/app/api/ai/feedback/route.ts:27) 에서 `ai_feedback`를 직접 사용한다. local `20251204_create_ai_feedback_table.sql`은 실제로 `ai_user_feedback`를 생성하므로 대체 불가하다. |

#### 4차 해석

- `incident_reports`는 “새 migration 작성”보다 “existing alternate source를 Supabase ledger로 편입”하는 문제다.
- `system_rules`와 `ai_feedback`는 local SSOT 부재 또는 semantic mismatch 때문에 remote schema recreate가 필요하다.
- `knowledge_base.metadata`는 가장 단순하다. 별도 full-table import가 아니라 additive patch로 정리하면 된다.
- 따라서 다음 실무 단계는 4건을 한 번에 정리하려 하지 말고 아래 순서로 worktree 초안을 만드는 것이다.
  1. `20251231074334 add_metadata_column_to_knowledge_base`
  2. `20251217163520 create_incident_reports_table`
  3. `20251219101716 create_system_rules_table`
  4. `20260214123057 create_ai_feedback_table`

#### Phase 2 3차 결과 (Import 후보 2건 초안 시뮬레이션)

- temp worktree에 아래 2개 timestamp migration 초안을 추가했다.
  - `20251231074334_add_metadata_column_to_knowledge_base.sql`
  - `20251217163520_create_incident_reports_table.sql`
- 초안 기준:
  - `knowledge_base.metadata`는 additive patch로만 반영
  - `incident_reports`는 [003_create_incident_reports_table.sql](/mnt/d/dev/openmanager-ai/src/database/migrations/003_create_incident_reports_table.sql:1)을 바탕으로 하되 `DROP TABLE` 없이, 현재 remote schema 컬럼 집합까지만 유지
- remote ledger는 DB에서 직접 조회하고, temp worktree의 local file list와 비교했다.
- 결과:
  - exact match `21 -> 23`
  - remaining local-only `12`
  - remaining remote-only `43`
- `supabase db pull inspect_after_import_candidates --linked --schema public`는 여전히 mismatch에서 차단됐다.

#### Phase 2 3차 해석

- `knowledge_base.metadata`와 `incident_reports`는 이제 “import draft 가능”이 아니라 “ledger blocker에서 제거됨”으로 봐도 된다.
- current-schema-critical remote-only 후보는 사실상 아래 2건만 남는다.
  - `20251219101716 create_system_rules_table`
  - `20260214123057 create_ai_feedback_table`
- 따라서 다음 단계의 초점은 broad repair가 아니라, `system_rules`와 `ai_feedback`를 remote-schema recreate 방식으로 ledger 초안화하는 것이다.
- 반대로 아래 remote-only 세트는 여전히 history-only 또는 manual-review 우선이다.
  - `20251222061727 add_checkpoint_blobs_and_writes`
  - `20251223000507 create_ai_jobs_table`
  - `20251223031738 create_agent_context_table`
  - `20251224104744`, `20251224104809`, `20251224104917`, `20251224104945`

#### Phase 2 4차 결과 (Import 후보 4건 전체 초안 시뮬레이션)

- temp worktree에 아래 2개 timestamp migration 초안을 추가했다.
  - `20251219101716_create_system_rules_table.sql`
  - `20260214123057_create_ai_feedback_table.sql`
- 초안 기준:
  - `system_rules`는 current remote schema의 컬럼/unique index/read policy를 기준으로 재구성
  - `ai_feedback`는 current runtime contract와 remote schema를 기준으로 재구성
- remote ledger와 temp worktree 파일 목록을 다시 비교한 결과:
  - exact match `23 -> 25`
  - remaining local-only `12`
  - remaining remote-only `41`
- `supabase db pull inspect_after_all_import_candidates --linked --schema public`는 여전히 mismatch에서 차단됐다.

#### Phase 2 4차 해석

- current-schema-critical import 후보 4건은 모두 temp worktree ledger에 반영됐다.
- 따라서 남은 remote-only `41`건은 사실상 모두 `history-only / manual-review` 영역이다.
- 이제 `db pull` blocker의 성격은 “현재 schema에 필요한 객체 부재”가 아니라, 압축 local ledger와 세분화 remote ledger의 역사 불일치다.
- 다음 단계는 더 많은 recreate draft가 아니라 아래 둘 중 하나를 결정하는 작업이다.
  1. remote timestamp ledger를 정본으로 삼고 history-only 세트를 local ledger로 수용
  2. local 압축 ledger를 유지하고, remote migration history를 repair 대상으로 본다
- 현재까지의 관측상 `db pull`을 통과시키려면 1번, 즉 remote-first history 수용 방향이 더 현실적이다.

#### 잔여 mismatch bucket (2차 분류)

### Bucket 1. Early bootstrap / monitoring origin

- local-only:
  - `20250127`
  - `20250801`
  - `20250805`
  - `20250806`
- remote-only:
  - `20250731085344`
  - `20250731085432`
  - `20250803015807`
  - `20250805061846~20250805114205`
  - `20250806120552`
  - `20250806121533`
  - `20250807044444`

판단:
- 이 구간은 초기 bootstrap이 remote에서 세분화된 상태로 남아 있다.
- local `20250805`, `20250806`은 압축본/재작성본 성격이 강하다.
- 우선순위는 낮지 않지만, 자동 rename 대상이 아니다.

### Bucket 2. Security hardening and function search-path fixes

- local-only:
  - `20250819`
- remote-only:
  - `20250821044800`
  - `20250821044828`
  - `20250821044841`
  - `20250821044908`
  - `20250821045004`
  - `20250828051431`
  - `20250828051528`

판단:
- local `20250819_enhanced_security_hardening.sql`은 broad hardening 묶음이다.
- remote는 세분화된 search_path / recursion / exec_sql 복구 이력이다.
- manual review 우선이며, remote repair로 지우면 audit trail 손실이 크다.

### Bucket 3. Vector/index maintenance drift

- local-only:
  - `20250906`
  - `20250929`
  - `20251124` x2
- remote-only:
  - `20250906043934`

판단:
- local `20250906_upgrade_to_hnsw_index.sql`은 incident/knowledge_base/command_vectors 전부를 다루는 broad 인덱스 업그레이드다.
- remote `20250906043934 create_ml_training_results_table_fixed`와는 직접 대응되지 않는다.
- `20251124_*`는 `command_vectors` 복구/유지보수 성격이고, remote 2025-11 ledger에는 직접 대응 항목이 없다.
- 이 구간은 rename보다 “현 schema 기준 archive 가능 여부” 평가가 먼저다.

### Bucket 4. Server schema / feedback / knowledge bootstrap drift

- local-only:
  - `20251017`
  - `20251204`
- remote-only:
  - `20251201203144`
  - `20251201211731`
  - `20251207081042`
  - `20251207081100`

판단:
- local `20251017_simplified_server_schema.sql`은 `servers + server_alerts + seed` 재설계본이다.
- local `20251204_create_ai_feedback_table.sql`은 파일명과 SQL 의미가 어긋난다. 실제 SQL은 `ai_user_feedback`.
- 이 구간은 ledger 정렬보다 파일 의미 교정이 우선이다.

### Bucket 5. Knowledge graph and RAG split zone

- local-only:
  - `20251218` x2
  - `20251219`
  - `20251231` x1 (`migrate_command_vectors_to_mistral`)
- remote-only:
  - `20251217163520`
  - `20251217182536`
  - `20251217182600`
  - `20251217182619`
  - `20251217182637`
  - `20251217203434`
  - `20251219101716`
  - `20251222061727`
  - `20251223000507`
  - `20251223031738`
  - `20251224104744`
  - `20251224104809`
  - `20251224104917`
  - `20251224104945`
  - `20251228073223`
  - `20251231074334`

판단:
- 이 구간은 현재 남은 mismatch의 중심이다.
- `20251218_create_knowledge_relationships.sql`는 분명한 split 대상이다.
- `20251219_add_bm25_text_search.sql`도 remote `20251217203434 add_bm25_text_search`와 semantic rename 가능성이 있지만 아직 증거를 더 확인해야 한다.
- `20251231_migrate_command_vectors_to_mistral.sql`는 remote `20251231074334 add_metadata_column_to_knowledge_base`와는 무관하다.
- 따라서 다음 시뮬레이션 우선순위는 이 bucket이다.

### Bucket 6. AI jobs cleanup drift

- local-only:
  - `20260126` x2
- remote-only:
  - `20260111102629`
  - `20260111102641`
  - `20260111102654`
  - `20260111102712`

판단:
- local은 `drop_ai_jobs_table` + `update_hybrid_search_vector_dim` 압축 ledger다.
- remote는 broader cleanup chain이다.
- 자동 rename보다 archival/manual mapping 후보에 가깝다.

### Bucket 7. Late duplicate feedback migration

- remote-only:
  - `20260214123057 create_ai_feedback_table`

판단:
- local에는 이미 `20251204_create_ai_feedback_table.sql`이 있지만 의미가 다르다.
- duplicate/semantic mismatch 가능성이 높아 별도 판정이 필요하다.

#### Phase 3 3차 분류 (history-only import vs local legacy handling)

### A. remote-only bucket 처리 원칙

| Bucket | 권장 처리 | 이유 |
|--------|-----------|------|
| Bucket 1 (`20250731~20250807`) | history-only import 우선 | 초기 bootstrap/monitoring chain이다. local `20250805`, `20250806`은 압축본 성격이 강하고, remote execution history를 repair로 지우는 쪽이 더 위험하다. |
| Bucket 2 (`20250821~20250828`) | history-only import 우선 | search_path / recursion / exec_sql 복구 계열이다. local `20250819` broad hardening으로 대체할 수 없고, remote audit trail 보존이 중요하다. |
| Bucket 6 (`20260111_*`) | history-only import 우선 | current remote schema에는 `ai_jobs`가 없고, 이 4건은 cleanup chain 역할이다. local `20260126` 압축본으로 remote history를 대체하면 의미가 손상된다. |
| Bucket 7 (`20260214123057`) | active import 완료 | current-schema-critical candidate로 이미 temp worktree 초안 반영을 마쳤다. |

### B. local-only bucket 처리 원칙

| Local file / bucket | 권장 처리 | 이유 |
|---------------------|-----------|------|
| `20250906_upgrade_to_hnsw_index.sql` | rewrite 또는 archive 후보 | 현재 remote `incident_reports`에는 `embedding` 컬럼이 없고, `command_vectors`에도 HNSW index가 없다. local SQL을 그대로 ledger 정본으로 보기 어렵다. |
| `20250929_add_response_to_query_logs.sql` | archive 우선 | current remote schema에 `query_logs` table 자체가 없다. active ledger 후보가 아니라 과거 경로로 보는 편이 맞다. |
| `20251124_create_command_vectors_table.sql` | rewrite 후보 | current remote schema에 `command_vectors` table은 존재하고 컬럼 집합도 대체로 맞는다. 다만 remote ledger에 직접 대응 이력이 없으므로, 유지하려면 remote-first 기준으로 재작성해야 한다. |
| `20251124_vector_db_maintenance.sql` | archive 우선 | `command_vectors_backup`, `vector_search_logs` 등 관련 객체가 current remote schema에 없다. active ledger보다 historical utility에 가깝다. |
| `20251017_simplified_server_schema.sql` | archive 우선 | current remote schema에 `servers`, `server_alerts`가 없고, local seed 중심 재설계본이라 remote incremental history와 맞지 않는다. |
| `20251204_create_ai_feedback_table.sql` | semantic-fix 우선 | 파일명은 `ai_feedback`이지만 실제 SQL은 `ai_user_feedback`를 만든다. active ledger로 유지하려면 먼저 이름/의미를 바로잡아야 한다. |

#### Phase 3 3차 해석

- remote-only Bucket 1/2/6은 `repair 대상`보다 `history-only import 대상`으로 보는 것이 맞다.
- local-only Bucket 3/4는 성격이 다르다.
  - `archive 우선`: `20250929`, `20251124_vector_db_maintenance`, `20251017`
  - `rewrite 후보`: `20250906`, `20251124_create_command_vectors_table`
  - `semantic-fix 우선`: `20251204_create_ai_feedback_table`
- 따라서 다음 단계의 실무 순서는 아래와 같다.
  1. Bucket 1/2/6 remote-only 세트의 history-only import 초안 범위를 정한다.
  2. `20251204_create_ai_feedback_table.sql`의 semantic-fix 방향을 결정한다.
  3. `20250906`, `20251124_create_command_vectors_table.sql`를 active rewrite 후보로 남길지 archive로 내릴지 별도 검토한다.

#### Phase 3 4차 분류 (Bucket 1/2/6 timestamp-level 판정)

### A. Bucket 1 (`20250731~20250807`) remote-only

#### history-only import

- `20250805061846 drop_existing_pgvector_functions`
- `20250805061916 create_pgvector_functions_optimized`
- `20250805062104 fix_pgvector_functions_text_id`
- `20250805083611 create_servers_table`
- `20250805083633 enable_servers_rls_policies`
- `20250805083724 add_servers_indexes`
- `20250805083817 create_server_metrics_table`
- `20250805104705 create_query_logs_table`
- `20250805111318 create_incident_reports_table`
- `20250805113019 create_vector_search_function`
- `20250805113221 add_vector_indexes`
- `20250805114205 create_vector_stats_view`

판단:
- local `20250805`, `20250806` 압축 ledger와 `src/database/migrations/002~004`의 초기 모니터링/incident/query 경로를 설명하는 실제 remote execution history다.
- 일부 객체(`servers`, `server_metrics`, `query_logs`)는 현재 schema에 없더라도 later cleanup과 semantic-fix 판단의 기준점 역할을 한다.
- 특히 `incident_reports`, `get_vector_stats`, `exec_sql`로 이어지는 현재 runtime/ops 문맥과도 연결된다.

#### hold

- `20250731085344 create_mcp_monitoring_schema_fixed`
- `20250731085432 add_mcp_analysis_functions`
- `20250803015807 create_thinking_steps_table`
- `20250806120552 004_create_intelligent_monitoring_tables`
- `20250806121533 create_ai_insight_tables`
- `20250807044444 create_hourly_server_states_table`

판단:
- current remote schema에 `mcp_monitoring`, `thinking_steps`, `hourly_server_states`가 없고, active runtime 경로에서도 직접 참조가 희박하다.
- `supabase/seeds/hourly_server_states_complete.sql`와 legacy docs 흔적은 있지만, 우선은 history-only import보다 hold로 두는 편이 안전하다.

### B. Bucket 2 (`20250821~20250828`) remote-only

#### history-only import

- `20250821044800 enable_rls_on_critical_tables`
- `20250821044828 fix_function_search_paths_batch1`
- `20250821044841 fix_function_search_paths_batch2`
- `20250821044908 fix_remaining_functions_and_views`
- `20250821045004 fix_remaining_search_path_functions`
- `20250828051431 fix_vector_documents_stats_infinite_recursion`
- `20250828051528 create_exec_sql_function`

판단:
- remote security/search-path hardening 실행 이력 자체가 중요하다.
- current remote에는 `exec_sql`, `get_vector_stats` 등 이 흐름의 산물이 남아 있고, local `20250819` broad hardening으로 대체할 수 없다.

### C. Bucket 6 (`20260111_*`) remote-only

#### history-only import

- `20260111102629 drop_unused_empty_tables`
- `20260111102641 drop_servers_table`
- `20260111102654 drop_langgraph_checkpoint_tables`
- `20260111102712 drop_checkpoint_migrations`

판단:
- current remote schema에 `ai_jobs`, `servers`, checkpoint 관련 table이 남아 있지 않은 이유를 설명하는 cleanup chain이다.
- local `20260126` 압축 ledger가 존재하더라도, remote execution history를 먼저 보존하는 쪽이 맞다.

#### Phase 3 4차 해석

- Bucket 2/6은 사실상 전부 `history-only import` 대상으로 봐도 무방하다.
- Bucket 1은 mixed set이다.
  - bootstrap/query/incident/vector function 계열: `history-only import`
  - `mcp_monitoring` / `thinking_steps` / `ai_insight` / `hourly_server_states`: `hold`
- 따라서 바로 다음 실무 단계는 다음 둘이다.
  1. Bucket 2/6 + Bucket 1 import subset에 대한 timestamp stub 초안 범위를 정한다.
  2. Bucket 1 hold 세트를 실제로 계속 보류할지, legacy archive로 별도 문서화할지 결정한다.

#### Phase 3 5차 결정 (history-only import stub scope)

### 1. 1차 stub 후보 범위

- **총 23개 timestamp stub**
  - Bucket 1 import subset: `12`
  - Bucket 2: `7`
  - Bucket 6: `4`

#### Bucket 1 import subset (12)

- `20250805061846 drop_existing_pgvector_functions`
- `20250805061916 create_pgvector_functions_optimized`
- `20250805062104 fix_pgvector_functions_text_id`
- `20250805083611 create_servers_table`
- `20250805083633 enable_servers_rls_policies`
- `20250805083724 add_servers_indexes`
- `20250805083817 create_server_metrics_table`
- `20250805104705 create_query_logs_table`
- `20250805111318 create_incident_reports_table`
- `20250805113019 create_vector_search_function`
- `20250805113221 add_vector_indexes`
- `20250805114205 create_vector_stats_view`

#### Bucket 2 (7)

- `20250821044800 enable_rls_on_critical_tables`
- `20250821044828 fix_function_search_paths_batch1`
- `20250821044841 fix_function_search_paths_batch2`
- `20250821044908 fix_remaining_functions_and_views`
- `20250821045004 fix_remaining_search_path_functions`
- `20250828051431 fix_vector_documents_stats_infinite_recursion`
- `20250828051528 create_exec_sql_function`

#### Bucket 6 (4)

- `20260111102629 drop_unused_empty_tables`
- `20260111102641 drop_servers_table`
- `20260111102654 drop_langgraph_checkpoint_tables`
- `20260111102712 drop_checkpoint_migrations`

### 2. stub 작성 원칙

- 이 23개는 **active schema recreate migration이 아니라 ledger parity용 history-only stub** 로 다룬다.
- 원칙:
  - current hosted schema를 다시 바꾸지 않는다.
  - 나중에 fresh DB bootstrap의 정본으로 삼지 않는다.
  - 파일 상단에 `history-only import`, `non-replayable`, `remote execution preserved`를 명시한다.
- 구현 방식은 아래 둘 중 하나를 우선 검토한다.
  1. comment-only file
  2. no-op `DO $$ BEGIN RAISE NOTICE ... END $$;`

#### stub 형식 결정

- **채택 형식: no-op `DO $$ BEGIN RAISE NOTICE ... END $$;`**
- 이유:
  1. comment-only file보다 SQL statement가 명시적이라 migration runner 관점에서 해석이 덜 모호하다.
  2. 실수로 apply되더라도 current hosted schema에 side effect를 만들지 않는다.
  3. 파일 내부에 `history-only import`, remote version, 원래 migration name을 함께 남기기 쉽다.
- 표준 헤더 초안:
  - `history-only import`
  - `non-replayable`
  - `remote execution preserved`
  - `do not treat as fresh-bootstrap schema source`

### 3. Bucket 1 hold 처리 원칙

- 아래 6건은 **stub 범위에서 제외**한다.
  - `20250731085344 create_mcp_monitoring_schema_fixed`
  - `20250731085432 add_mcp_analysis_functions`
  - `20250803015807 create_thinking_steps_table`
  - `20250806120552 004_create_intelligent_monitoring_tables`
  - `20250806121533 create_ai_insight_tables`
  - `20250807044444 create_hourly_server_states_table`
- 처리 방향:
  - 현재는 `hold`
  - active ledger repair 경로에서는 제외
  - 별도 legacy note로 분리
- 이유:
  - current remote schema와 active runtime 참조가 약하다.
  - 섣불리 ledger에 넣어도 `db pull` 회복보다 churn만 키울 가능성이 있다.

#### Bucket 1 hold 처리 결정

- **채택 방향: legacy note 분리**
- 문서 위치:
  - [README.legacy-ledger-hold.md](/mnt/d/dev/openmanager-ai/supabase/README.legacy-ledger-hold.md)
- 목적:
  - `mcp_monitoring`, `thinking_steps`, `ai_insight`, `hourly_server_states` 계열 remote-only history를 active ledger repair 경로와 분리한다.
  - 이후 이 세트가 다시 current schema 또는 active runtime에 등장할 때만 재평가한다.

#### Phase 3 5차 해석

- 이제 `history-only import`의 범위는 추상 계획이 아니라 **23개 timestamp stub**으로 구체화됐다.
- 다음 실무 단계는 broad discussion이 아니라, 이 23개를 실제로 어떤 디렉터리/네이밍 규칙으로 추가할지 결정하는 것이다.
- `Bucket 1 hold` 6건은 active ledger 복구 경로에서 제외하고 legacy note로 관리한다.

#### Phase 3 6차 결과 (no-op stub 샘플 검증)

- temp worktree에 no-op stub 샘플 2개를 추가했다.
  - `20250828051528_create_exec_sql_function.sql`
  - `20260111102629_drop_unused_empty_tables.sql`
- 형식:
  - `history-only import`
  - `non-replayable`
  - `remote execution preserved`
  - no-op `DO $$ BEGIN RAISE NOTICE ... END $$;`
- remote/local version 비교 결과:
  - exact match `25 -> 27`
  - remaining local-only `12`
  - remaining remote-only `39`

#### Phase 3 6차 해석

- no-op `DO $$` 형식은 ledger count를 예상대로 줄였고, temp worktree 시뮬레이션 기준 추가적인 구조 문제는 보이지 않았다.
- 따라서 `history-only import 23개` 전체를 같은 형식으로 확장하는 방향은 유지 가능하다.
- 다음 단계는 broad planning이 아니라, 23개 중 어느 subset부터 batch로 추가할지 정하는 일이다.

#### Phase 3 7차 결과 (Bucket 2 + 6 1차 batch 시뮬레이션)

- temp worktree에 `Bucket 2 + Bucket 6`의 history-only import stub `11`개를 추가했다.
  - Bucket 2: `7`
  - Bucket 6: `4`
- 형식은 Phase 3 6차에서 검증한 no-op `DO $$ ... $$;`를 그대로 사용했다.
- remote/local version 비교 결과:
  - exact match `27 -> 36`
  - remaining local-only `12`
  - remaining remote-only `30`
- `supabase db pull inspect_after_bucket2_6_stub_batch --linked --schema public`는 여전히 mismatch에서 차단됐다.

#### Phase 3 7차 해석

- `Bucket 2 + 6`은 예상대로 안전하게 count를 줄였다.
- 따라서 이 두 bucket은 실제 batch 적용 시에도 `history-only import`로 처리해도 무리가 없을 가능성이 높다.
- 현재 남은 remote-only `30`의 구성은 대략 아래와 같다.
  - Bucket 1 전체 `18`
  - Bucket 3 remote-only `1`
  - Bucket 4 remote-only `4`
  - Bucket 5 history-only/manual-review 세트 `7`
- 다음 batch 우선순위는 그대로 `Bucket 1 import subset 12`가 맞다.
  - 이유: hold 6건을 제외하면 남은 remote-only를 가장 크게 줄일 수 있다.
  - 이 batch가 끝나면 remote-only는 이론상 `30 -> 18` 수준으로 내려간다.

#### Phase 3 8차 결과 (Bucket 1 import subset 12개 2차 batch 시뮬레이션)

- temp worktree에 `Bucket 1 import subset` history-only import stub `12`개를 추가했다.
- 형식은 기존과 동일한 no-op `DO $$ ... $$;`를 사용했다.
- remote/local version 비교 결과:
  - exact match `36 -> 48`
  - remaining local-only `12`
  - remaining remote-only `18`
- `supabase db pull inspect_after_bucket1_import_batch --linked --schema public`는 여전히 mismatch에서 차단됐다.

#### Phase 3 8차 해석

- `Bucket 1 import subset 12`도 예상대로 count를 크게 줄였다.
- 이제 남은 remote-only `18`은 사실상 아래 세트만 남는다.
  - `Bucket 1 hold` `6`
  - `Bucket 3 remote-only` `1`
  - `Bucket 4 remote-only` `4`
  - `Bucket 5 history-only/manual-review` `7`
- 즉, active remote-first history 수용 대상으로 계획했던 대형 import batch는 사실상 끝났다.
- 다음 단계는 더 많은 history-only stub 추가가 아니라, 남은 `18 remote-only`와 `12 local-only`를 `hold / archive / rewrite / semantic-fix`로 정리하는 것이다.

#### Phase 3 9차 결과 (remaining mismatch handling split)

- current remote schema를 다시 대조한 결과, `public.ai_feedback`와 `public.ai_user_feedback`가 **둘 다 존재**한다.
- 따라서 local [20251204_create_ai_feedback_table.sql](/mnt/d/dev/openmanager-ai/supabase/migrations/20251204_create_ai_feedback_table.sql:1)은 단순 오기라기보다, 실제로는 **`ai_user_feedback` legacy track**을 가리키는 semantic mismatch 파일로 보는 편이 맞다.
- 남은 remote-only `18`은 아래처럼 다시 나뉜다.

##### A. intentional hold / deferred history (`7`)

- Bucket 1 hold `6`
  - `20250731085344 create_mcp_monitoring_schema_fixed`
  - `20250731085432 add_mcp_analysis_functions`
  - `20250803015807 create_thinking_steps_table`
  - `20250806120552 004_create_intelligent_monitoring_tables`
  - `20250806121533 create_ai_insight_tables`
  - `20250807044444 create_hourly_server_states_table`
- Bucket 3 deferred history `1`
  - `20250906043934 create_ml_training_results_table_fixed`

판단:
- 위 `7`건은 current remote schema에 직접 남아 있지 않거나 active runtime 참조가 희박하다.
- 특히 `ml_training_results`는 [cleanup-unused-tables.sql](/mnt/d/dev/openmanager-ai/reports/history/legacy-scripts/2026-04-10/scripts/supabase/cleanup-unused-tables.sql:48) 기준 이미 정리 대상으로 판정돼 있어, 지금 시점에서는 active ledger parity보다는 `deferred history`로 두는 편이 안전하다.

##### B. history-only import candidate (`11`)

- Bucket 4 `4`
  - `20251201203144 create_essential_tables_cleanup`
  - `20251201211731 create_server_metrics_table`
  - `20251207081042 create_ai_feedback_table`
  - `20251207081100` (ai_feedback follow-up로 추정, exact name recovery 필요)
- Bucket 5 `7`
  - `20251222061727 add_checkpoint_blobs_and_writes`
  - `20251223000507 create_ai_jobs_table`
  - `20251223031738 create_agent_context_table`
  - `20251224104744`
  - `20251224104809`
  - `20251224104917`
  - `20251224104945`

판단:
- 이 `11`건은 current runtime의 active recreate 대상은 아니지만, remote execution history 자체는 보존 가치가 있다.
- current remote schema에 `ai_jobs`, `agent_context`, checkpoint 관련 table이 없다는 점은 **history-only import** 판정과 충돌하지 않는다. 오히려 later cleanup chain과 함께 remote-first ledger를 설명하는 근거가 된다.
- 다만 `20251207081100`, `20251224104744`, `20251224104809`, `20251224104917`, `20251224104945`는 현재 저장소 근거만으로 exact migration name을 복원하지 못했으므로, stub 추가 전 naming recovery 또는 보수적 placeholder 정책을 결정해야 한다.

##### C. local-only `12`의 최신 처리 축

- archive 우선
  - `20250929_add_response_to_query_logs.sql`
  - `20251017_simplified_server_schema.sql`
  - `20251124_vector_db_maintenance.sql`
- rewrite 후보
  - `20250906_upgrade_to_hnsw_index.sql`
  - `20251124_create_command_vectors_table.sql`
- semantic split / rename 필요
  - `20251204_create_ai_feedback_table.sql` -> `ai_feedback`가 아니라 `ai_user_feedback` track으로 분리 검토

#### Phase 3 9차 해석

- 남은 mismatch는 이제 `remote-only 18` 전체가 아니라,
  1. `intentional hold 7`
  2. `history-only import candidate 11`
  3. `local-only 12`의 `archive / rewrite / semantic-split`
  로 분리된다.
- 특히 `ai_feedback`와 `ai_user_feedback`가 현재 remote에 공존한다는 점은 중요하다.
  - `20260214123057 create_ai_feedback_table`은 runtime-contract recreate
  - local `20251204_create_ai_feedback_table.sql`은 별도의 `ai_user_feedback` track
  - 따라서 둘을 rename 대응시키면 안 된다.
- 다음 실무 단계는 broad repair가 아니라, `history-only import candidate 11`에 대한 stub naming policy를 정하고 temp worktree에서 3차 batch로 검증하는 일이다.

#### Phase 3 10차 결과 (remaining history-only 11 naming recovery + 3차 batch)

- MCP `list_migrations`로 ambiguous remote-only `5`건의 exact name을 복원했다.
  - `20251207081100 add_ml_training_helpers`
  - `20251224104744 enable_rls_checkpoint_tables`
  - `20251224104809 fix_security_definer_views`
  - `20251224104917 fix_function_search_paths_v3`
  - `20251224104945 fix_remaining_function_search_path`
- temp worktree에 남은 `history-only import candidate 11` 전부를 no-op stub로 추가했다.
  - `20251201203144 create_essential_tables_cleanup`
  - `20251201211731 create_server_metrics_table`
  - `20251207081042 create_ai_feedback_table`
  - `20251207081100 add_ml_training_helpers`
  - `20251222061727 add_checkpoint_blobs_and_writes`
  - `20251223000507 create_ai_jobs_table`
  - `20251223031738 create_agent_context_table`
  - `20251224104744 enable_rls_checkpoint_tables`
  - `20251224104809 fix_security_definer_views`
  - `20251224104917 fix_function_search_paths_v3`
  - `20251224104945 fix_remaining_function_search_path`
- temp worktree 기준 `supabase migration list` 결과:
  - exact match `48 -> 59`
  - remaining local-only `12`
  - remaining remote-only `7`
- remaining remote-only `7`은 이제 전부 아래 세트뿐이다.
  - Bucket 1 hold `6`
  - Bucket 3 deferred history `1` (`create_ml_training_results_table_fixed`)
- `supabase db pull inspect_after_remaining_history_only_batch --linked --schema public` 재검증은 이번에는 immediate mismatch 대신 temp role SCRAM retry로 전환됐다.
  - 즉, ledger mismatch는 크게 줄었지만 `db pull` 최종 통과 여부는 temp-role auth 경로가 안정적인 상태에서 다시 확인해야 한다.

#### Phase 3 10차 해석

- active remote-first history import batch는 사실상 끝났다.
- 남은 remote-only `7`은 설계상 intentional hold/deferred history로 남겨둔 세트라, 이제 실질 작업의 중심은 `local-only 12` 처리로 이동한다.
- 현재 시점의 우선순위는 아래 순서가 맞다.
  1. `local-only 12`를 `archive / rewrite / semantic-split`로 실제 파일 단위 확정
  2. `20251204_create_ai_feedback_table.sql`를 `ai_user_feedback` track으로 분리할지 결정
  3. temp-role auth 경로가 안정적일 때 safe worktree 기준 `db pull` 재검증
  4. 그 결과를 바탕으로, intentional hold `7`을 공식 residual mismatch로 허용할지 최종 결정

#### Phase 3 11차 결과 (local-only 12 file-level triage)

- current remote schema / function 상태를 다시 대조한 결과, `local-only 12`는 아래처럼 정리하는 쪽이 맞다.
- 특히 `command_vectors` 축은 단순 archive가 아니라 **remote-schema rewrite chain**으로 남겨야 한다.
  - current remote `command_vectors.embedding`: `vector(1024)`
  - current remote `command_vectors` 인덱스: primary key만 존재
  - current remote 함수 `search_similar_vectors`, `search_vectors_by_category`, `hybrid_search_vectors`, `get_vector_stats`, `search_vectors_with_filters`, `hybrid_search_with_text` 모두 존재
  - local 파일들은 여전히 `vector(384)`, `id uuid`, HNSW index, broad TRUNCATE 가정 등을 포함해 current remote와 어긋난다.

##### A. archive / historical-compressed 우선 (`10 files / 8 version groups`)

- `20250127_enable_pgvector.sql`
  - 초기 `knowledge_base`/`incident_reports embedding` 부트스트랩 압축본
  - current remote는 `20251216233232` + `20251231074334` + `20251231074458` + `20251231110018` 체인으로 사실상 대체됨
- `20250801_security_hardening.sql`
  - `user_profiles`, `organization_settings`, `custom_rules`, `mcp_*` 등 broad hardening
  - current remote 및 repo hotfix는 세분화된 `20250821_*` + `20260410140028` 경로로 유지
- `20250805_create_server_metrics.sql`
  - `server_metrics` + view + sample data 압축본
  - current remote schema에는 `server_metrics` table이 없음
- `20250819_enhanced_security_hardening.sql`
  - broad security hardening 압축본
  - current remote에는 최소 audit restore + later hardening만 유지
- `20250906_upgrade_to_hnsw_index.sql`
  - `incident_reports embedding` + HNSW + `command_vectors` HNSW를 전제로 함
  - current remote에는 `incident_reports.embedding`이 없고 `command_vectors` HNSW도 없음
- `20250929_add_response_to_query_logs.sql`
  - current remote schema에 `query_logs` table 자체가 없음
- `20251017_simplified_server_schema.sql`
  - `servers`, `server_alerts`, seed data 중심의 local 재설계본
  - current remote schema에 해당 테이블이 없음
- `20251124_vector_db_maintenance.sql`
  - `command_vectors_backup`, `vector_search_logs` 등 absent object 전제
- `20251231_migrate_command_vectors_to_mistral.sql`
  - `command_vectors`를 TRUNCATE하고 HNSW를 재생성하는 one-shot migration
  - current remote는 이미 `vector(1024)`이지만 HNSW가 없고, later free-tier simplification과도 충돌
- `20260126_drop_ai_jobs_table.sql`
  - current remote cleanup chain은 imported `20260111102629~20260111102712`로 설명 가능

##### B. rewrite / remote-schema recreation chain (`3 files / 3 version groups`)

- `20250806_pgvector_native_functions.sql`
  - current remote helper 함수는 살아 있지만 local SQL은 `id uuid`/`vector(384)` 가정을 포함
  - remote function definition 기준으로 새 timestamp chain 또는 bootstrap patch로 재작성 필요
- `20251124_create_command_vectors_table.sql`
  - current remote table은 `id text`, `embedding vector(1024)`, primary key only
  - local SQL은 `id uuid`, `embedding vector(384)`, HNSW index, outdated policy/comment를 포함
  - active ledger 후보로 남기려면 remote schema recreate가 필요
- `20260126_update_hybrid_search_vector_dim.sql`
  - current remote `hybrid_search_with_text`는 존재하고 1024d path를 사실상 반영
  - 다만 local-only standalone patch로 둘 게 아니라, 위 `command_vectors` rewrite chain과 함께 remote-first 기준으로 재작성해야 함

##### C. semantic-split / rename required (`1 file / 1 version group`)

- `20251204_create_ai_feedback_table.sql`
  - 파일명은 `ai_feedback`
  - 실제 SQL은 `ai_user_feedback` 생성
  - current remote에는 `ai_feedback`와 `ai_user_feedback`가 모두 존재
  - 따라서 `ai_feedback` 대응 ledger로 유지하면 안 되고, `ai_user_feedback` track으로 분리/rename하는 것이 맞다

#### Phase 3 11차 해석

- `local-only 12`는 이제 broad manual-review가 아니라, 아래 실행 순서로 자를 수 있다.
  1. archive/historical-compressed 세트를 active ledger 후보에서 내린다.
  2. `command_vectors` 관련 `3-file rewrite chain`만 별도 worktree 트랙으로 재작성한다.
  3. `20251204_create_ai_feedback_table.sql`를 `ai_user_feedback` semantic-split 대상으로 분리한다.
- 즉, 다음 단계의 실질 작업은 `12`개 전체를 다루는 것이 아니라,
  - archive 대상 확정
  - `command_vectors` rewrite chain 설계
  - `ai_user_feedback` split
  로 좁혀졌다.

#### Phase 3 12차 결과 (command_vectors rewrite chain + ai_user_feedback split 설계)

- current remote schema / policy / function 정의를 다시 대조한 결과, 아래 두 판단을 active execution plan으로 고정해도 된다.
  1. `command_vectors`는 archive track이 아니라 **remote-schema rewrite chain**으로 유지
  2. `20251204_create_ai_feedback_table.sql`는 **`ai_user_feedback` semantic-split** 대상으로 분리

##### A. archive / historical-compressed 확정 (`10 files / 8 version groups`)

- 아래 `10`개는 **active ledger 후보 아님**으로 확정한다.
  - `20250127_enable_pgvector.sql`
  - `20250801_security_hardening.sql`
  - `20250805_create_server_metrics.sql`
  - `20250819_enhanced_security_hardening.sql`
  - `20250906_upgrade_to_hnsw_index.sql`
  - `20250929_add_response_to_query_logs.sql`
  - `20251017_simplified_server_schema.sql`
  - `20251124_vector_db_maintenance.sql`
  - `20251231_migrate_command_vectors_to_mistral.sql`
  - `20260126_drop_ai_jobs_table.sql`
- 이유:
  - current remote schema에 대응 table/index가 없거나
  - later remote-first history/import chain으로 의미가 이미 대체됐거나
  - one-shot local maintenance 성격이라 authoritative ledger로 보기 어렵다.

##### B. command_vectors rewrite chain (`3 files / 3 version groups`)

###### 1) `20251124_create_command_vectors_table.sql`

- 역할:
  - current remote `public.command_vectors`의 **canonical bootstrap**으로 재작성
- current remote 기준선:
  - `id text primary key`
  - `content text not null`
  - `metadata jsonb not null default '{}'::jsonb`
  - `embedding vector(1024)`
  - `created_at timestamptz`
  - `updated_at timestamptz`
  - RLS enabled
  - index는 `command_vectors_pkey` only
  - policy는 `Service role full access` only
- rewrite 원칙:
  - legacy `uuid`, `vector(384)`, HNSW, `updated_at` trigger, outdated comment를 재도입하지 않는다.
  - table 생성 + RLS enable + `Service role full access` policy까지를 bootstrap 범위로 본다.

###### 2) `20250806_pgvector_native_functions.sql`

- 역할:
  - current remote `command_vectors` helper function pack의 **canonical bootstrap**으로 재작성
- 포함 대상:
  - `search_similar_vectors`
  - `search_vectors_by_category`
  - `hybrid_search_vectors`
  - `get_vector_stats`
  - `search_vectors_with_filters`
- current remote 기준선:
  - 함수 인자는 `vector` generic type
  - 반환 `id`는 `text`
  - `SET search_path TO 'public', 'pg_catalog'`
  - `hybrid_search_vectors`만 `SECURITY DEFINER`
- rewrite 원칙:
  - legacy `uuid` 반환형과 `vector(384)` 시그니처를 재도입하지 않는다.
  - remote에 없는 legacy `GRANT`/comment를 새 정본에 강제로 복원하지 않는다.
  - imported history-only stub (`20250805061846~20250805114205`)는 실행 이력 보존용이고, 이 파일은 fresh bootstrap 정본 역할만 맡는다.

###### 3) `20260126_update_hybrid_search_vector_dim.sql`

- 역할 재분류:
  - `command_vectors` migration이 아니라 **knowledge_base hybrid search patch**로 재작성
- current remote 기준선:
  - `hybrid_search_with_text`는 `knowledge_base` 중심 함수다.
  - 인자는 `vector` generic type이지만 현재 1024d 경로를 반영한다.
  - `SET search_path TO 'public', 'pg_temp'`
  - `SECURITY DEFINER`
- rewrite 원칙:
  - standalone `command_vectors` dimension patch로 유지하지 않는다.
  - `20251231074458 migrate_to_mistral_1024d_embeddings` + `20251231110018 add_missing_rag_functions_v2` 이후의 active patch라는 의미로 재배치한다.
  - current remote function body와 diverge하는 legacy wording/comment만 남기고, outdated dimension migration narrative는 제거한다.

##### C. `20251204_create_ai_feedback_table.sql` semantic-split 확정

- file identity:
  - `ai_feedback` track이 아니라 `ai_user_feedback` track으로 분리한다.
- split 원칙:
  - 파일명/헤더 설명은 `ai_user_feedback` 기준으로 바로잡는다.
  - runtime `ai_feedback` table과 rename 대응시키지 않는다.
  - later hardening chain인 `20260213_harden_feedback_and_server_logs_rls.sql`와 연결되는 legacy feedback track으로 본다.
- 주의:
  - current remote에는 `ai_feedback`와 `ai_user_feedback`가 둘 다 존재한다.
  - `ai_user_feedback` index명이 `idx_ai_feedback_*`로 남아 있는 것은 legacy naming 흔적이므로, semantic-split의 1차 목표는 **file identity 교정**이지 index cosmetic rename이 아니다.

#### Phase 3 12차 해석

- 남은 주요 설계 불확실성은 해소됐다.
- 다음 worktree 실행 단위는 아래 셋으로 고정한다.
  1. archive `10`개를 active ledger 후보에서 제외한 전제로 시뮬레이션
  2. `command_vectors` rewrite chain `3`개 초안 작성
  3. `20251204_create_ai_feedback_table.sql`를 `ai_user_feedback` track으로 rename/split한 뒤 `db pull` 재검증
- 즉, 이제부터는 broad triage가 아니라 **rewrite draft + semantic split + safe worktree verification** 단계다.

#### Phase 3 13차 결과 (first command_vectors rewrite draft)

- temp worktree에서 `20251124_create_command_vectors_table.sql` 첫 rewrite draft를 작성했다.
- 위치:
  - `/tmp/openmanager-ledger-sim.ohJVoC/supabase/migrations/20251124_create_command_vectors_table.sql`
- 적용 원칙:
  - current remote `public.command_vectors` shape를 bootstrap 정본으로 채택
  - legacy `uuid`, `vector(384)`, HNSW, `updated_at` trigger, outdated comment 제거
  - RLS enabled + `Service role full access` 단일 policy만 유지

##### draft 반영 내용

- 컬럼/제약:
  - `id text primary key`
  - `content text not null`
  - `metadata jsonb not null`
  - `embedding vector(1024)`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`
- 보정 사항:
  - earlier plan 가정 중 `metadata default '{}'::jsonb`는 실제 remote와 달랐으므로 제거했다.
  - current remote는 `metadata`가 `NOT NULL`이지만 default는 없다.
  - current remote index는 `command_vectors_pkey` only 이므로 HNSW/보조 index는 draft에 넣지 않았다.

##### 현재 판단

- 이 파일은 **active ledger 후보**로 유지 가능하다.
- 다만 아직 아래 둘이 남아 있다.
  - `20250806_pgvector_native_functions.sql` remote-schema rewrite
  - `20260126_update_hybrid_search_vector_dim.sql` knowledge_base hybrid patch rewrite
- 따라서 이번 단계에서는 `db pull`을 다시 돌리지 않았다.
  - 이유: rewrite chain이 아직 완성되지 않아 결과 해석성이 낮다.

#### Phase 3 13차 해석

- `command_vectors` rewrite chain은 broad 설계가 아니라 실제 drafting 단계로 진입했다.
- 다음 worktree 실행 순서는 아래와 같이 더 좁혀진다.
  1. `20250806_pgvector_native_functions.sql`를 current remote helper function pack 기준으로 rewrite
  2. `20260126_update_hybrid_search_vector_dim.sql`를 `knowledge_base` hybrid patch로 rewrite
  3. `20251204_create_ai_feedback_table.sql`를 `ai_user_feedback` track으로 split
  4. 그 다음에만 safe worktree 기준 `db pull` 재검증

#### Phase 3 14차 결과 (command_vectors helper function pack rewrite draft)

- temp worktree에서 `20250806_pgvector_native_functions.sql` rewrite draft를 작성했다.
- 위치:
  - `/tmp/openmanager-ledger-sim.ohJVoC/supabase/migrations/20250806_pgvector_native_functions.sql`
- rewrite 기준:
  - current remote helper function definition을 bootstrap 정본으로 채택
  - imported history-only stub `20250805061846~20250805114205`는 split execution history만 보존
  - 이 파일은 fresh bootstrap canonical pack 역할만 수행

##### draft 반영 내용

- 포함 함수:
  - `search_similar_vectors`
  - `search_vectors_by_category`
  - `hybrid_search_vectors`
  - `get_vector_stats`
  - `search_vectors_with_filters`
- current remote 기준선:
  - 함수 인자 타입은 `vector` generic
  - 반환 `id`는 `text`
  - `SET search_path TO 'public', 'pg_catalog'`
  - `hybrid_search_vectors`만 `SECURITY DEFINER`
- 제거한 legacy 요소:
  - `vector(384)` 시그니처
  - `uuid` 반환형
  - legacy `GRANT EXECUTE`
  - legacy function comment
  - commented-out ivfflat/HNSW migration note

##### 현재 판단

- `command_vectors` rewrite chain의 앞 두 파일은 현재 remote 정의와 일치하는 방향으로 draft가 올라왔다.
- 남은 rewrite/split 작업:
  - `20260126_update_hybrid_search_vector_dim.sql`
  - `20251204_create_ai_feedback_table.sql` -> `ai_user_feedback` track
- 따라서 이번 단계에서도 `db pull` 재검증은 보류한다.
  - 이유: `command_vectors` chain과 feedback split이 아직 완성되지 않았다.

#### Phase 3 14차 해석

- `command_vectors` 축은 이제 broad rewrite 계획이 아니라, table bootstrap + helper function pack draft까지 확보된 상태다.
- 다음 safe worktree 실행 순서는 더 좁혀진다.
  1. `20260126_update_hybrid_search_vector_dim.sql`를 `knowledge_base hybrid_search_with_text` patch로 rewrite
  2. `20251204_create_ai_feedback_table.sql`를 `ai_user_feedback` track으로 split
  3. 그 다음에만 `db pull` 재검증

#### Phase 3 15차 결과 (20260126 hybrid patch rewrite 기준 확정)

- `20260126_update_hybrid_search_vector_dim.sql`의 역할을 다시 대조한 결과, 이 파일은 `command_vectors` migration이 아니라 **`knowledge_base` 중심 `hybrid_search_with_text` patch**로 다루는 판단이 맞다.
- 근거:
  - current remote `hybrid_search_with_text`는 `knowledge_base` / `search_vector` / `traverse_knowledge_graph`를 중심으로 동작한다.
  - 함수 인자는 `vector` generic type이며, `SET search_path TO 'public', 'pg_temp'`, `SECURITY DEFINER`가 적용돼 있다.
  - local/worktree 초안은 아직 `vector(1024)` 명시형 + old migration narrative를 유지하고 있다.

##### rewrite 기준 확정

- canonical target:
  - current remote `public.hybrid_search_with_text` definition
- patch identity:
  - `command_vectors` dimension update가 아니라 `knowledge_base hybrid search bootstrap patch`
- 반영 원칙:
  - 인자 타입은 `vector` generic으로 맞춘다.
  - `SET search_path TO 'public', 'pg_temp'`를 유지한다.
  - `SECURITY DEFINER`를 유지한다.
  - old `384 -> 1024` narrative는 제거하고, remote-first bootstrap patch라는 설명으로 바꾼다.

##### 현재 판단

- `20260126` rewrite는 table/function pack rewrite와 같은 축이 아니라, `knowledge_base` hybrid search chain의 마지막 active patch다.
- 따라서 다음 worktree drafting은 아래 순서가 맞다.
  1. `20260126_update_hybrid_search_vector_dim.sql` rewrite
  2. `20251204_create_ai_feedback_table.sql` -> `ai_user_feedback` split
  3. safe worktree `db pull` 재검증

#### Phase 3 15차 해석

- `command_vectors` rewrite chain은 사실상 앞 두 파일이 끝났고, 남은 핵심은 `knowledge_base hybrid patch`와 `ai_user_feedback` semantic split 두 개다.
- 이제 다음 턴부터는 broad triage 없이 실제 remaining draft 작성과 `db pull` 확인으로 바로 이어가면 된다.

#### Phase 3 16차 결과 (20260126 rewrite + ai_user_feedback split + db pull 재검증)

- temp worktree에서 `20260126_update_hybrid_search_vector_dim.sql` rewrite draft를 current remote `hybrid_search_with_text` definition 기준으로 덮어썼다.
- 적용 내용:
  - `p_query_embedding vector(1024)` -> generic `vector`
  - `SET search_path TO 'public', 'pg_temp'`
  - `SECURITY DEFINER` 유지
  - old `384 -> 1024` migration narrative 제거
  - file identity를 `knowledge_base hybrid search bootstrap patch`로 재정의
- temp worktree에서 `20251204_create_ai_feedback_table.sql`를 아래 경로로 rename했다.
  - `20251204_create_ai_user_feedback_table.sql`
- 판단:
  - `ai_feedback` runtime table과 분리된 legacy `ai_user_feedback` track이라는 semantic identity가 file path 수준에서도 드러난다.
  - index/view naming(`idx_ai_feedback_*`, `ai_feedback_stats`)은 legacy 흔적으로 남아 있지만, 1차 목표인 file identity correction은 완료됐다.

##### 검증 결과

- safe worktree 기준 `supabase migration list`는 계속 실행 가능하다.
- 다만 `supabase db pull inspect_after_rewrite_chain --linked --schema public`는 다시 clean mismatch pass로 가지 않고, temp role SCRAM retry에서 막혔다.
- 관측 오류:
  - `failed to connect as temp role ... invalid SCRAM server-final-message received from server`
- 해석:
  - 현재 blocker는 최소한 이번 시점에는 **ledger mismatch 단독**이 아니라, Supabase CLI의 temp role auth path가 다시 끼어드는 실행 환경 이슈와 분리해서 봐야 한다.

#### Phase 3 16차 해석

- `command_vectors` rewrite chain과 `ai_user_feedback` semantic split까지 draft 수준에서는 완료됐다.
- 이제 다음 작업의 성격은 drafting이 아니라 **safe worktree `db pull` temp-role auth blocker 분리 진단**이다.
- 즉, ledger repair Phase 3는 사실상 아래 상태다.
  1. remote-first history import: 완료 수준
  2. local-only triage: 완료 수준
  3. rewrite/split draft: 완료 수준
  4. 최종 blocker: `db pull` temp-role SCRAM path

### Phase 3. 정렬 방식 확정

#### Phase 3 1차 결정

- **권장 정렬 방향: remote-first history 수용**
- 이유:
  1. current-schema-critical import 후보 4건을 temp worktree에 모두 반영한 뒤에도 남은 remote-only `41`건은 사실상 `history-only / manual-review` 세트다.
  2. `supabase db pull` 실패 메시지가 제안하는 `migration repair --status reverted <remote_version>`를 그대로 따르면, 실제 hosted project에서 실행된 세분화 ledger를 대량으로 “되돌린 것처럼” 기록하게 된다.
  3. local-only `12`건은 대부분 압축본/재작성본/semantic mismatch라서, 이들을 remote에 맞는 authoritative history라고 보기 어렵다.
- 따라서 1차 원칙은 아래와 같다.
  - remote-only `41`건: 가능한 한 local ledger로 **history-only import** 하되, schema-critical 여부와 무관하게 remote execution history를 보존한다.
  - local-only `12`건: 즉시 remote repair 대상으로 보지 않고, `legacy-compressed local ledger`로 분리해 archive/rewrite/manual-review 대상으로 다룬다.
  - `migration repair`는 마지막 수단이다. remote execution history를 지우지 않고는 정렬이 불가능한 경우에만 검토한다.

#### Phase 3 2차 실행 원칙

- [ ] Bucket 1/2/6의 remote-only 세트를 history-only import 후보로 우선 정리한다.
- [ ] Bucket 3/4의 local-only 압축본은 archive/rewrite/manual-review 중 하나로 세부 판정한다.
- [ ] 위 정리가 끝난 뒤에만 safe worktree 기준 `db pull` 재검증을 한다.
- [ ] remote-first가 과도한 churn 없이 유지되지 않으면 그때만 옵션 B 또는 C로 되돌아가고 이유를 명시한다.

### Phase 4. 후속 검증

- [ ] `npm run supabase:check:db-auth`
- [ ] `supabase migration list`
- [ ] safe worktree 기준 `supabase db pull --linked --schema public`
- [ ] 필요 시 MCP `list_migrations`/`list_tables`로 remote ledger와 schema 재검증

## 완료 기준

- [ ] local/remote ledger mismatch의 정렬 방향이 문서와 실행 결과로 확정된다.
- [ ] 메인 저장소에서 다음 Supabase schema 작업을 수행해도 `db pull`/`db push` 경로가 예측 가능하다.
- [ ] 선택하지 않은 옵션을 왜 배제했는지 근거가 남아 있다.

#### Phase 3 17차 결과 (archive 후보 제거 시뮬레이션 + residual mismatch 재축약)

- safe worktree에서 `archive / historical-compressed`로 확정한 10개 파일을 `supabase/migrations/` 밖으로 이동시키는 시뮬레이션을 수행했다.
- 이동 경로:
  - `/tmp/openmanager-ledger-sim.ohJVoC/supabase/archive/legacy-compressed-ledger/`
- 목적:
  - broad local-only compressed ledger를 active migration ledger에서 빼면, 실제 `db pull` blocker가 `rewrite/split` 4개 version group만 남는지 확인하기 위함이다.

##### 시뮬레이션 결과

- safe worktree 기준 `supabase db pull inspect_after_archive_legacy_compressed --linked --schema public --debug`는 여전히 mismatch에서 종료됐다.
- 다만 residual set은 이전보다 훨씬 좁아졌다.
  - remote-only: `7`
    - `20250731085344`
    - `20250731085432`
    - `20250803015807`
    - `20250806120552`
    - `20250806121533`
    - `20250807044444`
    - `20250906043934`
  - local-only: `4 version groups`
    - `20250806`
    - `20251124`
    - `20251204`
    - `20260126`
- 해석:
  - archive 후보 10개는 active ledger에서 빼는 방향이 맞다.
  - 현재 남은 local-only는 모두 이미 draft가 있는 rewrite/split 체인과 정확히 대응한다.
  - 즉, broad compressed ledger가 아니라 `date-only active rewrite/split 4개`가 마지막 local ledger blocker다.

##### temp-role SCRAM 관측 보정

- 이번 재검증에서는 `db pull --debug`가 temp role 연결을 결국 통과했고, 최종 종료 사유도 다시 `migration history mismatch`로 귀결됐다.
- 따라서 현재 주 blocker는 temp-role auth 자체라기보다 **ledger parity 미정렬**로 보는 쪽이 더 정확하다.
- 다만 `supabase migration list --debug` 또는 일부 `db pull` 시도에서 temp-role SCRAM retry가 간헐적으로 끼어드는 현상은 남아 있으므로, 이는 secondary execution-noise로만 추적한다.

#### Phase 3 17차 해석

- active ledger repair의 핵심은 더 이상 archive 후보 정리가 아니다.
- 이제 남은 실질 작업은 아래 4개 version group을 remote timestamp/history에 어떻게 접속시킬지 정하는 것이다.
  1. `20250806` -> remote `20250806120552`, `20250806121533`, `20250807044444`와의 치환/분할
  2. `20251124` -> current remote `command_vectors` bootstrap timestamp track으로 재배치
  3. `20251204` -> `ai_user_feedback` semantic split을 timestamp track으로 정규화
  4. `20260126` -> `knowledge_base hybrid_search_with_text` active patch timestamp track으로 재배치
- 즉, 다음 단계는 `archive 더 하기`가 아니라 **date-only active rewrite/split 4개를 timestamp track으로 치환하는 실행안**을 확정하는 것이다.

#### Phase 3 18차 결과 (local-only active 4개 제거 시뮬레이션)

- safe worktree에서 아래 `local-only active rewrite/split 4개`를 `supabase/migrations/` 밖으로 이동시키는 시뮬레이션을 수행했다.
  - `20250806_pgvector_native_functions.sql`
  - `20251124_create_command_vectors_table.sql`
  - `20251204_create_ai_user_feedback_table.sql`
  - `20260126_update_hybrid_search_vector_dim.sql`
- 이동 경로:
  - `/tmp/openmanager-ledger-sim.ohJVoC/supabase/archive/active-rewrite-candidates/`
- 목적:
  - 이 4개가 정말 active ledger blocker인지, 아니면 remote-only hold 세트가 마지막 잔여인지 확인하기 위함이다.

##### 시뮬레이션 결과

- safe worktree 기준 `supabase db pull inspect_after_removing_all_local_only_active_groups --linked --schema public --debug`는 여전히 mismatch에서 종료됐다.
- 하지만 잔여 mismatch는 아래 `remote-only 7`만 남았다.
  - `20250731085344`
  - `20250731085432`
  - `20250803015807`
  - `20250806120552`
  - `20250806121533`
  - `20250807044444`
  - `20250906043934`
- 관찰 포인트:
  - local-only `20250806 / 20251124 / 20251204 / 20260126`는 모두 제거됐고, 더 이상 mismatch 목록에 나타나지 않았다.
  - 즉, 현재 `db pull` clean pass를 막는 local ledger blocker는 없다.
  - 남은 것은 모두 remote-first 정렬 과정에서 intentional hold/deferred로 남겨둔 timestamp 세트다.

##### 해석

- 이 결과는 중요하다.
  - `20250806`, `20251124`, `20251204`, `20260126`를 remote timestamp history에 억지로 맞추는 방향은 필요성이 낮다.
  - 오히려 이 4개는 **migration ledger 정합성용 active file**이 아니라, 별도 canonical bootstrap / rewrite reference track으로 다루는 것이 더 맞다.
- 특히 `20250806 -> 20250806120552/20250806121533/20250807044444` 식의 매핑은 부적절하다.
  - 해당 remote versions는 monitoring/ai_insight/hourly_server_states 계열이고, `pgvector_native_functions`와 동일 축이 아니다.
- 따라서 다음 실질 결정은 아래 둘 중 하나다.
  1. remote-only `7`을 공식 residual hold로 허용하고, active ledger는 현재 수준에서 종료
  2. remote-only `7`까지 history-only import/no-op stub로 수용해 `db pull` clean pass를 목표로 계속 진행

#### Phase 3 18차 해석

- “작년 자료를 지금 정리하는 게 의미가 있나”에 대한 답은 제한적 `yes`다.
  - broad historical cleanup 자체는 의미가 낮다.
  - 하지만 현재 `db pull`/`db push` parity를 막는 active/local 잔재를 ledger 밖으로 분리하는 작업은 현재 운영 도구 복구에 직접 의미가 있다.
- 이번 시뮬레이션으로 그 경계가 명확해졌다.
  - broad old migrations: 굳이 다 복구할 필요 없음
  - parity blocker인 active local groups: 정리할 가치 있음
- 이제 다음 단계는 SQL 재작성보다 **종료 기준 결정**이다.
  - intentional remote-only `7`을 허용 residual로 볼지
  - 아니면 마지막 history-only import batch로 닫을지

#### Phase 3 19차 결과 (remote-only hold 7 stub 검증)

- safe worktree에서 intentional hold / deferred remote-only `7`개에 대해 no-op history-only import stub를 추가했다.
- 추가 파일:
  - `20250731085344_create_mcp_monitoring_schema_fixed.sql`
  - `20250731085432_add_mcp_analysis_functions.sql`
  - `20250803015807_create_thinking_steps_table.sql`
  - `20250806120552_004_create_intelligent_monitoring_tables.sql`
  - `20250806121533_create_ai_insight_tables.sql`
  - `20250807044444_create_hourly_server_states_table.sql`
  - `20250906043934_create_ml_training_results_table_fixed.sql`
- stub 형식:
  - header comment + `DO $$ BEGIN END $$;`
  - schema side effect 없이 ledger parity만 맞추는 목적

##### 검증 결과

- safe worktree 기준 `supabase db pull inspect_after_remote_only_stub_batch --linked --schema public --debug`는 더 이상 migration history mismatch 단계에서 멈추지 않았다.
- 실행은 `Creating shadow database...` 단계까지 진행됐다.
- 해석:
  - safe worktree 조합(`archive 10 + active-reference 4 분리 + remote-only stub 7`) 기준으로, ledger mismatch blocker는 사실상 해소된 것으로 본다.
  - 이후 단계는 Supabase CLI의 normal shadow-db bootstrap/runtime 경로이며, ledger mismatch와는 다른 층위다.

##### 중요한 제한

- 이 결과는 **main repo에 stub 7개만 추가하면 된다**는 뜻이 아니다.
- clean progression이 나온 조건은 아래 조합 전체다.
  1. historical-compressed archive `10`개를 active ledger 밖으로 이동
  2. active rewrite/reference `4`개를 active ledger 밖으로 이동
  3. remote-only hold `7`개를 no-op history-only stub로 추가
- 따라서 main repo 반영은 `stub 7 only`가 아니라 **archive/ref split + stub batch**로 봐야 한다.

#### Phase 3 19차 해석

- “작년 자료를 지금 정리하는 게 의미가 있나”에 대한 답은 여기서 더 명확해진다.
  - broad old migration 복원 자체는 의미가 낮다.
  - 하지만 current toolchain (`db pull`/`db push`)을 막는 ledger parity만 복구하는 건 의미가 있다.
- safe worktree 검증 결과, 그 복구 최소 단위는 아래다.
  - `archive 10`
  - `active-reference 4`
  - `stub 7`
- 즉, 다음 실질 결정은 하나다.
  - 이 검증된 조합을 main repo에 반영할지, 아니면 planning 결과로만 남길지 결정한다.

#### Phase 3 20차 결과 (main repo ledger 재구성 + parity 재검증)

- safe worktree에서 검증한 조합을 main repo에 반영했다.
- 반영 묶음:
  1. `legacy-compressed-ledger` archive `10`
  2. `active-rewrite-candidates` reference split `4`
  3. remote-only history-only parity stub `7`
  4. validated timestamp migration set 전체를 `supabase/migrations/`에 반영
  5. remaining date-only compressed set `18`개를 `supabase/archive/replaced-date-only-ledger/`로 이동

##### main repo 검증 결과

- `comm -3 <main migrations> <safe worktree migrations>` 결과: 차이 없음
- `supabase migration list`: local/remote version table이 전부 1:1 정렬됨
- `supabase db pull inspect_main_repo_after_full_sync --linked --schema public --debug`:
  - 더 이상 `migration history mismatch`에서 멈추지 않음
  - `Creating shadow database...` 단계까지 진행 확인
  - parity 관점 검증은 충분하므로 해당 프로세스는 여기서 중단

##### 해석

- 이제 main repo 기준에서도 Supabase migration ledger drift의 주 blocker는 제거됐다.
- 남아 있는 후속 작업은 schema parity가 아니라 **git 정리와 문서 종료 처리**다.
- 즉, 이 트랙은 더 이상 분석/시뮬레이션 단계가 아니라 commit-ready 상태에 가깝다.

#### Phase 3 20차 해석

- “작년 자료를 지금 정리하는 게 의미가 있나”에 대한 최종 답:
  - broad historical migration 전체를 복원하는 건 여전히 의미가 낮다.
  - 하지만 current toolchain(`supabase migration list`, `supabase db pull`)을 막던 ledger parity를 복구하는 것은 의미가 있었다.
- 이번 반영으로 그 목적은 달성됐다.
- 다음 단계는 아래 둘뿐이다.
  1. ledger 재구성 커밋
  2. planning 문서를 `완료` 상태로 정리
