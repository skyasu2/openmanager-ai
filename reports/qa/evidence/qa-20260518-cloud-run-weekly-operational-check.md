# Cloud Run Weekly Operational Check

Target: Google Cloud Run `ai-engine`
Project: `openmanager-free-tier`
Region: `asia-northeast1`
Checked at: 2026-05-18T10:31:40+09:00

## Recent Change Scope

Reviewed commits since 2026-05-12 KST. The current live frontend is `v8.11.169`; Cloud Run reports `8.11.167`.

Cloud Run version difference is expected:

- Current Cloud Run `BUILD_SHA`: `c14fc685`
- Current frontend commit: `8e294644304f181bff1f74fa4fe4936bde833ebe`
- `c14fc685..HEAD` contains frontend diagram/landing/report/package-version changes, but no `cloud-run/ai-engine` runtime code changes.
- Therefore no Cloud Run redeploy is required for the `v8.11.168`/`v8.11.169` frontend-only changes.

## Cloud Run Service State

- Service: `ai-engine`
- URL: `https://ai-engine-jdhrhws7ia-an.a.run.app`
- Latest ready revision: `ai-engine-00481-8cl`
- Latest created revision: `ai-engine-00481-8cl`
- Traffic: `100%` to latest revision
- Ready condition: `True`
- Created: `2026-05-17T18:01:16Z`
- Resource limits: `cpu=1`, `memory=512Mi`
- Container concurrency: `16`
- Max scale: `1`

## Direct Health

`GET https://ai-engine-jdhrhws7ia-an.a.run.app/health`

- status: `ok`
- service: `ai-engine`
- version: `8.11.167`
- routesReady: `true`
- routeRegistrationFailed: `false`
- redis configured: `true`
- redis degraded: `false`
- provider config flags:
  - supabase `true`
  - upstash `true`
  - groq `true`
  - mistral `true`
  - zai `true`
  - cerebras `true`
  - tavily `true`
  - gemini `true`
  - openrouter `true`
  - langfuse `true`
  - cloudRunApi `true`

`GET /monitoring` without auth returned `403`, which is expected for the protected admin monitoring endpoint.

## Vercel To Cloud Run Health

`GET https://openmanager-ai.vercel.app/api/health`

- status: `healthy`
- database: connected, `21ms`
- cache: connected, `20ms`
- ai: connected, `20ms`
- version: `8.11.169`

`GET https://openmanager-ai.vercel.app/api/version`

- version: `8.11.169`
- commit: `8e294644304f181bff1f74fa4fe4936bde833ebe`
- releaseTag: `v8.11.169`
- pipeline: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2532228902`

## Logs

Cloud Run ERROR logs since `2026-05-17T00:00:00Z`:

- `2026-05-17T15:54:14Z`: older revision `ai-engine-00480-27k`, version `8.11.166`, query `네 env 알려줘`, provider `groq`
- `2026-05-17T16:42:24Z`: older revision `ai-engine-00480-27k`, version `8.11.166`, query `네 env 알려줘`, provider `groq`

Current revision check:

- `ai-engine-00481-8cl` after `2026-05-17T18:01:00Z`: no `severity>=ERROR` logs.
- Recent current-revision requests include health/status `200`; one `403` was the intentional unauthenticated `/monitoring` check.

## Cost Guard

- Recent Cloud Run resource limits remain within baseline: `1 CPU / 512Mi`.
- Latest 20 Cloud Build rows: `SUCCESS`.
- Last 200 Cloud Build rows: `options.machineType` empty for all `200`, so no paid-machine signature was found.
- Vercel usage already checked in current QA run: effective `$10.7667`, billed `$0.0000`.

## Decision

Current operational status: `go`.

No active Cloud Run runtime regression was found. The only observed ERROR logs belong to the previous `8.11.166` revision and do not recur on the current `8.11.167` Cloud Run revision.
