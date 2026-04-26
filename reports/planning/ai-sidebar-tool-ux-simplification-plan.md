> Owner: project
> Status: Approved
> Last reviewed: 2026-04-26

# AI Sidebar Tool and UX Simplification Plan

## 1. 목적

AI 사이드바의 RAG, Web Search, Thinking, 파일 첨부, Reporter, Analyst 기능을
사용자 관점의 명확한 계약과 단순한 정보 구조로 정리한다.

목표는 기능을 많이 보여주는 것이 아니라, 면접관이나 신규 사용자가 봤을 때
"각 컨트롤이 무엇을 하고 실제로 동작한다"는 신뢰를 주는 표면을 만드는 것이다.

## 2. 현재 판단

### 2026-04-25 provider 비용/모델 재검증 반영

Codex의 provider 현황 분석을 현재 코드와 공식 pricing/rate-limit 문서 기준으로 재검증한 결과,
sidebar의 RAG/Web/Thinking UX 개선은 provider/model drift 방지와 함께 처리해야 한다.
이번 계획의 1차 구현은 **신규 provider 추가가 아니라 기존 provider 체인의 안전성 개선**이다.

| 항목 | 판단 | 계획 반영 |
|------|------|-----------|
| Groq Scout | `meta-llama/llama-4-scout-17b-16e-instruct`는 현재 text primary로 적합하지만 공식 문서상 Preview 모델이다. Free limit은 `30 RPM / 30K TPM / 1K RPD / 500K TPD`로 확인됐다. | primary는 유지하되 Preview 모델임을 metadata에 고정한다. 별도 text A/B 후보는 두지 않는다. |
| Cerebras Qwen | `qwen-3-235b-a22b-instruct-2507`는 Preview이며 Cerebras 문서상 `2026-05-27` deprecation 예정이다. | deprecated 전까지 Cerebras primary로 사용한다. `CEREBRAS_MODEL_ID` 기본값을 Qwen으로 설정한다. |
| Cerebras current fallback | `llama3.1-8b`는 chat completions, AI SDK tool calling, Orchestrator `generateObject` smoke가 통과한 production model이다. 공식 Free Tier는 `30 RPM / 900 RPH / 14.4K RPD / 1M TPD`다. | Qwen 실패/quota 초과 시 intra-Cerebras fallback으로만 사용한다. `2026-05-27` deprecation 예정이므로 추적한다. |
| Cerebras GPT-OSS | `gpt-oss-120b`는 Cerebras 무료 티어 모델 목록에 없고, 현재 키의 chat completions smoke도 404를 반환했다. | **제외** — 무료 티어 미포함으로 target upgrade 후보에서 제거한다. |
| Mistral | 현재 last-resort text fallback 및 embedding 용도가 맞다. 공식 문서는 free API tier를 평가/프로토타입용으로 설명하고, 실제 limit은 workspace별 확인을 요구한다. | fallback 유지. `mistral-large-2512`/`mistral-small-2603`는 paid opt-in 후보로만 기록하고 Free Tier production chain에는 넣지 않는다. |
| Gemini | runtime default `gemini-2.5-flash-lite`는 Vision primary로 적절하다. Free tier input/output 무료와 `15 RPM / 1,000 RPD`가 확인됐다. | Vision primary 유지. `gemini-3.1-flash-lite-preview`는 preview 실험 후보일 뿐 production default로 쓰지 않는다. |
| OpenRouter | vision fallback-only 구조가 적절하다. Free plan은 `50 req/day`, $10+ credit 이후 free model `1,000 req/day`로 제한된다. | fallback 유지. `openrouter/free`는 비결정성이 크므로 production default로 쓰지 않는다. |
| SambaNova | Free Tier `20 RPD / 200K TPD`와 live smoke API key 실패 때문에 운영 fallback 효율이 낮다. | runtime chain에서 제거한다. 추후 유료/Developer tier와 정상 키가 확보될 때만 별도 POC로 재검토한다. |
| Together AI | 공식 billing docs 기준 현재 free trial은 없고 최소 `$5` credit purchase가 필요하다. 기존 `$25` signup credit 전제는 현재 정책과 맞지 않는다. | Free Tier production default 후보에서 제외한다. 현재 코드 통합이 없으므로 삭제 작업은 필요 없다. |
| Tavily / Brave Search | Tavily는 1,000 credits/month 무료, Brave Search는 월 $5 credit 구조다. 둘 다 LLM provider가 아니라 search API다. | 현재 Tavily 중심 유지. Brave는 Tavily 장애/품질 한계가 증명될 때만 별도 POC로 검토한다. MCP 상시 추가는 하지 않는다. |

