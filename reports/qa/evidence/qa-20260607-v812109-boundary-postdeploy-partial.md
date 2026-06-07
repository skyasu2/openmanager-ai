# v8.12.109 Cloud Run Direct API Boundary Post-Deploy QA

- Date: 2026-06-07 KST
- Target: `https://ai-engine-jdhrhws7ia-an.a.run.app`
- Release: `v8.12.109`
- GitLab tag pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2582950316

## Result

- PASS: `/health` returned version `8.12.109`.
- PASS: `네트워크 I/O 상위 서버 3대 알려줘` returned deterministic `monitoring-metric-ranking`.
- PASS: `GPU 사용률이 가장 높은 서버 3대 알려줘` returned deterministic `monitoring-boundary-guard` with `responsePolicy=deterministic_clarification`.
- PASS: `web-nginx-dc9-99 상태 알려줘` returned deterministic not-found clarification.
- PASS: `서버 하나만 자세히 알려줘` returned deterministic ambiguous-target clarification.
- PASS: contextual follow-up `그중 CPU가 높은 것만` preserved target scope and returned deterministic ranking.
- FAIL: `이상 없는 서버 목록` returned correct deterministic `monitoring-server-health` content, but metadata still reported `finalAgent=Analyst Agent`.

## Diagnosis

The remaining failure is metadata-only. `getIntentCategory()` checks the broad anomaly regex before inverse healthy-status filters, so the substring `이상` in `이상 없는 서버` is classified as anomaly even though domain evidence and answer content are deterministic metrics/server-health.

No API keys or secret values are recorded in this evidence.
