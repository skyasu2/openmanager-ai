# AI QA Model Performance Assessment 2026-05-05

> Owner: project
> Status: Active
> Doc type: Assessment
> Last reviewed: 2026-05-16
> Tags: ai,qa,benchmark,model-performance,provider

## Purpose

This report evaluates whether recent OpenManager AI QA answers match the expected performance of the currently assigned runtime models, and where the system roughly sits compared with common GPT-class expectations.

This is not a formal OpenAI/GPT benchmark. The repo has not run the same QA prompt set against GPT models. Any GPT comparison below is a qualitative positioning statement based on:

- current provider/model assignment in code,
- official provider capability docs,
- recorded production QA answer evidence,
- deterministic local benchmarks and contract tests.

## Current Runtime Model Tier

| Runtime path | Current model path | Raw model-tier expectation | Notes |
|--------------|-------------------|----------------------------|-------|
| Supervisor / NLQ / Orchestrator / Metrics Query | Groq `meta-llama/llama-4-scout-17b-16e-instruct` -> Z.AI `glm-4.5-flash` -> Mistral `mistral-small-latest` -> Cerebras `llama3.1-8b` | fast mid/high open-model tier, strong tool/JSON/long-context behavior, not frontier reasoning tier | Groq primary, Cerebras is short-context last fallback |
| Analyst / Verifier | Mistral `mistral-small-latest` -> Groq -> Z.AI -> Cerebras | long-context RCA path with 32K capability floor | Avoids prior phantom Cerebras primary: 8K Cerebras cannot satisfy `minContextTokens: 32_000` |
| Reporter | Z.AI `glm-4.5-flash` -> Mistral -> Groq -> Cerebras | long-context report/timeline generation | Z.AI primary retained, loop ceiling reduced to protect conservative 5 RPM guard |
| Advisor | Mistral `mistral-small-latest` -> Z.AI -> Groq -> Cerebras | KB/command guidance path | 3-step ceiling keeps short guidance cheap |
| Vision | Gemini `gemini-2.5-flash-lite` -> OpenRouter `gemma-3-27b-it:free` -> Z.AI `glm-4.6v-flash` | efficient multimodal/long-context tier, optimized for latency/cost rather than top frontier reasoning | Vision-only path, OpenRouter / Z.AI fallback 추가 |
| Deterministic evaluator/optimizer/fact pack | no LLM required | should exceed raw LLM reliability for metric/ranking/fact boundaries | Used to keep metric truth outside model memory |

### Model Benchmarks & Capability Profile (Updated 2026-05-16)

공식 문서와 현재 계정 smoke/header 기록을 바탕으로 현재 무료 API 모델들의 역할 적합성을 요약합니다. 성능 수치보다 운영상 더 중요한 제약은 RPM/RPD, context window, deprecation date입니다.

| 제공자 (Provider) | 모델 (Model ID) | 파라미터 / 아키텍처 | 주요 벤치마크 점수 | 현재 역할 (Role) | 역할 적절성 평가 |
|-----------------|-----------------|-------------------|----------------|----------------|----------------|
| **Groq** | `meta-llama/llama-4-scout-17b-16e-instruct` | 109B (17B active) MoE | MMLU: 79.6%, MMLU-Pro: 58.2%, MATH: 50.3% | Supervisor / Orchestrator / Metrics Query Primary | **적절함**. 30 RPM / 1K RPD / 30K TPM / 500K TPD 공식 Free Plan 한도 내에서 사용자-facing 빠른 경로를 담당. Analyst까지 떠안기면 30 RPM 병목이 커지므로 장문 RCA primary에서는 제외. |
| **Z.AI** | `glm-4.5-flash` | 미공개 (Flash tier) | SWE-bench, Terminal-Bench 2.0 SOTA (동급 중) | Reporter Agent Primary | **매우 적절함**. 128K 컨텍스트를 지원하고 논리/코딩 성능이 뛰어나 타임라인 생성 및 지식 검색을 요구하는 Reporter의 주력으로 쓰기에 적합. |
| **Mistral** | `mistral-small-latest` (Mistral Small 4) | 119B (6.5B active) MoE | LiveCodeBench 등에서 GPT-OSS 120B 상회 | Analyst / Advisor Primary | **매우 적절함**. 32K 장문 경로를 충족하고 현재 workspace smoke 기준 50 RPM / 50K TPM guard가 가장 넉넉해, 최대 5-step RCA loop의 1순위로 적합. |
| **Cerebras** | `llama3.1-8b` | 8B Dense | MMLU: ~68% | Short-context Fallback Only | **장문 primary 부적합**. 8K context라 16K/32K 요구 경로에서는 capability gate로 스킵된다. 2026-05-27 deprecation 예정이므로 short-context 최후 fallback으로만 유지. |
| **Gemini** | `gemini-2.5-flash-lite` | 미공개 (Lite tier) | 800+ tokens/s, FACTS ~84% | Vision Agent Primary | **적절함**. 비용과 지연시간(Latency) 최소화에 특화되어 실시간 Vision 태스크에 적합. 복잡한 추론 시 Fallback 모델과 병행. |
| **OpenRouter**| `google/gemma-3-27b-it:free` | 27B Dense | Vision & Text Benchmarks 준수 | Vision Fallback | **적절함**. 131K 컨텍스트에 27B의 체급으로 Flash-lite의 멀티모달 한계를 보완할 수 있는 훌륭한 백업. |
| **Z.AI** | `glm-4.6v-flash` | 9B Multimodal | MMBench: 86.9, OCRBench: 84.7 | Vision Fallback | **적절함**. 9B의 가벼운 모델임에도 Native Multimodal Function Calling을 지원하여 복잡한 UI 분석 및 문서 처리에 최적. |

