> Owner: project
> Status: Active
> Doc type: Ops memory
> Last reviewed: 2026-05-13

# Ops Knowledge

## Cerebras 2026-05-27 Deprecation Contingency

- Runtime model: `llama3.1-8b`
- Evidence: 2026-05-13 current account chat completion smoke returned HTTP 200.
- Constraint: model context is 8K and deprecates on 2026-05-27, so it must not be used as evidence for NLQ 16K primary promotion.
- Excluded visible models: `qwen-3-235b-a22b-instruct-2507` returned 429 queue/quota, `gpt-oss-120b` returned 404, and `zai-glm-4.7` is visible in model listing but current key chat completion returned 404.
- Expected behavior after deprecation without replacement entitlement: Analyst, Reporter, and Advisor effective fallback chain becomes `Groq -> Mistral`.
- Risk: Groq has 1K RPD and Mistral has 2 RPM, so Mistral cannot absorb burst fallback.
- Action: confirm a replacement Cerebras model entitlement before 2026-05-27 or intentionally run Group B agents Groq-first with quota monitoring.
