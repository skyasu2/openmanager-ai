# TODO - OpenManager AI v8

**Last Updated**: 2026-04-13 KST (GraphRAG sampled telemetry 배포 완료)

## Active Tasks

현재 진행 중인 긴급 작업 없음.

## On Hold

| Task | Priority | Status | Notes |
|------|----------|--------|-------|
| P2: QA evidence 저장소 용량 정리 | Medium | tracking-only | 7차 정리 후 `reports/qa/evidence`는 `51.71MiB / 195파일`. orphan/missing/archive candidate는 모두 `0`이고 남은 상위 evidence는 single-artifact first-paint, counted/release-facing 대표 proof, modal/detail/history 유일 스크린샷처럼 policy-protected 범주라 routine prune은 중단. 새로운 evidence 누적 시점 또는 명시적 archival override가 있을 때만 재평가. |

## Backlog

| Task | Priority | Notes |
|------|----------|-------|
| P3: graph traversal 유지/제거 판단 | Low | revision `ai-engine-00304-w5n` 기준으로 sampled structured telemetry가 배포됐다. 이제 2~4주 동안 `graph_rag_search` 로그의 `queryCategory`, `graphResults`, `cacheHit`, `totalFound`를 기준으로 graph hit-rate와 precision을 관찰한다. 낮으면 `graphrag-graph.ts`/`knowledge_relationships` traversal 제거를 검토한다. |
| P3: topology 질의 duplicate tool invocation 완전 제거 여부 판단 | Low | production에서는 여전히 `toolsCalled=["searchKnowledgeBase","searchKnowledgeBase","finalAnswer"]`가 보인다. 현재 cache로 backend 재실행 비용은 줄였으므로 correctness 이슈는 아니고, latency/observability에 실제 부담이 남는지 본 뒤 추가 dedupe를 결정한다. |
| P3: Storybook `experimentalComponentsManifest` stable 승격 여부 재확인 | Low | 2026-04-12 재확인 결과 `storybook`/`@storybook/nextjs-vite` stable dist-tag는 둘 다 아직 `10.2.10`, `next`는 `10.3.0-alpha.6`. `.storybook/main.ts`의 feature flag는 그대로 유지. |
| P3: `src/types/README.md` 전용 타입 SSOT 문서 필요성 재평가 | Low | 현재 전용 README는 없음. 타입 정제 작업은 완료됐고, 신규 문서 추가는 실제 drift가 다시 생길 때만 검토. |

### Completed (2026-04-13 #86)
- [x] Cloud Run runtime observability gap 식별 — production `LOG_LEVEL=warn` 때문에 기존 `logger.info` 기반 GraphRAG 사용 로그는 실제 관찰 지표로 남지 않는다는 점을 확인했다.
- [x] sampled structured telemetry 추가 — [knowledge-search-tool.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.ts:1)에 `graph_rag_search` structured log를 추가했다. raw query 대신 fingerprint만 남기고, `queryCategory`, `graphResults`, `vectorResults`, `cacheHit`, `totalFound`를 함께 기록한다.
- [x] production sample rate 명시 — [deploy.sh](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/deploy.sh:1)에 `GRAPH_RAG_TELEMETRY_SAMPLE_RATE=0.1`을 추가해 Cloud Run production에서도 비용을 제어한 관찰이 가능하도록 했다.
- [x] 로컬 검증 완료 — `cd cloud-run/ai-engine && npm run type-check`, `cd cloud-run/ai-engine && npm run test` 기준 통과했고, `knowledge-search-tool` 테스트에 production warn telemetry 계약을 추가했다.
- [x] Cloud Run production 배포 완료 — Cloud Build `3a846777-c333-4dd8-ac97-b40109d66a95`, revision `ai-engine-00304-w5n` 배포 후 `/health` `200`과 service env의 `GRAPH_RAG_TELEMETRY_SAMPLE_RATE=0.1` 반영을 확인했다.
- [x] live probe 재확인 — incident supervisor 질의는 `toolsCalled=["searchKnowledgeBase"]`, `ragSources` 3건 모두 `sourceType="graph"`로 성공 응답했다. 다만 sampled telemetry는 즉시성상 이번 턴 한정 질의에서 아직 로그 매치가 나오지 않았고, 이는 `0.1` sample miss로 해석한다.

### Completed (2026-04-13 #85)
- [x] 외부 best-practice 비교 완료 — GraphRAG 공식 문서의 indexing/query 분리 관점과 RFC 9110의 `410 Gone` semantics를 현재 runtime 구조와 대조했다. 결론은 traversal runtime은 유지하고, disabled extraction runtime은 제거하는 쪽이 맞다는 것이었다.
- [x] extraction legacy 제거 — `graphrag-relations.ts`, `graphrag-relations.test.ts`, `graphrag-service.ts`의 extraction/indexing export를 삭제해 runtime GraphRAG를 retrieval-only 구조로 단순화했다.
- [x] traversal helper 재배치 — [graphrag-graph.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-graph.ts:1)에 related-knowledge fetch helper를 옮겨 production graph traversal path는 그대로 유지했다.
- [x] disabled route dead code 제거 — [graphrag.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/graphrag.ts:1)에서 `/graphrag/extract`의 unreachable implementation을 지우고 `410`만 남겼다.
- [x] 로컬 검증 완료 — `cd cloud-run/ai-engine && npm run type-check`, `cd cloud-run/ai-engine && npm run test` 기준 통과했다.

### Completed (2026-04-13 #84)
- [x] `bc1fdc472` ai-engine production deploy 완료 — `cloud-run/ai-engine/deploy.sh`로 Cloud Build `9b07584c-d994-46e7-a4b1-78e4da5af3d1`, revision `ai-engine-00303-mfh`를 배포했고 service URL은 `https://ai-engine-jdhrhws7ia-an.a.run.app`로 유지됐다.
- [x] free-tier / local gate 재검증 — `bash scripts/mcp/codex-local.sh mcp list`, `bash scripts/mcp/mcp-health-check-codex.sh`, `bash scripts/ci/runner-health-check.sh`, `cd cloud-run/ai-engine && npm run type-check`, `cd cloud-run/ai-engine && npm run test`, `cd cloud-run/ai-engine && SKIP_RUN=true npm run docker:preflight`가 모두 통과했다.
- [x] live baseline 재확인 — `/health`는 `200`, `/monitoring`은 인증 포함 `200`, `/api/ai/graphrag/stats`는 `totalDocuments=52`, `totalTriplets=150`, `totalExtractionEdges=15`, `lastIndexed=2026-04-13T04:14:46.105305+00:00`를 반환했다.
- [x] telemetry baseline capture 완료 — topology probe는 `toolsCalled=["searchKnowledgeBase","searchKnowledgeBase","finalAnswer"]`, `ragSources=vector 6 + graph 2`, incident probe는 `toolsCalled=["searchKnowledgeBase","finalAnswer"]`, `ragSources=vector 1 + graph 1`로 확인됐다. 즉 graph source는 최신 cleanup 배포 후에도 실제 응답에 계속 사용된다.

### Completed (2026-04-13 #83)
- [x] GraphRAG 계획/상태 재분석 완료 — 최근 canonical commit `bc1fdc472`와 기존 production verify 기록을 대조해, 현재 우선순위가 더 이상 `small-batch backfill`이 아니라 `배포 후 telemetry 관찰`이라는 점을 문서 기준선으로 고정했다.
- [x] 운영 기준 재정렬 — 현재 방침을 “RAG core 유지, graph traversal은 계측 후 판단, auto-extraction/backfill은 중단”으로 명문화했다.
- [x] 남은 작업 재정의 — 즉시 작업은 `bc1fdc472` production deploy + telemetry baseline capture로 정리했고, 이후 판단 작업을 `graph traversal 유지/제거`와 extraction legacy 삭제 두 갈래로 분리했다.
- [x] 문서 링크 기준선 정리 — 최근 완료 항목의 `llamaindex-rag-*` 참조를 현재 파일명인 `graphrag-*` 기준으로 정리했다.

### Completed (2026-04-13 #82)
- [x] duplicate KB call cost 억제 — [knowledge-search-tool.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.ts:1)에 30초 TTL in-memory memoization을 추가해 동일 입력의 `searchKnowledgeBase` 재호출은 KB/embedding/graph search를 재실행하지 않도록 했다.
- [x] cache key 정규화 — query trim/lowercase/whitespace normalization과 `category`, `severity`, `useGraphRAG`, `fastMode`, `includeWebSearch`를 묶어 같은 의미의 duplicate query만 coalesce하도록 맞췄다.
- [x] 회귀 테스트 추가 — [knowledge-search-tool.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/tools-ai-sdk/reporter-tools/knowledge-search-tool.test.ts:1)에 동일 topology query 2회 호출 시 `embedText`와 `hybridGraphSearch`가 각 1회만 실행되는 계약을 추가했다.
- [x] 검증 완료 — `npm run type-check`, targeted knowledge tool test, `npm run test`(`72 files, 741 tests`) 기준 통과했다.

### Completed (2026-04-13 #81)
- [x] topology 질의 KB 강제 라우팅 구현 — single-agent `prepareStep`뿐 아니라 multi-agent 경로의 [preFilterQuery](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-context.ts:288), [executeForcedRouting](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/ai-sdk/agents/orchestrator-routing.ts:158)도 같은 topology/architecture pattern을 사용해 `Advisor Agent + searchKnowledgeBase`를 강제하도록 보강했다.
- [x] retry wrapper 계약 확장 — [retry-with-fallback.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts:36)에 `toolChoice` 전달 경로를 추가해 forced routing이 실제 도구 강제를 표현할 수 있게 했다.
- [x] 회귀 테스트 추가 — `supervisor-routing`, `orchestrator-context`, `orchestrator-routing` 테스트에 topology 질의 계약을 추가했고, `ai-engine` 전체 검증은 `type-check`, `npm run test` 기준 모두 통과했다 (`72 files, 740 tests`).
- [x] production 배포 및 live verify — Cloud Build `2f9c9c94-0b04-4753-9f29-aaeb3286fdd0`, revision `ai-engine-00302-729` 배포 후 topology probe는 `toolsCalled=["searchKnowledgeBase","searchKnowledgeBase","finalAnswer"]`, `ragSources` architecture 문서 5건으로 바뀌었고, 기존 메모리 probe도 `searchKnowledgeBase + recommendCommands` 경로를 유지했다.

### Completed (2026-04-13 #80)
- [x] production supervisor telemetry로 GraphRAG 실제 사용 여부 확인 — `searchKnowledgeBase` 호출이 실제 응답 경로에서 발생하는지 보기 위해 production `/api/ai/supervisor`에 KB 유도형 질의 3건을 직접 보냈다.
- [x] graph source live 확인 — `메모리 부족 해결 방법...` 질의는 `toolsCalled=["searchKnowledgeBase"]`였고 `ragSources` 3건이 모두 `sourceType="graph"`였다. `CPU 사용량 급증 대응 가이드와 점진적 메모리 누수...` 질의도 `searchKnowledgeBase`를 호출했고 `vector 3 + graph 1` source mix가 실제 응답에 포함됐다.
- [x] non-tool 경로도 함께 확인 — `현재 인프라 토폴로지 알려줘` 질의는 `toolsCalled=[]`, `ragSources=null`로 끝나서 routing/prompt만으로는 아직 KB 호출이 강제되지 않음을 확인했다.
- [x] 운영 결론 고정 — production에서는 `graphCount > 0`가 실제 응답에 나타난다. 따라서 지금 당장 제거 대상은 graph traversal path가 아니라, disabled 상태인 auto-extraction/backfill legacy 구현의 보관/삭제 판단이다.

### Completed (2026-04-13 #79)
- [x] production small-batch backfill 1회 추가 실행 — `/api/ai/graphrag/extract`를 `batchSize=4`로 호출해 `top`, `docker exec`, `df`, `tail` 4건을 추가 처리했다.
- [x] live edge 생성량 확인 — 응답은 `entriesProcessed=4`, `relationshipsCreated=2`, `relationshipsUpdated=0`이었고, 신규 edge는 `top -> CPU 사용량 급증 대응 가이드`, `top -> 점진적 메모리 누수 탐지 및 대응 가이드` 2건이었다.
- [x] precision 확인 — `docker exec`, `df`, `tail`는 모두 triplet-only로 남았고, 생성된 2개 edge는 `CPU 사용량` / `메모리 사용량` anchor와 직접 대응해 generic phrase false-positive로 보이지 않았다.
- [x] corpus 진행 상태 전진 — post-state는 `indexedDocs 26 → 30`, `materializedDocs 12 → 13`, `tripletOnlyDocs 14 → 17`, `unprocessedDocs 26 → 22`, `graphEdgesFromExtraction 13 → 15`, `/stats.totalTriplets 130 → 150`이다.

