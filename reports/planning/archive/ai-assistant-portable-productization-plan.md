> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-06
> Tags: ai-assistant,portable-core,domain-pack,provider-policy,productization

# AI Assistant Portable Productization Plan

- 상태: Completed
- 작성일: 2026-05-06
- TODO.md 연결: Active Tasks > `AI assistant portable productization and provider policy hardening`
- 기준 archive:
  - [archive/ai-assistant-portable-core-domain-pack-plan.md](archive/ai-assistant-portable-core-domain-pack-plan.md)
  - [archive/ai-engine-supervisor-domain-wiring-plan.md](archive/ai-engine-supervisor-domain-wiring-plan.md)

## 목표

이미 완료된 AI assistant portable core/domain pack 분리 작업을 "OpenManager 내부 구조 개선"에서 "다른 프로젝트가 가져다 쓸 수 있는 재사용 단위"로 끌어올린다.

현재 상태는 `AssistantDomain`, `AssistantRuntimeHost`, monitoring domain pack, sample domain portability smoke, production supervisor domain-agnostic wiring까지 완료되어 있다. 남은 작업은 코어를 별도 제품/패키지 경계로 설명하고 검증할 수 있게 만드는 것, 실제 도입 예제를 정리하는 것, provider-native reasoning capability를 정책 계약으로 분리해 app-level `thinking`과 혼동하지 않게 고정하는 것이다.

## 범위

포함:

- portable assistant core의 public export/facade 경계 정의
- monitoring domain pack과 generic assistant runtime 사이의 dependency guard 강화
- sample domain pack을 외부 도입 예제로 사용할 수 있게 정리
- 다른 프로젝트가 adapter/domain pack만 교체해 도입할 때 필요한 migration checklist 작성
- provider reasoning capability policy contract 추가
- 기존 `thinking`/planner intensity와 provider-native reasoning capability의 의미 분리
- deterministic contract/smoke 중심 검증

제외:

- npm registry publish 또는 외부 배포 자동화
- 신규 LLM/provider 도입
- provider 기본값 변경
- Cloud Run/Vercel 스펙 증설
- production 자동 live LLM QA 확대
- monitoring assistant의 user-facing 기능 변경
- artifact workspace 기능 확장

## 현재 상태

| 항목 | 상태 | 근거 |
|------|------|------|
| Portable core interface | 완료 | `AssistantDomain`, runtime, adapters, in-memory adapters 존재 |
| Production supervisor wiring | 완료 | prompt/tool/prepare-step authority가 `AssistantRuntimeHost` 경계로 이동 |
| Monitoring domain pack | 완료 | 첫 번째 concrete domain pack으로 동작 |
| Sample domain portability smoke | 완료 | monitoring import 없이 sample domain pack smoke 통과 |
| External package boundary | 미완료 | 어떤 파일/API를 외부 재사용 표면으로 볼지 명시 부족 |
| Adoption guide | 미완료 | 다른 프로젝트 적용 절차, adapter checklist, example wiring 문서 부족 |
| Provider-native reasoning policy | 미완료 | `thinking`은 app-level routing intensity인데 provider capability와 구분되는 contract가 없음 |

## 계약 (Contract)

이 섹션은 2026-05-06 기준 Approved 계약이다. 구현은 아래 파일/API 경계를 벗기지 않고, 추가 publish/infra/live provider smoke는 별도 plan으로 분리한다.

### 변경 대상 파일

Core/package boundary:

- `cloud-run/ai-engine/src/core/assistant-runtime/index.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/runtime.ts`
- `cloud-run/ai-engine/src/core/assistant-runtime/in-memory-adapters.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/assistant-runtime-host.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/monitoring-runtime-host.ts`

Public facade는 `cloud-run/ai-engine/src/core/assistant-runtime/index.ts`로 고정한다. 이 facade는 generic runtime 계약과 in-memory adapters만 export하며, monitoring domain implementation, provider-specific policy, supervisor production host는 export하지 않는다.

Domain/example boundary:

