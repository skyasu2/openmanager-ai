# Knowledge Base Corpus Expansion Plan

- 상태: 1차 corpus 반영 완료, extraction legacy 제거, graph telemetry 관찰 대기
- 작성일: 2026-04-12
- 목표: `knowledge_base`를 무작정 늘리거나 줄이지 않고, 현재 RAG governance 한도 안에서 corpus 품질을 유지하면서 실제 graph traversal 가치가 있는지 계측으로 판단한다.

## 배경

- 초기 backlog에는 `P3: knowledge_base RAG corpus 확충`이 남아 있었다.
- 2026-04-12 초기 점검 기준 `knowledge_base` live row는 `49`건이었고, hybrid retrieval 경로 자체는 이미 정상이었다.
- 현재 병목은 인덱스 부재가 아니라 **소규모 corpus + 카테고리 커버리지 부족 가능성** 쪽에 가깝다.
- governance 기준은 [rag-knowledge-engine.md](/mnt/d/dev/openmanager-ai/docs/reference/architecture/ai/rag-knowledge-engine.md:19) 와 [rag-doc-policy.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/rag-doc-policy.ts:1)가 정의한다.

## 2026-04-13 현재 SSOT

이 섹션이 아래의 과거 타임라인과 당시 시점의 "다음 단계" 문구보다 우선한다.

### 최근 변경 요약

- canonical repo 최신 커밋은 `bc1fdc472 feat(graphrag): consolidate corpus tooling and retrieval routing`이며, `gitlab/main`까지 push 완료됐다.
- 최근 변경의 핵심은 다음 다섯 가지다.
  1. `llamaindex-rag-*` 네이밍을 `graphrag-*`로 정리했다.
  2. `/api/ai/graphrag/extract`를 `410`으로 비활성화해 auto-extraction/backfill 운영 경로를 중단했다.
  3. topology/architecture 질의가 `searchKnowledgeBase`를 타도록 라우팅을 강제했다.
  4. duplicate `searchKnowledgeBase` 재호출 비용을 30초 TTL cache로 coalesce했다.
  5. extraction legacy (`graphrag-relations.ts`)를 제거하고, traversal helper만 `graphrag-graph.ts`로 유지했다.

### 현재 상태

- RAG core는 유지한다. 현재 retrieval 경로는 embedding + pgVector + BM25 + `knowledge_relationships` traversal 조합이다.
- auto-extraction/backfill은 현재 repo 기준 운영 경로에서 중단됐고, extraction legacy 구현도 제거됐다. 관계 업데이트의 공식 경로는 `seed-knowledge-base.ts`와 기존 수동 관계 데이터다.
- production에서 `sourceType="graph"`가 실제 응답에 포함된 사례는 이미 확인됐다. 따라서 graph traversal은 아직 제거 대상이 아니다.
- 최신 cleanup commit `bc1fdc472`는 2026-04-13 KST에 revision `ai-engine-00303-mfh`로 production 재배포됐다.
- deploy 직후 live baseline:
  - `totalDocuments=52`
  - `totalTriplets=150`
  - `totalExtractionEdges=15`
  - `indexedDocs=30`
  - `materializedDocs=13`
  - `tripletOnlyDocs=17`
  - `unprocessedDocs=22`
- telemetry baseline:
  - topology probe: `toolsCalled=["searchKnowledgeBase","searchKnowledgeBase","finalAnswer"]`, `ragSources=vector 6 + graph 2`
  - incident probe: `toolsCalled=["searchKnowledgeBase","finalAnswer"]`, `ragSources=vector 1 + graph 1`
  - 결론: graph source는 최신 cleanup 배포 후에도 실제 응답에 남아 있다. 다만 topology 질의의 duplicate tool call 표시는 계속 보인다.

### 남은 작업

1. 2~4주 동안 `toolsCalled`, `ragSources.sourceType`, query category를 같이 기록해 graph hit-rate와 precision을 관찰한다.
2. telemetry 결과를 바탕으로 `graphrag-graph.ts`/`knowledge_relationships` traversal 유지 여부를 판단한다.
3. duplicate `searchKnowledgeBase` tool count가 latency/observability에 실제 부담을 남기면, tool invocation dedupe를 별도 최적화로 검토한다.

## 2026-04-12 기준 baseline 요약

- 권장 총 문서 수: `<=52`
- 하드 최대 문서 수: `<=60`
- 당시 live count: `49`
- 권장 길이: `280~520자`
- 하드 최대 길이: `<=600자`
- command 비중 상한: `<=38%`
- category target:
  - command `18~24`
  - incident `8~12`
  - best_practice `8~12`
  - troubleshooting `8~12`
  - architecture `2~4`
  - security `1~2`

## 2026-04-12 실측 결과

### 총괄

- live count: `49`
- target 길이(280~520자): `48`
- below target(<280자): `0`
- over target(521~600자): `0`
- over limit(>600자): `1`
- placeholder title: `0`
- auto_generated: `0`
- 평균 길이: `360.86자`

### 카테고리 분포

| category | count | pct | 상태 |
|----------|------:|----:|------|
| command | 18 | 36.73% | 목표 범위 하한, 비중 상한(`38%`) 아래 |
| troubleshooting | 10 | 20.41% | 목표 범위 내 |
| incident | 9 | 18.37% | 목표 범위 내 |
| best_practice | 8 | 16.33% | 목표 범위 하한 |
| architecture | 3 | 6.12% | 목표 범위 내, 단 over-limit 1건 포함 |
| security | 1 | 2.04% | 목표 범위 하한 |

### source 분포

| source | count | pct | 해석 |
|--------|------:|----:|------|
| seed_script | 30 | 61.22% | corpus의 기본 골격. manual 비중이 없는 것이 약점 |
| command_vectors_migration | 18 | 36.73% | command 카테고리 전부가 migration 기원 |
| imported | 1 | 2.04% | imported 문서는 1건뿐이며, 동시에 유일한 over-limit 문서 |

