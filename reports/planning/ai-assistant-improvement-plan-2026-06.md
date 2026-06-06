# AI 어시스턴트 개선 작업 계획서 (2026-06)

> Owner: project
> Status: Approved
> Created: 2026-06-05
> Context: 포트폴리오 공개 품질 기준의 구조·성능 분석 결과 (Claude, Playwright MCP + Langfuse REST API 기반)
> Ref: docs/reference/architecture/ai/ai-engine-evaluation.md

---

## 분석 요약

| 평가 축 | 현재 상태 | 포트폴리오 목표 |
|--------|:--------:|:----:|
| 포트폴리오 완성도 | 6.5/10 | 8.0/10 |
| AI 라우팅 정확도 | 7/10 | 8.5/10 |
| Analyst/LLM 지연 근거 | A-2 실측 완료: after Analyst 6.3s (`n=1`) | 추가 표본 후 P95 재판단 |
| 런타임 가드레일 | 구현됨, 자동 eval 미흡 | 수동 QA + 경량 회귀 감지 |

## 포트폴리오 진행 기준

이번 계획서는 공개 포트폴리오에서 체감되거나 설명 가능한 품질 개선만 진행 대상으로 둔다.

| 분류 | 작업 | 판단 |
|------|------|------|
| 완료 | A-2 | Langfuse production 기준선 확보. after 표본 부족으로 D-2 미착수 |
| 완료 | A-1 | RCA 표현군 Analyst routing 보강 완료 |
| 완료 | C-1 | orchestrator 라우팅 정책을 `AssistantDomain.routingOverridePolicy`로 분리 |
| 완료 | E-1/E-2/E-3/E-5/E-6 | live DB 기준 legacy GraphRAG cleanup과 extension schema 정리 확인 |
| 완료 | E-4 | `security_audit_logs` 90일 app-level retention cleanup 구현 완료 |
| 완료 | B-1 | 수동 QA 의존을 줄이는 경량 회귀 방어. `npm run qa:routing:check` 등록 완료 |
| 조건부 | D-2 | A-2에서 개선 후 Analyst P95 병목이 확인되지 않아 현재 미착수 |
| 보류 | B-2, D-1 | 상업화/장기 운영 자동화 성격. 현재 포트폴리오에는 과함 |

---

## Task A — 라우팅 품질 개선

### A-1. "왜/원인" RCA 질문 Analyst 라우팅 보강

**Status: Completed (2026-06-06)**

**현상**: `"db-mysql-dc1-backup 디스크 73% 왜 이렇게 높아?"` → `deterministic / monitoring-metric-current` (현황만 반환)

**원인**: 서버명+메트릭이 명시된 경우 NLQ entity extractor가 신뢰도 0.65 미만으로 semantic frame을 반환해 deterministic 경로가 우선됨.

**작업**:
- [x] pre-filter Analyst/RCA 패턴에 "이유/때문/why/reason/cause" 변형 추가
- [x] current-metric deterministic evidence가 명시적 RCA 질문을 가로채지 않도록 exclusion 추가
- [x] 테스트 케이스: `"[서버명] [메트릭] 왜/이유/때문/why 높아?"` 형태의 5개 질문 Analyst 라우팅 확인

**예상 작업량**: 소규모 (orchestrator-direct-routing.ts 20~30줄)
**SDD 게이트**: test(spec) 선행 커밋 필요
**담당**: Codex 위임 가능

---

### A-2. Analyst P95 production 실측 비교

**Status: Completed (2026-06-06) / 기준선 확보, 통계 결론 보류**

**현상**: v8.12.82 Analyst 1차 지연 개선(commit a2f4ba9a9) 이후 production before/after 비교 미수행.

**작업**:
- [x] `npm run langfuse:check -- --limit 100 --q supervisor --json` 로 Analyst 라우팅된 트레이스 지연 추출
- [x] 개선 커밋 전(2026-05-29 이전) vs 후 Analyst 경로 평균 비교
- [x] 결과를 `ai-engine-evaluation.md` Langfuse 집계 기준선 섹션에 추가

**결과**:
- Before: Analyst `n=13`, avg `18.7s`, P50 `11.3s`, P95 `76.8s`
- After: Analyst `n=1`, observed `6.3s`, provider `mistral`, tools `detectAnomalies → finalAnswer`
- 판단: after 표본 부족으로 P95 개선 확정은 보류. `D-2 maxSteps 하향`은 현재 착수하지 않음

**예상 작업량**: 분석 작업 (코딩 없음)
**담당**: Claude 직접 수행 가능

---

## Task B — 라우팅 회귀 방어

### B-1. 라우팅 회귀 감지 스크립트 (LLM 없이)

**Status: Completed (2026-06-06)**

