# AI QA Model Performance Assessment 2026-05-05

> Owner: project
> Status: Active
> Doc type: Assessment
> Last reviewed: 2026-05-05
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
| Supervisor / NLQ / Orchestrator | Groq `meta-llama/llama-4-scout-17b-16e-instruct` -> Cerebras `llama3.1-8b` -> Z.AI `glm-4.5-flash` -> Mistral `mistral-small-latest` | fast mid/high open-model tier, strong tool/JSON/long-context behavior, not frontier reasoning tier | Z.AI text fallback 추가 |
| Analyst / Reporter / Advisor / Verifier | configured Cerebras-first, but 32K context capability gate usually skips 8K Cerebras and falls through to Groq | practically Groq Scout tier for long-context tool paths | Code path requires tool calling and `minContextTokens: 32_000` |
| Vision | Gemini `gemini-2.5-flash-lite` -> OpenRouter `gemma-3-27b-it:free` -> Z.AI `glm-4.6v-flash` | efficient multimodal/long-context tier, optimized for latency/cost rather than top frontier reasoning | Vision-only path, OpenRouter / Z.AI fallback 추가 |
| Deterministic evaluator/optimizer/fact pack | no LLM required | should exceed raw LLM reliability for metric/ranking/fact boundaries | Used to keep metric truth outside model memory |

### Model Benchmarks & Capability Profile (Updated 2026-05-16)

웹 검색 결과를 바탕으로 현재 우리가 사용 중인 무료 API 모델들의 객관적인 성능 벤치마크를 요약합니다. 이 데이터는 각 모델이 현재 부여받은 역할(Role)에 적절한지 판단하는 기준이 됩니다.

| 제공자 (Provider) | 모델 (Model ID) | 파라미터 / 아키텍처 | 주요 벤치마크 점수 | 현재 역할 (Role) | 역할 적절성 평가 |
|-----------------|-----------------|-------------------|----------------|----------------|----------------|
| **Groq** | `meta-llama/llama-4-scout-17b-16e-instruct` | 109B (17B active) MoE | MMLU: 79.6%, MMLU-Pro: 58.2%, MATH: 50.3% | Metrics Query / Orchestrator Primary | **매우 적절함**. 70B 급 덴스 모델을 상회하는 성능을 내면서도 빠른 응답속도를 보여 메인 오케스트레이션 및 Metrics Query 수행에 완벽히 부합. |
| **Z.AI** | `glm-4.5-flash` | 미공개 (Flash tier) | SWE-bench, Terminal-Bench 2.0 SOTA (동급 중) | Reporter Agent Primary | **매우 적절함**. 128K 컨텍스트를 지원하고 논리/코딩 성능이 뛰어나 타임라인 생성 및 지식 검색을 요구하는 Reporter의 주력으로 쓰기에 적합. |
| **Mistral** | `mistral-small-latest` (Mistral Small 4) | 119B (6.5B active) MoE | LiveCodeBench 등에서 GPT-OSS 120B 상회 | Advisor Agent Primary | **매우 적절함**. 256K 컨텍스트, MoE 기반 높은 효율성과 간결한 답변 생성 능력으로 조언(Advisor) 및 로그 요약 기능의 주력으로 손색 없음. |
| **Cerebras** | `llama3.1-8b` | 8B Dense | MMLU: ~68% | Analyst Agent Primary (32K+ Fallback) | **조건부 적절함**. Analyst의 주력이지만 8K 컨텍스트 한계로 복잡한 에이전트 태스크 시 32K 지원 모델(Groq 등)로 쉽게 Fallback 됩니다. (2026-05-27 deprecated 예정) |
| **Gemini** | `gemini-2.5-flash-lite` | 미공개 (Lite tier) | 800+ tokens/s, FACTS ~84% | Vision Agent Primary | **적절함**. 비용과 지연시간(Latency) 최소화에 특화되어 실시간 Vision 태스크에 적합. 복잡한 추론 시 Fallback 모델과 병행. |
| **OpenRouter**| `google/gemma-3-27b-it:free` | 27B Dense | Vision & Text Benchmarks 준수 | Vision Fallback | **적절함**. 131K 컨텍스트에 27B의 체급으로 Flash-lite의 멀티모달 한계를 보완할 수 있는 훌륭한 백업. |
| **Z.AI** | `glm-4.6v-flash` | 9B Multimodal | MMBench: 86.9, OCRBench: 84.7 | Vision Fallback | **적절함**. 9B의 가벼운 모델임에도 Native Multimodal Function Calling을 지원하여 복잡한 UI 분석 및 문서 처리에 최적. |

**분석 결론:**
현재 시스템에 구성된 모델들은 단순한 "주력-예비(Primary-Fallback)" 구조가 아니라, **각 에이전트의 성격에 맞춰 해당 모델이 1순위(Primary) 역할을 전담하는 분산형 로드밸런싱 구조**를 띠고 있습니다. (예: Reporter는 Z.AI 1순위, Advisor는 Mistral 1순위, Analyst는 Cerebras 1순위, Orchestrator/Metrics Query는 Groq 1순위). 이 설계는 각 모델의 특화된 강점(속도, 컨텍스트 길이, 특정 태스크 수행력)을 최대로 활용함과 동시에 특정 API의 일일 한도(Quota) 소모를 분산시키는 **매우 정교하고 비용 효율적인 아키텍처**입니다.
| Deterministic evaluator/optimizer/fact pack | no LLM required | should exceed raw LLM reliability for metric/ranking/fact boundaries | Used to keep metric truth outside model memory |

Source anchors:

- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-runtime-policy.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/agents/config/agent-model-selectors.ts`
- `cloud-run/ai-engine/src/services/ai-sdk/provider-capabilities.ts`
- `src/config/ai-providers.ts`

Official provider references checked on 2026-05-05:

- Groq Llama 4 Scout: tool use, JSON/schema mode, 131K context, preview model, MMLU Pro 52.2. <https://console.groq.com/docs/model/llama-4-scout-17b-16e-instruct>
- Groq tool use support list. <https://console.groq.com/docs/tool-use>
- Cerebras supported models and deprecation note for `llama3.1-8b`. <https://inference-docs.cerebras.ai/models/overview>
- Cerebras free-tier rate limits. <https://inference-docs.cerebras.ai/support/rate-limits>
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