### 품질 debt

- exact title duplicate: `0`
- below target 문서: `0`
- over-limit 문서: `1`
  - 제목: `현재 인프라 구성 토폴로지 스냅샷`
  - category/source: `architecture / imported`
  - 길이: `1020자`

## 실측 해석 (업데이트)

- 이전 가설과 달리 현재 corpus는 **카테고리 부족보다 source 편향**이 더 크다.
- 모든 카테고리가 목표 범위 안에 들어와 있으므로, 지금 `incident / best_practice / troubleshooting`를 무조건 늘리는 것은 정밀한 근거가 약하다.
- 대신 다음 순서가 더 합리적이다.
  1. over-limit architecture 문서 1건을 분할 또는 요약해 retrieval precision을 먼저 높인다.
  2. 이후 `manual` 또는 사람이 검증한 `imported` 재구성 문서를 넣어 source 다양성을 보강한다.
  3. 신규 추가는 category deficit 보완이 아니라 source 품질 보강 관점에서 제한적으로 수행한다.

## 핵심 해석

- 지금 단계의 corpus 확충은 "문서를 많이 넣는 작업"이 아니다.
- 권장 한도까지 남은 여유는 크지 않으므로, **추가 + 정리**를 같이 해야 한다.
- 현재는 카테고리 수 자체보다 `source` 품질과 장문 문서 정리가 더 우선이다.
- 따라서 신규 slot은 `manual` 또는 사람이 검증한 `imported` 재구성 문서에 우선 배정하고, category는 `incident / best_practice / troubleshooting` 쪽에서 품질 공백이 큰 항목만 제한적으로 채운다.
- 즉, 실행 단위는 다음 둘 중 하나여야 한다.
  - over-limit 문서를 분할/요약하고 그 빈 자리에 신규 문서를 넣기
  - 약한 기존 문서를 교체하면서 신규 문서를 넣기

## 범위

### 포함

- `knowledge_base` category/source/길이 분포 재측정
- 저품질 후보(`below_target`, 중복도 높은 seed/command 문서) 식별
- 신규 corpus 후보를 우선순위별로 정리
- free-tier 한도 안에서 추가/교체 배치 설계

### 제외

- 이번 단계에서 실제 DB insert/upsert 실행
- embedding 모델 교체
- retrieval 함수/가중치 조정
- `knowledge_relationships` 대량 재생성
- 추가 auto-extraction/backfill 재개

## 우선 보강 대상

### 1. incident

- 실제 incident report에서 반복되는 패턴
- 장애 원인-증상-완화 절차가 1문서 단위로 요약 가능한 케이스
- 단순 raw report dump가 아니라 operator-oriented 요약본으로 작성

### 2. troubleshooting

- 자주 묻는 운영 질문
- 예:
  - CPU spike 진단 순서
  - memory pressure 해석법
  - AI sidebar 응답 지연 시 확인 순서
  - production auth / guest-login smoke 실패 시 점검 순서

### 3. best_practice

- 운영 규칙/실행 규범
- 예:
  - release QA 기준
  - Supabase migration 작업 규칙
  - GitLab canonical deploy 원칙
  - free-tier guardrail

### 4. security / architecture

- slot이 남을 때만 보강
- 이미 존재하는 문서가 적절히 대표하면 중복 작성하지 않음

## 추천 source 우선순위

1. `manual`
- 현재 운영 규칙과 QA 기준에서 사람이 검증한 내용

2. `imported`
- 이미 존재하는 reference docs를 RAG-friendly chunk로 재구성한 것

3. `incident_reports`
- 실제 운영 사례를 operator summary로 축약한 것

4. `seed_script` / `command_vectors_migration`
- 기존 문서가 짧고 boilerplate가 많으면 신규 추가보다 먼저 병합/교체 검토

## 실행 단계

### Phase 1. 실제 분포 재측정

- [x] live `knowledge_base`의 category/source/title/길이 분포를 다시 측정
- [x] `48` vs `49` count drift를 최신값 `49`로 고정
- [x] `below_target`, `over_limit`, `duplicate-like` 후보 목록 생성
  - below target `0`
  - exact duplicate title `0`
  - over-limit `1` (`현재 인프라 구성 토폴로지 스냅샷`, 1020자)

### Phase 2. slot 예산 확정

- [x] 권장 한도 `52` 기준 신규 추가 가능 slot은 `+3`
- [x] over-limit architecture 문서를 1→2로 분할하면 실사용 예산은 `+2`로 감소
- [x] command 과대표 여부 확인 — `36.73%`로 cap 아래라 즉시 축소 필요는 없음
- [x] 이번 배치 목표를 `+3 docs 이내` 또는 `교체형 1:1`로 제한
- [x] split-first 전략을 실제 반영 시나리오로 고정 (`architecture split` 후 `+2 docs`)

#### split-first 시나리오 (고정)

- 현재 over-limit 문서: `현재 인프라 구성 토폴로지 스냅샷` (`1020자`)
- 분할 방향:
  1. `현재 인프라 역할/트래픽 토폴로지 스냅샷`
     - 포함: 총 서버 수, 역할 분포, 대표 트래픽 경로, 역할별 서버 묶음
     - 목적: "어떤 계층으로 흐르는가"를 빠르게 설명하는 retrieval anchor
  2. `현재 인프라 배치/운영 검증 스냅샷`
     - 포함: 리전/AZ/환경 분포, 전체 서버 인벤토리 요약, 운영 규칙(토폴로지 질의 vs 실시간 지표 교차 검증)
     - 목적: "어디에 배치돼 있고 운영 시 어떻게 해석하는가"를 설명하는 governance anchor
