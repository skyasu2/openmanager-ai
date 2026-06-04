# QA Evidence: v8.12.90 Pre-Auth System Preload Fix

- Date: 2026-06-05 KST
- Target: Vercel production
- Production URL: https://openmanager-ai.vercel.app
- Version: v8.12.90
- Commit: 36b29a5ca3d7e2505312cee873c6c7653c00e9c6
- GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2577188591
- Vercel deployment: dpl_J1PEim6zfHjgGUoB9NcYqgEH2hVj
- Deployment URL: https://openmanager-5dlwvbbv4-skyasus-projects.vercel.app

## Problem

Pre-auth production landing previously showed a browser console resource error because `preloadCriticalResources()` sent an unauthenticated `HEAD /api/system` request. `/api/system` is intentionally auth-protected, so the product worked but the landing console was not clean.

## Fix

`src/utils/vercel-optimization.ts` now preloads the public health endpoint instead:

- old: `HEAD /api/system`
- new: `HEAD /api/health?service=ai&soft=true`

This keeps auth protection intact and avoids a pre-auth console 401.

## Production Verification

Release/deploy:

- `v8.12.90` release commit and tag were pushed to GitLab.
- GitLab pipeline URL surfaced from production `/api/version`: `2577188591`.
- Vercel production alias points to Ready deployment `dpl_J1PEim6zfHjgGUoB9NcYqgEH2hVj`.
- Production `/api/version` returned version `8.12.90`, release tag `v8.12.90`, and commit `36b29a5ca3d7e2505312cee873c6c7653c00e9c6`.

Smoke:

- `GET /` passed.
- `GET /login` passed.
- `GET /api/version` passed with expected version and commit.

Playwright MCP pre-auth landing check:

- Browser context cookies and storage were cleared before navigation.
- URL: `https://openmanager-ai.vercel.app/?qa=preauth-console-v81290`
- Page title: `OpenManager AI - Operational Decision Support Assistant`
- Browser console messages: `0`
- Observed API requests:
  - `HEAD /api/health?service=ai&soft=true`
  - `POST /api/web-vitals` => 200
- Observed `/api/system` requests: `0`
- Landing rendered the logged-out state with `로그인 후 시작` and footer `v8.12.90`.

Health/cost:

- `HEAD /api/health?service=ai&soft=true` returned HTTP 200 by direct curl.
- `/api/health?service=ai&soft=true` returned healthy AI Engine status.
- Vercel usage check remained normal: effective 1.9358 USD, billed 0.0000 USD.
- Cloud Run was not redeployed for this frontend-only fix and remained on `ai-engine-00592-47p`, cpu=1, memory=512Mi, maxScale=1, traffic=100%.

## Residual

GitLab pipeline API lookup from the local workstation still returns 401 because the local GitLab token is expired. This does not affect the production app. Pipeline identity was recovered from the production `/api/version` payload and local runner process metadata.
