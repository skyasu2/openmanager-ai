---
name: openmanager-qa-ops
description: Execute final QA for OpenManager with Vercel+Playwright MCP by default, switch to local dev QA when AI validation is unnecessary, and record every run into reports/qa tracker.
version: v1.1.0
user-invocable: true
---

# OpenManager QA Ops

Final QA operation workflow with cumulative tracking.

## Use with state triage

- If the user asks `what is wrong`, `why did this fail`, `can this be fixed within free tier`, or `what should we do next after QA`, use `$openmanager-state-triage` before rerunning broad QA.
- Use this skill after triage when the next action is actually to execute QA, validate a fix on Vercel, or record a run.
- If triage points to preview or production env drift, use `$openmanager-env-sync` before broad QA so you do not record a known config failure as a product regression.

## Execute this workflow

1. Load QA baseline and current status.
- `cat reports/qa/qa-tracker.json`
- `sed -n '1,220p' reports/qa/QA_STATUS.md`
- `sed -n '1,220p' reports/qa/README.md`
- `sed -n '1,220p' reports/qa/production-qa-2026-02-25.md`
- `sed -n '1,220p' .agents/skills/openmanager-qa-ops/references/current-surface-checklist.md`
- Treat `qa-tracker.json` + `QA_STATUS.md` as the current state SSOT.
- Treat `production-qa-2026-02-25.md` as a historical baseline/reference, not the only coverage source.

2. Decide target environment.
- Default: **Vercel + Playwright MCP** (`https://openmanager-ai.vercel.app`)
- Use local dev server QA only when AI-path validation is unnecessary (UI/copy/layout/basic auth flow).
- Use Cloud Run endpoint checks when the scope is observability, monitoring, trace propagation, or Langfuse runtime proof.

3. Select the QA pack from the current product surface.
- Core route pack:
  - `/`, `/main`, `/login`, `/system-boot`, `/dashboard`
- AI surface pack:
  - AI sidebar, `/dashboard/ai-assistant`, analyst, reporter, feedback, streaming path
- Modal/detail pack:
  - alerts, topology, server detail tabs, log explorer, profile menu
- Observability/security pack:
  - `X-AI-*` timing headers, `/monitoring`, `/monitoring/traces`, Langfuse trace visibility, blocked prompt/security regression
- Secondary route pack:
  - `/auth/error`, `/auth/success`, `/privacy`

4. Run QA scenarios and record coverage explicitly.
- Broad QA must list which route/feature packs were covered.
- If a changed route or feature was not tested, state the reason explicitly.
- AI-required scope should run on Vercel unless the task is strictly local UI.
- AI-not-required scope may run on local dev server.
- Record `scope`, `releaseFacing`, `coveredSurfaces`, `skippedSurfaces`, and
  `countsTowardSummary` in the run input.
- Set `countsTowardSummary=false` for propagation checks or verification-only reruns
  whose purpose is to confirm tracker/public-evidence sync on an already-tested build.
- Keep `countsTowardSummary=true` for real product-surface QA that should affect the
  aggregate totals.

5. For Vercel QA/deploy, check usage before recording the run.
- Preferred:
  - `npm run check:usage:vercel`
- If CLI/auth is unavailable:
  - confirm in the Vercel Usage dashboard manually
- Record the outcome in `usageChecks` with at least:
  - `platform`
  - `method`
  - `status`
  - `result`
  - `summary`

6. Record QA result (mandatory).
- Prepare input JSON from template:
  - `cp reports/qa/templates/qa-run-input.example.json /tmp/qa-run-input.json`
- Record:
  - `npm run qa:record -- --input /tmp/qa-run-input.json`
- Verify summary:
  - `npm run qa:status`
- For Vercel production `broad`/`release-gate` runs, or when `releaseFacing=true`, `expertAssessments` is mandatory.
- Smoke/targeted rechecks may omit `expertAssessments` unless the run is release-facing or observability/security-heavy.
- If the outcome is intentionally non-blocking, reflect it as `wont-fix`/tracking-only according to `reports/qa/README.md`.
- Do not let meta verification runs inflate public totals. If the run exists only to
  confirm propagation of an already-recorded state, mark it `countsTowardSummary=false`.

7. Report with completion tracking.
- Always include:
  - target
  - run id
  - scope
  - checks
  - release decision (`go` | `conditional` | `no-go`)
- Include only when relevant:
  - covered surfaces / skipped surfaces
  - usage checks
  - `completedImprovements` vs `pendingImprovements`
  - `wont-fix` / expert gaps
  - next high-priority pending items

## Output format

```text
QA Summary
- result: go | conditional | no-go
- target: vercel|local-dev
- run id: QA-YYYYMMDD-XXXX
- scope: smoke|targeted|broad|release-gate
- checks: <total> (pass <n> / fail <n>)

Add optional bullets only when relevant:
- covered surfaces: <list>
- skipped surfaces: <list|none>
- usage: <collection/result summary>
- completed: <count>
- pending: <count>
- expert gaps: <count>
- next priority: <item id>

Close with one short operator note that explains the highest remaining risk or states that none remain in the tested scope.
```

## References

- `.agents/skills/openmanager-qa-ops/references/current-surface-checklist.md`
- `reports/qa/production-qa-2026-02-25.md`
- `reports/qa/README.md`
- `reports/qa/qa-tracker.json`
- `reports/qa/QA_STATUS.md`
