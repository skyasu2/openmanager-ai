> Owner: project
> Status: Draft
> Last reviewed: 2026-04-24

# AI Sidebar Tool and UX Simplification Plan

## 1. 목적

AI 사이드바의 RAG, Web Search, Thinking, 파일 첨부, Reporter, Analyst 기능을
사용자 관점의 명확한 계약과 단순한 정보 구조로 정리한다.

목표는 기능을 많이 보여주는 것이 아니라, 면접관이나 신규 사용자가 봤을 때
"각 컨트롤이 무엇을 하고 실제로 동작한다"는 신뢰를 주는 표면을 만드는 것이다.

## 2. 현재 판단

### 2026-04-24 provider 교차검증 반영

Claude Code의 provider 현황 분석을 공식 문서와 현재 코드 기준으로 교차검증한 결과,
sidebar의 RAG/Web/Thinking UX 개선은 provider/model drift 방지와 함께 처리해야 한다.

| 항목 | 판단 | 계획 반영 |
|------|------|-----------|
| Groq Scout | `meta-llama/llama-4-scout-17b-16e-instruct` primary 유지가 적절하다. 공식 free limit은 `30 RPM / 30K TPM / 1K RPD / 500K TPD`로 확인됐다. | 현재 primary 유지. deprecated 후보인 Groq Gemma2/Maverick은 추가하지 않는다. |
| Cerebras Qwen | `qwen-3-235b-a22b-instruct-2507`는 Preview 모델이며 account entitlement와 context 제한이 달라질 수 있다. | context/quota/capability를 provider metadata로 고정하고, 긴 RAG prompt에서는 안전하게 skip하는 계약을 추가한다. |
| Mistral | 프로젝트는 last-resort text fallback 및 embedding 용도로 쓰는 것이 맞다. 공식 문서는 workspace별 limits 확인을 요구하므로 `2 RPM`은 전역 사실이 아니라 보수적 로컬 설정으로 취급한다. | fallback 유지. limits는 실제 응답 header/계정 limits 확인 기반으로 갱신한다. |
| Gemini | runtime default는 `gemini-2.5-flash-lite`로 적절하다. active code에는 `gemini-2.0-flash-lite` 기본값이 없지만 stale doc에는 `gemini-2.0-flash`가 남아 있다. | active docs/schema에서 2.0 계열 잔류를 제거하고 guard 테스트를 추가한다. |
| OpenRouter | vision fallback-only 구조가 적절하다. free model availability와 50/1000 RPD 정책은 변동 가능성이 크다. | fallback 유지. primary 경로로 승격하지 않는다. |
| SambaNova | 무료/개발 tier 후보로 검토 가능하지만 Preview/limit/SDK 검증 없이 production fallback에 넣으면 provider sprawl이 된다. | 이번 계획 범위에서는 제외하고, 필요 시 별도 POC plan으로 분리한다. |

### 잘 유지할 부분

| 영역 | 판단 | 근거 |
|------|------|------|
| 공통 채팅 코어 | 유지 | `useAIChatCore`가 sidebar/fullscreen의 공통 상태를 제공한다. |
| lazy feature mount | 유지 | `AIContentArea`가 Reporter/Analyst를 필요 시 lazy load하고 Activity로 상태를 보존한다. |
| 파일 첨부 UX | 유지 후 문구 정리 | 이미지/PDF/MD 입력과 preview/remove 흐름이 이미 구분되어 있다. |
| 분석 근거 표시 | 유지 | RAG badge, web source card, analysis basis가 답변 신뢰도를 높인다. |

### 개선 필요 리스크