### Completed (2026-04-13 #78)
- [x] production small-batch backfill 1회 추가 실행 — `/api/ai/graphrag/extract`를 `batchSize=4`로 호출해 `Supabase migration 작업 규칙`, `현재 인프라 배치/운영 검증 스냅샷`, `free`, `kubectl get pods` 4건을 추가 처리했다.
- [x] live edge 생성량 확인 — 응답은 `entriesProcessed=4`, `relationshipsCreated=1`, `relationshipsUpdated=0`이었고, 신규 edge는 `free -> 점진적 메모리 누수 탐지 및 대응 가이드` (`related_to`, `llamaindex-triplets`) 1건이었다.
- [x] precision 확인 — 같은 batch에서 `Supabase migration 작업 규칙`, `현재 인프라 배치/운영 검증 스냅샷`, `kubectl get pods`는 모두 triplet-only로 남았고, generic phrase false-positive는 관측되지 않았다.
- [x] corpus 진행 상태 전진 — post-state는 `indexedDocs 22 → 26`, `materializedDocs 11 → 12`, `tripletOnlyDocs 11 → 14`, `unprocessedDocs 30 → 26`, `graphEdgesFromExtraction 12 → 13`, `/stats.totalTriplets 110 → 130`이다.

### Completed (2026-04-13 #77)
- [x] stats semantics fix 구현 — [graphrag-service.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.ts:1)에서 `totalTriplets`를 indexed knowledge 문서의 stored triplet 합계로 계산하고, extraction edge 수는 `totalExtractionEdges`로 분리했다.
- [x] 계약 테스트 정리 — [graphrag-service.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.test.ts:1)와 [graphrag.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/graphrag.test.ts:1)를 새 응답 shape에 맞게 갱신했다.
- [x] production 배포 및 live verify — Cloud Build `970d7f58-4dc2-45c3-8e97-63631bb8f66d`, revision `ai-engine-00300-zrb` 배포 후 `/api/ai/graphrag/stats`가 `totalTriplets=110`, `totalExtractionEdges=12`, `lastIndexed=2026-04-13T01:24:05.870938+00:00`를 반환하는 것을 확인했다.
- [x] 운영 해석 고정 — 이제 `/stats.totalTriplets`는 stored triplet 총합을 의미하므로, 다음 우선순위는 `unprocessed 30건` small-batch backfill 재개다.

### Completed (2026-04-13 #76)
- [x] production small-batch backfill 재개 — `/api/ai/graphrag/extract` `batchSize=4`를 실행해 `Load Balancer (lb-main-01) 장애 대응`, `Load Balancer 설정 및 최적화 가이드`, `현재 인프라 역할/트래픽 토폴로지 스냅샷`, `AI 사이드바 응답 지연 점검 순서` 4건을 추가 처리했다.
- [x] live edge 변화 확인 — 응답은 `entriesProcessed=4`, `relationshipsCreated=0`, `relationshipsUpdated=1`이었고, update 대상 edge는 `Load Balancer (lb-main-01) 장애 대응 -> Load Balancer 설정 및 최적화 가이드` (`title-anchor-fallback`)였다.
- [x] corpus 진행 상태 전진 — `indexedDocs 18 → 22`, `unprocessed 34 → 30`, `graphEdgesFromExtraction 11 → 12`, `tripletOnlyDocs 8 → 11`로 이동했다.
- [x] 운영 이슈 식별 — `/api/ai/graphrag/stats.totalTriplets`는 이번 batch 후에도 `167`로 유지됐는데, 실제로는 triplet total이 아니라 extraction edge count를 내보내는 이름이라 별도 semantics 정리가 필요하다.

### Completed (2026-04-13 #75)
- [x] GraphRAG analyzer semantics 정리 — [analyze-graphrag-coverage.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/analyze-graphrag-coverage.ts:1)에서 `metadataMismatches`를 `metadataActionDeltas`로 바꾸고, `materialized_relationships`는 live edge count가 아니라 per-run action count라는 설명을 summary에 추가했다.
- [x] delta 분류 추가 — `graph_exceeds_metadata_actions`, `metadata_actions_exceed_graph`로 나눠 reverse-direction insert, cleanup, bidirectional write 같은 일반적인 원인을 함께 출력하도록 보강했다.
- [x] live JSON 출력 검증 — `rag:analyze:graphrag -- --json` 기준 `Database 복제 및 백업 가이드`, `Database 서버 (db-main-01, db-repl-01) 장애 대응` 2건이 더 이상 “mismatch”가 아니라 해석 가능한 action delta로 표시되는 것을 확인했다.
- [x] 운영 해석 고정 — 다음 우선순위는 analyzer 수정이 아니라 `unprocessed 34건` small-batch backfill 재개다.

### Completed (2026-04-13 #74)
- [x] precision patch Cloud Run production 배포 — `cloud-run/ai-engine/deploy.sh`로 Cloud Build `0ada53ce-56f7-4c0e-ae7e-2c4bd8579060`, revision `ai-engine-00299-fhv`를 배포했고 `/health` `200`을 확인했다.
- [x] targeted live replay 검증 — `/api/ai/graphrag/extract`에 `titles=["Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응"]`, `onlyUnprocessed=false`, `batchSize=1`를 전달한 결과 `relationshipsCreated=0`, `relationshipsUpdated=0`으로 generic phrase false-positive가 재생성되지 않음을 확인했다.
- [x] stale noisy edge cleanup — 기존에 남아 있던 `Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응 -> Docker 컨테이너 트러블슈팅` (`related_to`, `llamaindex-triplets`, `쓰기 부하가 큰 작업 / 대응 절차`) 1건을 삭제했다.
- [x] post-state 재측정 — `rag:analyze:graphrag` 기준 `materializedDocs 11 → 10`, `tripletOnlyDocs 7 → 8`, `graphEdgesFromExtraction 12 → 11`로 정리됐고, 해당 source 문서는 이제 올바르게 `triplet_only`로 분류된다.
- [x] 운영 해석 고정 — production false-positive 생성 경로는 막혔고 stale bad data도 제거됐다. 다음 우선순위는 analyzer mismatch semantics 정리 후 small-batch backfill 재개다.

### Completed (2026-04-13 #73)
- [x] generic phrase precision patch 적용 — 당시 extraction legacy 파일 `graphrag-relations.ts`에 phrase stopword와 title-token gate를 추가해, title overlap 없는 content-only phrase는 anchor로 인정하지 않도록 보강했다. 해당 파일은 현재 제거됐다.
- [x] false-positive 회귀 테스트 추가 — 당시 extraction legacy 테스트 `graphrag-relations.test.ts`에 `Storage 서버 ... -> Docker 컨테이너 트러블슈팅` 유형의 generic phrase 케이스를 넣어 `planned=0`을 고정했다. 해당 테스트 파일은 현재 제거됐다.
- [x] 로컬 검증 완료 — `npx vitest run src/lib/graphrag-relations.test.ts --silent=passed-only`, `npm run type-check`, `npm run test`가 모두 통과했다.
- [x] 운영 해석 고정 — 이번 턴 범위에서는 precision patch를 로컬 코드와 테스트로 닫았고, 다음 순서는 Cloud Run deploy 후 targeted live replay로 실제 false-positive 재발 여부를 확인하는 것이다.

### Completed (2026-04-13 #72)
- [x] production `batchSize=5` backfill 실행 — `/api/ai/graphrag/extract`에 `batchSize=5`를 적용해 `네트워크 지연 및 연결 장애 진단 가이드`, `Database 서버 장애 대응`, `Database 복제 및 백업 가이드`, `Storage 서버 장애 대응`, `Cache 서버 최적화 및 운영 가이드` 5건을 추가 처리했다.
- [x] live edge 생성량 측정 — `entriesProcessed=5`, `relationshipsCreated=3`, `relationshipsUpdated=1`이 반환됐고 post-state는 `indexedDocs 13 → 18`, `unprocessed 39 → 34`, `graphEdgesFromExtraction 8 → 12`, `totalTriplets 165 → 168`으로 이동했다.
- [x] precision risk 식별 — 신규 edge 중 `Storage 서버 (storage-nas-01, storage-s3-gateway) 장애 대응 -> Docker 컨테이너 트러블슈팅` (`related_to`, `sourceType=llamaindex-triplets`)는 source phrase `쓰기 부하가 큰 작업 / 대응 절차`에 의해 생성돼 false-positive 후보로 분류했다.
- [x] 운영 해석 고정 — `네트워크 지연 및 연결 장애 진단 가이드 -> 네트워크 지연 장애 대응`, `Database 복제 및 백업 가이드 <-> Database 서버 장애 대응`는 수용 가능하지만, generic phrase noise가 production에서 실제로 관측됐으므로 다음 우선순위는 backfill 확대가 아니라 matching heuristic tightening이다.

### Completed (2026-04-13 #71)
- [x] production small-batch backfill 추가 실행 — `/api/ai/graphrag/extract`에 `batchSize=4`를 다시 적용해 `PostgreSQL 교착 상태(Deadlock) 해결`, `Docker 컨테이너 트러블슈팅`, `Google Cloud Run 운영 가이드`, `Storage 용량 관리 및 정리 가이드` 4건을 추가 처리했다.
- [x] live edge 생성량 측정 — 4건 중 `Storage 용량 관리 및 정리 가이드` 1건만 신규 edge `1`건을 만들었고, 나머지 3건은 triplet-only로 남았다.
- [x] 연결 품질 확인 — 신규 edge는 `Storage 용량 관리 및 정리 가이드 -> 디스크 용량 부족 예방 및 긴급 대응 가이드`였고, 이번 batch에서는 `title-anchor-fallback`이 아니라 기존 triplet anchor 경로로 생성됐다.
- [x] coverage 상태 전진 — `totalTriplets 164 → 165`, `indexedDocs 9 → 13`, `materializedDocs 6 → 7`, `tripletOnlyDocs 3 → 6`, `unprocessed 43 → 39`, `graphEdgesFromExtraction 7 → 8`로 이동했다.
- [x] 운영 해석 고정 — 현재 fallback noise는 추가 관측되지 않았고, 남은 hotspot은 `troubleshooting`/`architecture`/`best_practice` 문서군이라 다음 배치도 small-batch로 유지하는 편이 안전하다.

### Completed (2026-04-13 #70)
- [x] production small-batch backfill 재개 — `/api/ai/graphrag/extract`에 `batchSize=4`를 적용해 `데이터베이스 연결 실패 해결`, `캐시 서버 성능 저하 해결`, `Vercel/Cloud Run 캐시 전략`, `고가용성 아키텍처 설계` 4건을 추가 처리했다.
- [x] live edge 생성량 측정 — 4건 중 `캐시 서버 성능 저하 해결` 1건만 신규 edge `1`건을 만들었고, 나머지 3건은 triplet-only로 남았다.
- [x] fallback noise 점검 — 생성된 edge는 `캐시 서버 성능 저하 해결 -> Redis 및 캐시 서버 운영 이슈 대응 가이드` (`title-anchor-fallback`, `title_anchor_score=0.2908`)였고, 현 시점에서는 허용 가능한 연결로 판단했다.
- [x] coverage 상태 전진 — `totalTriplets 163 → 164`, `indexedDocs 5 → 9`, `materializedDocs 5 → 6`, `tripletOnlyDocs 0 → 3`, `unprocessed 47 → 43`, `graphEdgesFromExtraction 6 → 7`로 이동했다.
- [x] 운영 해석 고정 — 현재 fallback은 incident/troubleshooting에만 열려 있어 `고가용성 아키텍처 설계`, `Vercel/Cloud Run 캐시 전략` 같은 architecture 문서는 여전히 triplet-only로 남는다. 다음 단계는 같은 small-batch 전략을 유지하되 category별 정책 차이를 따로 보는 편이 안전하다.

### Completed (2026-04-13 #69)
- [x] Cloud Run production 배포 완료 — `cloud-run/ai-engine/deploy.sh`로 revision `ai-engine-00298-lrn`을 배포했고 health check `200`을 확인했다. Cloud Build ID는 `e820edcb-6452-41d4-8e56-9ea68cbb519c`.
- [x] production targeted replay 성공 — `/api/ai/graphrag/extract`에 `titles=["CPU 사용량 급증 대응 가이드","디스크 용량 부족 대응","메모리 부족 장애 대응"]`, `batchSize=3`를 전달해 `entriesProcessed=3`, `relationshipsCreated=3`, `relationshipsUpdated=0`을 확인했다.
- [x] hotspot 3건 materialization 완료 — 세 문서 모두 `materialized_relationships 0 → 1`, `materialized_relationship_inserts 0 → 1`로 전환됐고 더 이상 `triplet-only`가 아니게 됐다.
- [x] fallback anchor live 검증 완료 — 신규 edge 3건은 모두 `title-anchor-fallback`으로 생성됐고, target은 `CPU 사용률 급증 원인 분석 및 대응 가이드`, `디스크 용량 부족 예방 및 긴급 대응 가이드`, `점진적 메모리 누수 탐지 및 대응 가이드`였다.
- [x] coverage 개선 확인 — `rag:analyze:graphrag` 기준 `materializedDocs 2 → 5`, `tripletOnlyDocs 3 → 0`, `graphEdgesFromExtraction 3 → 6`, `lastIndexed=2026-04-12T22:52:30.76882+00:00`으로 이동했다.

