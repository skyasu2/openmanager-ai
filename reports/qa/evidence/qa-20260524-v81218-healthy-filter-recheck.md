# QA-20260524-0575 Evidence - v8.12.18 Healthy Filter Recheck

Recorded by Codex on 2026-05-24 11:25 KST.

## Target

- Vercel UI: https://openmanager-ai.vercel.app
- Version: `8.12.18`
- Commit: `dcd012fd0cf7f886b0afd326467eb538786fe149`
- GitLab pipeline: `2548681561`
- Cloud Run `/health`: `status=ok`, `service=ai-engine`, `version=8.12.18`
- Vercel usage check: PASS, billed `0.0000 USD`

## Prompt Result

Prompt: `현재 정상 범위인 서버 목록 보여줘`

Result: Fail.

Observed response:

- Returned `📊 서버 현황 요약`
- Reported `전체 18대: 정상 17대, 경고 1대, 위험 0대, 오프라인 0대`
- Listed warning server `api-was-dc1-01: CPU 82%`
- Metadata showed `도구: monitoring-server-health`

Expected behavior:

- Preserve healthy-only intent and return a normal-range server list.
- Use deterministic healthy-only evidence, not a generic fleet health summary.

Local follow-up after this failed QA:

- `parseCurrentMetricsFrame()` now preserves `statusFilter: "healthy-only"` when an upstream `server_health` intentFrame is present but the raw user message asks for normal-range / healthy-only servers.
- Added regression coverage for the exact prompt with whole-fleet `server_health` metadata frame.

Validation after local follow-up:

- `cloud-run/ai-engine npm run test -- --run src/domains/monitoring/current-metrics-evidence-provider.test.ts src/services/ai-sdk/routing/query-routing-signals.test.ts src/services/ai-sdk/agents/orchestrator-context.test.ts src/services/ai-sdk/agents/config/instructions/nlq.test.ts` -> `75 passed`
- `cloud-run/ai-engine npm run type-check` -> passed
- `cloud-run/ai-engine npm run test` -> `139 passed`, `1436 passed`