현재 QA 661 runs는 대부분 수동 판정. 라우팅 경로(provider, agent, 성공/실패)가 expected와 달라지면 자동으로 감지하는 스크립트가 없음.

**작업**:
- [x] `scripts/qa/routing-regression-check.js` 작성
  - 입력: 기준 라우팅 테이블 (질문 → 예상 provider/agent)
  - 동작: `npm run langfuse:check -- --json` 출력으로 실제 라우팅과 비교
  - 출력: 예상과 다른 케이스 목록 + 이탈률(%)
- [x] 기준 라우팅 테이블 정의 (오늘 테스트 5개 + 기존 QA pass 케이스 10개)
- [x] `npm run qa:routing:check` 스크립트 등록

**결과**:
- 기준 테이블: `config/qa/routing-regression-baseline.json` 15개 케이스
- 실행 경로: `npm run qa:routing:check -- --limit 100`
- deterministic 검증: `tests/unit/qa/routing-regression-check.test.ts`에서 pass/drift/missing 판정과 terminal report 포맷 확인

**예상 작업량**: 중간 (스크립트 200~300줄 + 기준 테이블 JSON)
**선행 조건**: Task A-2 완료 후 기준선 확정
**담당**: Codex 위임 적합

---

### B-2. Langfuse Score 활용 (LLM-as-judge 기초)

**Status: On Hold / Commercial-readiness**

현재 Langfuse의 `scores` 필드를 운영 루프에서 전혀 활용하지 않음. 자동 품질 판정의 첫 단계로 규칙 기반 scorer 도입.

**작업**:
- [ ] `cloud-run/ai-engine/src/services/observability/langfuse-score.ts` 작성
  - 라우팅 일치 여부 (expected vs actual agent): binary score
  - 응답 완료 여부 (finalAnswer 도달): binary score
  - 지연 티어 (빠름/보통/느림): 3단계 score
- [ ] supervisor-execution trace에 score 자동 기록
- [ ] `npm run langfuse:check` 출력에 score 컬럼 추가

**예상 작업량**: 중간 (langfuse-score.ts 100줄 + trace 기록 연동 50줄)
**담당**: Codex 위임 적합

---

## Task C — 도메인 이식성 개선

**Status: Completed (2026-06-06)**

### C-1. orchestrator-direct-routing.ts 중간층 상수 분리

**현상**: `orchestrator-direct-routing.ts` 43% 코드가 모니터링 특화 상수. 새 도메인 포팅 시 이 파일 수동 수정 필요.

**작업**:
- [x] `AssistantDomain` 인터페이스에 `routingOverridePolicy` 선택 필드 추가
  ```typescript
  routingOverridePolicy?: {
    analystOverrideCapabilities: string[];
    analystOverrideIntents: string[];
    defaultDirectRoutingAgent: string;
    semanticConfidenceThreshold: number;
  };
  ```
- [x] `orchestrator-direct-routing.ts`가 위 필드를 읽도록 리팩터링 (하드코딩 제거)
- [x] `monitoring/domain-pack.ts`에 현재 값 이전
- [x] 회귀 테스트: 기존 라우팅 동작 유지 확인

**결과**:
- `AssistantDomain.routingOverridePolicy`에 default direct agent, semantic confidence threshold, Analyst override capability/intent 목록을 추가
- monitoring domain pack이 기존 `metric_current`/`server_health` Analyst override 정책을 소유
- non-stream/stream multi-agent request가 runtime host domain을 direct router에 전달
- 검증: AI Engine `type-check`, AI Engine 전체 test, root `test:contract`, root `lint`, root `type-check`, root `test:quick` 통과

**예상 작업량**: 중간 (인터페이스 수정 + 파일 2개 리팩터링)
**SDD 게이트**: test(spec) 선행 커밋 필요
**담당**: Codex 위임 적합 (인터페이스 계약은 Claude 설계 후 위임)

---

## Task D — 성능 개선

### D-1. Langfuse 주간 자동 집계

**Status: On Hold / Long-term operations**

`npm run langfuse:check` 는 수동 실행. 주간 P95/분포를 자동 기록하는 CI 작업 부재.

**작업**:
- [ ] `npm run langfuse:weekly` 스크립트: 직전 7일 트레이스 집계 → `reports/qa/langfuse-weekly/YYYY-WW.json`
- [ ] GitLab CI에 주 1회 실행 추가 (docs/reports only 커밋이므로 CI 스킵 예외 처리 필요)

**예상 작업량**: 소규모 (스크립트 100줄 + CI yaml 5줄)
**담당**: Codex 위임 적합

---

### D-2. Analyst maxSteps 하향 검증

**Status: Conditional / Not triggered by A-2 2026-06-06**

