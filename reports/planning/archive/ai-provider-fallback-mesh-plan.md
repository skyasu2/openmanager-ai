> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-16
> Canonical: reports/planning/archive/ai-provider-fallback-mesh-plan.md
> Tags: ai, ai-engine, provider, fallback, free-tier, resilience, z-ai

# AI Provider Fallback Mesh Plan

- 상태: Completed
- 작성일: 2026-05-16
- TODO.md 연결: Recent Completed > AI Provider Fallback Mesh
- 기준: Free Tier 절대 원칙, 공식 provider 문서, 2026-05-16 로컬 계정 smoke

## 목표

현재 프로젝트의 LLM 호출 지점을 중앙 provider mesh로 정렬해 특정 provider가 rate limit, 장애, deprecation으로 마비되어도 AI Assistant 핵심 경로가 계속 동작하게 한다.

```text
Text mesh target:
  A: Groq     -> Z.AI     -> Mistral  -> Cerebras
  B: Z.AI     -> Mistral  -> Groq     -> Cerebras
  C: Mistral  -> Z.AI     -> Groq     -> Cerebras
  D: Cerebras -> Groq     -> Z.AI     -> Mistral

Vision mesh target:
  Gemini -> OpenRouter -> Z.AI Vision
```

## 현황 분석

| 호출 지점 | 현재 provider | 문제 |
|----------|---------------|------|
| AI Engine Supervisor single path | Groq -> Cerebras -> Mistral | Z.AI 미참여, Cerebras quota 정보 stale |
| Metrics Query/Analyst/Reporter/Advisor | Groq/Cerebras/Mistral | 3-provider chain이라 Groq/Cerebras 장애 시 Mistral 집중 |
| Orchestrator/stream summary/generate endpoint | Groq/Cerebras/Mistral | fallback order가 한 방향으로 수렴 |
| Vision Agent | Gemini -> OpenRouter | Gemini/OpenRouter 장애 시 vision fallback 없음 |
| Root NLQ entity extraction | Groq 단일 호출 + local fallback | 중앙 AI Engine provider mesh 밖의 경량 classifier |
| Root artifact intent classifier | Mistral 단일 호출 + deterministic fallback | production gate로 보호되지만 mesh 밖의 경량 classifier |

## 공식 문서 및 실측 요약

| Provider | 무료 사용 후보 | 공식/실측 근거 | 런타임 판단 |
|----------|----------------|----------------|-------------|
| Groq | `meta-llama/llama-4-scout-17b-16e-instruct` | 공식 rate-limit 문서 + 계정 header 30K TPM/1K 요청권 확인 | 빠른 primary 유지 |
| Z.AI | `glm-4.5-flash`, `glm-4.6v-flash` | 공식 pricing에서 Flash 모델 무료, chat completion은 function calling/structured output 지원 | text/vision fallback 추가, thinking disabled 패치 필수 |
| Mistral | `mistral-small-latest` | 계정 header 50 RPM/50K TPM 확인, tier별 제한은 workspace 의존 | last-resort가 아닌 일부 chain primary/secondary로 분산 |
| Cerebras | `llama3.1-8b` | 계정 header 5 RPM/150 RPH/2400 RPD/30K TPM/1M TPD, 2026-05-27 deprecation | 종료 전까지 유지하되 short-context/final fallback 중심 |
| Gemini | `gemini-2.5-flash-lite` | 공식 free tier 15 RPM/1K RPD | vision primary 유지 |
| OpenRouter | `*:free` vision fallback | 공식 free model request limit은 계정 credit 상태 의존 | vision fallback 유지, Z.AI Vision을 3순위로 추가 |

## 범위

- 포함:
  - AI Engine provider config/status/core/capability/quota/metadata에 `zai` 추가
  - agent runtime policy를 4-provider spider-web order로 재배치
  - retry/fallback chain과 quota-aware supervisor chain에 Z.AI 포함
  - Z.AI request body에 `thinking: { type: "disabled" }` 자동 주입
  - Vision fallback chain에 Z.AI `glm-4.6v-flash` 추가
  - provider UI metadata 갱신
- 제외:
  - SambaNova 재도입
  - 유료 Z.AI 모델, Z.AI Web Search, 유료 OpenRouter 모델 사용
  - Root Next.js 경량 classifier를 새 dependency로 확장하는 작업
  - Cloud Run/GCP/Vercel production env secret 동기화 및 재배포

## 계약 (Contract)

### 변경 대상 파일

- `cloud-run/ai-engine/src/lib/config-parser.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/model-provider-core.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/model-provider-status.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/model-provider.types.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/model-provider.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/provider-capabilities.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/provider-model-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/provider-model-metadata.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.ts`
- `cloud-run/ai-engine/src/services/resilience/quota-types.ts`
- `cloud-run/ai-engine/src/services/resilience/retry-provider-chain.ts`
- `cloud-run/ai-engine/src/services/resilience/retry-with-fallback.ts`
- `src/config/ai-providers.ts`

### 입출력 계약

| 함수/API | 입력 타입 | 출력 타입 | 에러/제외 케이스 |
|----------|-----------|-----------|------------------|
| `getZaiApiKey()` | env/`AI_PROVIDERS_CONFIG.zai` | `string | null` | 미설정이면 provider disabled |
| `getZaiModel()` | optional model id | `LanguageModel` | API key 미설정 또는 invalid model이면 throw 후 fallback |
| `getZaiVisionModel()` | optional model id | `LanguageModel` | Vision 3순위 실패 시 graceful null |
| `selectTextModel()` | `TextProvider[]` | `ModelResult | null` | capability mismatch, CB open, quota block 시 다음 provider |
| `generateTextWithRetry()` | provider order | retry result | 429/1302/1303/1305/error 시 fallback |
| `getVisionModel()` | 없음 | `ModelResult | null` | Gemini/OpenRouter 실패 시 Z.AI Vision 시도 |

### 테스트 시나리오

- [x] Z.AI가 provider status/toggle/capability에 포함된다.
- [x] Text provider selector가 Z.AI를 capability-satisfying fallback으로 선택한다.
- [x] Runtime policy가 A/B/C/D spider-web order를 보존한다.
- [x] Retry provider chain 기본 order에 Z.AI가 들어가고, unavailable provider는 다음 provider로 이동한다.
- [x] Vision chain이 Gemini -> OpenRouter -> Z.AI Vision 순서로 동작한다.
- [x] Quota metadata는 Cerebras 실측 limit과 Z.AI conservative guard를 반영한다.

## Task 목록

- [x] Task 0 — provider mesh failing tests 추가
- [x] Task 1 — Z.AI config/core/status/capability 연결
- [x] Task 2 — agent runtime/retry/quota chain spider-web 재배치
- [x] Task 3 — metadata/UI 설명 및 Free Tier guard 갱신
- [x] Task 4 — AI Engine/root 검증 및 live smoke 결과 보고

## 완료 기준

- [x] AI Engine `npm run type-check` 통과
- [x] AI Engine `npm run test` 통과
- [x] Root `npm run type-check`, `npm run lint`, `npm run test:quick`, `npm run test:contract` 통과
- [x] Docs checks 및 `git diff --check` 통과
- [x] Z.AI 무료 text/vision smoke 결과와 무료 사용 제한을 최종 보고에 명시
