> Owner: project
> Status: Approved
> Doc type: Plan
> Last reviewed: 2026-05-06
> Tags: ai-engine,supervisor,domain-pack,portable-core,tool-wiring

# AI Engine Supervisor Domain Wiring Plan

- 상태: Approved
- 작성일: 2026-05-06
- TODO.md 연결: Active Tasks > `AI Engine production supervisor stream domain-agnostic wiring`
- 기준 archive: [archive/ai-assistant-portable-core-domain-pack-plan.md](archive/ai-assistant-portable-core-domain-pack-plan.md) > `사후 분석 리뷰 (2026-05-06)`

## 목표

AI Engine의 production supervisor 실행 경로가 monitoring domain에 직접 묶이지 않고, `AssistantRuntimeHost`가 제공하는 domain pack contract를 통해 prompt/tool/artifact authority를 주입받도록 정렬한다.

이미 완료된 portable core/domain pack 작업은 `AssistantDomain`, runtime, adapters, monitoring domain pack, sample domain smoke를 제공한다. 이 plan은 그 다음 단계로, 실제 production stream/single-agent path의 prompt/tool execution authority를 monitoring compatibility layer에서 runtime host/domain pack boundary로 옮긴다.

최종 목표는 "서버 모니터링 assistant"를 유지하면서도, 다른 프로젝트가 `AssistantDomain`과 adapters를 교체하면 supervisor stream의 핵심 실행 경로가 core 수정 없이 동작하는 상태다.

## 범위

포함:

- `AssistantRuntimeHost`가 AI SDK 실행에 필요한 domain prompt/toolset/prepare-step adapter를 제공하도록 contract 확장
- `supervisor-stream.ts`의 `allTools` 직접 참조를 runtime host/domain toolset 기반으로 전환
- `supervisor-single-agent.ts`의 동일 전환
- `supervisor-mode.ts`의 monitoring artifact kind 직접 판정을 domain artifact registry 위임으로 전환
- `agent-configs.ts` multi-agent tool distribution의 domain registry 결합 정리 범위 확정 및 가능한 최소 adapter 적용
- 기존 monitoring behavior, web search/RAG toggle, provider fallback, quota/circuit breaker, stream event contract 유지

제외:

- 신규 LLM/provider 도입
- Cloud Run/Vercel 스펙 증설
- monitoring tool 자체의 대규모 이동 또는 tool behavior 변경
- frontend artifact workspace/schema replay pack 구현
- production live QA 자동화 확대

## 현재 정확한 상태

| 항목 | 상태 |
|------|------|
| `cloud-run/ai-engine/src/core/**` | monitoring dependency guard 통과, domain-independent |
| `monitoringDomainPack` | prompt/routing/tool/fact/artifact owner로 존재 |
| supervisor runtime metadata | `resolveMonitoringSupervisorRuntimeContext()`로 이미 주입됨 |
| supervisor actual tool execution | `supervisor-stream.ts`, `supervisor-single-agent.ts`가 아직 `allTools` 직접 사용 |
| supervisor prompt/prepareStep | `supervisor-routing.ts` compatibility wrapper를 통해 monitoring policy 직접 사용 |
| artifact kind normalization | `supervisor-mode.ts`가 monitoring artifact registry 직접 import |
| multi-agent tool registry | `agent-configs.ts`가 monitoring tool registry 직접 import |

## 계약 (Contract)

### 변경 대상 파일

1. Core/runtime host boundary
- `cloud-run/ai-engine/src/core/assistant-runtime/types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/assistant-runtime-host.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/monitoring-runtime-host.ts`

2. Supervisor production execution
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-stream.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-single-agent.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-mode.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-routing.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/supervisor-types.ts`

3. Multi-agent domain adapter
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-configs.ts`
- `cloud-run/ai-engine/src/domains/monitoring/tool-registry.ts`

### 입출력 계약

