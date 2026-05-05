# Promptfoo Evaluation & Golden Dataset Hardening Plan

**Owner**: project
**Status**: Completed
**Created**: 2026-05-05

## Context & Motivation
현재 OpenManager AI 프로젝트는 Free Tier 절대 원칙(Cerebras, Groq, Mistral 조합)에 따라 실 LLM 호출을 동반하는 무거운 CI/CD E2E 테스트를 금지하고 있습니다.
다행히 프로젝트 내에 `cloud-run/ai-engine/promptfoo`가 이미 세팅되어 있어 이를 활용하는 것이 가장 비용 효율적입니다. 그러나 현재 `promptfooconfig.yaml`을 보면 상당수의 검증(assert)이 `llm-rubric` (LLM-as-a-Judge) 방식으로 되어 있어, 반복 테스트 시 토큰 소모가 발생할 여지가 큽니다.

따라서 비용이 전혀 들지 않는 결정론적(Deterministic) 평가를 90% 이상으로 끌어올리고, 실제 런타임 모델(Cerebras, Groq)에 대한 A/B 라우팅 평가가 가능하도록 프레임워크를 최적화해야 합니다.

## Goal
- **Free Tier 방어**: `llm-rubric` 기반 검증을 `contains-any`, `is-json`, `javascript` (custom validation) 등 비용이 0인 결정론적 검증으로 대거 전환.
- **Golden Dataset 정예화**: 엣지 케이스 및 Tool Calling 스키마 검증 위주의 20~30개 내외 핵심 마이크로 벤치마크 구성.
- **A/B 테스트 환경**: `promptfooconfig.yaml`에 Cerebras와 Groq 등 실제 런타임 무료 모델들을 등록하여, 동일한 프롬프트(의도)에 대해 어떤 모델이 Tool Calling 실패율이 적은지 비교 측정.
- **옵저버빌리티(Langfuse) & Contract(Vitest) 연계**: Promptfoo는 Prompt 튜닝과 로컬 벤치마크를 전담하고, 실 배포 환경 평가는 비동기 Langfuse Eval, HTTP/Stream 검증은 Vitest에 위임하는 역할 명확화.

## Contract

| 항목 | 계약 |
|------|------|
| 비용 경계 | `prompt:eval`은 실제 provider 호출 가능성을 실행 전에 명시적으로 경고한다. Judge용 추가 LLM 호출은 기본 경로에서 제거한다. |
| assertion 비율 | 기본 `promptfooconfig.yaml`의 `llm-rubric` assertion은 전체 assertion의 20% 미만이어야 한다. `defaultTest`에는 `llm-rubric`을 두지 않는다. |
| deterministic guard | 핵심 회귀는 `contains-any`, `not-contains`, `javascript` assertion으로 검증한다. Tool/JSON/route/schema 성격의 검증은 LLM-as-a-Judge가 아니라 구조 검사로 고정한다. |
| provider 정렬 | eval provider label/config는 production runtime chain(Cerebras → Groq → Mistral)을 기준으로 설명한다. 실제 provider 호출은 로컬 수동 실행 전용이며 CI 기본 경로에는 포함하지 않는다. |
| golden dataset | 기본 config는 RAG/Web/Search/Reporter/NLQ/Supervisor edge case를 포함한 20~30개 micro benchmark를 유지한다. |
| redteam 분리 | redteam config는 별도 수동 실행 경로로 유지하되, 같은 deterministic assertion 원칙을 적용한다. |
| 검증 | Promptfoo config contract test가 assertion 비율, defaultTest 금지, javascript guard 수, script warning을 deterministic하게 검사한다. |

## Task Breakdown

### 1. `promptfooconfig.yaml` 리팩터링 및 모델 정렬
- [x] 현재 `providers`에 등록된 `groq:llama-3.3-70b-versatile` 및 `gemini-2.5-flash` 구성을 실제 AI Engine 런타임(Cerebras `llama3.1-8b`, Groq, Mistral fallback)과 비교/정렬.
- [x] 비용 검증용 로컬 모델 또는 극저비용 모델(예: API 키가 세팅된 무료 티어 내 모델)로 Provider 재구성. A/B 테스트가 가능하도록 세팅.

