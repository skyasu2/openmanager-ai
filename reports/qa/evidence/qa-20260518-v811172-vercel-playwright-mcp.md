# v8.11.172 Vercel Playwright MCP Targeted Check

- Checked at: 2026-05-18 19:15 KST
- Target: `https://openmanager-ai.vercel.app`
- Vercel deployment: `dpl_8mZ3ciQgf8UU7i2a3smsw6fxiXaG`
- Release tag: `v8.11.172`
- Commit: `2aec191db87e94fa7060200a78e68447a460d0f9`
- Pipeline: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2532907618`
- Tooling: Playwright MCP

## Results

- `/api/version` returned `8.11.172`, `v8.11.172`, commit `2aec191db87e94fa7060200a78e68447a460d0f9`, and `production`.
- `/api/health` returned `200` with database/cache/AI services connected.
- Landing and `/login` rendered with version `v8.11.172`.
- `/dashboard` rendered the OTel snapshot, 18 total servers, 17 online, 1 warning, 0 risk, 0 offline.
- AI sidebar opened and Reporter surface generated an incident report through the UI.
- Network check observed `POST /api/ai/incident-report => 200`.
- Browser console warnings/errors were `0`.

## Reporter Metadata Boundary

- Visible Reporter card text did not contain `_fallbackReason`, public `fallbackReason`, raw provider reason text, or `provider_*` reason codes.
- `sessionStorage.openmanager-artifact-workspace` replay pack did not contain `_fallbackReason`, `fallbackReason`, `fallbackReasonCode`, `fallbackSource`, `degradation`, `reporter_degraded`, `tool-based`, or `provider_*`.
- Generated artifact summary:
  - `sourceMode`: `tool-result`
  - `artifactKind`: `incident-report`
  - `reportSeverity`: `high`
  - `affectedServers`: `lb-haproxy-dc1-01`, `web-nginx-dc1-01`
  - `recommendationCount`: `3`

## Evidence

- Screenshot: `reports/qa/evidence/qa-20260518-v811172-reporter-mcp.png`

## Notes

- This run verified the deployed production release `v8.11.172`. Local `main` has a newer font bundle-budget commit `6e10e37eb6e9bb1fef80ac73a3d7cec8a95c4353`, but no matching Vercel production deployment was present during this check.
- A forced degraded Reporter provider failure was not triggered in production to avoid repeated live-provider manipulation; degraded-success contract remains covered by the local regression tests listed in `reports/qa/evidence/qa-20260518-v811172-reporter-degraded-metadata.md`.