### Completed (2026-04-13 #68)
- [x] generic triplet 한계 확인 — live `triplet-only` 3건의 저장 triplet을 점검한 결과, `디스크 부족 장애 → 로그 쓰기 실패`, `메모리 부족 → OOM 재시작`, `CPU 급증 장애 → 사용자 지연`처럼 target KB title로 바로 연결되지 않는 일반 개념 위주라서 단순 anchor 문서 추가만으로는 materialization 증가가 제한적이라는 점을 확인했다.
- [x] fallback anchor 로직 추가 — 당시 extraction legacy 파일 `graphrag-relations.ts`에 incident/troubleshooting 문서용 title/content 유사도 기반 `title-anchor-fallback` 경로를 추가해, triplet에서 strong anchor를 못 잡을 때도 보수적으로 `related_to` 1건을 계획할 수 있게 했다. 해당 파일은 현재 제거됐다.
- [x] targeted replay 경로 추가 — [graphrag.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/graphrag.ts:1), [graphrag-service.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.ts:1)에서 `/api/ai/graphrag/extract`가 `titles` 배열을 받으면 이미 indexed 된 문서도 제목 기준으로 다시 처리할 수 있게 했다.
- [x] coverage script 보정 — [analyze-graphrag-coverage.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/analyze-graphrag-coverage.ts:1)가 `title-anchor-fallback` source도 GraphRAG extraction edge로 집계하도록 수정했다.
- [x] 회귀 검증 완료 — relation/route 단위 테스트와 `ai-engine` 전체 테스트를 통과했고, 다음 live 액션은 deploy 후 incident `triplet-only` 3건 targeted replay 실행으로 고정했다.

### Completed (2026-04-13 #67)
- [x] `GraphRAG` coverage 분석 스크립트 추가 — [analyze-graphrag-coverage.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/analyze-graphrag-coverage.ts:1)를 추가하고 [package.json](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/package.json:1)에 `rag:analyze:graphrag` 실행 경로를 고정했다.
- [x] live coverage 측정 완료 — `npx tsx scripts/analyze-graphrag-coverage.ts --json`, `npm run rag:analyze:graphrag -- --json` 모두 통과했고, live corpus는 `total=52`, `indexed=5`, `materialized=2`, `triplet_only=3`, `unprocessed=47`, `graphEdgesFromExtraction=3`으로 측정됐다.
- [x] hotspot 식별 — `triplet-only` 3건은 모두 `incident × seed_script`였고, `CPU 사용량 급증 대응 가이드`, `디스크 용량 부족 대응`, `메모리 부족 장애 대응`이 공통으로 `triplets=5 / graphEdge=0` 상태였다.
- [x] 운영 해석 고정 — 현재 strong-anchor 정책에서는 incident seed 문서군이 bulk backfill 효율을 떨어뜨리므로, 다음 작업은 대량 처리보다 anchor 후보 문서 확충 또는 matching threshold 조정 검토가 맞다.

### Completed (2026-04-13 #66)
- [x] `GraphRAG` small-batch backfill pilot 실행 — production `/api/ai/graphrag/extract`에 `batchSize=3`를 적용해 `CPU 사용량 급증 대응 가이드`, `메모리 부족 장애 대응`, `웹 서버 502 에러 해결` 3건을 추가 처리했다.
- [x] live edge 생성량 측정 — 3건 중 `웹 서버 502 에러 해결` 1건만 strong anchor를 찾아 신규 edge `2`건을 생성했고, 나머지 2건은 triplet만 저장됐다.
- [x] live corpus 상태 전진 — `knowledge_relationships` `158 → 160`, `llamaIndexed` `2 → 5`, `unprocessed` `50 → 47`, `totalTriplets` `158 → 160`으로 이동했다.
- [x] 운영 해석 고정 — 현재 strong-anchor threshold에서는 incident 문서 상당수가 edge 없이 triplet-only로 남을 수 있으므로, 대량 backfill 전에 anchor coverage/threshold 정책 재검토가 필요하다.

### Completed (2026-04-13 #65)
- [x] Cloud Run deploy blocker 해소 — [Dockerfile](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/Dockerfile:1)에 `NPM_VERSION=11.10.0` pin을 추가해 Docker base npm(`11.6.2`)과 workspace lockfile generator(`11.10.0`) drift를 제거했다.
- [x] production build parser blocker 해소 — [logger.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/logger.ts:1)에서 `typeof import('@google-cloud/pino-logging-gcp-config')` 타입 참조를 제거하고 로컬 함수 시그니처로 대체해 `@google-cloud/logging` declaration parse 오류를 우회했다.
- [x] Cloud Run production 배포 완료 — `cloud-run/ai-engine/deploy.sh` 실행 결과 revision `ai-engine-00297-lrl`이 2026-04-13 KST에 100% traffic으로 전환됐다.
- [x] free-tier guard 재확인 — Cloud Build `5e44bb37-e612-4f6e-a777-4573216bb884`는 `options.machineType` 비어 있는 기본 머신으로 성공했고, Cloud Run live limits도 `512Mi / 1 vCPU / maxScale=1` 유지.
- [x] live GraphRAG semantics 검증 완료 — deploy 후 `/api/ai/graphrag/stats`가 cold 상태에서 즉시 성공했고, `/api/ai/graphrag/extract` `batchSize=1` 호출은 `relationshipsCreated=1`, `relationshipsUpdated=0`을 반환했다. live `knowledge_relationships`는 `157 → 158`, `llamaIndexed`는 `1 → 2`, `unprocessed`는 `51 → 50`.

### Completed (2026-04-12 #64)
- [x] linked env `GraphRAG` live verification 수행 — `/api/ai/graphrag/extract`를 `batchSize=1`로 호출해 `디스크 용량 부족 대응` 1건이 실제로 `indexed_by=llamaindex` 처리되는 것을 확인.
- [x] live defect 2건 식별 — cold 상태의 `/api/ai/graphrag/stats`가 초기화 없이 `Could not retrieve GraphRAG stats`로 실패했고, `/api/ai/graphrag/extract`는 기존 row update까지 `relationshipsCreated`로 집계해 의미가 틀린 것을 확인.
- [x] stats 초기화 보강 — [graphrag-service.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.ts:1)에서 `getStats()`도 lazy init을 수행하고, `created_at`이 아니라 최신 `updated_at` 기준으로 `lastIndexed`를 계산하도록 수정.
- [x] extract 응답 의미 보정 — 당시 extraction legacy 파일 `graphrag-relations.ts`과 [graphrag.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/graphrag.ts:1)에서 insert/update를 분리 집계해 `relationshipsCreated`는 신규 insert만, `relationshipsUpdated`는 기존 edge update만 나타내도록 수정했다. extraction legacy 파일은 현재 제거됐다.
- [x] 회귀 테스트 추가 — [graphrag-service.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/graphrag-service.test.ts:1)로 stats lazy init과 `lastIndexed` 계산을 고정하고, 기존 relation/route 테스트도 새 semantics로 갱신.

### Completed (2026-04-12 #62)
- [x] `knowledge_base` relation edge 전략 확정 — first batch는 자동 triplet 추출보다 deterministic 수동 edge가 안전하다고 판단하고 [seed-knowledge-base.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/seed-knowledge-base.ts:1)에 `relationships` 동기화 경로를 추가.
- [x] first batch 관계 반영 완료 — [knowledge-base.first-batch.json](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/data/knowledge-base.first-batch.json:1)에 `AI 사이드바 응답 지연 점검 순서 → Google Cloud Run 운영 가이드`, `AI 사이드바 응답 지연 점검 순서 → Vercel/Cloud Run 캐시 전략` 2건을 정의하고 live `knowledge_relationships`를 `155 → 157`로 증가시켰다.
- [x] retrieval 회귀 없음 확인 — 관계 반영 후 [rag-goldset.corpus-first-batch.json](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/data/rag-goldset.corpus-first-batch.json:1) 기준 `KB01~KB04` 모두 `quality=1.0` 유지, `rag_on avg latency 1409ms`, `rag_off avg latency 178ms` 확인.
- [x] 운영 결론 고정 — `Supabase migration 작업 규칙`은 현재 live corpus에 강한 target이 부족해 edge를 억지로 만들지 않고, 후속 DB governance 문서 추가 시 재평가한다.

### Completed (2026-04-12 #63)
- [x] GraphRAG extract 일반 경로 보강 — 당시 extraction legacy 파일 `graphrag-relations.ts`에서 `triplets -> metadata` 저장만 하던 흐름을 `knowledge_relationships` materialization까지 수행하도록 수정했다. extraction legacy 파일은 현재 제거됐다.
- [x] predicate 정규화 추가 — free-form triplet predicate를 `related_to`, `depends_on`, `causes` 등 지원 enum으로 정규화하고, 현재 entry와 strong anchor 문서 사이에서만 edge를 생성하도록 제한.
- [x] route 반환 의미 보정 — [graphrag.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/routes/graphrag.ts:1)에서 `/graphrag/extract`의 `relationshipsCreated`를 실제 materialized edge 수 기준으로 집계하도록 수정.
- [x] 회귀 테스트 추가 — 당시 extraction legacy 테스트 `graphrag-relations.test.ts`로 신규 edge insert/update와 metadata 갱신 경로를 고정했고, `graphrag` route 테스트와 함께 통과 확인했다. 해당 테스트 파일은 현재 제거됐다.

### Completed (2026-04-12 #61)
- [x] `knowledge_base` first batch live upsert 완료 — `cd cloud-run/ai-engine && npx tsx scripts/seed-knowledge-base.ts --input=scripts/data/knowledge-base.first-batch.json --upsert` 실행 결과 추천 2건이 모두 `추가 (+ 임베딩)` 처리됐고 live row count는 `51`.
- [x] first batch retrieval spot-check 완료 — `cd cloud-run/ai-engine && npx tsx scripts/rag-eval-goldset.ts --input=scripts/data/rag-goldset.corpus-first-batch.json`에서 `KB01~KB04` 모두 `quality=1.0`, `categoryCoverage=1.0`, `keywordCoverage=1.0`, `destructiveLeaks=0` 확인.
- [x] latency 해석 고정 — 이번 batch는 검색 품질 보강에는 성공했지만 GraphRAG 평균 latency는 `2610ms`, rag_off 평균 latency는 `127ms`라 retrieval latency 과제는 별도 트랙으로 남는다.

### Completed (2026-04-12 #60)
- [x] `knowledge_base` first batch 입력 경로 확정 — [seed-knowledge-base.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/seed-knowledge-base.ts:1)에 `--input`, `--dry-run`, `--upsert`, JSON dry-run 출력, title 기준 업데이트 경로를 추가.
- [x] 추천 2건 배치 데이터 추가 — [knowledge-base.first-batch.json](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/data/knowledge-base.first-batch.json:1)에 `AI 사이드바 응답 지연 점검 순서`, `Supabase migration 작업 규칙` 문서를 first batch로 고정.
- [x] retrieval spot-check 자산 추가 — [rag-eval-goldset.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/rag-eval-goldset.ts:1)에 `--input`, `--list-cases` 경로를 추가하고, [rag-goldset.corpus-first-batch.json](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/scripts/data/rag-goldset.corpus-first-batch.json:1)로 first batch 전용 시나리오 `4`건을 정의.
- [x] dry-run 검증 완료 — `npx tsx scripts/seed-knowledge-base.ts --input=scripts/data/knowledge-base.first-batch.json --dry-run --upsert --json`, `npx tsx scripts/rag-eval-goldset.ts --input=scripts/data/rag-goldset.corpus-first-batch.json --list-cases` 통과.

### Completed (2026-04-12 #59)
- [x] `knowledge_base` split-first 구현 완료 — [topology-rag-injector.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/topology-rag-injector.ts:1)에서 기존 단일 imported architecture 문서를 `현재 인프라 역할/트래픽 토폴로지 스냅샷` + `현재 인프라 배치/운영 검증 스냅샷` 2문서로 분리하고 legacy 단일 문서는 재사용/정리 가능하도록 sync 로직 보강.
- [x] 회귀 테스트 추가 — [topology-rag-injector.test.ts](/mnt/d/dev/openmanager-ai/cloud-run/ai-engine/src/lib/topology-rag-injector.test.ts:1)로 split 문서 수, 제목, target 길이, 역할/배치 정보 분리 규칙 고정.
- [x] Phase 3 신규 corpus 후보 `8`개 초안 준비 — [knowledge-base-corpus-candidate-drafts.md](/mnt/d/dev/openmanager-ai/reports/planning/knowledge-base-corpus-candidate-drafts.md:1)에 `manual 5 / imported 3` 구성으로 incident·troubleshooting·best_practice 후보를 정리.
- [x] 다음 배치 추천안 고정 — 우선 반영 후보는 `AI 사이드바 응답 지연 점검 순서`, `Supabase migration 작업 규칙`.

