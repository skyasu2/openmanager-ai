# v8.12.110 Cloud Run Direct API Boundary Post-Deploy QA

- Date: 2026-06-07 KST
- Target: `https://ai-engine-jdhrhws7ia-an.a.run.app`
- Release: `v8.12.110`
- GitLab tag pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2582961881

## Deployment Health

- `/health` returned version `8.12.110`.
- Cloud Run service URL: `https://ai-engine-jdhrhws7ia-an.a.run.app`.
- Cloud Run limits remained free-tier aligned: `cpu=1`, `memory=512Mi`.
- Vercel production version smoke passed for `v8.12.110` on attempt 1/81.

## Direct API Result

All six direct `/api/ai/supervisor` boundary prompts passed:

1. `네트워크 I/O 상위 서버 3대 알려줘`
   - `provider=deterministic`
   - `finalAgent=Metrics Query Agent`
   - `domainEvidence.id=monitoring-metric-ranking`
2. `GPU 사용률이 가장 높은 서버 3대 알려줘`
   - `provider=deterministic`
   - `finalAgent=Metrics Query Agent`
   - `domainEvidence.id=monitoring-boundary-guard`
   - `responsePolicy=deterministic_clarification`
3. `web-nginx-dc9-99 상태 알려줘`
   - deterministic not-found clarification
   - `domainEvidence.id=monitoring-boundary-guard`
4. `서버 하나만 자세히 알려줘`
   - deterministic ambiguous-target clarification
   - `domainEvidence.id=monitoring-boundary-guard`
5. `이상 없는 서버 목록`
   - deterministic server-health answer
   - `finalAgent=Metrics Query Agent`
   - `domainEvidence.id=monitoring-server-health`
6. Context follow-up `그중 CPU가 높은 것만`
   - target scope preserved
   - deterministic metric ranking for `lb-haproxy-dc1-01`

## Observability Note

`npm run langfuse:check -- --limit 50 --q supervisor` succeeded. The sampled trace list still included earlier v8.12.108/v8.12.109 failure traces and did not yet show the final 22:30 KST direct API calls in the first 50 rows, so direct API responses are the primary acceptance evidence for this run.

No API keys or secret values are recorded in this evidence.