### 2026-04-25 live provider smoke 결과

등록된 로컬 키로 최소 토큰 live smoke를 1회 수행했다. 결과는 provider 설정 존재 여부가
실제 model entitlement/인증 성공을 보장하지 않는다는 점을 확인했다.

| Provider | 결과 | 후속 판단 |
|----------|------|-----------|
| Groq | 성공 (`meta-llama/llama-4-scout-17b-16e-instruct`, text 약 366ms, Orchestrator `generateObject` 약 1.3s) | 현재 text primary 유지. Orchestrator에서는 Cerebras 장애 시 2순위 structured fallback으로 사용. 단, 공식 Preview 모델이므로 metadata guard 유지. |
| Cerebras `gpt-oss-120b` | 실패 (`chat/completions` 404) | 무료 티어 모델 목록 미포함. target upgrade 후보에서 제거. |
| Cerebras `llama3.1-8b` | 성공 (direct 약 1.3s, tool calling 약 0.8s, Orchestrator `generateObject` 약 0.5s) | Qwen 실패/quota 초과 시 intra-Cerebras fallback으로 사용. |
| SambaNova | 실패 (API key 인증 실패) | Free Tier request budget도 낮아 runtime chain에서 제거. |
| Mistral | 성공 (`mistral-large-latest`, 약 741ms) | last-resort text fallback 유지. |
| Gemini | 성공 (`gemini-2.5-flash-lite`, 약 800ms) | Vision primary 유지. |
| OpenRouter | text-only smoke에서 빈 응답 | Vision 입력으로 별도 smoke 필요. fallback-only 유지. |
| Langfuse | 성공, test mode trace flush 확인 | AI observability SSOT로 유지. |
| Sentry | 로컬 API auth key 없음 | AI Engine 직접 관측 채널로 보지 않고 frontend/Vercel 관측 채널로만 취급. |

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
| P1 | Cerebras 기본 모델 deprecation 대응이 필요하다 | Qwen과 `llama3.1-8b` 모두 `2026-05-27` deprecated 예정이다. `gpt-oss-120b`는 무료 티어 미포함으로 제외됐다. | `CEREBRAS_MODEL_ID` 기본값을 Qwen으로 설정하고 intra-Cerebras Qwen → `llama3.1-8b` fallback을 구현한다. deprecation 이후 대체 모델 issue를 별도로 관리한다. |
| P1 | Orchestrator provider order는 text agent order와 다르다 | Orchestrator는 tool-heavy 답변 생성이 아니라 `generateObject` 기반 structured routing이다. `llama3.1-8b`와 Groq Scout 모두 구조화 라우팅 smoke가 통과했고, Mistral은 2 RPM 병목이 있다. | Groq-first로 바꾸지 않는다. Orchestrator는 `Cerebras → Groq → Mistral`, text agents는 `Groq → Cerebras → Mistral`로 역할별 체인을 분리한다. |
| P2 | provider/model drift가 UI 신뢰도를 떨어뜨릴 수 있다 | active docs/schema/test fixture에 `llama-3.3`, `gemini-2.0-flash`, OpenRouter `nemotron` 등 과거 모델명이 남아 있다. | active code/docs 기준 모델 allowlist와 deprecated model guard를 추가한다. |
| P2 | Cerebras context/capability 표기가 충돌한다 | `quota-tracker.ts`는 free context `8,192`, `config-parser.ts` 주석은 `65K`를 말한다. | provider metadata SSOT에서 context window와 long-context capability를 모델/계정 설정 기반으로 정리한다. |
| P3 | 시각 신호가 과하다 | icon rail의 gradient, emoji tooltip, pulse status, 여러 컬러 badge가 동시에 노출된다. | 컬러 수를 줄이고 상태 신호는 실제 engine/tool 상태에만 사용한다. |