### Completed (2026-04-12 #58)
- [x] P1: local bootstrap blocker 해소 완료 — `supabase db reset` 전체 migration chain 성공. `type "vector" does not exist` 에러 소거. conversation_history · hourly_server_states · sync_servers 등 hosted schema 비존재 객체 stub화 완료.
- [x] P1: database.md bootstrap 이력 갱신 — 수정 4건 테이블화, `2026-04-12` 실검증 완료 명시.

### Completed (2026-04-12 #57)
- [x] `knowledge_base` split-first 시나리오 고정 — over-limit architecture 문서 `현재 인프라 구성 토폴로지 스냅샷`을 2개 문서로 분할하는 방향으로 Phase 2를 확정.
- [x] 분할 구조 정의 — `현재 인프라 역할/트래픽 토폴로지 스냅샷`(역할 분포/트래픽 경로) + `현재 인프라 배치/운영 검증 스냅샷`(리전/AZ/환경/운영 규칙)으로 분리.
- [x] 예산 재계산 — split 적용 시 live count `49→50`, 권장 한도 `52` 기준 후속 신규 추가 예산은 `+2`.
- [x] 실행 원칙 고정 — split 문서는 모두 `280~520자` 타깃으로 맞추고, 전체 서버 ID 나열 대신 역할/배치 해석 중심으로 요약.

### Completed (2026-04-12 #56)
- [x] `knowledge_base` 실측 분포 재측정 완료 — live count `49`, target 길이 `48`, below target `0`, over limit `1`, placeholder title `0`, auto_generated `0`.
- [x] category 분포 확인 — `command 18`, `troubleshooting 10`, `incident 9`, `best_practice 8`, `architecture 3`, `security 1`로 모두 target range 안에 있음을 확인.
- [x] source 편향 확인 — `seed_script 30 (61.22%)`, `command_vectors_migration 18 (36.73%)`, `imported 1 (2.04%)`, `manual 0`.
- [x] 핵심 debt 식별 — `architecture/imported` 문서 `현재 인프라 구성 토폴로지 스냅샷` 1건이 `1020자`로 hard limit 초과.
- [x] slot budget 고정 — 권장 `52` 기준 순증 가능 slot은 `+3`, 다만 over-limit architecture split을 먼저 하면 실사용 예산은 `+2`.

### Completed (2026-04-12 #55)
- [x] QA evidence 자동 정리 경계선 고정 — [README.md](/mnt/d/dev/openmanager-ai/reports/qa/README.md:195)에 orphan/missing/archive candidate가 모두 `0`인 상태에서 남는 top evidence는 policy-protected로 취급한다고 명시.
- [x] 보호 범주 정의 — single-artifact first-paint proof, counted/release-facing 대표 proof, modal/detail/history 유일 스크린샷, local-vs-prod 비교 증거를 routine prune 제외 대상으로 고정.
- [x] backlog 재분류 — `P2 QA evidence 저장소 용량 정리`를 active cleanup이 아니라 `tracking-only` on-hold 항목으로 이동.
- [x] 운영 결론 명시 — 추가 절감은 routine cleanup이 아니라 명시적 archival/retention override 결정이 필요하므로, 다음 실작업 우선순위는 `knowledge_base` corpus 트랙으로 이동 가능.

### Completed (2026-04-12 #54)
- [x] QA storage 7차 정리 완료 — `QA-20260330-0197` / `QA-20260330-0198`에서 공유하던 partial UX analysis screenshot `1`건 제거.
- [x] 보존 원칙 유지 — 같은 개선 묶음 안에서 `landing-ux-analysis-full`을 유지하고 partial variant만 정리해 landing/modal/console/local proof는 그대로 유지.
- [x] tracker/run 정합성 반영 — [qa-run-QA-20260330-0197.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260330-0197.json:1), [qa-run-QA-20260330-0198.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260330-0198.json:1), [qa-tracker.json](/mnt/d/dev/openmanager-ai/reports/qa/qa-tracker.json:1)에서 artifact 참조 제거.
- [x] 용량 절감 확인 — 전체 `reports/qa` `57.11MiB → 56.16MiB`, `reports/qa/evidence` `52.67MiB → 51.71MiB`, durable evidence file `195 → 194`.
- [x] 잔여 부채 고정 — evidence warning은 줄었지만 아직 `40MiB` 아래로 내려오지 않아 backlog P2는 유지.

### Completed (2026-04-12 #53)
- [x] QA storage 6차 정리 완료 — `reports/qa/runs/2026` 아래 무참조 stray PNG `23`건 제거.
- [x] 정책 보강 — [README.md](/mnt/d/dev/openmanager-ai/reports/qa/README.md:194)에 `reports/qa/runs/` 아래 무참조 binary screenshot은 canonical durable evidence가 아니므로 정리 가능하다고 명시.
- [x] 용량 절감 확인 — 전체 `reports/qa` `64.42MiB → 57.11MiB`, `reports/qa/runs` `10.41MiB → 3.11MiB`.
- [x] 무결성 재검증 — `npm run qa:evidence:audit` 기준 orphan `0`, missing durable artifact `0`, recent counted runs without artifacts `0`, archive candidates `0`.
- [x] 잔여 부채 고정 — 이번 배치는 `qa/evidence`를 직접 줄인 것이 아니므로 evidence warning(`52.67MiB > 40MiB`)은 계속 backlog P2로 유지.

### Completed (2026-04-12 #52)
- [x] `knowledge_base` corpus 확충 계획서 작성 — [knowledge-base-corpus-expansion-plan](./knowledge-base-corpus-expansion-plan.md) 추가.
- [x] 핵심 방침 고정 — 현재 `49`행 규모에서는 "많이 추가"가 아니라 권장 한도 `<=52` 안에서 `incident / best_practice / troubleshooting` 중심으로 교체형 확충을 우선.
- [x] 실행 단계 정의 — 분포 재측정 → slot 예산 확정 → 신규 문서 후보 초안 → 품질 게이트 → 반영 배치 설계 순으로 진행.
- [x] 리스크 명시 — command 비중 과다와 count drift(`48` vs `49`)를 먼저 정리하지 않으면 corpus 확충이 오히려 retrieval 품질을 악화시킬 수 있음.

### Completed (2026-04-12 #51)
- [x] QA evidence 저장소 5차 정리 완료 — non-release targeted 런에서 redundant landing screenshot 2건 추가 제거.
- [x] 대상 런 — [qa-run-QA-20260327-0193.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260327-0193.json:1), [qa-run-QA-20260330-0197.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260330-0197.json:1), [qa-run-QA-20260330-0198.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260330-0198.json:1).
- [x] 정책 보강 — [README.md](/mnt/d/dev/openmanager-ai/reports/qa/README.md:194)에 non-release targeted run의 secondary landing prune 조건을 명시.
- [x] 용량 절감 확인 — 전체 `reports/qa` `66.27MiB → 64.42MiB`, `reports/qa/evidence` `54.52MiB → 52.67MiB`, durable evidence file `197 → 195`.
- [x] 무결성 재검증 — `npm run qa:evidence:audit` 기준 orphan `0`, missing durable artifact `0`, recent counted runs without artifacts `0`, archive candidates `0`.

### Completed (2026-04-12 #50)
- [x] QA evidence 저장소 4차 정리 완료 — `countsTowardSummary=true` 또는 `releaseFacing=true`인 오래된 런 6건에서 중복 landing screenshot만 제거.
- [x] 대상 런 — [qa-run-QA-20260326-0187.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260326-0187.json:1), [qa-run-QA-20260326-0188.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260326-0188.json:1), [qa-run-QA-20260326-0189.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260326-0189.json:1), [qa-run-QA-20260326-0191.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260326-0191.json:1), [qa-run-QA-20260404-0225.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260404-0225.json:1), [qa-run-QA-20260404-0229.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260404-0229.json:1).
- [x] 보관 정책 고정 — [README.md](/mnt/d/dev/openmanager-ai/reports/qa/README.md:188)에 counted/release-facing run의 중복 landing screenshot prune 조건을 명시.
- [x] 용량 절감 확인 — 전체 `reports/qa` `72.37MiB → 66.27MiB`, `reports/qa/evidence` `60.62MiB → 54.52MiB`, durable evidence file `203 → 197`.
- [x] 무결성 재검증 — `npm run qa:evidence:audit` 기준 orphan `0`, missing durable artifact `0`, recent counted runs without artifacts `0`, archive candidates `0`.

---

### Completed (2026-04-12 #49)
- [x] Storybook stable 승격 여부 재확인 완료 — npm registry 기준 `storybook latest=10.2.10`, `@storybook/nextjs-vite latest=10.2.10` 확인.
- [x] `10.3.x` 상태 확인 — stable이 아니라 `next=10.3.0-alpha.6` 단계라 production config 변경 시점이 아님.
- [x] 결론 고정 — [.storybook/main.ts](/mnt/d/dev/openmanager-ai/.storybook/main.ts:18)의 `experimentalComponentsManifest: true`는 계속 유지.
- [x] 코드 변경 없음 — 현재 설정이 최신 stable 기준과 정합하므로 docs/backlog 상태만 갱신.

---

### Completed (2026-04-12 #48)
- [x] QA evidence 저장소 3차 정리 완료 — `countsTowardSummary=false` verification 런 2개에서 대형 landing/validation screenshot 2건 제거.
- [x] 대상 런 — [qa-run-QA-20260405-0237.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260405-0237.json:1), [qa-run-QA-20260409-0260.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260409-0260.json:1). 다른 report/log/dashboard evidence와 notes는 유지.
- [x] 용량 절감 확인 — 전체 `reports/qa` `74.52MiB → 72.37MiB`, `reports/qa/evidence` `62.77MiB → 60.62MiB`, durable evidence file `205 → 203`.
- [x] 무결성 재검증 — `npm run qa:evidence:audit` 기준 orphan `0`, missing durable artifact `0`, recent counted runs without artifacts `0`, archive candidates `0`.
- [x] 잔여 부채 고정 — evidence 경고는 여전히 남아 있으므로 backlog P2는 유지.

---

### Completed (2026-04-12 #47)
- [x] QA run scratch / unreferenced asset 2차 정리 완료 — `reports/qa/runs/2026/root-cleanup-2026-04-05/` 아래 참조 없는 보조 산출물 제거.
- [x] 용량 절감 확인 — 전체 `reports/qa` `96.70MiB → 74.52MiB`, `reports/qa/runs` `32.60MiB → 10.41MiB`.
- [x] audit 결과 개선 — `archive candidates (unreferenced run assets, 21d+)` `31건 / 7.76MiB → 0건 / 0B`.
- [x] 무결성 유지 — `npm run qa:evidence:audit` 기준 orphan `0`, missing durable artifact `0`, recent counted runs without artifacts `0`.
- [x] 잔여 부채 고정 — evidence 디렉터리 자체는 여전히 `62.77MiB`라 P2 backlog는 유지.

---

### Completed (2026-04-12 #46)
- [x] QA evidence 저장소 1차 정리 완료 — 가장 큰 Playwright trace zip 2건(`~18.1MiB` x 2) 제거.
- [x] historical run 참조 정합성 유지 — [qa-run-QA-20260324-0181.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260324-0181.json:1), [qa-run-QA-20260409-0266.json](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260409-0266.json:1) 에서 trace artifact만 제거하고 screenshot/console/network evidence는 유지.
- [x] 용량 절감 확인 — `reports/qa` `132.92MiB → 96.70MiB`, `reports/qa/evidence` `98.99MiB → 62.77MiB`, `files >= 8MiB` `2 → 0`.
- [x] 무결성 재검증 — `npm run qa:evidence:audit` 기준 orphan `0`, missing durable artifact `0`, recent counted runs without artifacts `0`.
- [x] 잔여 부채 명확화 — 전체 저장소 경고는 해소됐지만 evidence 경고(`62.77MiB > 40MiB`)는 남아 있어 backlog P2는 유지.

---

### Completed (2026-04-12 #45)
- [x] QA-20260412-0272 Vercel Production targeted run — 10/10 pass, **GO** 판정.
- [x] Supabase 변경 영향 없음 확인 — schema cleanup(orphan 함수/뷰 정리, server_logs 제거 등) 이후 dashboard·auth·AI sidebar 경로 회귀 없음.
- [x] `security_audit_logs` live path 증거 확보 — production guest login 후 `guest_login_success` row 1건 생성 확인.
- [x] 커버리지 — `/` · `/login` · guest PIN · `/system-boot→/dashboard` · dashboard render · AI sidebar ready · `/api/health` · `/api/version` · audit log insert.
- [x] 스킵 항목 — OAuth callback, approval_history path(QA-20260411-0270으로 이미 커버), feedback submit, 실제 LLM 호출.
- [x] 비용/사이드이펙트 — Vercel effective `$6.55` / billed `$0.00`, LLM 호출 없음, audit row 1건(기대 동작).
- [x] 비차단 운영 메모 — `reports/qa/evidence/` 100MB / 69파일 용량 경고 → Backlog P2로 등록.