- 예산 해석:
  - 현재 `49 docs`
  - split 적용 시 `50 docs`
  - 권장 한도 `52` 기준 후속 신규 추가 가능 예산은 `+2 docs`
- 실행 원칙:
  - split 두 문서 모두 `280~520자` 타깃 안으로 맞춘다.
  - server inventory는 전체 ID를 장문으로 반복 나열하지 말고, 역할/배치 해석 중심으로 요약한다.
  - split 이후 신규 추가는 `manual` 또는 사람이 검증한 `imported` 재구성 문서만 우선 검토한다.

### Phase 3. 신규 corpus 후보 초안 작성

- [x] incident 2개 초안 작성
- [x] troubleshooting 3개 초안 작성
- [x] best_practice 3개 초안 작성
- [x] 각 문서는 `280~520자` target으로 작성

#### Phase 3 1차 결과

- 신규 후보 `8`개를 [knowledge-base-corpus-candidate-drafts.md](/mnt/d/dev/openmanager-ai/reports/planning/knowledge-base-corpus-candidate-drafts.md:1)로 정리했다.
- source 구성:
  - `manual` `5`
  - `imported` `3`
- category 구성:
  - `incident` `2`
  - `troubleshooting` `3`
  - `best_practice` `3`
- 이번 배치 추천 우선순위:
  1. `AI 사이드바 응답 지연 점검 순서`
  2. `Supabase migration 작업 규칙`
- 이유:
  - 사용자 질문 빈도가 높고, 현재 source 편향(`manual 0`)을 가장 빠르게 줄일 수 있다.
  - 운영/QA/DB 작업에서 바로 재사용 가능한 설명 문서라 retrieval 실효성이 높다.

### Phase 4. 품질 게이트 적용

- [ ] placeholder 제목 `0`
- [ ] auto-generated 문서 `0~1`
- [ ] command 비중 상한 준수
- [ ] 중복도 높은 문서 병합/삭제 검토

### Phase 5. 반영 배치 설계

- [x] 실제 insert/upsert를 별도 migration 또는 운영 스크립트로 할지 결정
- [x] `seed-knowledge-base.ts --input=scripts/data/knowledge-base.first-batch.json --upsert` 경로로 first batch 반영 방식 고정
- [x] linked env에서 first batch live upsert 실행
- [x] relation edge를 수동 보강할지, 추후 자동 추출에 맡길지 결정
- [x] `seed-knowledge-base.ts` 입력 배치의 `relationships`를 `knowledge_relationships`에 deterministic sync하는 경로 추가
- [x] 반영 후 retrieval spot-check 시나리오 정의
- [x] `rag-eval-goldset.ts --input=scripts/data/rag-goldset.corpus-first-batch.json` 경로 추가
- [x] first batch goldset `4`건 live retrieval 검증

## 완료 기준

- [x] 현재 corpus 분포와 quality debt 목록이 문서화됨
- [x] 다음 배치에서 넣을 신규 문서 후보 6~9개가 준비됨
- [x] 실제 반영 시에도 총 문서 수가 권장 `52` 안에 남도록 계획이 고정됨
- [x] command 중심 편향을 더 키우지 않는 방향으로 확충 방침이 정리됨

## 메모

- 지금은 `P3`이므로, 실제 착수 트리거는 "AI 응답 품질 이슈가 반복 관측될 때"가 맞다.
- 다만 준비 없이 바로 corpus를 늘리면 free-tier footprint와 retrieval precision이 동시에 나빠질 수 있으므로, 다음 실행은 이 계획을 기준으로 해야 한다.
- 2026-04-12 실측 기준으로는 "카테고리 수 부족"보다 "source 편향 + 장문 architecture 문서 1건"이 더 우선순위가 높다.
- 2026-04-12 후속 구현 기준으로 topology imported 문서는 [topology-rag-injector.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/topology-rag-injector.ts:1)에서 단일 장문 문서 대신 2개 split 문서를 생성하도록 조정했다. 실제 `knowledge_base` 반영은 sync 실행 시점에 이뤄진다.
- 2026-04-12 후속 구현 기준으로 first batch 반영용 데이터 파일은 [knowledge-base.first-batch.json](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/data/knowledge-base.first-batch.json:1), spot-check 시나리오는 [rag-goldset.corpus-first-batch.json](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/data/rag-goldset.corpus-first-batch.json:1)로 고정했다.
- 2026-04-12 linked env 실행 결과:
  - `seed-knowledge-base.ts --input ... --upsert`로 추천 2건이 모두 `추가 (+ 임베딩)` 처리됐고 live `knowledge_base` count는 `51`이 됐다.
  - `rag-eval-goldset.ts --input=scripts/data/rag-goldset.corpus-first-batch.json` 결과, `KB01~KB04` 전부 `rag_on/rag_off quality=1.0`, `categoryCoverage=1.0`, `keywordCoverage=1.0`, `destructiveLeaks=0`이었다.
  - latency는 `rag_on avg 2610ms`, `rag_off avg 127ms`로 차이가 커서, 품질 검증은 통과했지만 이 batch 자체가 GraphRAG latency 문제를 개선한 것은 아니다.
- 2026-04-12 relation edge 결정:
  - 현재 `extractRelationships` 경로는 `metadata.triplets` 저장 중심이라, first batch 운영 반영에는 deterministic 수동 edge가 더 안전하다.
  - [seed-knowledge-base.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/seed-knowledge-base.ts:1)에 `relationships` sync를 추가해 배치 입력만으로 `knowledge_relationships` insert/update가 가능해졌다.
  - first batch에서는 `AI 사이드바 응답 지연 점검 순서`에만 강한 anchor가 있어 `Google Cloud Run 운영 가이드`(`related_to`, bidirectional)와 `Vercel/Cloud Run 캐시 전략`(`depends_on`) 2건을 추가했다.
  - `Supabase migration 작업 규칙`은 현재 live corpus 안에 강한 target이 부족해 edge를 억지로 만들지 않았다. 이 문서는 후속 DB governance 문서가 들어올 때 다시 연결하는 편이 맞다.