## 3. 범위

### 포함

- RAG/Web/Thinking 토글의 실제 동작 계약 정리
- sidebar, fullscreen, async job 경로의 옵션 전달 일관성 확보
- sidebar 정보 구조 평가 및 축소안 설계
- 기존 provider의 모델/limit/context drift 방지
- Cerebras Qwen을 primary로 설정하고 intra-Cerebras Qwen → `llama3.1-8b` fallback 구현
- SambaNova는 Free Tier request budget과 live smoke 실패를 근거로 runtime chain에서 제거한다.
- active docs/schema/test fixture의 stale model reference 정리
- 현재 UI가 "잘 만든 제품"으로 보이는지에 대한 code-review 관점 평가 기준 추가
- 구현 전 failing test 목록 작성
- 필요 시 1회 이하의 targeted Vercel QA 계획

### 제외

- OpenAI/Anthropic/xAI/Together AI 등 추가 신규 provider 기본 runtime chain 편입
- OpenAI/Anthropic/xAI 같은 유료 API를 기본 runtime chain에 추가
- Brave Search를 Tavily와 병렬 production search provider로 즉시 추가
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
| Groq | text primary | `meta-llama/llama-4-scout-17b-16e-instruct` | `gemma2-9b-it`, `meta-llama/llama-4-maverick-*`, old `llama-3.3` primary 회귀, Scout를 production model로 오기 |
| Cerebras | structured routing + text fallback | primary `qwen-3-235b-a22b-instruct-2507`; intra fallback `llama3.1-8b`; `CEREBRAS_MODEL_ID` env override 유지 | `gpt-oss-120b` 사용 (무료 티어 미포함), deprecation 이후에도 Qwen/llama3.1-8b를 교체 없이 유지, context window 불명확 상태에서 long RAG prompt 강제 투입 |
| Orchestrator chain | structured routing only | `Cerebras → Groq → Mistral`; Cerebras/Groq는 `generateObject` smoke green, Mistral은 last resort | text agent chain과 기계적으로 동일화, Mistral을 Groq보다 먼저 시도, Groq를 routing primary로 승격 |
| Mistral | last-resort text fallback + embedding | `mistral-large-latest`, `mistral-embed`; paid opt-in 후보 `mistral-large-2512`, `mistral-small-2603` | primary 승격, 2 RPM을 공식 전역 limit처럼 문서화 |
| Gemini | vision primary | `gemini-2.5-flash-lite` | active code/docs에서 `gemini-2.0-*` 사용, preview 3.1 모델을 production default로 사용 |
| OpenRouter | vision fallback | `google/gemma-3-27b-it:free` 계열 fallback | `nvidia/nemotron-*` fallback 복귀, primary 승격, `openrouter/free` 비결정 라우터를 기본값으로 사용 |

### Search API decision contract

| Provider | 현재 역할 | 허용 정책 | 차단 기준 |
|----------|-----------|-----------|-----------|
| Tavily | Cloud Run web search tool | 1,000 credits/month 무료 한도 내에서 최신 외부 정보 검색에만 사용 | 모든 일반 질의에 기본 사용, 비용 guard 없이 advanced/crawl/extract 남발 |
| Brave Search | 후보 | Tavily 장애, 인덱스 품질 부족, 또는 Brave 고유 API가 필요한 경우 별도 POC | Tavily와 중복된 production 기본 provider로 즉시 추가 |
| Groq Compound Web Search | 후보 | Groq provider 내부 A/B 실험에서만 검토 | 기존 tool schema를 우회해 search source attribution 계약을 깨는 도입 |