Analyst ReAct 루프 현재 maxSteps=5. 1차 개선 이후 step1 제거로 실질 최대 필요 step은 3~4로 줄었을 수 있음.

**작업**:
- [ ] Langfuse trace에서 Analyst 경로 toolsCalled 배열 길이 분포 분석
- [ ] 95th percentile step 수 확인 → maxSteps=4로 하향 가능하면 적용
- [ ] before/after P95 지연 비교

**예상 작업량**: 분석 + 소규모 코드 변경
**선행 조건**: 추가 Analyst production 표본 3~5건 이상 확보 후
**담당**: Claude 분석 → Codex 구현

---

## Task E — Supabase 최적화

**Status: Partially Completed / E-4 remaining**

> 기준: 2026-06-06 live DB 재확인
> - `knowledge_base=67`, `command_vectors=absent`, `knowledge_relationships=absent`
> - `vector_documents_stats=absent`, `knowledge_base.embedding=absent`
> - `knowledge_base.search_vector=present`
> - `security_audit_logs=425`, `pg_cron=not installed`
> - `vector`, `pg_trgm` extensions are installed in `extensions` schema

### E-1. command_vectors 잔여 5행 이관 후 테이블 삭제 (T5 완결)

**Status: Completed in live DB (2026-06-06 확인)**

**현황**: live DB에서 `public.command_vectors`가 이미 없음. `knowledge_base`는 67행이며 `source='command_vectors_migration'` 문서는 25행 유지. `npm run supabase:rag:smoke` 통과.

**작업**:
- [x] 잔여 5행이 `knowledge_base`에 backfill됐는지 live DB 상태로 확인
- [x] `public.command_vectors` 없음 확인
- [x] `supabase/migrations/` 에 cleanup migration 후보 존재 확인
- [x] `npm run supabase:rag:smoke` 통과 확인

**예상 작업량**: 소규모 (SQL 30~50줄)
**비용 영향**: embedding 벡터 데이터 제거로 DB 크기 절감
**담당**: Codex 위임 가능

---

### E-2. knowledge_relationships 테이블 삭제

**Status: Completed in live DB (2026-06-06 확인)**

**현황**: live DB에서 `public.knowledge_relationships`가 이미 없음. runtime 검색에서는 DB 호출이 없고 `rag-doc-policy.ts`, `rag-merge-planner.ts`의 source/tag 상수 참조만 남음.

**작업**:
- [x] `grep -rn "knowledge_relationships"` 로 runtime DB 호출 0건 재확인
- [x] post-check: `to_regclass('public.knowledge_relationships') IS NULL`

**예상 작업량**: 소규모 (SQL 5줄)
**선행 조건**: E-1 완료 후 (의존성 없으나 함께 진행 권장)
**담당**: Codex 위임 가능

---

### E-3. knowledge_base.embedding 컬럼 제거

**Status: Completed in live DB (2026-06-06 확인)**

**현황**: live DB에서 `public.knowledge_base.embedding` 컬럼이 이미 없음. `public.knowledge_base.search_vector`와 KRL RPC 함수들은 유지됨.

**작업**:
- [x] runtime path에서 `knowledge_base.embedding` 사용 없음 확인
- [x] live DB에서 `knowledge_base.embedding` 없음 확인
- [x] live DB에서 `knowledge_base.search_vector` 유지 확인
- [x] `search_knowledge_text`, `generate_knowledge_search_vector`, `update_knowledge_search_vector` 유지 확인

**예상 작업량**: 소규모 ~ 중간 (의존성 검증 포함)
**선행 조건**: E-1, E-2 완료 후
**비용 영향**: DB 크기 감소, pg_advisor 경고 일부 해소
**담당**: Codex 위임 가능

---

### E-4. security_audit_logs retention 정책 추가

**Status: Completed (2026-06-06)**

**현황**: 425행 (2026-06-06), 로그인마다 1행 추가. retention 정책 없음 → 무한 증가.
live DB에서 `pg_cron`은 설치되어 있지 않음.

**작업**:
- [x] 보존 기간 결정: 90일
- [x] live DB에서 `pg_cron` 미설치 확인 결과, 추가 extension/scheduler 없이 앱 레벨 cleanup 경로 선택
- [x] `recordLoginEvent` 성공 후 90일 초과 row 삭제 구현
- [x] 같은 프로세스에서는 cleanup을 24시간에 1회로 제한해 로그인 경로 DB write 부하를 제한

**결과**:
- 구현: `src/lib/auth/login-audit.ts`
- 테스트: `src/lib/auth/login-audit.test.ts`
- 운영 특성: 별도 Supabase Edge Function, Cloud Scheduler, `pg_cron` 설치 없음. 기존 `SUPABASE_SERVICE_ROLE_KEY` 기반 audit write 경로에서만 opportunistic cleanup 수행

