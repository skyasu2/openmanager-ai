# Promptfoo Evaluation & Golden Dataset Hardening Plan

**Owner**: project
**Status**: Draft
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

## Task Breakdown

### 1. `promptfooconfig.yaml` 리팩터링 및 모델 정렬
- [ ] 현재 `providers`에 등록된 `groq:llama-3.3-70b-versatile` 및 `gemini-2.5-flash` 구성을 실제 AI Engine 런타임(Cerebras `llama3.1-8b`, Groq, Mistral fallback)과 비교/정렬.
- [ ] 비용 검증용 로컬 모델 또는 극저비용 모델(예: API 키가 세팅된 무료 티어 내 모델)로 Provider 재구성. A/B 테스트가 가능하도록 세팅.

### 2. Deterministic Assertions (비용 Zero 채점) 비율 확대
- [ ] `defaultTest`의 `llm-rubric: "응답 품질 기준..."`과 같은 광범위한 AI 채점을 삭제하거나 최소화.
- [ ] Tool Calling 검증을 위해 응답이 유효한 JSON 포맷인지(`is-json`), 예상된 함수명(tool name)이 포함되었는지(`contains`) 등을 체크하는 결정론적 Assertions 도입.
- [ ] Javascript function assert(`javascript`)를 활용하여 구조화된 응답(Structured Output)의 필수 필드 검증 스크립트 작성.

### 3. Golden Dataset 구성 (Micro Benchmark)
- [ ] `tests` 블록의 케이스들을 런타임 에러가 자주 나던 엣지 케이스(예: 대용량 배열 응답, 모호한 쿼리, 오프도메인 등) 위주로 20~30건으로 개편.
- [ ] 일반 채팅(NLQ)과 아티팩트(Reporter/Analyst) 생성을 분리하여 테스트 스위트화.

### 4. CI/로컬 스크립트 연동 문서화
- [ ] `npm run prompt:eval` 시 발생하는 예상 토큰/비용 경고를 출력하도록 설정 보강 (가능한 경우).
- [ ] 로컬에서 프롬프트 변경 전후 회귀(Regression)를 테스트하는 절차 문서화 (`docs/guides/ai/ai-standards.md` 참조).

### 5. Ragas & DeepEval 도입 타당성 추가 검토
- [ ] **Ragas 검토**: 운영 매뉴얼 및 장애 대응 문서 기반의 RAG 파이프라인(VectorDB 검색 결과) 평가에 한하여 제한적 도입 가능성 검토. 정답 관련성, 문서 근거 충실도, 환각 여부 측정 용도.
- [ ] **DeepEval 검토**: `deepeval test run`과 같이 Pytest 스타일로 테스트 자동화에 붙이기 용이하므로, AI Agent의 장애 원인 분석 정확도 및 Task Completion 정밀 평가 시나리오에 도입 가능한지 분석.
- [ ] 위 두 프레임워크가 요구하는 LLM-as-a-Judge 평가 시, 프로젝트의 Free Tier 규칙을 훼손하지 않고 저비용 모델(예: Llama 3.1 8B 등)로 채점할 수 있는 아키텍처 연동 방안 마련.

## Success Criteria
- [ ] `promptfooconfig.yaml`의 Assertions 중 `llm-rubric` 비중이 전체의 20% 미만으로 감소.
- [ ] Tool Calling에 대한 정확한 스키마 검증 케이스가 최소 5개 이상 포함.
- [ ] `npm run prompt:eval`이 로컬에서 정상 구동되며, Free Tier 계정의 급격한 과금을 유발하지 않음.