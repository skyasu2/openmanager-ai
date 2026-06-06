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
| 진행 | A-1 | AI 어시스턴트 응답 품질에 직접 영향 |
| 진행 | C-1 | orchestrator 라우팅 정책 분리로 구조 설명력과 유지보수성 개선 |
| 진행 | E-1~E-6 | Supabase legacy cleanup과 Free Tier DB hygiene. 비가역 migration은 선행 분석 후 순차 진행 |
| 진행 | B-1 | 수동 QA 의존을 줄이는 경량 회귀 방어. A-1/C-1 후 라우팅 기준 확정 필요 |
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

현재 QA 658 runs는 전부 수동 판정. 라우팅 경로(provider, agent, 성공/실패)가 expected와 달라지면 자동으로 감지하는 스크립트가 없음.

**작업**:
- [ ] `scripts/qa/routing-regression-check.js` 작성
  - 입력: 기준 라우팅 테이블 (질문 → 예상 provider/agent)
  - 동작: `npm run langfuse:check -- --json` 출력으로 실제 라우팅과 비교
  - 출력: 예상과 다른 케이스 목록 + 이탈률(%)
- [ ] 기준 라우팅 테이블 정의 (오늘 테스트 5개 + 기존 QA pass 케이스 10개)
- [ ] `npm run qa:routing:check` 스크립트 등록

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

**Status: Proceed / Portfolio architecture cleanup**

### C-1. orchestrator-direct-routing.ts 중간층 상수 분리

**현상**: `orchestrator-direct-routing.ts` 43% 코드가 모니터링 특화 상수. 새 도메인 포팅 시 이 파일 수동 수정 필요.

**작업**:
- [ ] `AssistantDomain` 인터페이스에 `routingOverridePolicy` 선택 필드 추가
  ```typescript
  routingOverridePolicy?: {
    analystOverrideCapabilities: string[];
    analystOverrideIntents: string[];
    defaultDirectRoutingAgent: string;
    semanticConfidenceThreshold: number;
  };
  ```
- [ ] `orchestrator-direct-routing.ts`가 위 필드를 읽도록 리팩터링 (하드코딩 제거)
- [ ] `monitoring/domain-pack.ts`에 현재 값 이전
- [ ] 회귀 테스트: 기존 라우팅 동작 유지 확인

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

**Status: Proceed / Free-tier DB hygiene**

> 기준: 2026-06-06 실측 (knowledge_base=67, command_vectors=5, security_audit_logs=425, approval_history=0)

### E-1. command_vectors 잔여 5행 이관 후 테이블 삭제 (T5 완결)

**현황**: 2026-05-10에 26행 → 5행으로 줄었으나 5행 미이관 상태. runtime에서 테이블 미사용.

**작업**:
- [ ] 잔여 5행이 `knowledge_base`에 `cv:<id>` 태그로 이미 표현되는지 확인 (`SELECT cv.id FROM command_vectors cv LEFT JOIN knowledge_base kb ON kb.metadata->>'command_id' = cv.id::text WHERE kb.id IS NULL`)
- [ ] 미이관 행 있으면 `knowledge_base`에 backfill migration 작성
- [ ] `DROP TABLE public.command_vectors CASCADE` migration 작성·적용
- [ ] `supabase/migrations/` 에 migration 추가, `npm run supabase:rag:smoke` 통과 확인

**예상 작업량**: 소규모 (SQL 30~50줄)
**비용 영향**: embedding 벡터 데이터 제거로 DB 크기 절감
**담당**: Codex 위임 가능

---

### E-2. knowledge_relationships 테이블 삭제

**현황**: legacy graph traversal inventory. 170행이지만 runtime request path에서 DB query 없음. `rag-doc-policy.ts`, `rag-merge-planner.ts`는 상수 참조만 (DB 조회 없음).