**예상 작업량**: 소규모 (SQL 10줄 또는 Edge Function 50줄)
**비용 영향**: 장기적으로 DB 크기 안정화
**담당**: Codex 위임 가능

---

### E-5. Extension 스키마 migration 사전 조건 정리

**Status: Completed in live DB (2026-06-06 확인)**

**현황**: live DB에서 `vector`, `pg_trgm` extension이 `extensions` 스키마에 설치됨.

**작업 (분석 단계만)**:
- [x] live DB extension schema 확인
- [x] `npm run supabase:rag:smoke`로 `search_knowledge_text` 동작 확인
- [x] extension schema warning은 현재 재현되지 않음

**예상 작업량**: 분석 (30분~2시간)
**선행 조건**: E-3 완료 후 (embedding 관련 함수 정리 후 진행)
**담당**: Claude 직접 분석 권장 (schema 의존성 파악)

---

### E-6. approval_history / incident_reports 사용 여부 확인

**Status: Completed (2026-06-06) / 삭제 판단 분리**

**현황**: `approval_history` 0행, `incident_reports` 2행. Cloud Run의 `approval-store-supabase.ts`가 `approval_history` 테이블을 사용하나 현재 비활성 상태.

**작업**:
- [x] `approval-store-supabase.ts` 가 실제 request path에서 호출되는 경로 추적
- [x] 사용하지 않으면 approval 관련 테이블/RPC 삭제 계획 수립
- [x] `incident_reports` 2행 출처 확인 (실제 데이터 또는 테스트 데이터)

**결과**:
- `approval_history`: live DB 0행, `get_approval_stats(30)` 결과도 전부 0. 다만 Cloud Run이 `/api/ai/approval/history`와 `/api/ai/approval/history/stats`를 계속 mount하고, 두 endpoint가 `get_approval_history`/`get_approval_stats` RPC에 의존한다. write path는 제거된 상태이므로 데이터 관점에서는 비활성이지만, API 호환성 표면이 살아 있어 즉시 DROP은 보류한다.
- `incident_reports`: live DB 2행은 2026-01-01 UTC 생성된 과거 테스트/레거시 데이터로 판단. 현재 Next BFF와 Cloud Run incident-report 경로는 보고서를 세션 아티팩트로 반환하며, `src/**`와 `cloud-run/ai-engine/**`에서 `incident_reports` 직접 read/write 경로는 확인되지 않았다.
- 후속 판단: `incident_reports`는 backup 후 삭제 후보. `approval_history`는 approval history API를 함께 제거하거나 local empty response로 전환하는 계약 변경이 선행될 때만 테이블/RPC DROP migration을 진행한다.

**예상 작업량**: 분석 (30분)
**담당**: Claude 직접 수행

---

## 포트폴리오 진행 순서

```
진행 대상
  1. A-2  Analyst 지연 기준선 실측       → 완료. after n=1이라 D-2는 미착수
  2. A-1  "왜" RCA 라우팅 보강           → 완료. RCA 표현군 Analyst routing 보강
  3. C-1  orchestrator 중간층 분리       → 완료. routingOverridePolicy로 domain pack 소유화
  4. E-6  approval/incident 사용 여부    → 완료. incident_reports 삭제 후보, approval_history API 호환성 보류
  5. E-1  command_vectors 이관+삭제      → 완료 확인. live DB에서 테이블 없음
  6. E-2  knowledge_relationships 삭제   → 완료 확인. live DB에서 테이블 없음
  7. E-3  knowledge_base.embedding 제거  → 완료 확인. live DB에서 컬럼 없음
  8. E-5  Extension 스키마 migration     → 완료 확인. vector/pg_trgm extensions schema
  9. E-4  security_audit_logs retention  → 완료. 90일 app-level cleanup, pg_cron/Edge Function 추가 없음
 10. B-1  라우팅 회귀 감지 스크립트     → 완료. 기준 테이블 15개 + `npm run qa:routing:check`
 11. D-2  Analyst maxSteps 하향 검증     → A-2에서 병목 확인 시에만

보류 대상
  B-2  Langfuse Score 자동 기록          → 상업화/evals 준비 전까지 보류
  D-1  주간 자동 집계                    → 장기 운영 자동화, 현재는 수동 점검 충분
```

---

## 작업 외 범위 (이번 계획서 제외)

| 항목 | 이유 |
|------|------|
| 멀티테넌시 (3/10) | 포트폴리오 단계에서 불필요. 상업화 결정 시 별도 계획 |
| Cold start 해소 | Free Tier 구조 제약, Cloud Run min-instance 유료 |
| RAG cosine threshold 조정 | 기존 P2 pending, 독립 작업으로 처리 |
