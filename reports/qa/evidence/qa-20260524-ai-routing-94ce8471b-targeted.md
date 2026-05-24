# QA-20260524-0574 Evidence - AI Routing Targeted Check

Recorded by Codex on 2026-05-24 10:59 KST.

## Target

- Vercel UI: https://openmanager-ai.vercel.app
- User-reported Cloud Run AI Engine revision: `94ce8471b`
- User-reported GitLab pipeline: `2548650141`
- Vercel `/api/version` observed during QA: `v8.12.17`, commit `b2f6ccf11a86076e96bca4e5a7daba0b4e4a4f70`, pipeline `2548270166`
- Cloud Run `/health` observed during QA: `status=ok`, `service=ai-engine`, `version=8.12.17`
- Vercel usage check: PASS, billed `0.0000 USD`

## Production Prompt Results

| Prompt | Result | Latency | Evidence |
|---|---|---:|---|
| `현재 정상 범위인 서버 목록 보여줘` | Fail | 1940ms | Returned a server health summary with `정상 16대` and warning servers only. Metadata showed `monitoring-server-health`, not the expected inverse `filterServers(cpu < 80)` / Metrics Query path. |
| `지금 부하가 가장 낮은 서버는?` | Pass | 998ms | Returned `web-nginx-dc1-03`, composite load `28.2점`, CPU `24%`, memory `33%`, disk `27%`. Metadata showed `monitoring-metric-ranking`. |
| `api-was-dc1-01 서버 성능 개선 조언 해줘` | Pass with quality note | 2018ms | Returned non-empty Type C performance guidance instead of an empty response. Response exposed internal wording `TypeC...finalAnswer 호출이 허용됩니다`, so polish remains optional follow-up. |

## Local Follow-Up Fix

Production failure root cause was reproduced in code review: the inverse filter regex matched `정상 범위 서버` but missed `정상 범위인 서버` because `범위인` was not accepted as a token.

Local fix applied:

- `INVERSE_STATUS_FILTER_PATTERN` now accepts `범위인`.
- `INVERSE_STATUS_SIGNALS` and NLQ inverse instruction detection now accept the same wording.
- `buildPreFilterSignal()` now mirrors inverse-filter / minimum-ranking prefilter behavior so trace extraction stays aligned with runtime prefilter policy.

Validation after local fix:

- `cloud-run/ai-engine npm run test -- --run src/services/ai-sdk/routing/query-routing-signals.test.ts src/services/ai-sdk/agents/orchestrator-context.test.ts src/services/ai-sdk/agents/config/instructions/nlq.test.ts` -> `48 passed`
- `cloud-run/ai-engine npm run type-check` -> passed
- `cloud-run/ai-engine npm run test` -> `139 passed`, `1435 passed`