- `cloud-run/ai-engine/src/domains/monitoring/domain-pack.ts`
- `cloud-run/ai-engine/src/test-fixtures/sample-domain-pack.ts`

외부 도입 예제는 기존 `cloud-run/ai-engine/src/test-fixtures/sample-domain-pack.ts`를 canonical sample로 유지한다. 신규 `examples/` 디렉토리는 만들지 않고, adoption guide와 smoke test가 같은 sample fixture를 참조해 중복을 막는다.

Provider policy boundary:

- `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.test.ts`
- 필요 시 `src/lib/ai/assistant-contract.ts`

Docs/planning:

- `docs/reference/architecture/ai/ai-engine-architecture.md`
- `reports/planning/TODO.md`

Adoption guide는 신규 문서로 만들지 않고 기존 AI Engine architecture 문서에 병합한다. 문서 예산과 중복 위험을 줄이기 위해 migration checklist, public import path, provider reasoning policy 요약을 한 섹션으로 추가한다.

### 입출력 계약

| API/Boundary | 입력 | 출력 | 에러/제약 |
|--------------|------|------|-----------|
| Portable runtime facade | `AssistantRuntimeConfig` + `AssistantDomain` + adapters | `AssistantRuntime` / `AssistantRuntimeResult` | monitoring import, monitoring artifact literal, provider secret 노출 금지 |
| Runtime host facade | `SupervisorRequest` 또는 `AssistantRequestContext` | AI SDK `ToolSet`, system prompt, optional prepare-step | domain이 execution adapter를 제공하지 않으면 generic domain tools 기반으로 동작 |
| Domain pack example | sample `AssistantDomain` | route/tool/artifact/fact smoke 통과 | monitoring 코드, OpenManager OTel 데이터, provider 호출 의존 금지 |
| Provider reasoning capability policy | provider/model policy entry | `reasoningCapability`, opt-in flag, stale evaluation result | entitlement/latency/quota 변동 가능성을 전제로 stale capability는 provider-native reasoning 비활성 처리 |
| Public metadata | assistant response metadata | public-safe `assistantRuntime` / capability summary | raw provider response, secret-like string, internal stack trace 노출 금지 |

### Reasoning Capability Policy 초안

`thinking`은 계속 app-level routing/planner intensity로 유지한다. provider-native reasoning은 별도 capability로만 표현한다.

| 필드 | 타입 초안 | 의미 |
|------|-----------|------|
| `reasoningCapability.kind` | `'none' \| 'provider-native'` | provider/model이 native reasoning control을 제공하는지. app-level `thinking`은 이 필드에 넣지 않는다. |
| `reasoningCapability.defaultEnabled` | `false` | 기본 활성 여부. Free Tier 원칙상 native reasoning도 기본값은 항상 `false` |
| `reasoningCapability.requiresOptIn` | `boolean` | 사용자가 명시적으로 켜야 하는지. native reasoning은 `true` |
| `reasoningCapability.lastVerified` | ISO date, optional | 계정 entitlement/모델 지원을 확인한 날짜. `kind='none'`이면 생략 가능 |
| `reasoningCapability.expiresAt` | ISO date, optional | 검증 만료일. 만료 시 native reasoning disabled. 기본 stale 기준은 기존 provider smoke guard와 같은 14일 |
| `reasoningCapability.smokeSource` | `'mock-contract' \| 'manual-smoke' \| 'provider-doc'` | capability 판단 근거 |
| `reasoningCapability.optionShape` | `'reasoning_effort' \| 'reasoning_format' \| 'thinking_config' \| 'provider_options' \| 'unknown'` | provider-native reasoning을 활성화할 때 필요한 API option 형태 |
| `reasoningCapability.publicSummary` | string | public metadata에 노출 가능한 짧은 설명. raw provider payload, secret-like value, 내부 stack trace 금지 |

2026-05-06 공식 문서 확인 메모:

- Groq는 일부 reasoning model에서 `reasoning_format`, `include_reasoning`, 모델별 `reasoning_effort`를 문서화한다. Ref: <https://console.groq.com/docs/reasoning>
- Mistral은 `mistral-small-latest`, `mistral-medium-3-5`의 adjustable reasoning을 `reasoning_effort`로 문서화한다. Ref: <https://docs.mistral.ai/capabilities/reasoning/adjustable>
- Gemini는 Gemini 2.5 계열의 `thinkingBudget`/`thinkingConfig`와 Gemini 3 관련 주의사항을 문서화한다. Ref: <https://ai.google.dev/gemini-api/docs/thinking>
- Cerebras는 `gpt-oss-120b`, `zai-glm-4.7` reasoning format 및 모델별 `reasoning_effort`/disable option을 문서화한다. Ref: <https://inference-docs.cerebras.ai/capabilities/reasoning>

OpenManager runtime의 현재 Cerebras 기본 모델 `llama3.1-8b`는 provider-native reasoning을 활성화하지 않는다. GPT-OSS/GLM/Gemini/Groq/Mistral native reasoning은 policy capability로만 표현하고, live provider entitlement smoke 없이 production default를 바꾸지 않는다.

### 테스트 시나리오 (구현 전 확정)

- [x] Portable package boundary guard: public facade `core/assistant-runtime/index.ts`가 monitoring domain implementation, services/monitoring, provider policy를 직접 import/export하지 않는다.
- [x] Core dependency guard: `cloud-run/ai-engine/src/core/assistant-runtime/**`에 monitoring/provider-specific dependency가 추가되면 실패한다.
- [x] Sample domain adoption smoke: sample domain pack이 public facade export와 in-memory adapters만으로 route/tool/artifact/fact path를 통과한다.
- [x] Supervisor compatibility smoke: monitoring default runtime host는 기존 tool/prompt/prepare-step behavior를 유지한다.
- [x] Provider reasoning stale guard: `expiresAt`이 지난 provider-native reasoning capability는 opt-in이어도 disabled로 평가된다.
- [x] Provider reasoning app-level distinction: `analysisMode='thinking'` routing intensity는 `reasoningCapability.kind='provider-native'`로 오인되지 않는다.
- [x] Public metadata safety: capability metadata와 assistant runtime metadata가 raw provider payload나 secret-like value를 노출하지 않는다.
- [x] Docs/example consistency: adoption guide의 import path와 sample fixture가 실제 exported API와 일치한다.

## Task 목록

> 착수 전 Status가 Approved인지 확인한다. 구현 Task는 failing spec 커밋 이후 진행한다.

- [x] Task 0 — Draft contract 확정 및 Approved 전환
  - public facade 파일 위치 확정
  - example/domain pack 위치 확정
  - reasoning capability field 이름과 stale 기준 확정
- [x] Task 1 — failing specs 작성
  - package boundary guard
  - sample adoption smoke
  - provider reasoning capability policy contract
  - public metadata safety guard
- [x] Task 2 — portable runtime public facade 정리
  - 외부 재사용 표면을 `index.ts` 또는 dedicated facade로 고정
  - internal-only API가 public facade에 섞이지 않도록 guard 추가
- [x] Task 3 — sample domain adoption kit 정리
  - sample domain pack을 도입 예제로 읽기 쉽게 정리
  - minimal adapter wiring 예제 추가
  - live provider/Cloud dependency 없이 동작 보장
- [x] Task 4 — provider reasoning capability policy 구현
  - provider/model policy에 reasoning capability contract 추가
  - `thinking` app-level routing intensity와 native reasoning capability 구분
  - stale/expired capability disabled behavior 고정
- [x] Task 5 — adoption guide 작성
  - domain pack 작성 절차
  - adapter 교체 checklist
  - supervisor runtime host 연결 절차
  - Free Tier/secret/test 원칙