Source links:
- Groq models/rate limits: `https://console.groq.com/docs/models`, `https://console.groq.com/docs/rate-limits`
- Cerebras models/rate limits/tooling: `https://inference-docs.cerebras.ai/models/overview`, `https://inference-docs.cerebras.ai/support/rate-limits`, `https://inference-docs.cerebras.ai/capabilities/tool-use`
- Mistral limits/models: `https://docs.mistral.ai/admin/user-management-finops/tier`, `https://docs.mistral.ai/models/model-cards/mistral-large-3-25-12`, `https://docs.mistral.ai/models/model-cards/mistral-small-4-0-26-03`
- Gemini pricing/quota: `https://ai.google.dev/gemini-api/docs/pricing`, `https://ai.google.dev/gemini-api/docs/rate-limits`
- OpenRouter limits/pricing: `https://openrouter.ai/docs/api/reference/limits`, `https://openrouter.ai/pricing`
- Tavily/Brave pricing: `https://docs.tavily.com/documentation/api-credits`, `https://api-dashboard.search.brave.com/documentation/pricing`

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

### Task 0 - SDD 착수 게이트

- [x] 기존 plan과 70% 이상 겹치는지 확인하고 신규 plan 생성을 피한다.
- [x] `Status: Approved` 전환 전까지 구현 파일을 수정하지 않는다.
- [x] 1차 범위는 선택지 A + provider/model drift guard + Cerebras model refresh POC로 확정한다.
- [ ] 구현 착수 전 failing test 커밋을 먼저 만든다.

비고: 위 failing-test-first 커밋 순서 항목은 이미 여러 후속 구현/수정 커밋이
진행된 뒤 발견된 역사적 SDD 순서 미준수 항목이다. 현재는 관련 회귀 테스트가
추가되어 있으므로 소급 완료 처리하지 않고, 다음 신규 기능/계약 변경 plan부터
적용한다.

### Task 1 - failing tests 먼저 추가

- [x] async job 생성 시 `enableRAG`, `enableWebSearch`, `analysisMode`가 함께 전달되는 테스트 추가
- [x] Cloud Run job process payload가 RAG/Web 옵션을 보존하는 테스트 추가
- [x] ChatInputArea가 `Thinking` 단독 라벨보다 `심층 분석` 의미를 보여주는 테스트 추가
- [x] RAG/Web badge가 enabled와 used를 혼동하지 않는 UI 테스트 추가
- [x] active code/docs에서 deprecated model id가 다시 들어오면 실패하는 guard 테스트 추가
- [x] provider metadata가 Groq/Gemini/Cerebras/Mistral/OpenRouter의 current role과 model id를 설명하는 테스트 추가
- [x] Cerebras primary를 Qwen으로 설정하고 intra-Cerebras Qwen → `llama3.1-8b` fallback 및 deprecation guard 테스트 추가 (`gpt-oss-120b` 무료 티어 미포함으로 제외)

예상 커밋:

```text
test(spec): ai sidebar tool contract add failing tests
```

### Task 2 - provider drift guard 및 model refresh POC

- [x] active docs/schema/test fixture의 stale model reference를 current routing 기준으로 갱신
- [x] provider metadata SSOT에 `modelId`, `role`, `limits`, `contextWindow`, `preview`, `sourceUrl`을 정의
- [x] Cerebras metadata에 `productionModel`, `preview`, `deprecationDate`를 명시하고 Qwen 기본값 장기 유지 방지
- [x] SambaNova는 `20 RPD / 200K TPD`와 live smoke 실패를 근거로 runtime chain에서 제거
- [x] `CEREBRAS_MODEL_ID=llama3.1-8b` 경로에서 direct/tool-calling smoke 통과 확인
- [x] Orchestrator structured routing은 `Cerebras → Groq → Mistral`로 정렬하고, Cerebras/Groq `generateObject` smoke 통과 확인
- [x] Cerebras `supportsLongContext`를 Qwen account/model 설정 기반으로 보수화
- [x] 긴 RAG prompt는 Qwen context safety threshold를 넘으면 skip하도록 설계
- [x] OpenAI/Anthropic/xAI/Together AI/Brave는 이번 runtime chain에 추가하지 않는 명시적 decision record를 남김