### 2. Deterministic Assertions (비용 Zero 채점) 비율 확대
- [x] `defaultTest`의 `llm-rubric: "응답 품질 기준..."`과 같은 광범위한 AI 채점을 삭제하거나 최소화.
- [x] Tool Calling 검증을 위해 응답이 유효한 JSON 포맷인지(`is-json`), 예상된 함수명(tool name)이 포함되었는지(`contains`) 등을 체크하는 결정론적 Assertions 도입.
- [x] Javascript function assert(`javascript`)를 활용하여 구조화된 응답(Structured Output)의 필수 필드 검증 스크립트 작성.

### 3. Golden Dataset 구성 (Micro Benchmark)
- [x] `tests` 블록의 케이스들을 런타임 에러가 자주 나던 엣지 케이스(예: 대용량 배열 응답, 모호한 쿼리, 오프도메인 등) 위주로 20~30건으로 개편.
- [x] 일반 채팅(NLQ)과 아티팩트(Reporter/Analyst) 생성을 분리하여 테스트 스위트화.

### 4. CI/로컬 스크립트 연동 문서화
- [x] `npm run prompt:eval` 시 발생하는 예상 토큰/비용 경고를 출력하도록 설정 보강 (가능한 경우).
- [x] 로컬에서 프롬프트 변경 전후 회귀(Regression)를 테스트하는 절차 문서화 (`docs/guides/ai/ai-standards.md` 참조).

### 5. Ragas & DeepEval 도입 타당성 추가 검토
- [x] **Ragas 검토**: 운영 매뉴얼 및 장애 대응 문서 기반의 RAG 파이프라인(VectorDB 검색 결과) 평가에 한하여 제한적 도입 가능성 검토. 정답 관련성, 문서 근거 충실도, 환각 여부 측정 용도.
- [x] **DeepEval 검토**: `deepeval test run`과 같이 Pytest 스타일로 테스트 자동화에 붙이기 용이하므로, AI Agent의 장애 원인 분석 정확도 및 Task Completion 정밀 평가 시나리오에 도입 가능한지 분석.
- [x] 위 두 프레임워크가 요구하는 LLM-as-a-Judge 평가 시, 프로젝트의 Free Tier 규칙을 훼손하지 않고 저비용 모델(예: Llama 3.1 8B 등)로 채점할 수 있는 아키텍처 연동 방안 마련.

Decision: Ragas/DeepEval은 이번 구현 범위에 도입하지 않는다. 두 프레임워크는 RAG faithfulness/task-completion 정밀 평가에 유용할 수 있지만, 기본 CI/로컬 smoke에 넣으면 LLM-as-a-Judge 호출과 Python dependency surface가 늘어난다. 현재 단계에서는 Promptfoo deterministic assertions + Vitest contract를 기본 gate로 두고, Ragas/DeepEval은 익명화된 production sample replay가 준비된 뒤 수동/야간 eval 후보로만 재검토한다.

## Success Criteria
- [x] `promptfooconfig.yaml`의 Assertions 중 `llm-rubric` 비중이 전체의 20% 미만으로 감소.
- [x] Tool Calling에 대한 정확한 스키마 검증 케이스가 최소 5개 이상 포함.
- [x] `npm run prompt:eval`이 실행 전 preflight를 통과하며, judge LLM 호출 없이 Free Tier 급격 과금 위험을 줄임. 실제 live provider eval은 수동 실행 대상이라 이번 검증에서 호출하지 않음.

## Completion Log

- `promptfooconfig.yaml`: `llm-rubric` 0건, deterministic assertion 37건, 25개 golden dataset case, test별 대상 prompt 명시로 예상 provider call `200 → 50`.
- `redteam/security-tests.yaml`: `llm-rubric` 0건, deterministic assertion 25건.
- `scripts/promptfoo/preflight.mjs`: live provider call estimate와 judge assertion ratio를 실행 전에 출력하고, `llm-rubric` 비율 20% 이상이면 차단.
- Verification: `src/lib/promptfoo-config-contract.test.ts`, AI Engine `type-check`, AI Engine full test, changed docs/lint checks.
