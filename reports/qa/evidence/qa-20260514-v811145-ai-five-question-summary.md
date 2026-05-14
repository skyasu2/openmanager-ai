# QA Evidence - v8.11.145 Vercel AI Five-Question Check

- Target: `https://openmanager-ai.vercel.app`
- Method: Playwright MCP, authenticated guest session, AI Assistant sidebar UI fill/click path only
- Time: 2026-05-14 10:05-10:11 KST
- Production version: `8.11.145`
- Production commit: `f8588b97fbcd7d21bc94d90a75b817c73f960046`
- Release tag: `v8.11.145`
- Version pipeline: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2521541297`
- Health: `/api/health` returned `success=true`, database/cache/ai `connected`

## Deployment Gap

The latest Cerebras graceful-exit implementation commit `a512fb6a4` was already merged and validated on GitLab main, but this Vercel production deployment still reports commit `f8588b97`.

Result: this QA verifies current Vercel production AI-path regression behavior and confirms the deployment gap. It does not prove the new Cerebras date-gate behavior on Vercel until a semver tag deployment promotes `a512fb6a4` or later.

## Dashboard Baseline Observed

- OTel snapshot: `10:00 KST (slot 60/143)`
- Server total: `18`
- Online/warning/risk/offline: `16 / 1 / 1 / 0`
- Resource summary: CPU `40%`, Memory `50%`, Disk `34%`
- Top alerts: `api-was-dc1-01 CPU 92%`, `api-was-dc1-02 CPU 85%`, `db-mysql-dc1-primary MEM 77%`, `db-mysql-dc1-backup DISK 70%`

## Conversational AI QA

| # | Question | Result | Evidence |
|---|---|---|---|
| 1 | 현재 서버 전체 상태를 요약해줘 | Pass | Returned 18 total, 16 normal, 1 warning, 1 risk/offline 0, CPU/MEM/DISK averages, and `api-was-dc1-01 CPU 92%` / `api-was-dc1-02 CPU 85%` risk context. Metadata: `Cloud Run AI`, tool `서버 메트릭 조회`, recent 1h. |
| 2 | web-server-01 상태를 자세히 알려줘 | Warn | Returned concrete CPU `23.4%`, memory `41.2%`, disk `32.5%`, but metadata was `일반 대화 응답` rather than explicit metric-tool grounding. |
| 3 | 지난 24시간 중 가장 부하가 높았던 시간대는 언제야? | Pass | Returned peak time `2026-05-14 03:50`, `load1=16.58`, top servers `db-mysql-dc1-primary`, `db-mysql-dc1-replica`, `api-was-dc1-01`. Metadata: `모니터링 피크 지표 근거`. |
| 4 | 지금 당장 조치가 필요한 서버가 있어? | Warn | Identified `api-was-dc1-01` with CPU `92%` and actionable checks, but metadata was `일반 대화 응답` rather than explicit metric-tool grounding. |
| 5 | 방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘 | Pass | Returned no servers matching `network > 70%`. Metadata: `Cloud Run AI`, tool `대상 서버 추리기`, recent 1h. |

## Console/Network Notes

- Known landing pre-auth `/api/system` 401 console resource error was observed once and matches the existing WONT-FIX tracker item `landing-console-api-system-unauthorized`.
- Authenticated dashboard `/api/system` checks later returned 200.
- AI calls completed through UI path with 200/201 statuses. See `qa-20260514-v811145-ai-five-question-network.txt`.

## Operator Judgment

The tested production AI path is usable with no empty responses or HTTP failures. Quality is `conditional` because two standard questions produced usable answers through generic response metadata, and because the current Vercel deployment does not include the latest Cerebras graceful-exit implementation commit.
