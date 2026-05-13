# QA-20260513 v8.11.143 AI Assistant 3-Feature Check

Target: Vercel production `https://openmanager-ai.vercel.app`, version `8.11.143`, Cloud Run revision `ai-engine-00459-5gg`.

## Result

| Feature | Result | Evidence |
| --- | --- | --- |
| AI Chat | PASS | `/api/ai/supervisor/stream/v2` returned 200 in 3481ms. UI answer included 18 servers, 17 normal, 1 warning, and `cache-redis-dc1-01` memory 84%. |
| Auto Incident Report | FAIL | `/api/ai/incident-report` returned HTTP 200 from Vercel, but the payload was fallback: `success=false`, `source=fallback`, `X-Fallback-Reason=upstream_error`. UI displayed `보고서 생성 실패`. |
| Anomaly/Trend | PASS | `/api/ai/intelligent-monitoring` returned 200 in 1116ms. UI rendered whole-system analysis with 18 servers, 1 warning, and `cache-redis-dc1-01` memory 84%. |

## Root Cause

Cloud Run logs for `ai-engine-00459-5gg` showed Reporter endpoint 400 errors:

- `invalid JSON schema for response_format: 'incident_report': /properties/postmortem/required`
- `invalid JSON schema for response_format: 'incident_report': /properties/affectedServers/items/required`

The Reporter route used AI SDK `Output.object` with a Zod schema containing nested optional fields. The provider's strict structured-output JSON schema requires nested object properties to be explicitly listed as required; optional nested properties caused the upstream 400, which Vercel surfaced as a fallback response.

## Local Fix Prepared

Commit `a4d10314c` fixes the Reporter structured output schema and moves Reporter system instructions from a `messages` system role into the AI SDK `system` option.

Local verification:

- `cd cloud-run/ai-engine && npx vitest run src/routes/analytics-report-utils.test.ts src/routes/analytics.test.ts`: 2 files / 29 tests passed
- `cd cloud-run/ai-engine && npm run type-check`: passed
- `cd cloud-run/ai-engine && npm run test`: 117 files / 1164 tests passed
- `npm run line-guard`: fail 0, warn 44
- `git diff --check`: passed
