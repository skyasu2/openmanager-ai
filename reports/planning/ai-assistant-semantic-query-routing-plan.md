> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-12
> Tags: ai-assistant,semantic-parser,intent-frame,domain-resolver,ai-sdk

# AI Assistant Semantic Query Routing Plan

- 상태: Approved
- 작성일: 2026-05-12
- TODO.md 연결: Active Tasks > AI Assistant Semantic Query Routing Phase 3
- 기준 archive:
  - [archive/ai-assistant-semantic-intent-frame-plan.md](archive/ai-assistant-semantic-intent-frame-plan.md)
  - [archive/ai-assistant-domain-capability-resolver-plan.md](archive/ai-assistant-domain-capability-resolver-plan.md)
  - [archive/ai-assistant-portable-productization-plan.md](archive/ai-assistant-portable-productization-plan.md)

## 목표

자연어 질의 처리를 정규식/NLP 정규화에 계속 누적하지 않고, LLM을 답변 생성기가 아닌 semantic parser로 제한해 `IntentFrame`/`QueryPlan`을 만들고, 실제 provider 선택·조회·계산·검증은 domain resolver와 deterministic evidence provider가 담당하도록 연결한다.

이번 Phase 3는 Phase 1의 Root App `SemanticIntentFrame`과 Phase 2의 AI Engine `DomainIntentFrame`/capability resolver를 end-to-end로 연결하는 작업이다. 목표는 monitoring peak 질의 하나만 하드코딩으로 맞추는 것이 아니라, 이후 모의 주식, HR, 코드리뷰 agent가 같은 구조로 domain pack을 추가할 수 있는 재사용 가능한 query routing contract를 확정하는 것이다.

## 현재 상태 분석

| 영역 | 현재 상태 | 판단 |
|------|-----------|------|
| Root semantic parser | `/api/ai/nlq/extract-entities`가 `generateText + Output.object + Zod`로 `SemanticIntentFrame`을 추출 | 방향은 맞지만 주로 clarification 보조에 사용됨 |
| Clarification | `scope=whole_fleet`이면 서버명이 없어도 통과 가능 | Phase 1 목표 달성 |
| AI Engine domain resolver | `metadata.intentFrame` 우선, domain parser fallback, capability lookup, provider request 전달 구조 존재 | Phase 2 목표 달성 |
| Main stream wire | Vercel stream proxy와 Cloud Run supervisor request에 `intentFrame` 전달 계약이 아직 없음 | 이번 작업의 핵심 gap |
| Provider validation | monitoring peak provider는 frame/raw query 모두 처리하나 provider별 evidence validation 표준은 약함 | 개선 필요 |
| Trace/eval | routeDecision/metadata 일부는 있으나 semantic parse 결과, provider 선택, evidence 요약의 표준 로그는 없음 | 개선 필요 |

## 기존 작업과의 충돌 검토

- Phase 1과 충돌하지 않는다. 기존 `SemanticIntentFrame`을 폐기하지 않고, clarification 보조에서 Cloud Run evidence resolver 입력으로 승격한다.
- Phase 2와 충돌하지 않는다. AI Engine resolver가 이미 `metadata.intentFrame`을 우선할 수 있으므로 wire protocol과 normalizer를 추가하는 방향이다.
- portable productization과 충돌하지 않는다. Root App이 monitoring provider 구현체 이름을 알지 않으며, Cloud Run 공통 런타임도 provider 구현체 이름을 LLM에게 노출하지 않는다.
- Free Tier 원칙과 충돌하지 않도록 parser 호출은 모든 요청이 아니라 cheap guard 이후 domain 후보 질의에만 제한한다. 반복 live LLM QA는 기본 검증 범위에서 제외한다.

## 범위

포함:

- Root App `SemanticIntentFrame`을 Cloud Run `DomainIntentFrame` metadata로 변환하는 mapper 추가
- Vercel supervisor stream/json request schema에 optional semantic frame 전달 계약 추가
- Cloud Run supervisor stream/json request schema에 optional `metadata.intentFrame` 또는 `semanticIntentFrame` normalization 추가
- `resolveDomainEvidenceForStream`이 request metadata를 resolver에 전달하도록 연결
- provider selection/evidence validation의 최소 표준 인터페이스 또는 helper 추가
- semantic query trace 로그 추가
- deterministic contract/unit test 중심 검증

제외:

- 모든 자연어 질의를 LLM parser로 강제 처리
- LLM이 provider 구현체 이름이나 내부 함수명을 선택하는 구조
- monitoring 외 신규 domain 실제 구현
- 전체 orchestrator/job queue 재작성
- production live LLM 반복 QA 및 비용 큰 E2E
- provider-native reasoning 기본값 변경

