---
name: openmanager-state-triage
description: Analyze current OpenManager QA, runtime, deployment, and AI-path state; identify the primary symptom, root cause, free-tier fit, and next action. Use when the user asks what is broken now, why a recent Vercel or Cloud Run QA failed, whether the issue can be fixed within free-tier rules, how recent runs compare, or what step to take next after QA.
version: v1.1.0
user-invocable: true
---

# OpenManager State Triage

Turn recent evidence into a concrete next step before editing code or rerunning broad QA.

## Execute this workflow

1. Load policy and current evidence first.
- `sed -n '1,220p' docs/guides/ai/ai-standards.md`
- `cat reports/qa/qa-tracker.json`
- `sed -n '1,220p' reports/qa/QA_STATUS.md`
- `sed -n '1,220p' reports/qa/README.md`
- `sed -n '1,220p' reports/qa/production-qa-2026-02-25.md`
- `sed -n '1,220p' .agents/skills/openmanager-qa-ops/references/current-surface-checklist.md`
- If the user says `latest`, `recent`, or names a run id, inspect the latest 1-3 run JSON files in `reports/qa/runs/<year>/`.
- Treat `qa-tracker.json` + `QA_STATUS.md` as the current QA state SSOT.
- Distinguish:
  - `summary.lastRunId`: latest run that counts toward aggregate totals
  - `summary.latestRecordedRunId`: latest recorded run, including propagation/meta checks

2. Classify the failure before proposing fixes.
- `availability`: health check fail, 5xx, auth break, env drift, deploy failure
- `logic-or-quality`: network `200` but wrong text, fallback message, wrong UI state
- `data-or-ssot`: dashboard and AI disagree, OTel dataset mismatch
- `latency-or-cold-start`: first request slow, retry heals it, timeouts/fallback headers appear
- `observability-monitoring`: timing header, `/monitoring`, trace, Langfuse, sampled traceId visibility
- `security-regression`: blocked prompt UX, raw JSON leakage, auth hardening, CSP/security contract regression
- `observability-gap`: behavior works but automation or accessibility cannot observe it well
- `qa-metadata`: tracker/public snapshot/proof/summary semantics drift even though the app itself works

3. Map the symptom to the smallest code path that can explain it.
- First map it to the user-facing product surface:
  - landing / main / login / system-boot
  - dashboard / modal / profile menu
  - AI sidebar / fullscreen assistant
  - analyst / reporter
  - auth fallback / privacy
  - observability / monitoring / traces
- Frontend component path for UI-only regression
- Next.js route or proxy path for Vercel `/api/*` mismatch
- `cloud-run/ai-engine` path for upstream AI response, routing, prompt, or fallback behavior
- env/deploy scripts for preview vs production drift
- Prefer reading the exact route, agent, tool, or config file that matches the failing request instead of scanning the whole repo.

4. Decide whether the problem is infra or code.
- If `HTTP 200` and only content/UX is wrong, treat it as code or prompt-path quality, not infra sizing.
- If Reporter/Analyst pass but Chat fails, treat it as route or agent-specific logic.
- If preview fails and production passes, inspect env sync and deploy drift before changing product code.

5. Check free-tier fit before suggesting a fix.
- Re-check `docs/guides/ai/ai-standards.md`.
- Re-check `cloud-run/ai-engine/deploy.sh` and `cloud-run/ai-engine/cloudbuild.yaml` for guardrails.
- Prefer routing, fallback, caching, prompt, contract-test, and deterministic-summary fixes.
- Do not propose `--machine-type`, `>1 vCPU`, `>512Mi`, build machine upgrades, or always-on runtime as the first fix.
- Treat “optimization” as code or cache improvement unless the user explicitly asks for cost tradeoffs.

6. Choose the next action explicitly.
- `code-fix`: root cause is in logic, routing, fallback, or UI state
- `config-fix`: env drift or secret mismatch
- `deploy-and-qa`: code already fixed locally and only verification remains
- `qa-checklist-fix`: product behavior exists but the current QA/skill flow does not cover the route or feature well enough
- `qa-metadata-fix`: app is healthy but QA tracker/evidence semantics or counting rules are wrong
- `wont-fix`: non-blocking issue that falls under portfolio or QA policy
- `broader-qa`: only when there is not enough evidence to localize the issue

7. Pair with the right follow-on skill.
- Use `$openmanager-qa-ops` when broad or release QA still needs to run.
- Use `$openmanager-qa-ops` after `qa-checklist-fix` so the new surface coverage is exercised immediately.
- Use `$openmanager-code-review` when the user wants risk analysis or review on the proposed fix.
- Use `$openmanager-cloud-run` when the next step involves Cloud Run deploy, cost check, or GCP verification.
- Use `$openmanager-env-sync` when preview and production differ, health checks fail after deploy, or missing runtime secrets are the likely cause.

## Output format

```text
State Triage
- symptom: <what failed, with concrete run/date if known>
- scope: frontend | next-api | cloud-run | env/deploy | data-ssot
- root cause: <most likely cause from code/evidence>
- free-tier fit: yes | no | conditional
- next step: <single best next action>

Evidence
- <file/run/command>
- <file/run/command>

Why this next step
- <1-3 concise bullets>
```
