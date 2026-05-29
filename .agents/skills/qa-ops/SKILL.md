---
name: qa-ops
description: Execute final QA for OpenManager with Vercel+Playwright MCP by default, switch to local dev QA when AI validation is unnecessary, record every run into reports/qa tracker, and include conversational AI QA for AI-related changes.
version: v1.5.4
---

# OpenManager QA Ops

> Common baseline: before editing this skill, review `docs/development/vibe-coding/skills.md` and `config/ai/skill-baselines.json`. If behavior changes are not agent-specific, update the baseline first.

Final QA operation workflow with cumulative tracking.

## Testing methodology

- Use `docs/guides/testing/test-strategy.md` as the methodology SSOT.
- QA is the top of the test pyramid: run representative, risk-based scenarios instead of expanding broad matrices.
- Do not repeat live Vercel/Cloud Run/LLM QA to chase coverage percentage. One focused rerun after a fix is acceptable; repeated live runs need an explicit reason.
- Keep default CI/local gates free of external-service cost. Treat production QA evidence as release-facing proof, not a replacement for local contract tests.

## Use with state triage

- If the user asks `what is wrong`, `why did this fail`, `can this be fixed within free tier`, or `what should we do next after QA`, use `$state-triage` before rerunning broad QA.
- Use this skill after triage when the next action is actually to execute QA, validate a fix on Vercel, or record a run.
- If triage points to preview or production env drift, use `$env-sync` before broad QA so you do not record a known config failure as a product regression.

## Execute this workflow

1. Load QA baseline and current status.
- `cat reports/qa/qa-tracker.json`
- `sed -n '1,220p' reports/qa/QA_STATUS.md`
- `sed -n '1,220p' reports/qa/README.md`
- `sed -n '1,220p' .agents/skills/qa-ops/references/current-surface-checklist.md`
- Treat `qa-tracker.json` + `QA_STATUS.md` as the current state SSOT.
- Treat the `Current Production Reference` section in `current-surface-checklist.md` as the baseline selector. Inspect the named run JSON, such as `reports/qa/runs/2026/qa-run-QA-20260415-0291.json`, when broad or release-facing comparisons need historical detail.

1. Decide target environment.
- Default: **Vercel + Playwright MCP** (`https://openmanager-ai.vercel.app`) for functional QA and E2E flows.
- For Codex/WSL browser QA, verify Windows HTTP Playwright MCP readiness before starting the run:
  - `npm run mcp:playwright:windows:start` when the Windows server is not already running.
  - `bash scripts/mcp/mcp-health-check-codex.sh --probe playwright` to confirm the JSON-RPC `initialize` probe succeeds.
  - Restart the Codex session after changing `.codex/config.toml`; MCP server config is loaded at session start.
- Diagnostics: Use **Chrome DevTools MCP** for performance (LCP, CLS, Core Web Vitals), Lighthouse audits, memory leaks, and deep network inspection.
- Use local dev server QA only when AI-path validation is unnecessary (UI/copy/layout/basic auth flow).
- Use Cloud Run endpoint checks when the scope is observability, monitoring, trace propagation, or Langfuse runtime proof.
- If local Next.js runtime diagnostics are needed, use `nextjs_index` first and retry with explicit `port` when auto-discovery fails.
- If `next-devtools.browser_eval` fails to start with `Connection closed` or a similar session-start error, switch browser automation to direct Playwright MCP and keep `nextjs_call` for runtime diagnostics only.
- When this fallback is used in release-facing QA, state it explicitly in the evidence/report so the automation gap stays visible.

1. Select the QA pack from the current product surface.
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

1. Run conversational AI QA for AI-related changes.
- Required when AI prompt, agent routing, knowledge base, precomputed-state/data source, response parsing, or output formatting behavior changes.
- Ask the AI Assistant the standard five questions in order. Details: `docs/guides/testing/test-strategy.md` § 1.5.
  1. "현재 서버 전체 상태를 요약해줘"
  2. "web-server-01 상태를 자세히 알려줘"
  3. "지난 24시간 중 가장 부하가 높았던 시간대는 언제야?"
  4. "지금 당장 조치가 필요한 서버가 있어?"
  5. "방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘"
- Judge each answer as Pass (specific metrics/context), Warn (vague but usable), or Fail (empty/error/wrong).
- Warn/Fail means fix prompt/routing/data grounding and rerun the failed question before recording a passing release-facing run.
- Record the result with `coveredSurfaces: ["conversational-ai-qa"]` and an `expertAssessments` entry.

1. Treat Vision real-image QA as manual-only.
- Do not include Gemini Vision or Z.AI GLM Vision live image calls in routine release QA, standard five-question QA, or repeated provider matrices.
- Run one real-image Vision smoke only when the user explicitly asks for it or when Vision routing/provider behavior is the changed surface.
- Prefer deterministic routing/provider-selection tests for routine validation. Live Vision calls spend deployed provider quota and can quickly exhaust Gemini/GLM free-tier limits.
- When a Vision live smoke is executed, record provider, model, image count, and pass/fail in `reports/qa`; do not rerun just to collect extra samples.
- Z.AI GLM Vision fallback live smoke is not assumed from selection tests. Mark it as unverified unless a manual image call explicitly exercised `provider=zai`, `modelId=glm-4.6v-flash`.