| 우선순위 | 리스크 | 현재 증거 | 개선 방향 |
|----------|--------|-----------|-----------|
| P1 | Job Queue 경로에서 RAG/Web 토글 계약이 약하다 | Streaming 경로는 `enableRAG`, `enableWebSearch`, `analysisMode`를 전달하지만 async job 경로는 `analysisMode` 중심이다. | async job create/process 계약에 RAG/Web 옵션을 명시 전달하고 테스트로 고정한다. |
| P2 | Thinking 라벨이 provider-native reasoning처럼 보일 수 있다 | UI는 `Thinking`, backend는 app-level `analysisMode='thinking'` 기반 라우팅/심층 분석이다. | 라벨을 `심층 분석` 중심으로 정리하고 tooltip에서 "더 긴 분석 경로"임을 설명한다. |
| P2 | RAG/Web이 "켜짐"과 "실제로 사용됨"을 구분하지 못한다 | 입력 영역 badge는 enabled만 보여주고, 답변 이후 used/suppressed/unavailable 상태가 분리되어 있지 않다. | enabled, used, suppressed, unavailable 상태를 UI/metadata로 분리한다. |
| P2 | 사이드바 표면에 기능이 많아 조잡해 보일 수 있다 | Chat, Reporter, Analyst, fullscreen, RAG, Web, Thinking, file attach, analysis basis가 한 표면에 있다. | 기본은 chat-first로 두고 고급 기능은 명확한 2차 액션 또는 fullscreen workspace로 분리한다. |
| P2 | sidebar와 fullscreen 배선 중복 | `AISidebarV4`와 `AIWorkspace`가 selected function, chat props, toggle props를 각각 배선한다. | 공통 `AIChatSurface`/adapter로 chat prop bundle을 만든다. |
| P2 | provider/model drift가 UI 신뢰도를 떨어뜨릴 수 있다 | active docs/schema/test fixture에 `llama-3.3`, `gemini-2.0-flash`, OpenRouter `nemotron` 등 과거 모델명이 남아 있다. | active code/docs 기준 모델 allowlist와 deprecated model guard를 추가한다. |
| P2 | Cerebras context/capability 표기가 충돌한다 | `quota-tracker.ts`는 free context `8,192`, `config-parser.ts` 주석은 `65K`를 말한다. | provider metadata SSOT에서 context window와 long-context capability를 모델/계정 설정 기반으로 정리한다. |
| P3 | 시각 신호가 과하다 | icon rail의 gradient, emoji tooltip, pulse status, 여러 컬러 badge가 동시에 노출된다. | 컬러 수를 줄이고 상태 신호는 실제 engine/tool 상태에만 사용한다. |

## 3. 범위

### 포함

- RAG/Web/Thinking 토글의 실제 동작 계약 정리
- sidebar, fullscreen, async job 경로의 옵션 전달 일관성 확보
- sidebar 정보 구조 평가 및 축소안 설계
- 기존 provider의 모델/limit/context drift 방지
- active docs/schema/test fixture의 stale model reference 정리
- 현재 UI가 "잘 만든 제품"으로 보이는지에 대한 code-review 관점 평가 기준 추가
- 구현 전 failing test 목록 작성
- 필요 시 1회 이하의 targeted Vercel QA 계획

### 제외

- 신규 AI provider 추가
- SambaNova 등 신규 provider production fallback 편입
- RAG 지식베이스 자체 확장
- Reporter/Analyst 기능 삭제
- 전면 디자인 리브랜딩
- Draft 단계에서 production LLM/Playwright 반복 QA 수행

## 4. 기준 계약

### Tool option contract

| 옵션 | 의미 | 기대 동작 |
|------|------|-----------|
| `enableRAG` | 내부 지식베이스 검색 허용 | knowledge base/incident/best practice 문맥이 필요한 경우만 사용한다. |
| `enableWebSearch` | 외부 최신 정보 검색 허용 | CVE, 최신 문서, 릴리스, 외부 장애 정보처럼 최신성이 필요한 경우만 사용한다. |
| `analysisMode='thinking'` | 심층 분석 경로 선호 | provider-native hidden reasoning이 아니라 더 긴 분석/라우팅/async 처리 경로를 의미한다. |
| 파일 첨부 | 사용자 제공 파일/이미지 분석 | 첨부 파일이 있을 때는 파일 근거를 우선 표시하고 RAG/Web과 구분한다. |

### UI status contract

| 상태 | 표시 의미 |
|------|-----------|
| `enabled` | 사용자가 해당 도구 사용을 허용했다. |
| `used` | 이번 답변에서 실제로 사용됐다. |
| `suppressed` | warmup, 비용, 쿼리 성격, 비활성 환경 때문에 의도적으로 사용하지 않았다. |
| `unavailable` | API key, provider, backend 상태 때문에 사용할 수 없다. |

### Provider drift contract

| Provider | 현재 역할 | 허용 모델/정책 | 차단 기준 |
|----------|-----------|----------------|-----------|
| Groq | text primary | `meta-llama/llama-4-scout-17b-16e-instruct` | `gemma2-9b-it`, `meta-llama/llama-4-maverick-*`, old `llama-3.3` primary 회귀 |
| Cerebras | structured routing + opt-in text fallback | `CEREBRAS_MODEL_ID` env override, default `qwen-3-235b-a22b-instruct-2507` | context window 불명확 상태에서 long RAG prompt 강제 투입 |
| Mistral | last-resort text fallback + embedding | `mistral-large-latest`, `mistral-embed` | primary 승격, 2 RPM을 공식 전역 limit처럼 문서화 |
| Gemini | vision primary | `gemini-2.5-flash-lite` | active code/docs에서 `gemini-2.0-*` 사용 |
| OpenRouter | vision fallback | `google/gemma-3-27b-it:free` 계열 fallback | `nvidia/nemotron-*` fallback 복귀, primary 승격 |

