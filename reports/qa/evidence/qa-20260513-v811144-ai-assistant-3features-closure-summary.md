# v8.11.144 AI Assistant 3-Feature Closure QA

Date: 2026-05-13 14:22 KST

Target:
- Frontend: Vercel production `https://openmanager-ai.vercel.app`
- Version: `8.11.144`
- Commit: `fb61ce00bda07b6a020f6c60f6b921378d8d70f9`
- Vercel deployment: `dpl_HYnFzNmCeri7QZiyxGSebLcycmvX`
- Cloud Run revision: `ai-engine-00460-ng4`
- GitLab pipeline: `2521174683`

## Result

| Function | Result | Evidence |
|---|---|---|
| AI Chat | PASS | `/api/ai/supervisor/stream/v2` returned 200. Answer included 18 total servers, 17 normal, 1 warning, and `cache-redis-dc1-01` memory 83%. |
| Auto Incident Report | PASS | `/api/ai/incident-report` returned 200. UI rendered a report card titled `Redis 서버 메모리 경고 및 쿼리 성능 이슈`; no fallback failure banner. |
| Anomaly/Trend | PASS | `/api/ai/intelligent-monitoring` returned 200. UI rendered 18 servers, 1 warning, and cache-redis memory risk. |

## Closure

The v8.11.143 Reporter failure was caused by strict structured-output schema incompatibility in nested optional fields.
v8.11.144 deployed the schema fix to Cloud Run and the same production UI flow now generates the incident report successfully.

Artifactization note:
- Incident report and monitoring-analysis artifact generators already exist.
- The sidebar function screens still execute their own API/state path directly.
- Full absorption into a single artifact execution/rendering layer remains a separate SDD refactor candidate, not part of this production regression fix.