- 2026-04-12 GraphRAG 일반 경로 보강:
  - 당시 extraction legacy 파일 `graphrag-relations.ts`에서 triplet extraction 후 `knowledge_relationships`를 실제 materialize하도록 수정했다. 해당 파일은 현재 제거됐다.
  - materialization은 현재 entry와 strong anchor를 가진 다른 문서 사이에서만 수행하고, free-form predicate는 enum 타입(`causes`, `depends_on`, `related_to` 등)으로 정규화한다.
  - linked env live verification에서 update-only run도 `relationshipsCreated`로 집계되는 문제가 확인되어, 현재는 신규 insert만 `relationshipsCreated`, 기존 edge update는 `relationshipsUpdated`로 분리 집계하도록 코드베이스를 보정했다.
  - `/graphrag/stats`는 cold 상태에서 초기화 누락으로 실패할 수 있어, `getStats()`도 lazy init을 수행하고 `lastIndexed`는 최신 `updated_at` 기준으로 계산하도록 수정했다.
  - 2026-04-13 Cloud Run production deploy 후 live 검증 결과:
    - revision `ai-engine-00297-lrl`가 100% traffic으로 전환됐고 `/health`는 즉시 `200` 응답.
    - `/api/ai/graphrag/stats`는 cold 상태에서 `success=true`, `totalDocuments=52`, `totalTriplets=157`, 이후 extract 실행 후 `totalTriplets=158`, `lastIndexed=2026-04-12T15:19:18.494385+00:00`로 갱신됐다.
    - `/api/ai/graphrag/extract` `batchSize=1` 호출은 `entriesProcessed=1`, `relationshipsCreated=1`, `relationshipsUpdated=0`을 반환했고, live `knowledge_relationships`는 `157 → 158`, `llamaIndexed`는 `1 → 2`, `unprocessed`는 `51 → 50`으로 이동했다.
- 2026-04-13 후속 small-batch pilot 결과:
  - `/api/ai/graphrag/extract` `batchSize=3` 호출은 `entriesProcessed=3`, `relationshipsCreated=2`, `relationshipsUpdated=0`을 반환했다.
  - 처리 대상 3건 중 `웹 서버 502 에러 해결`만 strong anchor를 찾아 edge 2건을 만들었고, `CPU 사용량 급증 대응 가이드`, `메모리 부족 장애 대응`은 triplet-only로 남았다.
  - live `knowledge_relationships`는 `158 → 160`, `llamaIndexed`는 `2 → 5`, `unprocessed`는 `50 → 47`, `lastIndexed`는 `2026-04-12T15:23:48.609738+00:00`로 갱신됐다.
  - 결론적으로 현재 anchor threshold는 보수적으로 동작하며, 대량 backfill 전에 anchor coverage 부족 문서군을 별도로 분류하는 편이 안전하다.
- 2026-04-13 coverage 분석 추가:
  - [analyze-graphrag-coverage.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/analyze-graphrag-coverage.ts:1), `npm run rag:analyze:graphrag -- --json` 경로를 추가해 GraphRAG coverage를 독립 측정 가능하게 했다.
  - 실측 결과는 `total=52`, `indexed=5`, `materialized=2`, `triplet_only=3`, `unprocessed=47`, `graphEdgesFromExtraction=3`이었다.
  - `triplet-only` 문서는 전부 `incident × seed_script`였고, `CPU 사용량 급증 대응 가이드`, `디스크 용량 부족 대응`, `메모리 부족 장애 대응`이 공통 hotspot으로 확인됐다.
  - 따라서 다음 액션은 bulk backfill이 아니라 incident seed 문서군용 anchor 보강 또는 strong-anchor matching threshold 재조정 검토다.
- 2026-04-13 fallback anchor + targeted replay 준비:
  - live `triplet-only` 3건의 저장 triplet은 `로그 쓰기 실패`, `OOM 재시작`, `사용자 지연`처럼 일반 개념 위주라 target KB title 직접 매칭이 어렵다는 점을 확인했다.
  - 그래서 당시 extraction legacy 파일 `graphrag-relations.ts`에 incident/troubleshooting용 `title-anchor-fallback`을 추가해, triplet anchor가 0건일 때 의미 있는 title token overlap + content similarity가 있는 문서로 `related_to` 1건을 계획하도록 보강했다. 해당 파일은 현재 제거됐다.
  - [graphrag.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/graphrag.ts:1)는 이제 `titles` 배열과 `onlyUnprocessed`를 받아 이미 indexed 된 문서도 targeted replay할 수 있다.
  - 다음 live 검증은 deploy 후 `/api/ai/graphrag/extract`에 `titles=["CPU 사용량 급증 대응 가이드","디스크 용량 부족 대응","메모리 부족 장애 대응"]`를 넘겨 materialized edge 증가량을 확인하는 단계다.