2026-04-26 진행:
- `provider-capabilities`가 Cerebras provider 전체가 아니라 Qwen/`llama3.1-8b` model policy의 `contextWindowTokens`를 기준으로 long-context capability를 계산하도록 보수화했다.
- `CEREBRAS_LONG_CONTEXT_ENABLED=false` 운영 kill switch를 추가했다.
- long prompt context가 short-context fallback 한도를 넘으면 retry path에서 `minContextTokens` capability check로 `llama3.1-8b`를 건너뛰도록 고정했다.

예상 커밋:

```text
fix: guard ai provider model drift
```

### Task 3 - RAG/Web option propagation 구현

- [x] `useAsyncAIQuery`와 `useQueryExecution`에서 tool options 전달
- [x] `/api/ai/jobs` 요청 schema와 job payload 확장
- [x] Cloud Run `jobs/process` 처리 경로에서 supervisor/orchestrator까지 options 전달
- [x] 기존 streaming 경로와 동일한 의미를 유지

예상 커밋:

```text
feat: align ai sidebar tool options across async jobs
```

### Task 4 - RAG/Web/Thinking copy와 상태 정리

- [x] `Thinking` UI를 `심층 분석` 중심으로 변경하고 보조 설명 추가
- [x] RAG 설명을 "과거 장애 이력"보다 넓은 "내부 운영 지식/장애 이력"으로 정리
- [x] Web 설명을 "최신 외부 정보"로 정리
- [x] 입력 허용 badge와 답변 근거의 RAG/Web 사용 badge를 분리
- [x] 답변 metadata에서 used/suppressed/unavailable 표시 가능성 검토

예상 커밋:

```text
fix: clarify ai sidebar tool mode semantics
```

### Task 5 - sidebar 시각/정보 구조 단순화

- [x] icon rail에서 장식용 gradient/pulse/emoji tooltip 축소
- [x] 실제 engine/tool 상태와 무관한 "AI 활성" 신호 제거 또는 의미 재정의
- [x] 모바일에서 기능 전환과 채팅 입력이 충돌하지 않는지 확인
- [x] 선택지 B가 필요하면 별도 plan으로 승격

2026-04-25 진행:
- `AIAssistantIconPanel`의 선택 상태를 gradient/color rail에서 단색 border 기반 navigation state로 단순화
- 기능 tooltip의 emoji와 과장된 표현을 제거하고 clear text 설명으로 정리
- 실제 Cloud Run/AI Engine 상태 확인과 무관한 `AI 활성` pulse 표시 제거
- icon-only 버튼에 `aria-label`/`aria-pressed`를 추가해 기능 전환 접근성 보강

2026-04-26 진행:
- 모바일 기능 전환 패널을 chat/non-chat 공통 상단 영역으로 이동해 chat 입력 하단과 겹치지 않게 했다.
- 모바일 chat 화면에서도 Reporter/Analyst 진입점이 유지되도록 `AISidebarV4` 회귀 테스트를 추가했다.
- 선택지 B(Chat-first sidebar 재구조화)는 현재 범위에서 승격하지 않는다. 공통 상단 nav와 fullscreen handoff로 기본 행동이 충분히 명확하므로, production QA에서 여전히 조잡하다는 증거가 나올 때만 별도 plan으로 분리한다.

예상 커밋:

```text
refactor: simplify ai sidebar feature navigation
```

### Task 6 - sidebar/fullscreen 중복 배선 축소

- [x] `AISidebarV4`와 `AIWorkspace`의 chat prop bundle 중복을 추출
- [x] selected function/entry state/fullscreen handoff 책임 경계를 문서화
- [x] 파일 첨부, RAG/Web/Thinking toggle props가 한 곳에서 정의되도록 정리

