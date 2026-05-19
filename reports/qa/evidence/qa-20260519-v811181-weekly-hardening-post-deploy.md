---
runId: QA-20260519-0537
createdAt: 2026-05-19T16:37:23+09:00
target: vercel-production
release: v8.11.181
source: playwright-mcp
---

# v8.11.181 Weekly Hardening Post-Deploy QA Evidence

## Environment

- URL: `https://openmanager-ai.vercel.app`
- Version endpoint: `8.11.181`
- Commit: `cb05a58efae1b0059b652f5c7222a29023a5d134`
- GitLab tag pipeline: `2536315753` success
- Guest auth path: `/login` PIN login, then `/dashboard/ai-assistant?qa=v811181`

## Checks

- `/api/version` returned `8.11.181`, `releaseTag=v8.11.181`, `pipelineUrl=https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2536315753`.
- AI Chat remediation query `cache-redis-dc1-01 메모리 경고 조치 방법을 명령어 중심으로 알려줘` returned command-focused output with `redis-cli --bigkeys`, `redis-cli MEMORY USAGE <key>`, and `redis-cli INFO memory`; footer showed deterministic `service-command-catalog`.
- `/api/ai/intelligent-monitoring` single-server `analyze_server` returned HTTP 200 with `X-Cache=HIT`, `X-AI-Source=cache`, `X-AI-Provider=deterministic`, `X-AI-Model=monitoring-analyze-server`.
- The cached response shape was normalized: `success=true`, `data` object present, legacy top-level `response` absent, `data.serverId=cache-redis-dc1-01`, and `data.metadata.usedFallback=false`.
- The `/dashboard/ai-assistant` 이상감지/추세 tab selected `cache-redis-dc1-01` and completed single-server analysis without the previous `분석 실패` state.
- UI result displayed current status with 2 anomalies, CPU 71%, memory 92%, disk normal, and trend/insight sections.
- Vercel usage check: `npm run check:usage:vercel` passed via `vercel usage --format json --non-interactive`; effective usage `12.6977 USD`, billed `0.0000 USD`.

## Notes

- v8.11.180 production QA reproduced the single-server UI failure while direct API MISS already normalized. Root cause was stale cached legacy `{ response: string }` data bypassing normalization on cache HIT.
- v8.11.181 applies normalization after `withAICache`, so both MISS and HIT paths expose the same `data` object contract.