| API/Boundary | 입력 | 출력 | 에러/제약 |
|--------------|------|------|-----------|
| `AssistantRuntimeHost` execution adapter | `SupervisorRequest` 또는 `AssistantRequestContext` | AI SDK compatible `ToolSet`, system prompt, optional prepare-step policy | domain이 adapter를 제공하지 않으면 monitoring default host는 기존 behavior를 유지해야 함 |
| `supervisor-stream.ts` tool resolution | runtime host metadata + domain execution adapter + web/RAG toggles | filtered AI SDK `ToolSet` | `searchWeb`/`searchKnowledgeBase` toggle filtering은 기존과 동일해야 함 |
| `supervisor-single-agent.ts` tool resolution | runtime host metadata + domain execution adapter + web/RAG toggles | filtered AI SDK `ToolSet` | tool count, fallback metadata, quality retry behavior 유지 |
| `supervisor-mode.ts` artifact classification | request/local route decision + runtime host/domain artifact registry | public-safe route/assistant plan metadata | monitoring artifact literal import 제거, unknown artifact는 기존처럼 무시/normalize 실패 |
| `agent-configs.ts` tool registry | domain-aware monitoring tool registry adapter | agent별 tool allowlist | 기존 AgentToolName allowlist 및 provider capability policy 유지 |

### 불변 조건

- `cloud-run/ai-engine/src/core/**`는 monitoring/import/literal/glossary dependency guard를 계속 통과한다.
- 기존 monitoring supervisor의 user-facing answer, stream event names, metadata keys는 호환 유지한다.
- `allTools`는 monitoring domain pack 또는 compatibility adapter 내부에 머물 수 있지만, supervisor stream/single-agent production 파일에서 직접 authority로 사용하지 않는다.
- web search/RAG toggles는 기존 query policy와 fallback behavior를 유지한다.
- 신규 live provider 호출을 테스트/CI 기본 경로에 추가하지 않는다.
- Free Tier 제약(Cloud Run 1 vCPU/512Mi, no always-on, no provider call 증가)을 변경하지 않는다.

### 테스트 시나리오 (구현 전 확정)

- [ ] Stream path domain toolset contract: sample runtime host를 주입하면 `supervisor-stream.ts`가 `allTools`가 아닌 host-provided toolset을 사용한다.
- [ ] Single-agent path domain toolset contract: sample runtime host를 주입하면 `supervisor-single-agent.ts`가 host-provided toolset을 사용한다.
- [ ] Monitoring compatibility contract: default monitoring runtime host는 기존 `searchKnowledgeBase`, `searchWeb`, `getServerMetricsAdvanced`, `finalAnswer` availability를 유지한다.
- [ ] Web/RAG filtering contract: host-provided toolset에서도 `filterToolsByWebSearch`/`filterToolsByRAG` 결과가 기존과 동일하게 적용된다.
- [ ] Artifact generic contract: `supervisor-mode.ts`가 domain artifact registry를 통해 artifact kind를 classify/normalize하고 monitoring registry 직접 import 없이 통과한다.
- [ ] Multi-agent registry contract: agent allowlist가 domain tool registry를 통해 resolution되며 기존 monitoring agent configs가 같은 tool names를 노출한다.
- [ ] Stream snapshot contract: existing `portable-core-stream-contract.bench.test.ts`와 supervisor stream targeted tests가 event shape 회귀 없이 통과한다.
- [ ] Core dependency guard: `cloud-run/ai-engine/src/core/**`에 monitoring dependency가 추가되지 않는다.

## Task 목록

- [x] Task 0 — failing specs 작성
  - stream/single-agent host toolset injection contract
  - generic artifact classification contract
  - monitoring compatibility tool availability contract
- [x] Task 1 — `AssistantRuntimeHost` execution adapter contract 추가
  - domain `ToolDefinition[]`를 AI SDK `ToolSet`으로 변환하는 adapter boundary 정의
  - monitoring default host는 기존 production `allTools` behavior를 compatibility adapter 내부에서 보존
- [x] Task 2 — `supervisor-stream.ts` tool authority 전환
  - `allTools` direct import 제거
  - runtime host toolset + 기존 web/RAG filtering 연결
  - forced KB direct path behavior 유지
- [x] Task 3 — `supervisor-single-agent.ts` tool authority 전환
  - `allTools` direct import 제거
  - model retry/quality retry/fallback metadata 유지
- [x] Task 4 — `supervisor-mode.ts` artifact authority generic화
  - monitoring artifact direct import 제거
  - domain artifact registry classify/normalize 경로로 전환
- [ ] Task 5 — multi-agent tool distribution boundary 정리
  - `agent-configs.ts` monitoring direct registry 결합 최소화
  - 필요 시 domain-aware adapter 추가
- [ ] Task 6 — targeted/full validation 및 plan/TODO 완료 처리

## 단계별 커밋/푸시/배포 판단