- 2026-04-13 production targeted replay 결과:
  - revision `ai-engine-00298-lrn`, Cloud Build `e820edcb-6452-41d4-8e56-9ea68cbb519c` 배포 후 `/health`는 `200`으로 통과했다.
  - `/api/ai/graphrag/extract`에 `batchSize=3`, `titles=["CPU 사용량 급증 대응 가이드","디스크 용량 부족 대응","메모리 부족 장애 대응"]`를 전달한 결과 `entriesProcessed=3`, `relationshipsCreated=3`, `relationshipsUpdated=0`이 반환됐다.
  - 생성된 edge 3건은 모두 `title-anchor-fallback` source였다.
    - `CPU 사용량 급증 대응 가이드 -> CPU 사용률 급증 원인 분석 및 대응 가이드` (`title_anchor_score=0.5045`)
    - `디스크 용량 부족 대응 -> 디스크 용량 부족 예방 및 긴급 대응 가이드` (`title_anchor_score=0.6968`)
    - `메모리 부족 장애 대응 -> 점진적 메모리 누수 탐지 및 대응 가이드` (`title_anchor_score=0.2849`)
  - post-state 기준 `materializedDocs 2 → 5`, `tripletOnlyDocs 3 → 0`, `graphEdgesFromExtraction 3 → 6`, `totalTriplets 160 → 163`, `lastIndexed=2026-04-12T22:52:30.76882+00:00`으로 개선됐다.
  - 따라서 incident hotspot 3건은 해소됐고, 다음 단계는 남은 `unprocessed` 47건에 대해 small-batch backfill을 재개하면서 fallback anchor가 일반 문서군에도 과도하게 연결되지 않는지 관찰하는 것이다.
- 2026-04-13 production small-batch backfill 재개 결과:
  - `/api/ai/graphrag/extract` `batchSize=4` 호출은 `entriesProcessed=4`, `relationshipsCreated=1`, `relationshipsUpdated=0`을 반환했다.
  - 처리 대상은 `데이터베이스 연결 실패 해결`, `캐시 서버 성능 저하 해결`, `Vercel/Cloud Run 캐시 전략`, `고가용성 아키텍처 설계`였고, 이 중 `캐시 서버 성능 저하 해결`만 edge 1건을 생성했다.
  - 생성된 edge는 `캐시 서버 성능 저하 해결 -> Redis 및 캐시 서버 운영 이슈 대응 가이드`였으며 `title-anchor-fallback`, `title_anchor_score=0.2908`, `shared_title_tokens=["캐시","서버"]`로 기록됐다.
  - post-state 기준 `totalTriplets 163 → 164`, `indexedDocs 5 → 9`, `materializedDocs 5 → 6`, `tripletOnlyDocs 0 → 3`, `unprocessed 47 → 43`, `graphEdgesFromExtraction 6 → 7`로 이동했다.
  - 현재 fallback category gate가 `incident` / `troubleshooting`에만 열려 있기 때문에 `Vercel/Cloud Run 캐시 전략`, `고가용성 아키텍처 설계` 같은 `architecture` 문서는 triplet-only로 남는다. 이건 현 시점에 의도된 보수 동작으로 본다.
- 2026-04-13 production small-batch backfill 추가 결과:
  - `/api/ai/graphrag/extract` `batchSize=4`를 한 번 더 실행한 결과 `entriesProcessed=4`, `relationshipsCreated=1`, `relationshipsUpdated=0`이 반환됐다.
  - 처리 대상은 `PostgreSQL 교착 상태(Deadlock) 해결`, `Docker 컨테이너 트러블슈팅`, `Google Cloud Run 운영 가이드`, `Storage 용량 관리 및 정리 가이드`였다.
  - 신규 edge는 `Storage 용량 관리 및 정리 가이드 -> 디스크 용량 부족 예방 및 긴급 대응 가이드` 1건이었고, 이번 edge는 `title-anchor-fallback`이 아니라 기존 triplet anchor 경로(`llamaindex-triplets`)로 생성됐다.
  - post-state 기준 `totalTriplets 164 → 165`, `indexedDocs 9 → 13`, `materializedDocs 6 → 7`, `tripletOnlyDocs 3 → 6`, `unprocessed 43 → 39`, `graphEdgesFromExtraction 7 → 8`로 이동했다.
  - 따라서 fallback noise는 추가로 관측되지 않았고, 남은 `triplet-only` hotspot은 `troubleshooting 3`, `architecture 2`, `best_practice 1`이다. 다음 배치도 같은 small-batch 방식으로 누적하는 것이 안전하다.
- 2026-04-13 production `batchSize=5` precision 검토 결과:
  - `/api/ai/graphrag/extract` `batchSize=5` 호출은 `entriesProcessed=5`, `relationshipsCreated=3`, `relationshipsUpdated=1`을 반환했다.
  - 처리 대상은 `네트워크 지연 및 연결 장애 진단 가이드`, `Database 서버 (db-main-01, db-repl-01) 장애 대응`, `Database 복제 및 백업 가이드`, `Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응`, `Cache 서버 최적화 및 운영 가이드`였다.
  - 수용 가능한 신규 연결은 `네트워크 지연 및 연결 장애 진단 가이드 -> 네트워크 지연 장애 대응` (`title-anchor-fallback`, `title_anchor_score=0.3608`)와 `Database 복제 및 백업 가이드 <-> Database 서버 (db-main-01, db-repl-01) 장애 대응` (`llamaindex-triplets`)였다.
  - 반면 `Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응 -> Docker 컨테이너 트러블슈팅` `related_to` edge는 source phrase `쓰기 부하가 큰 작업 / 대응 절차`로 생성돼 false-positive 후보로 분류했다. 지금 heuristic은 이런 일반 구를 anchor처럼 받아들일 수 있다.
  - post-state 기준 `totalTriplets 165 → 168`, `indexedDocs 13 → 18`, `materializedDocs 7 → 11`, `tripletOnlyDocs 6 → 7`, `unprocessed 39 → 34`, `graphEdgesFromExtraction 8 → 12`로 이동했다.
  - 따라서 다음 우선순위는 대량 backfill 재개가 아니라 generic triplet phrase match precision을 먼저 보강하는 것이다. 현재 `metadataMismatches`도 reverse-direction materialization까지 포함한 live graph와 per-run metadata action count를 단순 비교하므로 운영 지표로는 해석에 주의가 필요하다.
