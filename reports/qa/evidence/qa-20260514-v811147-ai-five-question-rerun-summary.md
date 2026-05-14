# v8.11.147 AI Five-Question Rerun Summary

- Target: https://openmanager-ai.vercel.app
- Method: Playwright MCP, Vercel production UI path
- Build: v8.11.147, commit e506aeb61eca0318c72f738fa939c915dd995f79
- Dashboard snapshot: 18 total, 17 online, 1 warning, 0 critical, 0 offline, 13:50 KST slot 83/143
- Console errors/warnings observed by MCP script: 0

## Results

| Check | Result | Evidence |
|---|---|---|
| Production version/health | PASS | `/api/version` 200, `/api/health` 200 |
| Dashboard boot | PASS | Landing "시스템 시작" to `/dashboard`, system API 200 |
| Q1 fleet status | PASS | 18 total, 17 normal, 1 warning, no critical/offline |
| Q2 server detail | PASS | `web-server-01 -> web-nginx-dc1-01`, online, CPU 36%, memory 45%, disk 30%, network 1%, load and response-time included |
| Q3 24h peak load | PASS | Peak load1 time `2026-05-14 03:50`, max 16.58, top servers listed |
| Q4 action needed | PASS | No immediate-action target; one caution target `cache-redis-dc1-01`; no contradictory conclusion |
| Q5 network filter | PASS | No `network > 70%` server found; network filter path completed |

## Notes

- This is a user-requested Playwright MCP rerun of the already-recorded v8.11.147 closure surface, so the QA tracker run is recorded as verification-only and non-counting.
- The first automation pass advanced before one async answer completed. The final evidence rechecked completion and reran the missing action-needed prompt through the UI input path.
