# QA Evidence: v8.11.193 Cerebras gpt-oss-120b Release Verification

> Owner: qa
> Status: Evidence
> Doc type: QA Evidence
> Last reviewed: 2026-05-21
> Tags: qa,release,ai-engine,cerebras,vercel,cloud-run

## Scope

- Release: `v8.11.193`
- Release commit: `02d08f22c6c428c51902ffb79c5febb45de471e9`
- Change under verification: Cerebras default model switched to `gpt-oss-120b` before `llama3.1-8b` deprecation on 2026-05-27.
- QA type: targeted release/deploy verification.

## Pre-release Validation

- AI Engine `npm run type-check`: PASS
- AI Engine `npm run test`: PASS, 138 files / 1370 tests
- Root `npm run test:contract`: PASS, 3 files / 24 tests
- Release dry run selected next version `8.11.193`.
- Base production drift gate confirmed current production served `8.11.192` before release.

## Release and Deploy Evidence

- Release command: `./scripts/release/publish.sh patch`
- Release commit created: `02d08f22c chore(release): 8.11.193`
- Tag pushed: `v8.11.193`
- GitLab tag pipeline: `2542047885`
- GitLab tag pipeline status: success
- Frontend deploy job: success
- AI Engine deploy job: success
- Frontend post-deploy smoke: success
- AI Engine post-deploy smoke: success

## Production Checks

### Frontend Version

`GET https://openmanager-ai.vercel.app/api/version` returned:

- `version`: `8.11.193`
- `releaseTag`: `v8.11.193`
- `commitSha`: `02d08f22c6c428c51902ffb79c5febb45de471e9`
- `pipelineUrl`: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2542047885`

### AI Engine Smoke

`AI_ENGINE_EXPECTED_VERSION=8.11.193 bash scripts/ci/ai-engine-post-deploy-smoke.sh` returned:

- `GET /health`: PASS
- `GET /warmup`: PASS
- `GET /monitoring` unauthenticated: PASS with expected `403`
- smoke summary: PASS

### AI Engine Health

Cloud Run `/health` returned:

- `status`: `ok`
- `version`: `8.11.193`
- config flags: `supabase`, `upstash`, `groq`, `mistral`, `zai`, `cerebras`, `tavily`, `gemini`, `langfuse`, `cloudRunApi` all true

### Provider Metadata

Cloud Run `/api/ai/providers` confirmed:

- Cerebras primary metadata:
  - `provider`: `cerebras`
  - `role`: `primary Cerebras model`
  - `modelId`: `gpt-oss-120b`
  - `lifecycle`: `production`
  - `productionModel`: `true`
  - `deprecated`: `false`
  - `enabled`: `true`
- Legacy Cerebras metadata remains explicitly bounded:
  - `modelId`: `llama3.1-8b`
  - `deprecationDate`: `2026-05-27`
  - `recommendedReplacement`: `cerebras:gpt-oss-120b`
  - `blockAfterDeprecation`: `true`

## Usage Check

`npm run check:usage:vercel` returned:

- status: PASS
- effective: `13.3467 USD`
- billed: `0.0000 USD`
- chargeCount: `11571`

## Skipped Scope

- No Playwright UI pass was run for this release because the changed surface is AI Engine provider/model policy, not frontend UI behavior.
- No live LLM conversational QA was repeated. Provider metadata, CI smoke, and local contract tests cover this deployment path while preserving provider quota.
- Vision real-image QA was not in scope.

## Result

Targeted release verification passed. Production frontend and Cloud Run AI Engine both serve `8.11.193`, and Cloud Run provider metadata exposes Cerebras `gpt-oss-120b` as the primary production model.
