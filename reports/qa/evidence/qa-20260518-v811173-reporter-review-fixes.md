# QA Evidence: v8.11.173 Reporter Review Fixes

- Date: 2026-05-18 20:53 KST
- Target: Vercel production `https://openmanager-ai.vercel.app`
- Release: `v8.11.173`
- Commit: `cdbec15ab4f6d567049c8149ad94470813176c7f`
- Vercel deployment: `dpl_EWpPNaJ7EXfkPKngFjwZTpo5mAqy`
- Deployment URL: `https://openmanager-cxyz6razc-skyasus-projects.vercel.app`
- GitLab pipeline: `2533982020`

## Release Checks

- GitLab tag pipeline `2533982020` completed `success`.
- `/api/version` returned `version=8.11.173`, `releaseTag=v8.11.173`, and `commitSha=cdbec15ab4f6d567049c8149ad94470813176c7f`.
- Cloud Run `/health` returned `status=ok`, `service=ai-engine`, `version=8.11.173`, `routesReady=true`, and Redis `degraded=false`.
- Vercel usage check passed: current period effective `$11.4422`, billed `$0.0000`.

## Playwright MCP Flow

1. Navigated to `/`.
2. Confirmed landing version badge `v8.11.173`.
3. Opened `/dashboard` through the landing dashboard CTA.
4. Opened the AI assistant sidebar.
5. Switched to `자동장애 보고서`.
6. Generated a `정기 운영 보고서`.
7. Opened the generated report detail.
8. Captured screenshot: `reports/qa/evidence/qa-20260518-v811173-reporter-review-fixes.png`.

## Observed UI State

- AI Engine status button showed `Ready`.
- Dashboard snapshot showed `18` servers, `17` online, `1` warning, `0` risk, `0` offline.
- Reporter generated one active report with title `서버 상태 정상`.
- Report card showed:
  - Cause: `총 18대 서버가 정상 상태입니다.`
  - Impact: `주의 1대 · 위험 0대`
  - Affected servers: `없음`
- Detail view showed a no-incident postmortem path with:
  - Pattern: `정상 패턴`
  - Timeline: `정보 없음`
  - Recurrence prevention checklist.

## Network Checks

Playwright MCP network log for `/api/` routes:

- `HEAD /api/system` -> `200`
- `GET /api/system` -> `200`
- `POST /api/ai/wake-up` -> `200`
- `GET /api/monitoring/report` -> `200`
- `GET /api/health?service=ai&soft=true` -> `200`
- `POST /api/ai/incident-report` -> `200`

## Scope Notes

- The production UI exercised the Reporter no-incident path after the review fixes.
- Disk threshold timeline behavior and short-window SLA threshold behavior are covered by the committed regression tests because the current production synthetic snapshot did not contain a live disk threshold breach over the production threshold.
- Full visual regression, forced degraded provider fallback, and Cloud Run admin `/monitoring` surfaces were intentionally skipped for this targeted release-facing run.