## 설계 원칙

```text
User Query
  -> Pre Guard / Cheap Validation
  -> Semantic Parser (structured output)
  -> IntentFrame
  -> Clarification / Validation
  -> Domain Resolver
  -> Deterministic Evidence Provider
  -> Evidence Validation
  -> Final Answer Generator
```

- LLM은 `domain`, `intent`, `scope`, `metric`, `timeWindow`, `aggregation`, `topN`, `ambiguity`, `confidence`까지만 만든다.
- LLM은 provider 구현체 이름, 내부 함수명, 파일 경로를 선택하지 않는다.
- 수치 계산과 데이터 조회는 deterministic provider가 담당한다.
- 최종 답변 생성 LLM은 evidence에 없는 수치·시간·서버명을 만들 수 없다.
- clarification 판단은 원문 query text보다 `IntentFrame`을 우선한다.
- `scope=whole_fleet`이면 서버명이 없어도 정상 질의로 통과한다.

## 계약 (Contract)

### 변경 대상 파일

Root App:

- `src/lib/ai/entity-extractor.ts`
- `src/lib/ai/semantic-intent-frame.ts` (신규 후보)
- `src/app/api/ai/nlq/extract-entities/route.ts`
- `src/lib/ai/clarification-generator.ts`
- `src/app/api/ai/supervisor/schemas.ts`
- `src/app/api/ai/supervisor/route.ts`
- `src/app/api/ai/supervisor/cloud-run-handler.ts`
- `src/app/api/ai/supervisor/stream/v2/route.ts`
- `src/hooks/ai/core/useQueryExecution.ts`
- `src/hooks/ai/useHybridAIQuery.ts`
- `src/hooks/ai/core/createHybridChatTransport.ts`

AI Engine:

- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-types.ts`
- `cloud-run/ai-engine/src/routes/supervisor.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts`
- `cloud-run/ai-engine/src/domains/monitoring/peak-metric-evidence-provider.ts`
- 필요 시 `cloud-run/ai-engine/src/services/ai-sdk/semantic-query-trace.ts` (신규 후보)

관련 테스트:

- `src/lib/ai/entity-extractor.test.ts`
- `src/lib/ai/clarification-generator.test.ts`
- `src/app/api/ai/supervisor/schemas.test.ts`
- `src/app/api/ai/supervisor/stream/v2/route.test.ts`
- `src/hooks/ai/core/createHybridChatTransport.test.ts`
- `cloud-run/ai-engine/src/routes/supervisor.test.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.test.ts`
- `cloud-run/ai-engine/src/domains/monitoring/peak-metric-evidence-provider.test.ts`

### 입출력 계약

| 경계 | 입력 | 출력 | 에러/제약 |
|------|------|------|-----------|
| `POST /api/ai/nlq/extract-entities` | `{ query: string }` | sanitized `SemanticIntentFrame?` | provider 실패 시 `{ confidence: 0 }` 유지 |
| `toDomainIntentFrame` | Root `SemanticIntentFrame` | Cloud Run-safe `DomainIntentFrame` payload + drop reasonCodes | `domain='unknown'`, `intent='unknown'`, `ambiguity='high'`, `confidence < ENTITY_CONFIDENCE_THRESHOLD(80)`은 drop |
| AI SDK transport body | current query + optional normalized semantic frame | stream body에 `metadata.intentFrame` 포함 | `createHybridChatTransport` body callback에서 누락되면 실패 |
| Vercel supervisor request | `messages`, options, optional semantic frame | Cloud Run body에 `metadata.intentFrame` 전달 | invalid frame은 warn log 후 drop |
| Cloud Run supervisor request | optional `metadata.intentFrame` | `SupervisorRequest.metadata.intentFrame` | unknown domain/capability는 drop, raw fallback 유지 |
| `resolveDomainEvidenceForStream` | `SupervisorRequest` + query + domain | `DomainEvidenceResult | null` | metadata frame 우선, parser fallback, provider miss 시 null |
| Evidence provider validation | provider evidence + frame | valid evidence 또는 null/fallback reason | evidence 없는 수치 생성 금지 |

### Frame 변환 규칙

| Root `SemanticIntentFrame` | AI Engine `DomainIntentFrame` |
|----------------------------|-------------------------------|
| `domain: 'monitoring'` | `domainId: 'openmanager-monitoring'` |
| `intent` | `intent` |
| capability mapping | `metric_peak` -> `monitoring.metric_peak` |
| `scope: 'whole_fleet'` | `scope: 'whole_fleet'` |
| `scope: 'server'` | `scope: 'entity'` |
| `targets` | `targets` |
| `metric` | `metric` |
| `timeWindow` | `timeWindow` |
| `aggregation` | `aggregation` |
| `topN` | `topN` |
| `ambiguity` | `ambiguity` |
| `confidence / 100` | `confidence` |

### Drop / reasonCode 계약

Root `SemanticIntentFrame.confidence`는 0-100, AI Engine `DomainIntentFrame.confidence`는 0-1이다. Root mapper는 Phase 1의 `ENTITY_CONFIDENCE_THRESHOLD = 80`을 SSOT로 사용한다.

| 조건 | 처리 | reasonCode |
|------|------|------------|
| `confidence < 80` | Cloud Run body에 싣지 않음 | `semantic_frame_low_confidence` |
| `ambiguity === 'high'` | Cloud Run body에 싣지 않음 | `semantic_frame_high_ambiguity` |
| `domain === 'unknown'` 또는 domain mapping 없음 | Cloud Run body에 싣지 않음 | `semantic_frame_unknown_domain` |
| `intent === 'unknown'` 또는 capability mapping 없음 | Cloud Run body에 싣지 않음 | `semantic_frame_unknown_intent` |
| payload shape invalid | warn log + drop | `semantic_frame_invalid` |
| frame valid but provider miss | raw fallback 또는 일반 stream path 유지 | `semantic_frame_provider_miss`, `semantic_frame_raw_fallback_used` |
| evidence 생성/검증 성공 | evidence prompt/fallback 사용 | `semantic_frame_evidence_validated` |

Drop reasonCode는 user-facing 답변에 노출하지 않는다. 내부 logger, stream metadata, test assertion에서만 사용한다.

### Semantic query trace 계약

```ts
interface SemanticQueryTrace {
  originalQuery: string;
  parsedFrame?: {
    domainId: string;
    intent: string;
    capabilityId?: string;
    scope: string;
    metric?: string;
    timeWindow?: string;
    aggregation?: string;
    confidence: number;
  };
  selectedDomain?: string;
  selectedCapability?: string;
  selectedEvidenceProvider?: string;
  evidenceAvailable: boolean;
  clarificationRequired: boolean;
  rawFallbackUsed?: boolean;
  reasonCodes: string[];
}
```

로그에는 query 전문을 남기되, 시크릿/파일 내용/첨부 payload는 포함하지 않는다. 사용자 입력이 길면 기존 logger 정책에 맞춰 truncate한다.

## 테스트 시나리오 (구현 전 확정)

- [ ] Root mapper는 valid monitoring `metric_peak/load1/24h/whole_fleet` frame을 `openmanager-monitoring` `DomainIntentFrame`으로 변환한다.
- [ ] Root mapper는 `domain='unknown'`, `intent='unknown'`, `ambiguity='high'`, `confidence < 80` frame을 Cloud Run body에 싣지 않고 drop reasonCode를 반환한다.
- [ ] confidence threshold 미만 frame은 `createHybridChatTransport` body에 포함되지 않고 `semantic_frame_low_confidence`가 trace/log reasonCode로 남는다.
- [ ] Vercel stream v2 route는 optional semantic frame을 Cloud Run request body의 `metadata.intentFrame`으로 전달한다.
- [ ] client AI SDK transport body는 semantic frame을 request body에 보존한다.
- [ ] Cloud Run supervisor stream/json route는 `metadata.intentFrame`을 validate/normalize해 `SupervisorRequest.metadata`에 보존한다.
- [ ] `resolveDomainEvidenceForStream`은 request metadata frame을 `resolveDomainEvidenceSupport`에 전달하고, domain parser보다 metadata frame을 우선한다.
- [ ] monitoring peak provider는 metadata frame만으로 evidence를 생성하고 raw regex fallback 없이도 동작한다.
- [ ] 동일 peak 질의는 raw only, frame only, frame+raw 세 입력에서 동일한 deterministic evidence 핵심값을 반환한다.
- [ ] invalid metadata frame이 들어오면 `semantic_frame_invalid` reasonCode가 기록되고 raw fallback 또는 일반 stream 답변 경로가 깨지지 않는다.
- [ ] provider miss 시 `semantic_frame_provider_miss`와 `semantic_frame_raw_fallback_used` reasonCode가 기록되고 기존 raw fallback이 호출된다.
- [ ] `scope=whole_fleet` 질의는 서버명이 없어도 clarification으로 막히지 않는다.
- [ ] semantic query trace는 selected domain/capability/evidence availability/reasonCodes를 internal metadata/log에 남기고 provider 이름을 user-facing answer에 노출하지 않는다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다. 구현 Task는 failing spec 커밋 이후 진행한다.

- [ ] Task 0 — failing specs 작성
  - mapper contract
  - Vercel stream/json forwarding
  - Cloud Run request normalization
  - resolver metadata priority
  - provider frame-only evidence
- [ ] Task 1 — Root semantic frame mapper/validator 정리
  - provider/function 이름 노출 금지
  - confidence/ambiguity/drop rule 고정
  - clarification 기존 동작 유지
- [ ] Task 2 — Vercel BFF request forwarding
  - stream v2 primary path
  - legacy JSON fallback path
  - `createHybridChatTransport` body callback의 semantic frame forwarding
  - invalid semantic frame drop log
- [ ] Task 3 — Cloud Run request metadata wiring
  - supervisor schema
  - `SupervisorRequest.metadata`
  - stream/json/job 영향을 최소화
- [ ] Task 4 — AI Engine resolver/provider validation 보강
  - metadata frame 우선순위 고정
  - `DomainEvidenceValidationResult` helper 추가
  - provider-local validation에서 required evidence field 검증
  - raw fallback 유지
- [ ] Task 5 — semantic query trace/eval seed 추가
  - deterministic log metadata
  - `cloud-run/ai-engine/src/services/ai-sdk/__fixtures__/semantic-query-eval-seed.json`에 비용 없는 deterministic seed 8-12건 추가
  - seed 포맷: `{ query, expectedFrame, expectedReasonCodes, expectedEvidence? }`
  - 비용 큰 live LLM 테스트 제외
- [ ] Task 6 — 문서/TODO/검증 정리
  - plan Task 체크
  - TODO.md 상태 갱신
  - targeted tests, type-check, diff check

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | X | X |
| Task 1~2 | `feat(ai):` | 선택 | X | release/tag에서 판단 |
| Task 3~5 | `feat(ai-engine):` 또는 `feat(ai):` | 선택 | release/tag에서 판단 | Task 2 포함 시 release/tag에서 판단 |
| Task 6 | `docs:` 또는 구현 커밋 포함 | 예 | X | X |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 완료 후 | failing specs가 provider 이름 노출 없이 semantic frame contract를 검증하는지 |
| Task 2 완료 후 | Vercel BFF가 semantic frame을 user-facing 메시지에 섞지 않고 metadata로만 전달하는지 |
| Task 4 완료 후 | 공통 runtime이 monitoring 문자열/import에 새로 결합되지 않았는지, raw fallback이 유지되는지 |
| 전체 완료 후 | Free Tier, 보안, 테스트 비용, portable domain pack 원칙 준수 여부 |

## 검증 계획

우선 실행:

- targeted Vitest:
  - `src/lib/ai/entity-extractor.test.ts`
  - `src/lib/ai/clarification-generator.test.ts`
  - `src/app/api/ai/supervisor/stream/v2/route.test.ts`
  - `cloud-run/ai-engine/src/routes/supervisor.test.ts`
  - `cloud-run/ai-engine/src/services/ai-sdk/supervisor-domain-evidence.test.ts`
- `npm run type-check`
- `cd cloud-run/ai-engine && npm run type-check`
- `git diff --check`

추가 판단:

- API/AI 계약 변경이므로 root `npm run test:contract`는 변경 범위가 안정된 뒤 1회 실행한다.
- 비용이 발생하거나 오래 걸리는 live LLM/production Playwright QA는 이번 구현 검증의 기본값에서 제외하고, release/tag 배포 후 QA gate에서 필요 시 1회성으로 수행한다.

## 완료 기준

- [ ] Root `SemanticIntentFrame`이 Cloud Run `DomainIntentFrame` metadata로 안전하게 전달된다.
- [ ] AI Engine resolver가 metadata frame을 domain parser보다 우선 사용한다.
- [ ] monitoring peak evidence provider가 frame-only 경로로 deterministic evidence를 생성한다.
- [ ] invalid/low-confidence frame은 기존 raw fallback 또는 일반 stream 경로를 깨지 않는다.
- [ ] LLM이 provider 구현체 이름을 알거나 선택하지 않는다.
- [ ] evidence 없는 수치·시간·서버명이 최종 답변에 임의 생성되지 않도록 검증 경계가 있다.
- [ ] semantic query trace가 internal logger/metadata에 기록되고 reasonCodes로 분기 추적 가능하다.
- [ ] targeted tests와 type-check가 통과한다.
- [ ] TODO.md와 plan 상태가 완료 기준에 맞게 갱신된다.