---

### Completed (2026-04-12 #44)
- [x] `create_vector_table(text)` 제거 완료 — remote에 남아 있던 구형 pgvector helper(`vector(1536)` + `ivfflat`)를 drop migration으로 정리.
- [x] 근거 확인 — 코드 참조 `0`, DB 의존 프로시저 `0`, view 참조 `0` 상태에서 제거.
- [x] 비용/사이드 이펙트 점검 — 새 비용 발생 없음. 미사용 함수 제거라 runtime query path 변화 없음, 오히려 dead surface와 schema 혼선만 감소.
- [x] parity 재검증 — `supabase db push --dry-run --linked` clean 유지 확인 후 canonical 반영.

---

### Completed (2026-04-12 #43)
- [x] `security_audit_logs` 운영 정책 결정 완료 — DB trigger는 추가하지 않고 현재 app-level explicit audit write를 유지.
- [x] 근거 확인 — [guest-login route](/mnt/d/dev/openmanager-ai/src/app/api/auth/guest-login/route.ts:286)와 [auth callback](/mnt/d/dev/openmanager-ai/src/app/auth/callback/route.ts:48)가 모두 [recordLoginEvent](/mnt/d/dev/openmanager-ai/src/lib/auth/login-audit.ts:79)를 직접 호출.
- [x] remote 상태 확인 — `public.security_audit_logs` row count `0`, table-level trigger `0`, RLS policy는 `System can insert audit logs` / `Users can view own audit logs` 유지.
- [x] 결론 고정 — 현재 0행은 비활성의 증거가 아니라 low-traffic + smoke cleanup 결과다. DB trigger를 추가하면 auth callback / guest login의 명시적 감사 경로와 책임이 중복된다.

---

### Completed (2026-04-11 #40)

#### P1: Supabase DB 잔여 orphan 함수 2차 정리 + 보안 함수 제거

**배경**: `drop_legacy_server_logs` (20260411070843) 반영으로 `server_logs` 테이블이 삭제됐으나,
해당 테이블을 참조하는 함수 `add_server_log` / `cleanup_old_logs` 가 schema에 남아 있음.
아울러 같은 시점에 확인된 추가 orphan 9개 + SECURITY DEFINER 보안 위험 함수 `exec_sql` 존재.

**대상 함수 (총 10개)**:
```
add_server_log             → server_logs (삭제됨) 참조
cleanup_old_logs           → server_logs (삭제됨) 참조
cleanup_old_metrics        → server_metrics_history (존재 안 함) 참조
update_compression_metadata     → conversation_history (삭제됨) 참조
update_conversation_updated_at  → conversation_history trigger fn (삭제됨)
update_server_metrics_updated_at → server_metrics_history trigger fn (존재 안 함)
get_active_patterns        → learned_patterns (존재 안 함) 참조
get_latest_bottlenecks     → performance_bottlenecks (존재 안 함) 참조
calculate_system_health_score → code_quality_analysis (존재 안 함) 참조
exec_sql                   → SECURITY DEFINER arbitrary SQL 실행, 앱 미사용 → 보안 위험
```

**대상 뷰 (1개)**:
```
query_statistics  → 하드코딩 stub (모두 0 반환), 실 데이터 없음, 앱 미사용
```

- [x] `20260411133303_drop_orphan_functions_batch2.sql` 추가 — `DROP FUNCTION` 10개 + `DROP VIEW public.query_statistics` 반영.
- [x] remote Supabase에 batch2 migration 적용 완료 — `server_logs` 잔재 2개 + 추가 orphan 7개 + `exec_sql(text)` 제거.
- [x] clean 재검증 완료 — `supabase migration list` local=remote 정렬, `supabase db push --dry-run --linked` `Remote database is up to date.` 확인.
- [x] 보안 게이트 확인 — `exec_sql(text)` remote schema에서 실제 제거 확인.

---

### Completed (2026-04-12 #41)
- [x] `command_vectors` retrieval 경로 점검 완료 — remote에 `idx_command_vectors_embedding_hnsw` 존재, row 수는 `26`건으로 확인.
- [x] query plan 확인 — `ORDER BY embedding <=> ... LIMIT` 쿼리는 현재 planner가 `Seq Scan + Sort`를 선택하지만 실행시간은 warm 기준 `~0.5ms`, cold 기준 `~17ms`로 관측.
- [x] live codepath 분리 확인 — 현재 AI Engine의 주 hybrid retrieval은 [graphrag-service.ts](../../cloud-run/ai-engine/src/lib/graphrag-service.ts) → [hybrid-text-search.ts](../../cloud-run/ai-engine/src/lib/hybrid-text-search.ts) → `hybrid_search_with_text` 이며, 이는 `knowledge_base`를 주로 사용.
- [x] 결론 고정 — `command_vectors` HNSW 추가는 방어적 개선으로 유효하지만, 현재 데이터량/코드 경로 기준 즉시 추가 튜닝 과제는 아님. row 수가 충분히 커지거나 command retrieval path가 주 경로가 될 때 재평가.

---

### Completed (2026-04-12 #42)
- [x] `knowledge_base` hybrid retrieval 경로 점검 완료 — remote에 `idx_knowledge_base_embedding_hnsw`, `idx_knowledge_base_search_vector`, trigram/category/severity 인덱스가 모두 존재하고 row 수는 `49`건으로 확인.
- [x] vector subquery plan 확인 — `knowledge_base`의 `ORDER BY embedding <=> ... LIMIT` 경로는 현재 planner가 `Seq Scan + Sort`를 선택하며, sample 쿼리 실행시간은 `~29.5ms`.
- [x] BM25 text plan 확인 — `search_vector @@ plainto_tsquery(...)` 경로는 `Bitmap Index Scan on idx_knowledge_base_search_vector`를 정상 사용하며 sample 실행시간은 `~10ms`.
- [x] actual RPC wall time 확인 — `hybrid_search_with_text(...)` sample 호출은 `Function Scan` 기준 `~73.8ms / 15 rows`로 관측.
- [x] 결론 고정 — 현재 hybrid retrieval은 인덱스 미구성 문제가 아니라 `49`건 규모의 소규모 corpus + 함수 내부 vector/text/graph 결합 비용이 지배적이다. 즉시 DDL 추가보다는 corpus 확충 또는 호출 빈도/품질 기준 재평가가 우선이다.

---

### Completed (2026-04-11 #39)
- [x] P1: 로그 테이블 정리 완료 — `security_audit_logs`는 auth audit live 경로라 유지, `server_logs`는 runtime 미사용/0행/seed-only 상태라 `get_server_logs`와 함께 제거.
- [x] P1: Supabase parity 재검증 — `20260411070843_drop_legacy_server_logs` 반영 후 `supabase migration list` 정렬 및 `supabase db push --dry-run --linked` clean 유지 확인.
- [x] P1: orphan 함수 정리 완료 — remote schema에서 backing object가 없는 legacy 함수 `19`개 제거, `get_approval_history` / `get_approval_stats`만 유지.
- [x] P1: Supabase parity 재검증 — `20260411063810_drop_orphan_legacy_functions` 반영 후 `supabase migration list` 정렬 및 `supabase db push --dry-run --linked` clean 유지 확인.
- [x] P1: Supabase migration ledger parity repair 완료 — main repo `supabase/migrations/`를 remote timestamp ledger 기준으로 재구성하고 compressed/date-only legacy 세트를 `supabase/archive/`로 분리.
- [x] P1: CLI parity 검증 완료 — `supabase migration list` local=remote 일치, `supabase db pull` shadow DB 생성 단계 진입, `supabase db push --dry-run --linked` `Remote database is up to date.` 확인.
- [x] P2: 운영 문서 정리 — [supabase-migration-ledger-repair-plan](./supabase-migration-ledger-repair-plan.md) 완료 상태 전환, [README.legacy-ledger-hold](../../supabase/README.legacy-ledger-hold.md) 추가, archive 경로 git 추적 예외 처리.

### Completed (2026-04-07 #38)
- [x] P3: `src/types/common.ts` 잔여 unused type 정리 — 실참조가 없는 `Environment`, `ServerType`, `PaginationInfo`, `LogLevel`와 미사용 `ServerMetrics` 경유 re-export 제거.
- [x] P3: 안전성 재검증 — 실제 참조(`ServiceStatus`, `ServerStatus`, `AlertSeverity`) 유지 상태에서 `npm run type-check`, `npm run lint` 통과.

### Completed (2026-04-07 #37)
- [x] P3: Storybook large chunk warning 정리 — `.storybook/main.ts`의 `chunkSizeWarningLimit`를 Storybook-generated `vite-inject-mocker-entry.js` 실제 산출 크기(약 `1.52 MB`) 기준으로 `1600`으로 상향해 build 로그의 false-positive large chunk warning 제거.
- [x] P3: Storybook build 재검증 — `npm run storybook:build:ci` 재실행으로 large chunk warning 없이 static build 성공 확인.

### Completed (2026-04-07 #36)
- [x] P2: `pre-push` shared node infra smoke 최적화 — `src/test/setup.node.ts`, `vitest.config.node.ts`, `vitest.config.dev.ts`, `vitest-node-wrapper.js`, shared `msw/shared-aliases/main config` 변경을 일반 `src/**` related suite에서 분리하고 `test:node:infra:smoke` 경로로 라우팅.
- [x] P2: 분류기 회귀 보강 — `pre-push-file-classifier`/`pre-push-test-classifier` 테스트에 node infra exact/shared infra/mixed source+infra 케이스 추가.
- [x] P2: smoke 경로 검증 완료 — `npm run test:node -- tests/unit/dev/pre-push-*.test.ts tests/unit/dev/vitest-node-wrapper.test.ts`, `npm run test:node:infra:smoke` 통과.

### Completed (2026-04-07 #34)
- [x] P1: `v8.11.0` 릴리스 완료 — `chore(release): 8.11.0` 커밋/태그(`v8.11.0`) 생성, release consistency check PASS, `git push --follow-tags gitlab main` 완료.
- [x] P1: GitHub 공개 스냅샷 동기화 완료 — `npm run sync:github` 실행, `cc1c579f5` 기준 공개 레포 반영.
- [x] P2: node full-suite 회귀 수정 — `vercel-post-deploy-smoke` probe 경로의 `Server is not running` 오류 수정 후 `npm run test:node` 전체 통과 (`184 files: 181 passed, 3 skipped`).

### Completed (2026-04-07 #35)
- [x] P2: `test:node` runtime 최적화 — `config/testing/vitest.config.node.ts`에 node 전용 `setup.node.ts`를 분리해 DOM 전용 셋업 비용을 제거.
- [x] P2: lightweight node routing 확장 — `tests/unit/playwright/**`를 lightweight config(`vitest.config.dev.ts`)로 라우팅해 pre-push targeted node 실행 비용 축소.
- [x] P2: 회귀 검증 완료 — `tests/unit/dev/vitest-node-wrapper.test.ts`, `tests/api/ai-supervisor-stream.contract.test.ts`, `tests/unit/playwright/playwright-config.test.ts`, `npm run test:node`, `npm run type-check`, `npm run lint` 통과. Full node suite wall time `809.63s → 536.87s`로 약 34% 단축.

### Completed (2026-04-07 #33)
- [x] P2: node smoke 테스트 안정화 — `tests/unit/dev/filter-public-scripts.test.ts`, `tests/unit/qa/check-vercel-usage.test.ts`에서 output assertion을 상태/부수효과 중심으로 보강해 무출력 환경 false negative 완화.
- [x] P2: loopback 제한 환경 대응 — `tests/unit/qa/vercel-post-deploy-smoke.test.ts`에 bind probe/listen error 처리 추가, `EPERM` 환경에서 deterministic skip 처리.
- [x] P2: 게이트 재검증 — `npm run type-check`(136.8s), `npm run test:quick`(160 tests), targeted node tests(12 tests) PASS 확인.

### Completed (2026-04-07 #32)
- [x] P2: ai-engine `ai` SDK 버전 정렬 — `cloud-run/ai-engine`의 `ai`를 `6.0.86→6.0.145`로 상향해 root app과 동일 버전으로 정렬. `npm run verify:rag`, `npm run type-check`, `npm run test`(69 files / 726 tests) 통과. 기존 Vitest resolver 가설은 현재 재현되지 않아 별도 alias 수정 없이 유지.

### Completed (2026-04-07 #31)
- [x] P3: Storybook circular chunk warning 제거 — `.storybook/main.ts`에서 `vendor-react` manual chunk를 제거해 `vendor-react -> vendor-storybook`, `vendor-react -> vendor-charts` 순환 경고 해소. `npm run storybook:build` 통과, large chunk warning만 잔존.

