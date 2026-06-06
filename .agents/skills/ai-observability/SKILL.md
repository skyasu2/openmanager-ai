---
name: ai-observability
description: Analyze OpenManager AI assistant routing, provider distribution, latency, failures, fallbacks, and Langfuse traces with npm run langfuse:check. Use when the user asks to inspect AI assistant state, Langfuse traces, routing quality, Analyst or Supervisor latency, provider behavior, or whether AI QA needs browser verification.
---

# OpenManager AI Observability

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Inspect internal AI-call evidence before deciding whether Playwright/UI QA is needed.

## Execute this workflow

1. Confirm the scope.
- Use this skill first for AI routing, agent selection, provider distribution, latency, failure, and fallback questions.
- Use `$qa-ops` after this check when user-facing UI proof, screenshots, console errors, or release-facing QA records are needed.
- Do not add live Langfuse checks to default local smoke gates. They are explicit observability evidence, not deterministic CI coverage.

1. Run the smallest useful Langfuse query.
- Recent baseline: `npm run langfuse:check -- --limit 50`
- Supervisor or Analyst focus: `npm run langfuse:check -- --limit 100 --q supervisor`
- Structured comparison: `npm run langfuse:check -- --limit 100 --json`
- Name filter: `npm run langfuse:check -- --q <term>`
- If sandbox DNS or external access blocks the command, rerun the same command with approved external access. Never print `.env.local` secret values.

1. Read the result.
- Provider distribution: deterministic vs Mistral, Groq, Z.AI, or other live providers.
- Latency: average and P95, especially Supervisor, Analyst, and fallback paths.
- Fail/fallback: failed traces, retry shape, and `usedFallback` signals when present.
- Agent routing: `finalAgent` or trace metadata for RCA, "why", anomaly, Advisor, Analyst, Reporter, and Metrics Query prompts.
- Recency: if no traces appear, classify it as no recent AI traffic or an observability gap before assuming product failure.

1. Decide the next action.
- `healthy`: routing and latency are acceptable; skip browser QA unless UI proof is required.
- `routing-gap`: agent mismatch or missed intent; use `$state-triage`, then fix routing or contract tests.
- `latency-gap`: gather before/after trace baseline; prefer caching, routing, or prompt-path fixes before infra cost changes.
- `provider-gap`: inspect provider metadata, quota, and fallback before changing infrastructure.
- `ui-proof-needed`: use `$qa-ops` for Playwright/Vercel QA.
- `qa-record-needed`: use `$qa-ops` to record release-facing evidence.

## Output format

```text
AI Observability
- scope: routing | latency | provider | fallback | trace-health
- sample: <limit/filter/date range>
- provider mix: <summary>
- latency: avg <n>s / p95 <n>s
- failures: <count and pattern>
- routing: <pass|warn|fail with reason>
- next step: <single best action>

Evidence
- <command or trace summary>
```

## References

- `scripts/qa/langfuse-check.js`
- `docs/guides/observability.md`
- `docs/reference/architecture/ai/ai-engine-evaluation.md`