1. Run QA scenarios and record coverage explicitly.
- Broad QA must list which route/feature packs were covered.
- If a changed route or feature was not tested, state the reason explicitly.
- Select the smallest representative pack that covers the changed risk. Do not expand route/device/provider matrices without a concrete risk reason.
- AI-required scope should run on Vercel unless the task is strictly local UI.
- AI-not-required scope may run on local dev server.
- Record `scope`, `releaseFacing`, `coveredSurfaces`, `skippedSurfaces`, and
  `countsTowardSummary` in the run input.
- Set `countsTowardSummary=false` for propagation checks or verification-only reruns
  whose purpose is to confirm tracker/public-evidence sync on an already-tested build.
- Keep `countsTowardSummary=true` for real product-surface QA that should affect the
  aggregate totals.

1. For Vercel QA/deploy, check usage before recording the run.
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

1. Record QA result (mandatory).
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

1. Report with completion tracking.
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

## Playbook — Async Job + SSE Probing on Vercel Production

For verifying the async AI Job + SSE stream path (`POST /api/ai/jobs` → `GET /api/ai/jobs/:id/stream`) using Playwright MCP. Established during the v8.11.53 cloud-tasks dispatch QA run.

### 1) Entry flow

1. `mcp__playwright__browser_navigate` → `https://openmanager-ai.vercel.app`
2. `browser_snapshot` to get refs → click guest login → click "시스템 시작" → wait ~18s for `/dashboard`
3. Click "AI 어시스턴트 열기" → `dialog [name="AI 어시스턴트"]` opens

### 2) Send the query (do not bypass CSRF)

- **Always use the UI fill+click path.** Calling `fetch('/api/ai/jobs')` directly via `browser_evaluate` returns **403 Invalid CSRF token** — that is the security control working, not something to work around.
- To force the dispatch path, choose `thinking` mode + RAG and use a query long enough that direct sync handling is bypassed.

### 3) Stream progress monitoring

- `browser_snapshot` is heavy. For tail status use `browser_evaluate`:
  ```js
  () => document.querySelector('[role=dialog]')?.innerText?.slice(-2500)
  ```
- Read directly from the UI: `경과 N초`, `N% 완료`, `handoff N회`, response card footer `{ms}ms`, "분석 근거" line `도구 N개 · 모드: ...`.

### 4) Network capture — EventSource is invisible to browser_network_requests

- `browser_network_requests` only captures `fetch`. SSE on `/api/ai/jobs/:id/stream` is dropped.
- Recover SSE via Performance API:
  ```js
  () => performance.getEntriesByType('resource')
    .filter(r => r.name.includes('/api/ai/'))
    .map(r => ({ url: r.name, duration: Math.round(r.duration), transferSize: r.transferSize, initiator: r.initiatorType }))
  ```
- Entries with `initiator: 'other'` are EventSource. Two or more entries = client backoff reconnect after the 60s `maxDuration` boundary, which is **expected and healthy**.

### 5) Pass/fail bar

| Item | Threshold |
|------|-----------|
| `POST /api/ai/jobs` latency | < 3s (validates Cloud Tasks dispatch separation) |
| Stream entry count | 1–3 (more than 3 suggests reconnect storm) |
| Answer accuracy | UI metric cards ↔ AI response body must match (e.g. "DISK 70%+ 3 servers" ↔ Top 5 cards) |
| Handoff/tool visibility | Stage, handoff, tool count all visible in UI |
| Regression signals | No `302 → 404`, no "Job not found", no `error: 'Worker request failed'` |

### 6) Cleanup

- Save one screenshot for evidence: `.playwright-mcp/<scenario>.png`
- `browser_close`
- Then follow the standard step 6 (Record QA result).

### Pitfalls

| Pitfall | Workaround |
|---------|------------|
| `browser_network_requests` misses SSE | Use Performance API |
| `evaluate(fetch)` returns 403 | Use UI flow only — never bypass CSRF |
| Deep dialog snapshot is slow | Slice innerText instead |
| `/api/health?service=ai` returns 500 while queries succeed | Report health probe separately. Do not fail the run on the "AI 엔진 상태: Error" badge alone |
| First stream cuts at 60s | One reconnect is normal. Report the duration of the second stream entry too |

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

- `docs/guides/testing/test-strategy.md`
- `.agents/skills/qa-ops/references/current-surface-checklist.md`
- `reports/qa/runs/2026/qa-run-QA-20260415-0291.json`
- `reports/qa/README.md`
- `reports/qa/qa-tracker.json`
- `reports/qa/QA_STATUS.md`

## Changelog

- 2026-04-28: v1.4.0 - Added Async Job + SSE Probing Playbook for Cloud Tasks dispatch QA, including EventSource Performance API capture, CSRF-safe UI flow, reconnect interpretation, and health badge separation.
- 2026-05-07: v1.5.0 - Added conversational AI QA for AI-related changes with the standard five-question set and tracker recording guidance.
- 2026-05-07: v1.5.1 - Aligned QA selection with risk-based test methodology, cost guardrails, and representative live-run limits.
- 2026-05-19: v1.5.2 - Made Vision real-image Gemini/GLM smoke manual-only and documented GLM fallback live-smoke evidence requirements.
- 2026-05-23: v1.5.3 - Added Codex/WSL Playwright MCP Windows HTTP readiness checks before browser-driven Vercel QA.
- 2026-05-29: v1.5.4 - Replaced stale production-qa markdown reference with current-surface checklist baseline selection and the current broad run JSON reference.