### Completed (2026-04-07 #30)
- [x] P2: AI 응답 `분석 근거` 접힘 상태 요약 추가 — 기본 collapsed 상태에서도 `데이터 · 도구 · 기간` 1줄 요약이 보이도록 개선. `AnalysisBasisBadge` 타입 보정 포함, `npx vitest run src/components/ai/AnalysisBasisBadge.test.tsx`, `npm run lint`, `npm run test:quick`, `npm run type-check` 통과.

### Completed (2026-04-07 #27)
- [x] P2: TypeScript 6 root 업그레이드 — `typescript 5.9.3→6.0.2` 반영. `downlevelIteration` 제거와 `src/types/css.d.ts` 추가로 TS6의 side-effect CSS import stricter check 대응. `npm run type-check`, `npm run lint`, `npm run test:quick` 통과.

### Completed (2026-04-07 #28)
- [x] P2: Storybook hygiene 정리 — 71개 story type import를 `@storybook/nextjs-vite`로 통일, `AIWorkspace`/`AIDebugPanel` autodocs 적용, `AIDebugPanel` 비표준 `mockData`를 deterministic fetch mocking으로 교체, named export mismatch(`AnalysisBasisBadge`, `WelcomePromptCards`) 수정 후 `npm run storybook:build` 통과.

### Completed (2026-04-07 #29)
- [x] P2: ai-engine 패키지 분리 트랙 1차 적용 — `typescript 6.0.2`, `@types/node 25.5.2`, `@supabase/supabase-js 2.101.1` 반영. `ai@latest`는 Vitest resolver 충돌로 실패해 `6.0.86` 유지. `cloud-run/ai-engine`의 `npm run type-check`, `npm run test` 통과.

### Completed (2026-04-07 #25)
- [x] P2: Knip v6 전환 — `knip` `5.88.1→6.0.5`, `knip.json` schema `@5→@6` 정렬. 새 parser 기준 unused 4건(`src/types/server/guards.ts`, `api-config` default export, server enum alias re-export)도 함께 정리해 `npm run knip:ci` clean 유지.

### Completed (2026-04-07 #23)
- [x] P2: 루트 앱 안전한 patch 업그레이드 적용 — `@supabase/supabase-js` `2.97.0→2.101.1`, `@supabase/ssr` `0.8.0→0.9.0`, `@opentelemetry/sdk-node` `0.212.0→0.214.0`, `@types/node` `25.5.0→25.5.2`, `rollup` `4.53.5→4.59.0` 반영. `ai`는 npm registry 기준 `6.0.145`가 latest라 유지.

### Completed (2026-04-07 #24)
- [x] P2: TypeScript 6 사전 준비 — root `tsconfig.json`에 `types: ["node"]`를 선행 반영해 TS6 기본 `@types/*` 포함 정책 변경에 대비. TS 자체 업그레이드는 Step 4에서 별도 수행.

### Completed (2026-04-07 #22)
- [x] P2: `server-enums` SSOT 정렬 — `src/types/server/types.ts`를 canonical enum passthrough로 단순화하고, `src/types/server/entities.ts`의 환경/역할 필드를 공통 scope로 정렬. `src/types/server/index.ts`도 base/core export 경계를 정리해 Step 2 서버 타입 SSOT 항목 마감.

### Completed (2026-04-07 #21)
- [x] P2: `ServerHealthSummary`/`ServerSpecs` SSOT 정렬 — `src/types/server/base.ts`에 health summary alias 추가, `src/types/server/core.ts`와 `EnhancedServerModal.types.ts`가 동일 summary/specs 타입을 재사용하도록 통합. `src/types/server/index.ts` re-export도 함께 정렬.

### Completed (2026-04-07 #20)
- [x] P2: `EnhancedServerModal.types.ts` 서버 타입 정렬 — 중복 `ServerSpecs` 제거, `ServerHealth`를 `src/types/server/base.ts` 기반 요약 타입으로 파생. `normalizeServerData()` fallback health에도 `status`를 채워 모달 데이터와 서버 타입 SSOT를 정렬.

### Completed (2026-04-07 #19)
- [x] P2: `type-check:changed` correctness 정리 — `files: [...]` scoped mode 제거, changed-file filtering은 전체 project type-check 시작 여부만 판단하도록 환원. `src/types/**` 위임 / tooling-only skip fast path 유지, standalone regression test에서 `tsconfig.check.json` full-project fallback 고정.

### Completed (2026-04-07 #18)
- [x] P2: `type-check:changed` 인프라 최적화 — `files: [...]` 스코프형 증분 체크 도입 (100s+ → 12s 단축), `PRESET_FILES` 공백 처리 버그 수정 (`709d88954`)
- [x] P2: 서버 타입 통합 — `server-common.ts` 제거 후 `server/base.ts` 통합, 의존성 인디렉션 제거

### Completed (2026-04-07 #17)
- [x] P3: `src/types/common.ts` 미사용 export 1차 정리 — 전역 참조 0회인 `CloudProvider`, `BaseService`, `BaseAlert`, `MetadataValue`, `ServerMetadata`, `ExtensibleMetadata`, `BaseServer`, `ApiErrorDetails`, `BaseApiResponse`, `TimeRange`, `FilterOptions`, `SortOptions`, `LogDataValue`, `LogData`, `ErrorContextValue`, `ErrorContext`, `DeepPartial`, `AnalysisDetail` 제거. 내부 전용 `isMetadataValue`/`_isLogData`/`_isErrorContext` 헬퍼도 함께 삭제.

### Completed (2026-04-07 #16)
- [x] P3: Knip unused export 정리 — `src/types/ai-sidebar/`: AIEngineInfo/AISidebarHandlers/AISidebarProps/AutoReportTrigger/SessionInfo/UseAISidebarReturn 6개 제거. `src/types/intelligent-monitoring.types.ts`: 구형 IntelligentAnalysis* 타입 블록 전체 + SimpleAnalysisRequest 9개 제거. TypeScript 에러 0.

### Completed (2026-03-31 #15)
- [x] P3: 백로그 재정비 — `대형 파일(500+줄) 분리 계획` 항목 폐기 확정. 대상 파일(system/route.ts 476줄, jobs stream 464줄)이 이미 기준 미만으로 실효 상실. schemas/api.*.schema.ts 미사용 type alias + src/types/ 미사용 exports 일괄 정리 진행.

### Completed (2026-03-29 #14)
- [x] P3: `supervisor/stream/v2/route.ts` timeout helper 분리 — warmup/abort/retry timeout 계산과 헤더 파서를 `stream-timeouts.ts`로 추출해 `route.ts` 634→561줄 축소, `stream-timeouts.test.ts` 추가 후 route/helper 28 tests 및 `npm run check` 통과

### Completed (2026-03-29 #13)
- [x] P3: `auth/guest-login/route.ts` 대형 파일 분리 — 응답/쿠키 조립을 `response-utils.ts`로 추출해 `route.ts` 521→435줄 축소, `response-utils.test.ts` 추가 후 route/utility 11 tests 및 `npm run check` 통과

### Completed (2026-03-29 #12)
- [x] P3: auto-report formatter 대형 파일 분리 — `formatters.ts` 661→304줄 축소, section builder를 `formatters-sections.ts`로 추출, `formatters-sections.test.ts` 추가 후 type-check/check/test 통과 (`4c2e4fb29`)

### Completed (2026-03-29 #11)
- [x] P3: VibeHistorySection stage4 추가 — GitLab canonical/Multi-AI CLI/로컬 Docker CI/Cloud Run AI Engine 4단계 cyan 섹션. types/data/component/test 4파일 수정, 6 tests pass. v8.10.8 릴리즈

### Completed (2026-03-29 #10)
- [x] P3: Knip unused export types 19개 제거 — FeatureCardProps, LokiPushPayload, ServerMetrics alias, HourlyJsonData, JobProgressUpdate, JobCompletionUpdate, AnalyzeComplexityFn, EstimateTimeFn, ISystemEventSubscriber, ErrorContext, ServerMetricsHistory, EnhancedServerMetrics (core), ServerGroup, CloudRunResponse, FilePartSchema, MessageSchema, RequestSchema, RequestSchemaLoose, UpstashResumableContext. 160/160 tests pass 유지

### Completed (2026-03-29 #9)
- [x] P2: v8.10.6 Production QA 완료 — Playwright MCP, 11/11 pass, 콘솔 에러 0, QA-20260329-0194 기록. Vercel 사용량 $21.09/월 정상
- [x] P2: Production 보안 헤더 배포 확인 — COOP(`same-origin-allow-popups`), CSP, HSTS(`preload`), X-Frame-Options(`DENY`), Permissions-Policy 모두 production 응답에서 확인
- [x] P1: brace-expansion CVE GHSA-f886-m6hf-6m8v 패치 — `npm audit fix`로 process hang/memory exhaustion 취약점 제거

### Completed (2026-03-28 #8)
- [x] P2: `global-error.tsx` Sentry.captureException 추가 — 다른 에러 경계와 일관성 확보 (`boundary: 'global-error'`)
- [x] P3: `error.tsx` boundary 태그 수정 — `'global-error'` → `'root'` (Sentry 에러 분류 정확도 개선)
- [x] P2: 보안 헤더 3종 개선 — `Cross-Origin-Opener-Policy: same-origin-allow-popups` 추가, `Permissions-Policy` 구식 `interest-cohort=()` 제거, 잘못된 `X-Vercel-Cache`/`X-Edge-Runtime` 수동 설정 제거
- [x] P2: `vitest.config.simple.ts` coverage suite 안정화 — playwright/dev/qa 테스트 exclude, ai-warmup jsdom 격리, esbuild target node14→node18. 12/12 pass (이전 6 failed)
- [x] P2: Biome `useOptionalChain` 4건 수정 — `AgentHandoffBadge`, `useClarificationHandlers`, `useQueryExecution`, `promql-engine-core` (커밋 `64bb17940`)

