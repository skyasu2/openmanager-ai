# AI Assistant 설계 개선 계획서

> Owner: project
> Status: Completed
> Doc type: How-to
> Created: 2026-05-13
> Last reviewed: 2026-05-13

## 배경

2026-05-13 AI Assistant request flow 다이어그램 재검토에서 비용, 지연 시간, 보안 경계, semantic intent 전처리의 개선 가능성을 점검했다.
초기 우려였던 "artifact path가 Next.js BFF를 우회한다"는 실제 구현 결함이 아니라 다이어그램 표현 오해였다.
다만 고비용 artifact API의 rate-limit 계약, Groq 모델 ID drift, entity extraction 반복 호출, 자연어 부하 표현 미탐지, zero-token 설명 정밀도는 실제 개선 가치가 있었다.

## 재검토 결론

| 항목 | 판정 | 근거 | 조치 |
|------|------|------|------|
| Artifact BFF 보안 우회 | 문서 표현 오해 | Artifact intent/report/monitoring route는 Next.js API route를 통과하며 auth 적용 | 다이어그램에 BFF route와 auth/rate-limit 경계 명시 |
| Artifact API rate-limit | 실제 개선 필요 | `incident-report`, `intelligent-monitoring` POST는 auth는 있었지만 `aiAnalysis` rate-limit 계약이 없었음 | route wrapper와 계약 테스트 추가 |
| Artifact classifier SPOF | 부분 개선됨 | `/api/ai/artifact-intent`는 3초 timeout과 `none` fallback으로 fail-open | 현 구조 유지, 문서에 fallback 성격 유지 |
| Entity extraction 비용 | 실제 개선 필요 | semantic/clarification 경로에서 동일 쿼리 재시도 시 provider 호출 반복 가능 | session-scoped TTL + in-flight cache 추가 |
| Semantic natural language coverage | 실제 개선 필요 | "힘들어", "느린", "부담" 등 운영자가 쓰는 부하 표현이 gate를 열지 못함 | positive/negative 테스트와 패턴 확장 |
| Zero-token 표현 | 문서 정확도 개선 필요 | Cloud Run 내부 zero-token이어도 frontend classifier/entity extractor LLM이 선행될 수 있음 | Cloud Run 구간 기준으로 명시 |

## Task 목록

### Task 0 — 재검토 및 범위 보정 [P1] ✅

- 보안 우회는 실제 결함이 아니라 다이어그램이 BFF/API route를 생략해 생긴 오해로 판정.
- 실제 코드 기준으로 artifact intent, incident report, intelligent monitoring route의 auth/rate-limit 상태를 확인.
- 계획 범위를 "우회 제거"가 아니라 "route 계약 강화 + 문서 정정"으로 축소.

### Task 1 — Artifact API rate-limit 계약 강화 [P1] ✅

**수정**
- `src/app/api/ai/incident-report/route.ts`
- `src/app/api/ai/intelligent-monitoring/route.ts`

**내용**
- 고비용 Cloud Run proxy POST route에 `withRateLimit(rateLimiters.aiAnalysis, withAuth(...))` 적용.
- 기존 auth 경계는 유지하고 `GET /api/ai/intelligent-monitoring` status route는 auth만 유지.

**테스트**
- `src/app/api/ai/incident-report/route.test.ts`
- `src/app/api/ai/intelligent-monitoring/route.test.ts`

### Task 2 — Groq 모델 ID 통일 [P2] ✅

**수정**
- `src/config/ai-providers.ts`
- `src/app/api/ai/nlq/extract-entities/route.ts`
- `src/lib/ai/entity-extractor.ts`
- `src/data/feature-cards.data.ts`

**내용**
- Groq text model ID를 `meta-llama/llama-4-scout-17b-16e-instruct`로 통일.
- `GROQ_TEXT_MODEL_ID` 상수를 root app config에 추가해 UI provider 표시와 NLQ entity extractor가 같은 값을 사용하도록 정렬.

### Task 3 — `extractEntities` session cache 추가 [P3] ✅

**수정**
- `src/hooks/ai/core/useQueryExecution.ts`

**내용**
- `extractEntitiesCached()`를 추가해 정규화된 쿼리 기준으로 5분 TTL cache와 in-flight dedupe를 적용.
- `confidence: 0` 같은 무신뢰 결과는 캐시하지 않아 provider 장애나 fallback 상태를 오래 붙잡지 않음.
- 테스트 격리용 `clearEntityExtractionCacheForTesting()` 추가.

### Task 4 — semantic extraction gate 패턴 확장 [P3] ✅

**수정**
- `src/hooks/ai/core/useQueryExecution.ts`

**내용**
- 기존 metric keyword 중심 gate에 `힘들`, `버거`, `느린`, `느려`, `느리`, `부담`, `응답.*느`, `과부하`, `리소스`, `자원`을 추가.
- `서버 상태 어때?`, `알려줘` 같은 일반 질의는 gate를 열지 않도록 negative test로 고정.

### Task 5 — 다이어그램/문서 정확도 수정 [P4] ✅

**수정**
- `docs/architecture/02-runtime-architecture.md`
- `docs/reference/architecture/ai/ai-engine-architecture.md`

**내용**
- artifact path가 Next.js BFF를 우회하지 않는다는 점을 Mermaid/ASCII 다이어그램에 반영.
- artifact API route auth + `aiAnalysis` rate-limit 경계를 명시.
- deterministic answer의 zero-token 표현을 "Cloud Run 내부 LLM 호출 없음" 기준으로 정정.

## 검증

```bash
npm run test:node -- src/app/api/ai/incident-report/route.test.ts src/app/api/ai/intelligent-monitoring/route.test.ts src/app/api/ai/nlq/extract-entities/route.test.ts
npm run test:dom -- src/hooks/ai/core/useQueryExecution.test.ts
npm run type-check
npm run lint:changed
npm run test:quick
npm run test:contract
npm run line-guard
npm run docs:budget
npm run docs:ai-consistency
npm run docs:lint:changed
git diff --check
```

초기 failing test 확인 후 구현했고, 위 targeted/full local gate는 통과했다.

## 완료 조건

- [x] Artifact route rate-limit 계약 테스트와 구현 통과
- [x] Groq model ID drift 제거
- [x] Entity extraction TTL/in-flight cache 적용
- [x] Semantic gate positive/negative 테스트 고정
- [x] Runtime/AI Engine architecture Mermaid + ASCII 다이어그램 정정
- [x] 최종 gate: type-check, lint:changed, docs checks, diff check
