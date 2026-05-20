---
name: qa-state
description: Thin wrapper for running OpenManager state triage followed by QA ops only when both are needed. Use when the user asks to inspect current QA/runtime state, decide the next action, and execute/record QA in one flow.
---

# OpenManager QA State

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Use this skill only when the request needs both current-state triage and QA execution/reporting. It is intentionally a wrapper; keep detailed diagnostic rules in `$state-triage` and detailed QA execution rules in `$qa-ops`.

## Execute this workflow

1. Run state triage first.
- Use `$state-triage`.
- Load current QA status/tracker evidence before choosing a fix or rerun.
- Classify the next action as `code-fix`, `config-fix`, `deploy-and-qa`, `qa-checklist-fix`, `qa-metadata-fix`, `broader-qa`, or `wont-fix`.

1. Decide whether QA should run now.
- If triage points to `code-fix` or `config-fix`, do not run broad QA before the fix.
- If triage points to `deploy-and-qa`, `broader-qa`, `qa-checklist-fix`, or a verification rerun, continue with `$qa-ops`.
- If the issue is accepted debt, report `wont-fix` with the reason and do not record a noisy QA run.

1. Run and record QA through qa-ops.
- Use `$qa-ops` for environment selection, coverage pack choice, Playwright/Chrome DevTools usage, and `qa:record`.
- Preserve `scope`, `releaseFacing`, `coveredSurfaces`, `skippedSurfaces`, and `countsTowardSummary` decisions from `$qa-ops`.
- Preserve `$qa-ops` conversational AI QA requirements when the scope includes AI behavior, response parsing, or output formatting.
- Do not duplicate QA tracker semantics in this skill.

1. Report the combined state.
- Include the triage result, whether QA was run, run id when recorded, release decision, and the single next action.
- If QA was skipped, explain the concrete blocker or why QA would be premature.

## Output format

```text
QA State Report
- triage: <healthy|degraded|broken> / <next action>
- qa: <run id | skipped>
- scope: <none|smoke|targeted|broad|release-gate>
- decision: go | conditional | no-go | not_applicable
- next: <single best action>
```

## Related Skills

- `state-triage` - required first step for current-state/root-cause analysis
- `qa-ops` - required when QA execution or recording is needed
- `env-sync` - use after triage when env drift is the likely cause