- 2026-04-13 generic phrase precision patch 로컬 검증 결과:
  - 당시 extraction legacy 파일 `graphrag-relations.ts`에 phrase stopword와 title-token gate를 추가했다. 이제 exact title이 아닌 경우에는 phrase와 candidate title 사이에 의미 있는 token overlap이 없으면 content match만으로 edge를 만들지 않는다. 해당 파일은 현재 제거됐다.
  - 이 보정은 production false-positive 후보였던 `Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응 -> Docker 컨테이너 트러블슈팅` 유형을 직접 겨냥한다. source phrase `쓰기 부하가 큰 작업 / 대응 절차`는 title anchor가 없으므로 더 이상 planner를 통과하면 안 된다.
  - 당시 extraction legacy 테스트 `graphrag-relations.test.ts`에 generic phrase가 unrelated target으로 연결되지 않는 회귀 테스트를 추가했고, 기존 deterministic edge / fallback / targeted replay 테스트도 유지했다. 해당 테스트 파일은 현재 제거됐다.
  - 로컬 검증은 `npx vitest run src/lib/graphrag-relations.test.ts --silent=passed-only`, `npm run type-check`, `npm run test` 기준으로 모두 통과했다.
  - 따라서 다음 단계는 Cloud Run production에 이 patch를 배포한 뒤, `Storage 서버 ...` 계열 title replay와 `batchSize=3~5` 소량 backfill로 false-positive 재발 여부를 확인하는 것이다.
- 2026-04-13 precision patch production 배포 및 live verify 결과:
  - `cloud-run/ai-engine/deploy.sh`로 Cloud Build `0ada53ce-56f7-4c0e-ae7e-2c4bd8579060`, revision `ai-engine-00299-fhv`를 배포했고, canonical service URL `https://ai-engine-jdhrhws7ia-an.a.run.app`에서 `/health` `200`을 확인했다.
  - deploy 직후 `/api/ai/graphrag/stats`는 `totalTriplets=168`, `lastIndexed=2026-04-13T00:03:19.341526+00:00`를 반환해 baseline이 유지됨을 확인했다.
  - targeted replay로 `/api/ai/graphrag/extract`에 `titles=["Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응"]`, `onlyUnprocessed=false`, `batchSize=1`를 전달한 결과 `relationshipsCreated=0`, `relationshipsUpdated=0`이 반환됐다. 즉, generic phrase `쓰기 부하가 큰 작업 / 대응 절차`는 더 이상 doc edge를 materialize하지 못한다.
  - 다만 기존 batch에서 남아 있던 stale noisy edge `Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응 -> Docker 컨테이너 트러블슈팅` (`related_to`, `llamaindex-triplets`)는 자동으로 사라지지 않았으므로, 해당 row 1건을 수동 삭제했다.
  - 삭제 후 같은 targeted replay를 다시 실행해도 `relationshipsCreated=0`, `relationshipsUpdated=0`이 유지됐고, `rag:analyze:graphrag` 기준 `materializedDocs 11 → 10`, `tripletOnlyDocs 7 → 8`, `graphEdgesFromExtraction 12 → 11`로 정리됐다.
  - 결론적으로 production false-positive 생성 경로는 막혔고 stale bad data도 제거됐다. 다음 단계는 `metadataMismatches` 지표 semantics를 정리한 뒤 small-batch backfill을 재개하는 것이다.
- 2026-04-13 analyzer semantics 정리 결과:
  - [analyze-graphrag-coverage.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/analyze-graphrag-coverage.ts:1)의 `metadataMismatches`는 실제 inconsistency가 아니라, `knowledge_base.metadata.materialized_relationships`가 per-run action count이고 `graphEdgeCount`는 live outgoing extraction edge count라는 의미 차이를 반영하지 못한 이름이었다.
  - 따라서 출력 필드를 `metadataActionCount`로 바꾸고, 요약에 `semantics` 블록을 추가해 두 숫자의 정의를 명시했다.
  - mismatch 목록도 `metadataActionDeltas`로 바꿨고, 각 문서마다 `graph_exceeds_metadata_actions` 또는 `metadata_actions_exceed_graph` 분류와 설명 문구를 함께 출력하도록 수정했다.
  - live JSON 검증 결과 `Database 복제 및 백업 가이드`는 `metadata_actions_exceed_graph`, `Database 서버 (db-main-01, db-repl-01) 장애 대응`은 `graph_exceeds_metadata_actions`로 표시돼, reverse-direction insert / cleanup / bidirectional write 가능성을 해석 가능한 상태로 바뀌었다.
  - 이로써 운영자가 healthy-but-asymmetric 상태를 실제 graph corruption처럼 오해할 위험은 줄었다. 다음 단계는 별도 semantics 수정이 아니라 `unprocessed 34건` small-batch backfill을 다시 누적하는 것이다.
- 2026-04-13 production small-batch backfill 재개 결과 (`batchSize=4`):
  - `/api/ai/graphrag/extract` `batchSize=4` 호출은 `entriesProcessed=4`, `relationshipsCreated=0`, `relationshipsUpdated=1`을 반환했다.
  - 처리 대상은 `Load Balancer (lb-main-01) 장애 대응`, `Load Balancer 설정 및 최적화 가이드`, `현재 인프라 역할/트래픽 토폴로지 스냅샷`, `AI 사이드바 응답 지연 점검 순서`였다.
  - 유일한 graph 변화는 `Load Balancer (lb-main-01) 장애 대응 -> Load Balancer 설정 및 최적화 가이드` `related_to` edge 1건 update였고, source는 `title-anchor-fallback`이었다. 이번 batch에서는 신규 false-positive나 신규 insert는 관측되지 않았다.
  - coverage 기준 post-state는 `indexedDocs 18 → 22`, `materializedDocs 10 → 11`, `tripletOnlyDocs 8 → 11`, `unprocessedDocs 34 → 30`, `graphEdgesFromExtraction 11 → 12`였다.
  - 다만 `/api/ai/graphrag/stats`의 `totalTriplets`는 batch 전후 모두 `167`로 유지됐다. 현재 구현은 [graphrag-service.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.ts:336)에서 `knowledge_relationships` row count를 `totalTriplets`로 반환하므로, 필드 이름과 실제 의미가 어긋난다.
  - 따라서 next action은 small-batch를 계속 누적하기 전에 `stats.totalTriplets` semantics를 `totalExtractionEdges`로 개명하거나, 실제 stored triplet 합계 집계로 바꾸는 것이다.