### Completed (2026-03-28 #7)
- [x] P1: `unified-cache.ts` + `redis/index.ts` 배럴 export 오류 수정 — 삭제된 7개 함수 re-export 정리 (TypeScript 빌드 회귀 해소)
- [x] P1: npm audit fix — rollup CVE-2025 high severity 해소 (path traversal, GHSA-mw96-cpmx-2vgc)
- [x] P2: `ai-assistant/error.tsx` + `login/error.tsx` 에러 경계 추가 — 전용 Sentry 태깅 + 컨텍스트별 복구 UX
- [x] P2: SEO robots noindex — auth/* 레이아웃, system-boot/page.tsx, main/page.tsx (유틸리티 페이지 색인 차단)
- [x] P2: title template 이중 접미사 버그 수정 — `validation/page.tsx`, `privacy/page.tsx`
- [x] P1: v8.10.5 릴리즈 — GitLab push + GitHub sync 완료

### Completed (2026-03-28 #6)
- [x] P2: `auth/error.tsx` 에러 경계 추가 — auth 세그먼트 전용 에러 UI (Sentry `boundary: 'auth'` 태깅 + "로그인으로" 복구 액션)
- [x] P1: v8.10.4 릴리즈 — 19커밋 누적 후 릴리즈. GitLab push + GitHub sync 완료

### Completed (2026-03-28 #5)
- [x] P1: `pre-push-changed-files.js` 단위 테스트 20개 추가 — 6-branch 로직(`override`/`prePushUpdates`/`upstream`/`merge-base`/`baseDiff`/`HEAD~1`) + skip 조건 + 중복 제거 커버
- [x] P2: `checkNodeModules` → `createGuardResult` 패턴 전환 — guards 모듈 내 반환 타입 일관성 확보 (boolean→`{ ok, reason }`)
- [x] P2: `runDocsArtifactValidation` process.exit 제거 — return-value 패턴 + `exitIfGuardFailed()` 위임. orchestrator 외부 모듈에서 process.exit 완전 제거
- [x] P3: `dashboard.types.ts` unused types 8개 제거 — `ServerFilters`, `ServerCluster`, `ApplicationMetrics`, `ServerDashboardProps`, `ServerAction`, `RealtimeData` + 내부 전용 `ServerInstance`, `NetworkStatus` 삭제. `DashboardStats`/`DashboardTab`/`ViewMode` 유지

### Completed (2026-03-28 #4)
- [x] P3: Knip safe unused type cleanup — 내부 UI/constant 범위의 unused exported types 7개 제거 (`FilterOption`, `TimeRange`, `AlertHistoryFilterState`, `LogExplorerFilterState`, `ProfileSecurityState`, profile `SystemStatus`, `OTelMetricName`). 잔여 backlog는 schema/common/public contract 중심으로 축소

### Completed (2026-03-28 #2)
- [x] P3: Public GitHub snapshot sync 자동화 — `scripts/sync/github-sync.sh`, `.github-export-ignore`, `package.json`의 `sync:github` / `sync:github:dry-run` 추가. 코드 전용 스냅샷 기준으로 `origin/main` 동기화 완료
- [x] P1: GitLab canonical delivery 정렬 및 로컬 Docker CI 표준화 — `gitlab` canonical / `origin` public-only topology 확정, `remote.pushDefault=gitlab`, `main -> gitlab/main`, `scripts/ci/local-docker-ci.sh` + `CI_DOCKER_PULL_POLICY` 도입, 관련 규칙/문서 정렬, `git push gitlab main` 후 Vercel production deployment `dpl_HaXUuu6ewS38hYCVoFuwx5oKL6Ru` `READY` 확인

### Completed (2026-03-28 #3)
- [x] P2: Knip unused exports 정리 — `cache-helpers.ts` 미사용 7개 함수 + AI 쿼리 헬퍼 3개 삭제(-131줄), `rate-limiter.ts` `RATE_LIMIT_CONFIGS` 삭제(-57줄). Knip `exports: warn` 기준 clean pass. GitLab push + GitHub sync 완료
- [x] P2: `filter-public-scripts.js` 추출 + 단위 테스트 6개 — `github-sync.sh` 인라인 Node.js 스니펫을 독립 스크립트로 분리. dirty check 에러 메시지에 `git stash` 가이드 추가
- [x] P2: `knip.json` severity rules 추가 — `files`/`dependencies`/`unlisted` → error, `exports`/`types`/`devDependencies` → warn 세분화. `ignoreExportsUsedInFile: true` 유지
- [x] P2: `.versionrc.json` 개선 — URL GitLab으로 교체, CHANGELOG 타입 필터(chore/docs/style/ci hidden)

### Completed (2026-03-28 #2)
- [x] P1: pre-push.js 1137→595줄 모듈 분리 — `pre-push-file-classifier.js` (경로 분류), `pre-push-test-classifier.js` (테스트 라우팅), `pre-push-guards.js` (guard 체크) 추출. 단위 테스트 55개 추가. `v8.10.3` 릴리즈, GitLab push + GitHub sync 완료

### Completed (2026-03-28 #1)
- [x] P1: v8.10.2 릴리즈 — commit-and-tag-version으로 마이그레이션 (standard-version deprecated 해소), CHANGELOG 업데이트, `git push gitlab --follow-tags` 완료
- [x] P3: pre-push hook TypeScript fallback soft-timeout 적용 — 변경 감지 실패 시 full type-check 무제한 실행 경로를 `type-check:changed` + 60초 soft-timeout으로 통일 (`scripts/hooks/pre-push.js`, `754beff03`)
- [x] P3: 로컬 CI / GitLab 배포 베스트 프랙티스 분석 완료 — 웹 검색 기반: 현행 구조(직접 실행 + GitHub Actions gate) 업계 권장 일치 확인. commit-and-tag-version 교체 실행. GitLab Push Mirror는 코드 필터링 정책 유지 목적으로 현행 `sync:github` 스크립트 방식 유지 결정
- [x] P2: GitHub 저장소 정리 완료 — releases 9개·tags 67개 전부 삭제, orphan reset으로 히스토리 1커밋으로 교체 (`2f3815075`), issues/wiki/projects 비활성화, repo description 업데이트, `sync:github` 재실행으로 code-only snapshot 최신화 (`f546ea7b3`)
- [x] P1: Dependabot 대체 self-hosted Renovate 기준선 추가 — hosted GitLab app offline 상태를 반영해 `renovate.json`, `config/renovate/docker-compose.yml`, `scripts/renovate/run-self-hosted.sh` 도입. GitLab native status gate 부재로 automerge는 보류

### Completed (2026-03-17)
- [x] P2: WONT-FIX 실측 재평가 (`QA-20260317-0114`) — Playwright MCP로 38개 wont-fix 항목 중 30개 Production Vercel 동작 확인 → completed 전환. 잔여 wont-fix 8개(코드/인프라 레벨 6개 + AI 실응답 필요 2개)

### Completed (2026-03-16)
- [x] P1: 보안 회귀팩 자동화 (`QA-20260316-0108`) — `scripts/test/security-smoke.mjs` 구현. Playwright 없이 API 직접 POST로 5패턴 자동 검증. `npm run test:security:smoke`로 실행. `security-attack-regression-pack` deferred 종결
- [x] P2: AI Code Gate Prompt Injection 5패턴 검증 (`QA-20260316-0107`) — EN 지시 무시, DAN/bypass, KO 지시 무시, 역할 변경+노출, 정상 쿼리 통과 모두 PASS. 차단 메시지 일관 동작 확인. `ai-code-gate-input-policy` deferred 기준(5패턴) 충족
- [x] P1: v8.9.1 릴리즈 정렬 완료 — `v8.9.1` 태그/GitHub Release 생성, Cloud Run `ai-engine-00251-8qt` 배포, Vercel `/api/version` + Cloud Run `/health` 모두 `8.9.1` 확인, Production QA `QA-20260316-0106` 8/8 PASS
- [x] P3: Next.js dev 로컬 QA 혼선 조사 종결 — Turbopack: nested route non-404 확인, 96s 콜드스타트 정상. webpack: 120s first-request timeout은 "Compiling proxy + target" 패턴으로 Next.js 고유 동작임, 우리 코드 버그 아님. 미사용 dev-only rewrites(`/test-tools/*`, `/dev/*`) 제거로 proxy 컴파일 경로 단순화. 진단 스크립트(`dev:readiness`, `dev:probe:webpack`, `dev:trace:turbopack`, `local:smoke`) 도구화 완료.

### Completed (2026-03-15)
- [x] P3: Cloud Run 대형 파일 리팩토링 Phase 3 완료 — `incident-report` route + `ai-proxy.config.ts` 책임 분리 마감
- [x] P3: `ai-proxy.config.ts` 분리 — env 파싱/Zod 검증을 `config-loader.ts`로 이동, 퍼사드는 캐시 singleton + accessor만 유지(325→146)
- [x] P3: `incident-report` route 분리 시작 — `route.ts`를 thin handler로 축소(349→48), Cloud Run proxy/cache/retry/response 조합은 `post-handler.ts`로 분리
- [x] P2: Cloud Run 실배포 검증 — `bash deploy.sh` 기본 경로 성공, Cloud Build `9cdc5c74-97ae-4752-b532-365f8c69fd7f`, revision `ai-engine-00249-tg7`, `/health` 200, `/monitoring` 403
- [x] P2: Cloud Run 배포 기본값 복원 — `deploy.sh`가 build-only Docker preflight를 기본 수행하도록 복원, full local `/health` 검사는 opt-in으로 유지
- [x] P2: Cloud Run `docker:preflight` 복구 — `npm prune --production` 정체 제거, `prod-deps` stage 도입, local build-only/full preflight + `/health` 확인
- [x] P3: Semantic Caching — exact miss 시 token-hash embedding 기반 유사 쿼리 캐시 fallback 추가, 저장 메타데이터/유사도 계산/단위 테스트 반영

### Test Coverage Gap (Closed)

2026-03-05 코드리뷰에서 식별된 우선 테스트 대상 5건은 모두 완료되어 `Completed (2026-03-07)`에 이관됨.

우선 테스트 대상:
1. `/api/health/route.ts` — 프로덕션 모니터링 핵심
2. `/api/servers-unified/route.ts` — 메인 데이터 엔드포인트 (494줄)
3. `/api/servers/[id]/route.ts` — 서버 상세 (397줄)
4. `src/services/code-interpreter/pyodide-service.ts` — 미테스트
5. `src/services/notifications/BrowserNotificationService.ts` — 미테스트

### Completed (2026-03-07)
- [x] P0: v8.8.0 릴리스 (29커밋) — Reporter 품질 개선, CSRF 보안, 테스트 93개 추가
- [x] P2: Cloud Run 배포 — v8.8.0 (faad6169f), 빌드 7분 13초, health check HTTP 200 통과
- [x] P1: Reporter 파이프라인 품질 개선 — 임계값 SSOT 버그 수정(memory 85→80, disk 90→80), 근접 경고, 트렌드 예측, 서버 타입별 CLI 명령어
- [x] P2: `/api/servers/[id]` 테스트 추가 (31 tests) — enhanced/legacy 포맷, history, 서버 검색, 404, 환경 매핑, 에러 핸들링
- [x] P2: Services 테스트 추가 — BrowserNotificationService (13), PyodideService (7), SystemInactivityService (12)
- [x] P2: Hooks 테스트 추가 — useDashboardStats (12), useServerDataCache (7), useResizable (11)

### Completed (2026-03-06)
- [x] P0: Provider quota-tracker 수치 교정 — Cerebras 24M→1M TPD, Groq 100K→500K TPD, Groq TPM 12K→6K, Gemini RPM 15→10
- [x] P0: Cerebras 8K context 방어 — 세션 히스토리 4메시지 제한 (buildContext)
- [x] P1: Reranker Groq 전환 — Cerebras 1M TPD 보존을 위해 reranker를 Groq으로 분리
- [x] P0: v8.7.9 릴리스 (43커밋)
- [x] P1: 보안 수정 — API key timing attack 방어 (length leak 제거), error message 내부 정보 노출 차단
- [x] P2: SSE 스트림 에러 핸들링 — 연결 끊김 시 unhandled rejection 방지
- [x] P2: Redis CB 초기화 race condition 수정 — promise 캐싱으로 중복 초기화 방지
- [x] P2: 코드리뷰 4라운드 (AI Engine resilience, Vercel frontend AI, Data SSOT, Cloud Run pipeline) — 44건 발견, 7건 수정
- [x] P2: Production QA 7/7 통과 (Playwright MCP, v8.7.8 → v8.7.9)

### Completed (2026-03-05)
- [x] P1: CI/CD 파이프라인 분석 및 개선
  - CodeQL SAST 워크플로우 추가 (`codeql-analysis.yml`, v4)
  - Hardcoded secrets 검사 hard-fail 전환 (`exit 1`)
  - `npm audit --audit-level=high` CI code-quality job에 추가
  - E2E 타임아웃 15분→20분 (Cloud Run cold start 대응)
  - keep-alive 환경변수 `NEXT_PUBLIC_SUPABASE_URL`로 통일
- [x] P1: `/api/version` 라우트 복원 — 삭제되어 E2E 연속 실패 원인이었음
- [x] P1: CodeQL 설정 수정 — 존재하지 않는 `Security.ql` pack 참조 제거
- [x] P3: GitLab 이전 가능성 분석 문서 작성 (`docs/reference/architecture/infrastructure/gitlab-migration-feasibility.md`)

### Completed (2026-02-22)
- [x] P1: 이메일 Magic Link 로그인 추가 — Supabase OTP 기반, 소셜 로그인과 병행
- [x] P1: 런타임 로그 레벨 API + AIDebugPanel UI 토글 — TTL 자동 리셋, Vercel + Cloud Run 양쪽
- [x] P1: GPL v3 라이선스 적용 — LICENSE 파일 + README 배지
- [x] P1: 게스트 PIN 브루트포스 방어 — 5회 실패 → 1분 잠금 (Redis + 메모리 폴백)
- [x] P2: Dead code 20+ 파일 삭제 — 미사용 스토어, 서비스, 테스트, 유틸리티 정리
- [x] P2: 게스트 정책 단순화 — CIDR IP 범위 차단 제거, 국가코드 기반으로 통일
- [x] P2: 로그인 버튼 순서 변경 — 소셜 → 이메일 → 게스트
- [x] P2: Storybook 스토리 추가 — 이메일 로그인, AIDebugPanel, stale mock 수정
- [x] P2: 랜딩 히어로 텍스트 및 Feature Card 메시징 개선
- [x] P3: Playwright 스크린샷 정리 — 778개/356MB → 6개/1.7MB
- [x] P0: v8.2.0 릴리즈 — 89커밋 포함

### Completed (2026-02-19)
- [x] P2: Production QA 전체 통과 — 대시보드, AI 사이드바, 서버 카드, 페이지네이션, Cold Start 검증
- [x] P2: AI Rate Limit dailyLimit 50→100 — QA 테스트 중 소진 확인, Cloud Run 용량 대비 6.7% 안전 마진
- [x] P0: `/debug/*` timing-safe 인증 — string 비교→`timingSafeEqual` (타이밍 공격 방지)
- [x] P1: 429 응답 JSON 파싱 방어 — `response.json()` try-catch 래핑 (non-JSON proxy 방어)
- [x] P1: rate-limiter 주석 불일치 수정 — 실제 값(10회/분, 100회/일)과 일치
- [x] P1: wake-up 엔드포인트 rate limiter 추가 — 무인증 남용 방지
- [x] P2: ColdStartErrorBanner error prop 변경 시 retry 상태 리셋
- [x] P2: useHybridAIQuery retry 카운트 표시를 실제 maxRetries로 통일
- [x] P2: useAsyncAIQuery JSDoc timeout 기본값 수정 (120000→15000)
- [x] P2: wake-up/route HTTP 204 스펙 준수 (body 제거)
- [x] P2: rate-limiter `x-vercel-forwarded-for` 우선 사용
- [x] P2: supervisor-routing `console.log`→`logger` 마이그레이션
- [x] P3: server.ts `verifyApiKey()` 헬퍼 추출 (DRY, 3중 복사→1)
- [x] P3: rate-limiter 미사용 interface 필드 제거
- [x] P3: useAsyncAIQuery `||`→`??`, type assertion 제거
- [x] P3: wake-up/route Retry-After 헤더 추가
- [x] P3: useHybridAIQuery dead `resumeEnabled` useState→const
- [x] P3: supervisor-routing/single-agent stale `@version` JSDoc 제거
- [x] P3: Storybook play function + argTypes 추가 (11 stories)

### Completed (2026-02-18)
- [x] P2: Cloud Run E2E 파이프라인 완성 — contract test에 supervisor/stream/v2 입력검증+인증 계약 추가 (LLM 0회), 리팩토링 계획서 3개 archive 이동
- [x] P2: 기능 책임 기반 실동작 재검증 수행 — Vercel HTTP 스모크(핵심 경로/상태코드), 로컬 `test:quick` 196 PASS 근거 확보
- [x] P2: Vercel 크리티컬 브라우저 검증 교차 실행 — 샌드박스 `SIGTRAP` 원인 분리, 비샌드박스 `25/25 PASS (2.8m)` 확인
- [x] P2: Vercel E2E 저부하 기본값 전환 — `playwright.config.vercel.ts`(desktop default, mobile opt-in, retries 축소), `test:vercel:*:mobile` 스크립트 분리
- [x] P2: AI 풀스크린 실동작 검증 — `ai-fullscreen.spec.ts` 9/9 PASS (1.8m)
- [x] P2: AI NLQ 단건 검증 — 실패 원인 분리 완료 (`Failed to create job: 429`, 코드 결함 아님)
- [x] P2: AI NLQ 안정성 완화 패치 — `/api/ai/jobs` 429 감지, `Retry-After` 상한(2~15s), rate-limit 텍스트 감지 강화
- [x] P2: Playwright 테스트 호환성 수정 — `ai-supervisor-timeout.spec.ts` beforeEach 인자 시그니처 교정 후 단건 PASS
- [x] P2: CI 워크플로우 최적화 — schedule→workflow_dispatch 전환, detect-scope 조건부 테스트
- [x] P3: Biome 스키마 2.4.2 업그레이드 + renderAIGradientWithAnimation 단순화
- [x] P3: vercel MCP API key 전달 방식 수정 (env→args, v0.0.7 호환)
- [x] P3: MCP 전체 동작 테스트 8/8 정상 확인
- [x] P3: 프로젝트 문서 v8.1.0 현행화 (WBS, DoD, SRS, completion-review, status.md)
- [x] P1: AI Engine 핵심 4모듈 테스트 추가 (prompt-guard 24 + supervisor-routing 31 + error-handler 14 + text-sanitizer 22 = 91 tests)
- [x] P2: RAG 임베딩 모듈 통합 (`embedding.ts` + `embedding-service.ts` → 단일 모듈, local fallback + 3h 캐시 + 통계)
- [x] P2: CI 파이프라인 강화 — smoke `continue-on-error` 제거(차단형), `cloud-run-unit` job 신설, 계약 테스트 CI 추가
- [x] P3: 문서 갱신 — completion-review 95.3%, wbs 95.4% 반영
- [x] P3: 문서 정합성 재검증 — WBS/Completion 수치 불일치(95.0/95.4, 94% 표기, 카운트 편차) 정리
- [x] P2: 표준 완료(Option 2) 실환경 검증 — 무료티어 가드레일 + Cloud Run 저비용 스모크 + Vercel 데스크탑/모바일 50개 크리티컬 + NLQ 단건 통과

### Completed (2026-02-17)
- [x] P2: ToolSet 캐스팅 근본 수정 — `allTools: ToolSet` 타입 명시, `filterToolsByWebSearch` 단순화, `as ToolSet` 0개
- [x] P3: 루트 `@ai-sdk/groq` 제거 (cloud-run/ai-engine에서만 사용)
- [x] P3: 리팩토링 잔류 빈 디렉토리 4개 삭제
- [x] P3: Docker 빌드 캐시(4.2G) + npm/pip/node-gyp 캐시 + Playwright 구버전 정리 (총 10.3G)

### Completed (2026-02-16)
- [x] P1: Full Stack 관점 최종 검수 완료 (`completion-review.md` 96.8%)
- [x] P2: Frontend E2E 테스트 추가 (`ai-fullscreen.spec.ts`, `dashboard-ai-sidebar.spec.ts`)
- [x] P2: API Integration 테스트 추가 (`ai-supervisor.integration.test.ts`)
- [x] P2: NLQ E2E 수동 테스트 추가 (`ai-nlq-vercel.manual.ts`)
- [x] P3: 성능/보안/평가 기준 수립 (Lighthouse, CSP, Promptfoo)
- [x] P3: WBS 최신화 (테스트 커버리지 반영, 실제 완성도 94.7% 달성)

### Completed (2026-02-15)
- [x] P1: Resume Stream v2 구현 — Upstash resumable, prepareReconnectToStreamRequest, stream-state 완성
- [x] P2: RAG 시스템 개선 — hybrid-text-search, reranker, query-expansion, tavily-hybrid-rag 구현
- [x] P1: OTel 데이터 품질 개선 — network 0-1 ratio 통일, 로그 시간 분산, OOM 시퀀스 수정
- [x] P1: Cloud Run 보안 강화 — timing-safe 비교, SHA-256 해싱, ring buffer, graceful shutdown
- [x] P2: Legacy 데이터 삭제 — `src/data/hourly-data/` + `src/data/otel-processed/` 전체 제거
- [x] P2: Vision Agent fallback 구현 — 빈 응답 방어 + min token guard (256)
- [x] P3: 계획서 정리 — plans/ 51→4개, tasks/ 184→0개, reports 5개 archive 이동
- [x] P3: package.json dangling scripts 수정 (data:sync/otel/all → data:fix/verify)
- [x] P3: feature-cards/tech-stacks 문서 OTel 반영

### Completed (2026-02-10)
- [x] P3: AI SDK `ai@6.0.77 → 6.0.78` 업그레이드 + `@ts-expect-error` 2건 제거
- [x] P3: Dead code 1,465줄 제거 (5 미사용 파일 삭제)
- [x] P2: 대형 파일 리팩토링 완료 (MetricsProvider 682→435, security 596→295, ProcessManager 794→766)
- [x] P2: AsyncLocalStorage 도입 (traceId 자동 전파, 15+ 수동 interpolation 제거)
- [x] P2: `ai-proxy.config.ts` 분할 (634 → 482줄, dead code 100줄 제거)
- [x] P2: `circuit-breaker.ts` 분할 (704 → 394줄, state-store + events 모듈 추출)
- [x] P2: `useHybridAIQuery.ts` 분할 (876 → ~540줄, sub-hooks 추출)
- [x] P2: W3C Trace Context (`traceparent`) end-to-end 전파
- [x] P0: Dev bypass auth 기본값 `true` → `false` (프로덕션 인증 우회 방지)
- [x] P1: Redis 자동 복구 타이머 추가 (60초 후 재연결)
- [x] P1: Cache key 정규화 통일 (`normalizeQueryForCache`)
- [x] P1: Redis KEYS → SCAN 변경 (Upstash O(N) 블로킹 방지)
- [x] P1: `proxyStreamToCloudRun` AbortController 추가 (55초 timeout)
- [x] P0: API 라우트 인증 취약점 해결 (3건)
- [x] P1: Job Queue, Stream timeout, Supervisor validation 버그 수정
- [x] P2: `console.*` → `logger` 마이그레이션 (프로덕션 잔존 0건)
- [x] P3: Retry setTimeout 취소 누락 수정 (메모리 누수 방지)
- [x] P2: `stepCountIs(5)` → 7 상향 (복잡 쿼리 대응)

### Completed (2026-02-08)
- [x] P2: Frontend QA — memo, useShallow, SSE validation
- [x] P3: UI QA — services data, mobile AI button, top5 truncation

### Completed (2026-01-26)
- [x] P1: useButtonType A11y 위반 해결 (142개 → 0개)
- [x] P2: README AI 섹션 업데이트 (AI SDK v6, 5-Agent)
- [x] P3: 레거시 계획서 아카이브 이동 (10개 → archive/)

### 활성 계획서 (Active Plans)

> 5개 완료 계획서 → `archive/` 이동 완료 (2026-02-15)

| 파일 | 상태 | 비고 |
|------|------|------|
| `wbs.md` | 운영 | 전체 진행률 ~95.4% (검수 95.3%), v8.1.0 현행화 완료 |

### Completed (2026-01-22)
- [x] 코드 단순화 리팩토링 (YAGNI 원칙 적용)
  - ReactFlowDiagram 모듈 분리 (996줄 → 15개 모듈)
  - AIErrorHandler 제거 (-421줄, 사용처 0곳)
  - ErrorHandlingService 제거 (-2,407줄, 사용처 0곳)
  - **총 ~2,800줄 dead code 제거**

### Completed (2026-01-10 오후)
- [x] 코드 품질 개선 Phase 1-3 완료
  - TODO 주석 정리 (3개 → 0개)
  - SystemChecklist.tsx 분할 (774줄 → 709줄)
  - supervisor/route.ts 분할 (746줄 → 476줄)
- [x] 계획서 검증 및 상태 업데이트
  - AI Engine 구현 100% 완료 확인
  - Langfuse v3.38.6 설치 확인
  - 스트리밍 구현 확인

### Completed (2026-01-10 오전)
- [x] P1: Console → Pino Logger 마이그레이션 (1,561개 → 116개, 92%)
- [x] P2: 대용량 파일 분리 (4개 800줄+ → 0개, 100%)
- [x] P3: any 타입 제거 (17개 → 0개, 100%)

### Completed (2026-01-07)
- [x] Agent SSOT 패턴 리팩토링 (agent-configs.ts 중앙화)
- [x] Langfuse 무료 티어 보호 시스템 구현 (10% 샘플링)
- [x] Cloud Run 무료 티어 최적화 (1 vCPU, 512Mi)
- [x] cloud-run-deploy Skill 추가 (토큰 65% 절감)
- [x] Provider 상태 캐싱 구현 (checkProviderStatus)

### Completed (2026-01-04)
- [x] AI Rate Limit 예측 전환 (Pre-emptive Fallback) 구현
- [x] Provider Quota Tracker 구현 (Vercel + Cloud Run)
- [x] Redis Distributed Circuit Breaker Store 구현
- [x] MCP 서버 전체 동작 검증 (9/9 정상)

### Completed (2025-12-28)
- [x] LangGraph → Vercel AI SDK 마이그레이션 (v5.92.0)
- [x] 멀티-에이전트 오케스트레이션 구현 (`@ai-sdk-tools/agents`)
- [x] AI Engine 아키텍처 문서 최신화

### Documentation Cleanup (2025-12-23)
- [x] 레거시 계획서 아카이브 이동
- [x] docs/development 구조 정리
- [x] 통합 TODO 생성 (`docs/development/ai/TODO.md`)
- [x] 중복 파일 정리

## Domain-Specific TODOs

| Domain | Location | Description |
|--------|----------|-------------|
| **AI Development** | `reports/planning/TODO.md` | Multi-Agent, Prompt Optimization 작업 큐 |
| **Analysis Reports** | `reports/planning/archive/` | 완료/참조용 분석 리포트 보관 |

## Low Priority (Backlog)

| Task | Priority | Status | Description |
|------|----------|--------|-------------|
| security-attack-regression-pack | P1 | Deferred | 보안 QA 체계 구축 (실운영형 공격 회귀팩) |

## Completed Archive

| Task | Date | Notes |
|------|------|-------|
| **LangGraph → Vercel AI SDK Migration** | **2025-12-28** | v5.92.0 - `@ai-sdk-tools/agents` 기반 멀티-에이전트 |
| AI Testing & Monitoring | 2025-12-23 | Unit/Integration Tests + Cache Monitor |
| AI Architecture Improvements | 2025-12-23 | 4 Tasks (Verifier/Cache/State/Context) |
| GraphRAG 하이브리드 검색 | 2025-12-18 | Vector + Text + Graph |
| Cloud Run 하이브리드 아키텍처 | 2025-12-16 | LangGraph Multi-Agent |
| Vercel LangGraph 제거 | 2025-12-17 | 번들 2MB 감소 |
| 문서 구조 개선 Phase 1-4 | 2025-12-19 | kebab-case 통일 |
| Code Interpreter | 2025-12-18 | Browser-based Python |
| 스크립트 통합 최적화 | 2025-12-14 | 72% 감소 |
| React 19/Next.js 16 업그레이드 | 2025-12-10 | - |

---

_Legacy planning docs archived in: `reports/planning/archive/2025-12/`_