Source links:
- Groq rate limits/deprecations: `https://console.groq.com/docs/rate-limits`, `https://console.groq.com/docs/deprecations`
- Cerebras models/rate limits: `https://inference-docs.cerebras.ai/models/overview`, `https://inference-docs.cerebras.ai/support/rate-limits`
- Mistral limits: `https://docs.mistral.ai/admin/user-management-finops/tier`
- Gemini quota/deprecations: `https://ai.google.dev/gemini-api/docs/quota`
- OpenRouter FAQ/routing: `https://openrouter.ai/docs/faq`, `https://openrouter.ai/docs/features/provider-routing`
- SambaNova rate limits: `https://docs.sambanova.ai/cloud/docs/models/rate-limits`

## 5. UI/UX 평가 기준

다음 기준 중 하나라도 실패하면 "기능은 많은데 조잡해 보이는" 상태로 판단한다.

| 기준 | 합격 기준 |
|------|-----------|
| One sentence test | 사이드바 목적을 "서버 운영 질문을 묻고 근거 있는 답을 받는 공간"으로 한 문장 설명 가능 |
| Ghost control test | 켠 토글은 request path에서 실제 옵션으로 전달되거나, 미사용 사유가 노출됨 |
| Primary action test | 처음 보는 사용자가 5초 안에 입력창과 전송 버튼을 찾음 |
| Feature density test | 기본 sidebar에서 핵심 행동은 chat, attach, tool options, fullscreen 정도로 제한 |
| Visual hierarchy test | status color는 실제 상태 의미가 있을 때만 사용하고 장식용 gradient/pulse는 줄임 |
| Interviewer test | "기능 나열"보다 "계약, 근거, 비용 제어가 명확하다"는 인상을 줌 |

## 6. 설계 선택지

### 선택지 A - 보수적 정리

- 현재 Chat/Reporter/Analyst 3개 기능은 유지한다.
- icon rail의 색상/tooltip/status 표현을 단순화한다.
- RAG/Web/Thinking 문구와 상태 표시만 개선한다.
- 구현 비용이 낮고 회귀 위험이 작다.

### 선택지 B - Chat-first sidebar

- sidebar 기본 표면은 Chat 중심으로 둔다.
- Reporter/Analyst는 "고급 분석" 그룹 또는 fullscreen workspace에서 강조한다.
- 작은 sidebar 안에서 기능이 많아 보이는 문제를 더 강하게 줄인다.
- IA 변경이므로 사용자 동선 회귀 테스트가 더 필요하다.

### 권장 초안

1차 구현은 선택지 A로 계약과 문구를 먼저 안정화한다.
이후 실제 QA/리뷰에서 여전히 조잡해 보이면 선택지 B를 별도 승인 작업으로 분리한다.

## 7. SDD 진행 계획

### Task 0 - 검토 게이트

- [ ] 이 Draft 계획서를 Claude Code/Gemini CLI 검토에 전달한다.
- [ ] `Status: Approved` 전환 전까지 구현 파일을 수정하지 않는다.
- [ ] 선택지 A/B 중 1차 범위를 확정한다.

### Task 1 - failing tests 먼저 추가

- [ ] async job 생성 시 `enableRAG`, `enableWebSearch`, `analysisMode`가 함께 전달되는 테스트 추가
- [ ] Cloud Run job process payload가 RAG/Web 옵션을 보존하는 테스트 추가
- [ ] ChatInputArea가 `Thinking` 단독 라벨보다 `심층 분석` 의미를 보여주는 테스트 추가
- [ ] RAG/Web badge가 enabled와 used를 혼동하지 않는 UI 테스트 추가
- [ ] active code/docs에서 deprecated model id가 다시 들어오면 실패하는 guard 테스트 추가
- [ ] provider metadata가 Groq/Gemini/Cerebras/Mistral/OpenRouter의 current role과 model id를 설명하는 테스트 추가

예상 커밋:

```text
test(spec): ai sidebar tool contract add failing tests
```

### Task 2 - provider drift guard 및 metadata 정리

- [ ] active docs/schema/test fixture의 stale model reference를 current routing 기준으로 갱신
- [ ] provider metadata SSOT에 `modelId`, `role`, `limits`, `contextWindow`, `preview`, `sourceUrl`을 정의
- [ ] Cerebras `supportsLongContext`를 account/model 설정 기반으로 보수화
- [ ] 긴 RAG prompt는 Cerebras context safety threshold를 넘으면 skip하도록 설계
- [ ] SambaNova는 이번 runtime chain에 추가하지 않는 명시적 decision record를 남김

예상 커밋:

```text
fix: guard ai provider model drift
```

