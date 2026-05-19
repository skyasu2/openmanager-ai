> Owner: project
> Status: Completed
> Doc type: QA Evidence
> Last reviewed: 2026-05-19
> Tags: qa,vercel,ai-assistant,broad

# QA-20260519-0535 Evidence Summary

## Run

- Run ID: QA-20260519-0535
- Target: Vercel production
- Source: Chrome DevTools MCP / Playwright MCP-compatible manual browser QA
- Scope: broad
- Deployment: `icn1::icn1::7hs47-1779167617388-c78b3062ad59`
- Commit: `4ce2e3f71`

## Covered Surfaces

- `/dashboard/ai-assistant` AI Chat tab
- `/dashboard/ai-assistant` anomaly/trend tab
- `/dashboard/servers/:id` nonexistent server handling
- `/api/ai/intelligent-monitoring`
- `/api/health`
- `/api/system`
- Security headers
- Rate limit headers

## Result

- Checks: 18 total, 14 passed, 4 failed
- Main findings:
  - `analyze_server` single-server analysis response shape mismatch.
  - AI Chat remediation query quality/routing needed improvement.
  - `/api/system` abort race was observed as non-blocking portfolio debt.
  - Guest logout endpoint absence was observed as non-blocking because logout is client-side cookie cleanup.

## Follow-Up

QA-20260519-0536 records local deterministic closure for the code-level fixes:

- `intelligent-monitoring-analyze-server-normalization`
- `ai-remediation-advisor-routing-precedence`
- `provider-fallback-freshness-hardening`
- `analyst-lightweight-evidence-contract`

Production closure still requires a post-deploy focused Vercel QA rerun.