**분석 결론:**
현재 시스템의 목표 구조는 각 모델의 강점과 quota를 나누는 spider-web fallback입니다. 다만 이전 문서/정책에는 **Analyst=Cerebras 1순위**라는 유령 1순위가 남아 있었다. 실제 런타임은 Analyst의 `minContextTokens: 32_000` 때문에 8K Cerebras를 항상 스킵했고, 결과적으로 Groq에 RCA 부하가 몰렸다. 2026-05-16 보정 후 Analyst/Verifier는 Mistral-first, Reporter는 Z.AI-first, Advisor는 Mistral-first, Cerebras는 short-context last fallback으로 정렬했다.

Source anchors:

- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/provider-capabilities.ts`
- `src/config/ai-providers.ts`

Official provider references checked on 2026-05-16:

- Groq Llama 4 Scout: tool use, JSON/schema mode, 131K context, preview model, MMLU Pro 52.2. <https://console.groq.com/docs/model/llama-4-scout-17b-16e-instruct>
- Groq Free Plan rate limits for `meta-llama/llama-4-scout-17b-16e-instruct`: 30 RPM / 1K RPD / 30K TPM / 500K TPD. <https://console.groq.com/docs/rate-limits>
- Groq tool use support list. <https://console.groq.com/docs/tool-use>
- Cerebras supported models and deprecation note for `llama3.1-8b`. <https://inference-docs.cerebras.ai/models/overview>
- Cerebras free-tier rate limits. <https://inference-docs.cerebras.ai/support/rate-limits>
- Mistral free tier is workspace-tier dependent and current limits must be checked in Admin > Limits. <https://docs.mistral.ai/admin/user-management-finops/tier>
- Z.AI marks GLM-4.5-Flash and GLM-4.6V-Flash as free; rate limits are account/concurrency based. <https://docs.z.ai/guides/overview/pricing>
- Gemini 2.5 Flash-Lite: 1M input context, multimodal inputs, low-latency positioning. <https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-lite>

## Expected Performance

Given the current model mix and free-tier constraints, the expected performance is:

| Capability | Expected level | Reason |
|------------|----------------|--------|
| Metric lookup / ranking | high | deterministic tools own server IDs, values, ranking, and source slot |
| Tool routing | medium-high | Groq Scout supports tool use/JSON; app-level routing and allowlists reduce drift |
| RAG/document path grounding | medium | retrieval can constrain evidence, but answer text still depends on model compliance |
| Web freshness | medium | web tool can recover freshness, but answer quality depends on result selection and citation handling |
| Report generation prose | medium | output can be useful, but polish/omission risk remains with mid-tier models |
| Deep RCA / ambiguous multi-hop reasoning | medium-low to medium | model tier is below frontier reasoning systems; deterministic fact pack can help but not fully replace reasoning |
| Security refusal / prompt injection | medium-high for basic smoke | prompt guard + contract checks reduce obvious leakage, but broad red-team is manual |
| Latency under free-tier | high enough for portfolio/demo | fast providers and free-tier infra work, but cold start and provider fallback remain visible |

## Actual QA Evidence

| Evidence | Result | Assessment |
|----------|--------|------------|
| `QA-20260505-0412` v8.11.106 targeted QA | 6/6 passed, pending 0 | Latest production targeted UI/copy/RAG-control regression is clean. This run did not send live LLM prompts. |
| `QA-20260505-0410` RAG OTel SSOT recheck | 3/3 passed | RAG answer correctly returned repo paths and rejected placeholder `/opt/otel` / `/path/to/OpenManager` paths. This confirms a prior hallucination was remediated. |
| `QA-20260505-0408` Web search answer recovery | 8/8 passed | Web On prompt returned current Next.js answer with source URL after prior stale/no-source behavior. Confirms recovery, not permanent immunity. |
| `QA-20260505-0407` broad QA | 33/39 passed, 5 pending at the time | Core AI paths worked, but RAG path hallucination, stale web answer, and UI/detail issues were observed. Later targeted runs closed the AI blockers. |
| Artifact intent deterministic benchmark | 3 files / 8 tests passed; current corpus 124/124 | Intent classifier is strong for artifact false-positive/false-negative prevention. |
| Artifact production replay | 19/19, precision/recall 1.0000 | Production-style artifact routing samples are stable. |
| Portable route/retrieval/stream benchmark | 3 files / 9 tests passed with Promptfoo contract included | Route/tool trace, retrieval evidence fallback, and stream event shape are now pinned without provider calls. |
| Promptfoo config/preflight | main estimated 50 live calls, redteam estimated 10, `llm-rubric=0` | Manual eval is cost-controlled, but no persisted recent Promptfoo live score exists. |

## Expected vs Actual

| Area | Expected | Actual from QA/bench | Fit |
|------|----------|----------------------|-----|
| Server status and metric answers | high factuality from tools | QA showed grounded 18-server counts and CPU top-3 values | meets expectation |
| Artifact routing | high deterministic stability | 124/124 local corpus and 19/19 replay | exceeds expectation for current sample size |
| RAG path grounding | medium with known risk | failed in broad QA, then passed targeted recheck after KB/fallback fix | meets expectation after remediation, still risk-bearing |
| Web freshness | medium | failed once with stale/no-source answer, then passed targeted recovery | meets expectation after remediation, still provider/search dependent |
| Reporter/Analyst quality | medium | generated usable reports/analysis, with UI/action visibility issues separate from model quality | meets expectation for portfolio scope |
| Security smoke | medium-high | prompt injection smoke did not leak secrets in broad QA | meets basic expectation; broad red-team remains manual |
| Latency | usable, not premium SaaS | recent 24h rollup: Supervisor avg around 3.4s, p95 around 8.8s; cold-start debt accepted as free-tier tradeoff | meets free-tier expectation |

## Rough Comparative Position

This system should be described as:

```text
Raw model capability:
  below frontier GPT-class reasoning systems
  around fast mid/high open-model assistant tier

