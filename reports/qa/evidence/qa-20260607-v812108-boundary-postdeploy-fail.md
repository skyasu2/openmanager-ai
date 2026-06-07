# v8.12.108 Cloud Run Direct API Boundary Post-Deploy QA

- Date: 2026-06-07 KST
- Target: `https://ai-engine-jdhrhws7ia-an.a.run.app`
- Release: `v8.12.108`
- GitLab tag pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2582927769

## Result

- PASS: `/health` returned version `8.12.108`.
- PASS: Cloud Run limits remained `cpu=1` and `memory=512Mi`.
- PASS: `/monitoring` without auth returned `403`.
- PASS: `네트워크 I/O 상위 서버 3대 알려줘` returned deterministic metric ranking.
- PASS: contextual follow-up `그중 CPU가 높은 것만` returned deterministic metric ranking.
- FAIL: `GPU 사용률이 가장 높은 서버 3대 알려줘` returned HTTP 500 instead of deterministic unsupported-metric clarification.
- FAIL: `web-nginx-dc9-99 상태 알려줘` returned HTTP 500 or LLM fallback instead of deterministic not-found clarification.
- FAIL: `서버 하나만 자세히 알려줘` used LLM clarification instead of deterministic boundary guard.
- FAIL: `이상 없는 서버 목록` returned correct deterministic content, but response metadata still reported `Analyst Agent`.

## Diagnosis

Cloud Logging showed AI SDK tool validation errors after boundary prompts reached LLM/tool-call planning:

- invalid `metric=gpu` for `getServerMetricsAdvanced`
- attempted `getServerMetrics` tool call when the tool was not available in the selected request tool set

Local source triage found that `monitoring-boundary-guard` produced `responsePolicy=deterministic_clarification`, but supervisor deterministic short-circuit logic accepted only `deterministic_answer`, `deterministic_read_only_advice`, and `deterministic_fail_closed`.

No API keys or secret values are recorded in this evidence.
