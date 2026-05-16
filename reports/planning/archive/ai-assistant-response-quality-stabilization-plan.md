# AI Assistant Response Quality Stabilization Plan

> Owner: project
> Status: Completed
> Doc type: Plan
> Last reviewed: 2026-05-16
> Canonical: reports/planning/archive/ai-assistant-response-quality-stabilization-plan.md
> Tags: ai-assistant,ai-engine,response-quality,free-tier

---

## Background

2026-05-16 recent AI assistant answer-quality changes were reviewed because they
touched Cloud Run AI Engine prompt, generation parameters, provider policy, and
response post-processing. The goal is to keep low-cost deterministic quality
improvements while reverting provider/model changes that are not approved for
the current production policy.

## Scope

- Keep: prompt guidance that improves grounded tool-result answers.
- Keep: intent-specific `temperature` / `maxOutputTokens` for single-agent
  generation.
- Keep with fixes: post-processing enrichment from collected tool results.
- Revert: SambaNova provider surface.
- Revert: early Cerebras default switch from `llama3.1-8b` to `llama3.3-70b`.

## Tasks

- [x] **Q1**: Replace explicit Chain-of-Thought wording with internal decision
  guidance and prevent final answers from exposing hidden reasoning.
- [x] **Q2**: Replace unsafe few-shot cleanup command examples with read-only
  discovery commands and approval-gated deletion guidance.
- [x] **Q3**: Make response enrichment use actual `recommendCommands`
  `recommendations[]` output and filter mutating commands from automatic
  supplements.
- [x] **Q4**: Evaluate single-agent responses against intent-appropriate quality
  profiles instead of the generic `Supervisor` profile.
- [x] **Q5**: Remove SambaNova provider additions from the current runtime
  surface.
- [x] **Q6**: Keep Cerebras `llama3.1-8b` as the default until the deprecation
  cutoff or an approved replacement smoke.

## Free Tier Impact

No new provider or external service call is added. The retained changes are
local prompt/parameter/post-processing changes. No live LLM smoke was run in
this stabilization pass.

## Verification

- `cd cloud-run/ai-engine && npx vitest run src/domains/monitoring/routing-policy.test.ts src/services/ai-sdk/supervisor-response-enrichment.test.ts src/services/ai-sdk/supervisor-domain-wiring.contract.test.ts src/services/ai-sdk/supervisor-multi-fallback.test.ts src/services/ai-sdk/provider-model-metadata.test.ts src/lib/config-parser.test.ts src/services/ai-sdk/provider-model-policy.test.ts --silent=passed-only` — 7 files / 154 tests PASS
- `cd cloud-run/ai-engine && npm run type-check` — PASS
- `cd cloud-run/ai-engine && npm run test` — 126 files / 1224 tests PASS
- `npm run type-check` — PASS
- `npm run lint` — PASS (qa-tracker size info only)
- `npm run test:quick` — PASS
- `npm run test:contract` — 3 files / 24 tests PASS
- `npm run line-guard` — PASS (35 warning file(s), no fail-threshold violations)
- `npm run docs:budget` — PASS
- `npm run docs:ai-consistency` — PASS
- `git diff --check` — PASS