### Task 3 - RAG/Web option propagation 구현

- [ ] `useAsyncAIQuery`와 `useQueryExecution`에서 tool options 전달
- [ ] `/api/ai/jobs` 요청 schema와 job payload 확장
- [ ] Cloud Run `jobs/process` 처리 경로에서 supervisor/orchestrator까지 options 전달
- [ ] 기존 streaming 경로와 동일한 의미를 유지

예상 커밋:

```text
feat: align ai sidebar tool options across async jobs
```

### Task 4 - RAG/Web/Thinking copy와 상태 정리

- [ ] `Thinking` UI를 `심층 분석` 중심으로 변경하고 보조 설명 추가
- [ ] RAG 설명을 "과거 장애 이력"보다 넓은 "내부 운영 지식/장애 이력"으로 정리
- [ ] Web 설명을 "최신 외부 정보"로 정리
- [ ] 답변 metadata에서 used/suppressed/unavailable 표시 가능성 검토

예상 커밋:

```text
fix: clarify ai sidebar tool mode semantics
```

### Task 5 - sidebar 시각/정보 구조 단순화

- [ ] icon rail에서 장식용 gradient/pulse/emoji tooltip 축소
- [ ] 실제 engine/tool 상태와 무관한 "AI 활성" 신호 제거 또는 의미 재정의
- [ ] 모바일에서 기능 전환과 채팅 입력이 충돌하지 않는지 확인
- [ ] 선택지 B가 필요하면 별도 plan으로 승격

예상 커밋:

```text
refactor: simplify ai sidebar feature navigation
```

### Task 6 - sidebar/fullscreen 중복 배선 축소

- [ ] `AISidebarV4`와 `AIWorkspace`의 chat prop bundle 중복을 추출
- [ ] selected function/entry state/fullscreen handoff 책임 경계를 문서화
- [ ] 파일 첨부, RAG/Web/Thinking toggle props가 한 곳에서 정의되도록 정리

예상 커밋:

```text
refactor: extract shared ai chat surface contract
```

### Task 7 - 검증

- [ ] `npx vitest run src/components/ai-sidebar/ChatInputArea.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx src/components/ai/AIWorkspace.test.tsx`
- [ ] `npx vitest run src/hooks/ai/useAsyncAIQuery.test.ts src/hooks/ai/core/useQueryExecution.test.ts`
- [ ] `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts`
- [ ] provider drift guard 관련 unit test 실행
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] 필요 시 `npm run test:quick`

### Task 8 - targeted QA

- [ ] 로컬 계약 검증이 통과한 뒤에만 Vercel QA 실행 여부를 결정한다.
- [ ] Vercel QA는 비용/사용량을 고려해 단일 smoke run으로 제한한다.
- [ ] 대상은 sidebar chat: 기본 질의, RAG ON, Web ON, 심층 분석 ON, fullscreen 전환이다.
- [ ] 실행 시 `reports/qa`에 `qa:record`로 남기고 `qa:evidence:audit` 확인.

## 8. 완료 조건

- [ ] RAG/Web/Thinking 옵션이 streaming과 async job 경로에서 동일하게 해석된다.
- [ ] UI가 enabled와 actually used를 혼동하지 않는다.
- [ ] active code/docs/schema에서 deprecated provider model id가 제거되고 guard된다.
- [ ] Cerebras context/capability 정책이 하나의 metadata 기준으로 설명된다.
- [ ] 기본 sidebar에서 핵심 행동이 chat-first로 보인다.
- [ ] `AISidebarV4`와 `AIWorkspace`의 중복 배선이 감소한다.
- [ ] 로컬 검증이 통과한다.
- [ ] production QA를 수행했다면 QA tracker와 evidence audit가 clean 또는 accepted 상태다.

## 9. 검토 질문

다른 AI 검토자는 아래 질문에 답한다.

| 질문 | 선택지 |
|------|--------|
| 1차 범위는 선택지 A로 충분한가? | A 유지 / B로 확대 |
| Thinking 라벨은 `심층 분석`으로 바꾸는 것이 적절한가? | 변경 / 유지 / 병기 |
| RAG/Web used 상태는 답변 metadata 기반으로 표시할 수 있는가? | 즉시 구현 / 후속 작업 |
| Reporter/Analyst는 sidebar에 계속 1급 기능으로 둘 것인가? | 유지 / fullscreen 중심 |
| Vercel QA는 구현 후 1회 smoke로 충분한가? | 충분 / 추가 필요 |
| provider drift guard를 이번 1차 범위에 포함할 것인가? | 포함 / 별도 plan |
| Cerebras long-context capability는 free-tier 기준 보수값으로 둘 것인가? | 보수값 / env 기반 override |