- [x] Task 6 — validation 및 planning 정리
  - targeted tests
  - AI Engine `type-check`
  - AI Engine test subset 또는 full test 판단
  - root `test:contract`
  - `docs:budget`
  - `docs:ai-consistency`
  - `git diff --check`

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `docs(planning):` | 선택 | X | X |
| Task 1 | `test(spec):` | 선택 | X | X |
| Task 2 | `refactor(ai):` | 선택 | 판단 필요 | X |
| Task 3 | `test(ai):` 또는 `docs(ai):` | 선택 | X | X |
| Task 4 | `feat(ai):` | 예 | 예, policy runtime 영향 시 | 필요 시 |
| Task 5 | `docs(ai):` | 선택 | X | X |
| Task 6 | `test:` 또는 `docs(planning):` | 예 | 변경 범위 기준 | 변경 범위 기준 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 후 | 계약이 기존 완료 plan과 중복되지 않고 남은 작업만 다루는지 |
| Task 1 후 | failing spec이 package boundary와 provider policy를 정확히 표현하는지 |
| Task 2 후 | public facade가 너무 넓거나 monitoring-specific API를 노출하지 않는지 |
| Task 3 후 | sample adoption kit가 실제 다른 domain에 적용 가능한 수준인지 |
| Task 4 후 | reasoning capability가 Free Tier, entitlement drift, stale verification을 안전하게 처리하는지 |
| Task 5 후 | docs가 기존 architecture/development 문서와 중복되지 않는지 |
| Task 6 후 | 기존 monitoring assistant behavior 회귀가 없는지 |

## 진행 중 블로커 대응

| 상황 | 기준 |
|------|------|
| package boundary가 실제 npm publish 수준으로 커짐 | publishing plan으로 분리하고 이 plan은 internal facade/adoption kit까지만 완료 |
| provider capability 확인이 외부 live smoke를 요구함 | mock/contract를 우선하고 manual smoke는 별도 QA evidence로 기록 |
| docs budget 초과 또는 duplicate 감지 | 신규 docs 생성 대신 기존 development/architecture 문서에 병합 |
| monitoring assistant regression 발생 | 회귀 재현 test를 우선 추가하고 productization 작업과 분리해 수정 |
| capability policy가 provider default 변경을 요구함 | 기본값 변경은 별도 provider policy plan으로 분리 |

## 완료 기준

- [x] plan Status가 Approved 이상으로 전환된 뒤 구현 착수
- [x] 테스트 시나리오 전체 통과
- [x] portable runtime public facade 경계가 명시됨
- [x] sample domain adoption smoke가 external-domain 관점에서 통과
- [x] provider reasoning capability policy가 `thinking`과 분리됨
- [x] stale/expired provider-native reasoning capability가 disabled로 평가됨
- [x] adoption guide가 실제 import path와 일치함
- [x] 기존 monitoring supervisor stream/single-agent behavior 유지
- [x] AI Engine `npm run type-check`
- [x] AI Engine targeted tests 통과
- [x] root `npm run test:contract`
- [x] `npm run docs:budget`
- [x] `npm run docs:ai-consistency`
- [x] `git diff --check`

## 진행 로그

- 2026-05-06: 최근 3일 작업 분석 결과, internal portable core/domain pack과 production supervisor domain-agnostic wiring은 완료된 것으로 판정했다. 남은 범위는 external reuse/productization, adoption guide, provider-native reasoning policy contract로 축소해 새 Draft plan으로 분리했다.
- 2026-05-06: 계약을 Approved로 전환했다. Public facade는 `core/assistant-runtime/index.ts`, sample adoption fixture는 `src/test-fixtures/sample-domain-pack.ts`, adoption guide는 기존 AI Engine architecture 문서 병합으로 고정했다. Provider-native reasoning 공식 문서(Groq/Mistral/Gemini/Cerebras)를 재확인하고 `analysisMode='thinking'`과 별도 capability policy로 분리했다.
- 2026-05-06: SDD 순서대로 failing spec 커밋 후 구현을 완료했다. `reasoningCapability` 정책 계약과 expired native reasoning disabled helper를 추가했고, portable adoption guide를 기존 AI Engine architecture 문서에 병합했다. 검증은 AI Engine targeted tests `6 files / 30 tests`, AI Engine `type-check`, root `test:contract`, `docs:budget`, `docs:ai-consistency`, `git diff --check` 통과.