**작업**:
- [ ] `grep -rn "knowledge_relationships"` 로 runtime DB 호출 0건 재확인
- [ ] `DROP TABLE public.knowledge_relationships CASCADE` migration 작성·적용
- [ ] post-check: `to_regclass('public.knowledge_relationships') IS NULL`

**예상 작업량**: 소규모 (SQL 5줄)
**선행 조건**: E-1 완료 후 (의존성 없으나 함께 진행 권장)
**담당**: Codex 위임 가능

---

### E-3. knowledge_base.embedding 컬럼 제거

**현황**: cosine vector search path가 P2로 비활성화된 상태. 67건 × 1024차원 float32 = 약 268KB 순수 벡터 데이터. runtime에서 읽지 않음.

**작업**:
- [ ] `grep -rn "\.embedding\b"` 로 runtime SELECT/INSERT에서 embedding 컬럼 사용 0건 재확인
- [ ] `ALTER TABLE knowledge_base DROP COLUMN embedding` migration 작성
- [ ] 연관 인덱스 `idx_knowledge_base_search_vector` 제거 여부 확인 (이름이 다를 수 있음)
- [ ] cosine RPC/함수 잔여 참조 확인 후 migration 적용

**예상 작업량**: 소규모 ~ 중간 (의존성 검증 포함)
**선행 조건**: E-1, E-2 완료 후
**비용 영향**: DB 크기 감소, pg_advisor 경고 일부 해소
**담당**: Codex 위임 가능

---

### E-4. security_audit_logs retention 정책 추가

**현황**: 425행 (2026-06-06), 로그인마다 1행 추가. retention 정책 없음 → 무한 증가.

**작업**:
- [ ] 보존 기간 결정 (권장: 90일)
- [ ] Supabase scheduled function(pg_cron) 또는 migration으로 90일 초과 row 자동 삭제 구현:
  ```sql
  -- pg_cron 방식 (매일 새벽 3시)
  SELECT cron.schedule('cleanup-audit-logs', '0 3 * * *',
    $$DELETE FROM security_audit_logs WHERE created_at < NOW() - INTERVAL '90 days'$$);
  ```
- [ ] Free Tier pg_cron 지원 여부 확인 (Supabase Free에서 pg_cron 사용 가능 확인 필요)
- [ ] 대안: Supabase Edge Function scheduled trigger

**예상 작업량**: 소규모 (SQL 10줄 또는 Edge Function 50줄)
**비용 영향**: 장기적으로 DB 크기 안정화
**담당**: Codex 위임 가능

---

### E-5. Extension 스키마 migration 사전 조건 정리

**현황**: `vector`, `pg_trgm` extension이 `public` 스키마에 설치됨 → Supabase advisor 경고. `extensions` 스키마로 이동 시 `SECURITY DEFINER` 함수 search_path 충돌 위험.

**작업 (분석 단계만)**:
- [ ] disposable branch DB에서 extension 이동 시뮬레이션
- [ ] `search_knowledge_text` RPC의 `similarity()` 호출이 `extensions.similarity()` 로 변경 없이 동작하는지 확인
- [ ] 이동 가능하면 migration 작성, 불가능하면 "advisor warning accepted" 문서화

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
  3. C-1  orchestrator 중간층 분리       → 다음 구조화 후보
  4. E-6  approval/incident 사용 여부    → 완료. incident_reports 삭제 후보, approval_history API 호환성 보류
  5. E-1  command_vectors 이관+삭제      → 다음 진행. 비가역 migration 전 잔여 5행 검증
  6. E-2  knowledge_relationships 삭제   → runtime 미사용 재확인 후 삭제
  7. E-3  knowledge_base.embedding 제거  → cosine/RPC 잔여 참조 확인 후 제거
  8. E-5  Extension 스키마 migration     → E-3 후 disposable DB에서 시뮬레이션
  9. E-4  security_audit_logs retention  → Free Tier 적합 방식으로 장기 증가 차단
 10. B-1  라우팅 회귀 감지 스크립트     → 최종 라우팅 기준 확정 후 QA 신뢰도 보강
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