| Task | 커밋 prefix | gitlab push | Cloud Run 재배포 | Vercel 재배포 |
|------|-------------|:-----------:|:----------------:|:-------------:|
| Task 0 | `test(spec):` | 선택 | ❌ | ❌ |
| Task 1 | `refactor(ai):` | ✅ | ❌ | ❌ |
| Task 2~5 | `refactor(ai):` | ✅ | ✅ | 필요 시 |
| Task 6 | `test:` 또는 `docs:` | ✅ | 판단 필요 | 판단 필요 |

## 코드리뷰 게이트

| 시점 | 리뷰 대상 |
|------|-----------|
| Task 0 후 | failing spec이 domain-agnostic wiring 계약을 정확히 표현하는지 |
| Task 1 후 | ToolDefinition → AI SDK ToolSet adapter가 타입/보안/호환성을 지키는지 |
| Task 2 후 | stream provider fallback, quota, circuit breaker, forced KB path 회귀 여부 |
| Task 3 후 | single-agent quality retry, fallback metadata, finalAnswer path 회귀 여부 |
| Task 4 후 | artifact metadata가 public-safe이고 unknown artifact를 안전하게 처리하는지 |
| Task 5 후 | multi-agent tool allowlist와 domain registry 책임이 과도하게 섞이지 않았는지 |
| Task 6 후 | monitoring behavior 유지와 sample domain portability가 둘 다 검증됐는지 |

## 완료 기준

- [ ] 테스트 시나리오 전체 통과
- [x] `supervisor-stream.ts`에서 `allTools` 직접 import 제거
- [x] `supervisor-single-agent.ts`에서 `allTools` 직접 import 제거
- [x] `supervisor-mode.ts`에서 monitoring artifact registry 직접 import 제거
- [x] sample/custom runtime host가 supervisor stream/single-agent toolset injection contract를 통과
- [x] monitoring default runtime host가 기존 tool/prompt behavior를 유지
- [ ] `cloud-run/ai-engine/src/core/**` dependency guard 통과
- [ ] AI Engine `npm run type-check`
- [ ] AI Engine targeted supervisor/runtime/domain tests 통과
- [ ] AI Engine `npm test`
- [ ] root `npm run test:contract`
- [ ] `npm run docs:budget`
- [ ] `npm run docs:ai-consistency`
- [ ] `git diff --check`

## 진행 로그

- 2026-05-06: Completed portable core/domain pack plan의 사후 분석 리뷰를 근거로 새 Active plan을 생성했다. 현재 결론은 core/interface/metadata wiring은 완료됐지만 production supervisor의 actual prompt/tool execution authority가 monitoring compatibility layer에 남아 있다는 것이다. 이 plan은 바로 구현하지 않고 SDD 규칙에 따라 Task 0 failing spec부터 시작한다.
- 2026-05-06: Task 0 failing specs를 추가했다. `supervisor-domain-wiring.contract.test.ts`는 sample runtime host toolset이 stream/single-agent 실행에 주입되는지, monitoring default host의 기존 핵심 tool availability가 유지되는지, non-monitoring artifact kind가 route decision metadata에서 보존되는지를 고정한다. 현재 production code는 아직 `allTools` 직접 authority와 monitoring artifact kind allowlist를 사용하므로 이 spec은 구현 전 의도대로 실패한다.
- 2026-05-06: Task 1~4 구현. `AssistantRuntimeHost.createToolSet()` adapter를 추가하고, monitoring default host는 기존 `allTools` compatibility를 유지하도록 execution adapter를 제공한다. `supervisor-stream.ts`와 `supervisor-single-agent.ts`는 runtime host toolset을 web/RAG filtering에 통과시키며, web fallback 재실행도 현재 filtered toolset의 `searchWeb`을 사용한다. `supervisor-mode.ts`는 monitoring artifact registry 직접 import를 제거하고 runtime host domain artifact registry로 artifact kind를 classify한다. `/supervisor/stream/v2` route는 UIMessageStream 초기 `data-mode` metadata도 같은 runtime host 기준으로 만들도록 default monitoring host를 주입한다. 검증: `supervisor-domain-wiring.contract.test.ts` `5/5`, targeted supervisor/runtime suites `39/39`, AI Engine `type-check`, AI Engine `npm test` `102 files / 1031 tests`, route/stream targeted `12/12`, `docs:budget`, `docs:ai-consistency`, `git diff --check`.