- 2026-04-13 stats semantics fix production 반영 결과:
  - [graphrag-service.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.ts:1)에서 `totalTriplets`를 `knowledge_base.metadata.triplets` 길이 합계로 재계산하고, extraction-generated edge 수는 `totalExtractionEdges`로 분리했다.
  - [graphrag-service.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.test.ts:1)와 [graphrag.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/graphrag.test.ts:1)를 새 응답 shape에 맞게 갱신했고, local 검증은 `npx vitest run src/lib/graphrag-service.test.ts src/routes/graphrag.test.ts --silent=passed-only`, `npm run type-check`, `npm run test`로 통과했다.
  - Cloud Build `970d7f58-4dc2-45c3-8e97-63631bb8f66d`, revision `ai-engine-00300-zrb` 배포 후 production `/api/ai/graphrag/stats`는 `totalDocuments=52`, `totalTriplets=110`, `totalExtractionEdges=12`, `lastIndexed=2026-04-13T01:24:05.870938+00:00`를 반환했다.
  - live `rag:analyze:graphrag -- --json` 기준 `indexedDocs=22`, `graphEdgesFromExtraction=12`, `avgTripletsPerIndexedDoc=5`였으므로 `totalTriplets=110`은 실제 corpus 상태와 일치한다.
  - 이로써 `/stats` contract는 운영 의미와 다시 맞아졌고, 다음 단계는 별도 stats 정리가 아니라 `unprocessed 30건` small-batch backfill 재개다.
- 2026-04-13 production small-batch backfill 추가 실행 결과 (`batchSize=4`):
  - production `/api/ai/graphrag/extract`를 `batchSize=4`로 호출했고, 응답은 `entriesProcessed=4`, `relationshipsCreated=1`, `relationshipsUpdated=0`이었다.
  - 처리 대상은 `Supabase migration 작업 규칙`, `현재 인프라 배치/운영 검증 스냅샷`, `free`, `kubectl get pods`였다.
  - 신규 materialized edge는 `free -> 점진적 메모리 누수 탐지 및 대응 가이드` `related_to` 1건이었고, relation metadata의 `extraction_source`는 `llamaindex-triplets`였다.
  - `Supabase migration 작업 규칙`, `현재 인프라 배치/운영 검증 스냅샷`, `kubectl get pods`는 triplet 저장만 수행했고 edge는 생성하지 않았다. 이번 batch에서는 generic phrase false-positive나 fallback noise가 관측되지 않았다.
  - post-state는 production `/api/ai/graphrag/stats` 기준 `totalDocuments=52`, `totalTriplets=130`, `totalExtractionEdges=13`, `lastIndexed=2026-04-13T03:02:29.219815+00:00`였고, `rag:analyze:graphrag -- --json` 기준 `indexedDocs=26`, `materializedDocs=12`, `tripletOnlyDocs=14`, `unprocessedDocs=26`, `graphEdgesFromExtraction=13`으로 전진했다.
  - category/source hotspot은 `architecture 4`, `best_practice 4`, `troubleshooting 4`, `command 1`, `incident 1`이며 source 기준으로는 `seed_script 9`, `imported 3`, `command_vectors_migration 1`, `manual 1`이다. 즉 incident hotspot은 완화됐지만 imported/command 문서군은 여전히 triplet-only 비율이 높다.
  - next action은 같은 `batchSize=3~5` 전략으로 `unprocessed 26건`을 계속 줄이되, imported/command 문서군은 edge insert보다 triplet-only 누적이 자연스러운지 별도로 관찰하는 것이다.
- 2026-04-13 production small-batch backfill 추가 실행 결과 (`batchSize=4`, command batch):
  - production `/api/ai/graphrag/extract`를 다시 `batchSize=4`로 호출했고, 응답은 `entriesProcessed=4`, `relationshipsCreated=2`, `relationshipsUpdated=0`이었다.
  - 처리 대상은 `top`, `docker exec`, `df`, `tail`였다.
  - 신규 materialized edge는 `top -> CPU 사용량 급증 대응 가이드`, `top -> 점진적 메모리 누수 탐지 및 대응 가이드` `related_to` 2건이었다. relation metadata의 `extraction_source`는 모두 `llamaindex-triplets`였고, anchor object는 각각 `CPU 사용량`, `메모리 사용량`이었다.
  - `docker exec`, `df`, `tail`는 triplet 저장만 수행했고 edge는 생성하지 않았다. 이번 batch에서도 generic phrase false-positive나 fallback noise는 관측되지 않았다.
  - post-state는 production `/api/ai/graphrag/stats` 기준 `totalDocuments=52`, `totalTriplets=150`, `totalExtractionEdges=15`, `lastIndexed=2026-04-13T04:14:46.105305+00:00`였고, `rag:analyze:graphrag -- --json` 기준 `indexedDocs=30`, `materializedDocs=13`, `tripletOnlyDocs=17`, `unprocessedDocs=22`, `graphEdgesFromExtraction=15`였다.
  - hotspot은 category 기준 `architecture 4`, `best_practice 4`, `command 4`, `troubleshooting 4`, `incident 1`이고, source 기준으로는 `seed_script 9`, `command_vectors_migration 4`, `imported 3`, `manual 1`이다. 즉 command 문서군은 일부만 anchor를 찾았고, 상당수는 구조적으로 triplet-only로 남고 있다.
  - next action은 same strategy로 `unprocessed 22건`을 계속 줄이되, command 문서군은 edge 생성을 강제하기보다 “검색/설명용 triplet-only 문서”로 남는 비율을 허용할지 운영 기준을 정하는 것이다.