2026-04-26 진행:
- `useAIChatSurface`를 추가해 `AISidebarV4`와 `AIWorkspace`의 selected function, RAG/Web/analysis toggle, pending entry/prefill store 구독을 한 곳으로 묶었다.
- 책임 경계: `useAIChatSurface`는 selected function/tool toggle/pending entry state를 소유한다. `useAIEntryController`는 sidebar/fullscreen open handoff를 소유한다. `AISidebarV4`는 resizable/mobile close UX, `AIWorkspace`는 fullscreen shell/right panel/router 책임만 가진다.

예상 커밋:

```text
refactor: extract shared ai chat surface contract
```

### Task 7 - 검증

- [x] `npx vitest run src/components/ai/AIAssistantIconPanel.test.tsx src/components/ai-sidebar/AISidebarV4.test.tsx src/components/ai/AIWorkspace.test.tsx`
- [x] `npx vitest run src/hooks/ai/useAsyncAIQuery.test.ts src/hooks/ai/core/useQueryExecution.test.ts`
- [x] `cd cloud-run/ai-engine && npx vitest run src/services/ai-sdk/supervisor-routing.test.ts src/services/ai-sdk/agents/orchestrator-web-search.test.ts`
- [x] provider drift guard 관련 unit test 실행
- [x] `npm run type-check`
- [x] `npm run lint:changed`
- [x] `bash scripts/dev/biome-wrapper.sh check src/components/ai/AIAssistantIconPanel.tsx src/components/ai/AIAssistantIconPanel.test.tsx`
- [x] `npm run lint`
- [x] 필요 시 `npm run test:quick`

### Task 8 - targeted QA

- [x] 로컬 계약 검증이 통과한 뒤에만 Vercel QA 실행 여부를 결정한다.
- [x] Vercel QA는 비용/사용량을 고려해 다음 release/tag 배포 후 단일 smoke run으로 제한한다.
- [x] 대상은 sidebar chat: 기본 질의, RAG ON, Web ON, 심층 분석 ON, fullscreen 전환으로 고정한다.
- [x] 실행 시 `reports/qa`에 `qa:record`로 남기고 `qa:evidence:audit` 확인한다.

2026-04-26 결정:
- 이번 잔여 변경은 backend routing/capability guard, tests, docs/env 문서와 모바일 sidebar 기능 전환 보강 중심이다.
- 따라서 Vercel/Playwright QA는 현재 미배포 로컬 변경에 대해 반복 실행하지 않고, 다음 release/tag 배포 후 단일 smoke로 제한한다.

2026-04-26 추가 리뷰 후속:
- `useAIChatSurface`의 Web/RAG 토글을 함수형 store update로 바꿔 연속 클릭 race 가능성을 줄였다.
- `AISidebarV4` 모바일 기능 전환은 chat/non-chat 공통 상단 영역에 고정하고, 콘텐츠 영역은 `min-h-0 flex-1`로 분리해 입력창과 높이 충돌하지 않도록 했다.

## 8. 완료 조건

- [x] RAG/Web/Thinking 옵션이 streaming과 async job 경로에서 동일하게 해석된다.
- [x] UI가 enabled와 actually used를 혼동하지 않는다.
- [x] active code/docs/schema에서 deprecated provider model id가 제거되고 guard된다.
- [x] Cerebras Qwen preview/deprecation 리스크가 metadata와 test로 차단되고, `gpt-oss-120b`는 무료 티어 미포함으로 runtime 후보에서 제외된다.
- [x] Cerebras context/capability 정책이 하나의 metadata 기준으로 설명된다.
- [x] 기본 sidebar에서 핵심 행동이 chat-first로 보인다.
- [x] `AISidebarV4`와 `AIWorkspace`의 중복 배선이 감소한다.
- [x] 로컬 검증이 통과한다.
- [x] production QA는 현재 미배포 로컬 변경에는 반복 실행하지 않고, 다음 release/tag 배포 후 tracker/evidence audit까지 단일 smoke로 수행한다.

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