App-level domain experience:
  stronger than raw mid-tier chat for monitoring tasks
  because deterministic tools, retrieval guards, fact packs, and QA contracts own the facts

Not appropriate claim:
  "GPT-4/GPT-5-level assistant"

Appropriate claim:
  "tool-augmented operational assistant that can deliver small/mini GPT-class app experience on constrained monitoring workflows, while staying below frontier reasoning quality for open-ended RCA and complex report reasoning"
```

Approximate internal scorecard:

| Dimension | Current estimate | Basis |
|-----------|------------------|-------|
| Raw LLM reasoning tier | 6/10 | Groq Scout / Flash-Lite / 8B fallback mix; not frontier reasoning |
| Monitoring-domain answer usefulness | 7.5/10 | Tools and QA evidence make common server questions reliable |
| Metric/ranking factuality | 8.5/10 | Deterministic lookup/ranking now guards core values |
| RAG/Web trustworthiness | 6.5-7/10 | Recent failures were real but targeted remediation passed |
| Artifact intent reliability | 9/10 | Current deterministic corpus is clean, but sample size is still finite |
| Free-tier cost efficiency | 8.5/10 | Vercel billed 0.0000 USD in latest usage check; provider live eval kept manual |
| Commercial reusable assistant-core readiness | 6.5/10 now, 8/10 target after portable core renderer/history tasks | Core/domain separation is in progress; route/retrieval/stream benches are now in place |

## What Wrappers Can And Cannot Change

Wrappers and runtime code can improve:

- tool selection,
- factual grounding,
- route stability,
- fallback reliability,
- hallucinated path suppression,
- stream/schema consistency,
- UI observability of provider/model choice.

Wrappers cannot materially improve:

- the base model's reasoning depth,
- ambiguous incident-cause analysis quality,
- long-form report coherence beyond the model's ability,
- instruction-following stability under adversarial or underspecified prompts,
- latent knowledge freshness without web/retrieval evidence.

Therefore, the current design is correct for free-tier domain reliability, but not enough to claim frontier model quality.

## Documentation Positioning

Recommended product/architecture wording:

- "Operational Decision Support AI Assistant"
- "tool-augmented LLM application with deterministic fact and routing boundaries"
- "domain-grounded monitoring assistant"

Avoid:

- "GPT-4/GPT-5-level assistant"
- "autonomous AIOps/SRE agent"
- "fully deterministic AI answer quality"

## Next Measurement Gap

The next useful benchmark is not another generic model leaderboard. The missing measurement is a small manual A/B scorecard that runs the same QA prompt set across:

- current production provider chain,
- one stronger reasoning candidate model, if budget and provider access allow,
- current deterministic fallback-only path where applicable.

Suggested prompt groups:

- metric lookup/ranking,
- RAG repo-path grounding,
- web freshness with citation,
- report rewrite context preservation,
- prompt injection refusal,
- RCA with uncertainty and evidence.

Required scoring dimensions:

- factual accuracy,
- evidence/source correctness,
- tool-use correctness,
- omission rate,
- hallucination rate,
- latency,
- estimated provider calls/cost.

This should remain manual or nightly only. It should not become a default CI gate unless it can run without live LLM calls.