- 2026-04-13 GraphRAG auto-extraction 비활성화 후 production telemetry 확인 결과:
  - 현재 codebase에서 `/api/ai/graphrag/extract`는 `410`으로 즉시 반환되고, auto-extraction/backfill은 운영 경로에서 중단된 상태다. 따라서 남은 판단은 “graph traversal 자체를 없앨지”와 “legacy extraction 구현을 보관할지”를 분리해서 봐야 한다.
  - production `/api/ai/supervisor`에 KB 유도형 질의 3건을 직접 전송해 실제 응답 경로를 점검했다.
    - `메모리 부족 해결 방법을 사내 지식베이스 기준으로 요약해줘...` → `toolsCalled=["searchKnowledgeBase"]`, `ragSources` 3건 모두 `sourceType="graph"`
    - `현재 인프라 토폴로지 알려줘...` → `toolsCalled=[]`, `ragSources=null`
    - `CPU 사용량 급증 대응 가이드와 점진적 메모리 누수...` → `toolsCalled=["searchKnowledgeBase"]`, `ragSources`는 `vector 3 + graph 1`
  - 즉 production에서는 `graphCount > 0`가 실제 user-visible 응답에 나타난다. 특히 장애/조치형 질의에서는 graph source가 직접 섞였고, topology 질의처럼 prompt만으로 끝나는 경로도 별도로 존재한다.
  - 따라서 immediate removal 대상은 graph traversal path가 아니라 disabled 상태인 auto-extraction/backfill legacy 구현이다. `graphrag-graph.ts` / `hybridGraphSearch` 경로는 live usage가 확인됐으므로, 제거 여부는 hit-rate/precision 추가 관찰 뒤에 판단해야 한다.
- 2026-04-13 topology 질의 KB 강제 라우팅 production 반영 결과:
  - 직전 telemetry에서 `현재 인프라 토폴로지 알려줘...` 질의는 `toolsCalled=[]`, `ragSources=null`로 끝났고, 이는 single-agent `prepareStep`이 아니라 `multi-agent + LLM routing` 경로를 타면서 KB 강제가 누락된 상태였다.
  - 따라서 [query-routing-signals.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/query-routing-signals.ts:1)에 topology/architecture 공용 pattern을 만들고, [supervisor-routing.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts:1)의 single-agent `prepareStep`, [orchestrator-context.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.ts:1)의 `preFilterQuery`, [orchestrator-routing.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts:1)의 forced routing이 동일한 규칙을 공유하도록 보강했다.
  - `generateTextWithRetry`도 `toolChoice`를 전달할 수 있게 확장해, `Advisor Agent`가 topology 질의에서 `searchKnowledgeBase`를 첫 도구로 강제 호출할 수 있게 했다.
  - local 검증은 `npx vitest run src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-context.test.ts src/services/ai-sdk/agents/orchestrator-routing.test.ts --silent=passed-only`, `npm run type-check`, `npm run test` 기준으로 모두 통과했다 (`72 files, 740 tests`).
  - Cloud Build `2f9c9c94-0b04-4753-9f29-aaeb3286fdd0`, revision `ai-engine-00302-729` 배포 후 production topology probe는 `toolsCalled=["searchKnowledgeBase","searchKnowledgeBase","finalAnswer"]`, `ragSources` architecture 문서 5건으로 바뀌었다. 대표 source는 `현재 인프라 역할/트래픽 토폴로지 스냅샷`, `현재 인프라 배치/운영 검증 스냅샷`, `고가용성 아키텍처 설계`였다.
  - 같은 배포에서 메모리 probe는 `toolsCalled=["searchKnowledgeBase","recommendCommands","finalAnswer"]`, `ragSources`에 `메모리 부족 장애 대응`(vector)과 graph source 1건을 유지해, 기존 troubleshooting 경로가 깨지지 않았음을 확인했다.
  - correctness는 닫혔고, 남은 운영 이슈는 topology 질의에서 동일 계열 `searchKnowledgeBase`가 2회 호출된다는 점이었다.
- 2026-04-13 duplicate KB call cost 억제 결과:
  - duplicate topology probe에서 남은 문제는 “tool call count”보다 “실제 KB/embedding/graph search가 2회 재실행된다”는 비용/지연 리스크였다. 모델이 같은 도구를 다시 고르는 것 자체는 강제로 막기 어렵기 때문에, tool layer에서 동일 입력을 coalesce하는 쪽으로 처리했다.
  - [knowledge-search-tool.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.ts:1)에 30초 TTL in-memory memoization을 추가했고, key는 normalized query + `category`, `severity`, `useGraphRAG`, `fastMode`, `includeWebSearch` 조합으로 고정했다.
  - 이 캐시는 duplicate query가 들어오면 같은 Promise를 재사용하므로, topology 질의처럼 같은 세션 안에서 `searchKnowledgeBase`가 2회 호출돼도 `embedText`, `hybridGraphSearch`, vector fallback을 다시 실행하지 않는다.
  - [knowledge-search-tool.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts:1)에 동일 topology query 2회 호출 시 `embedText`/`hybridGraphSearch`가 각 1회만 실행되는 회귀 테스트를 추가했다.
  - local 검증은 `npx vitest run src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts --silent=passed-only`, `npm run type-check`, `npm run test` 기준으로 모두 통과했고, 전체 `ai-engine` 스위트는 `72 files, 741 tests`로 증가했다.
  - 따라서 immediate next action은 duplicate call 자체를 zero로 만드는 것이 아니라, 이 cache patch를 canonical repo에 커밋하고 필요 시 다음 production deploy에서 latency 변화를 관찰하는 것이다.
