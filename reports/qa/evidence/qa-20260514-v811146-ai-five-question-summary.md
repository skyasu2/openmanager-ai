# v8.11.146 Vercel Playwright MCP QA - AI Five-Question Result

- Date: 2026-05-14 KST
- Target: `https://openmanager-ai.vercel.app`
- Release: `v8.11.146`
- Commit: `3cc313e108acdc6f57ebda15537fb1fc5a78bc62`
- GitLab tag pipeline: `2523965014` success
- Pipeline URL: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2523965014`

## Deployment Checks

- `/api/version` served `8.11.146`, release tag `v8.11.146`, commit `3cc313e108`.
- `/api/health` returned success with database, cache, and AI connected.
- Landing footer showed `v8.11.146`.
- Guest session was active and `/dashboard` rendered successfully.
- AI Assistant sidebar opened with AI Engine `Ready`.

## Dashboard Baseline

- OTel snapshot: `10:40 KST (slot 64/143)`
- Total servers: 18
- Online: 16
- Warning: 1
- Risk: 1
- Offline: 0
- Resource summary: CPU 40%, Memory 51%, Disk 36%
- Top alerts: `api-was-dc1-01 CPU 93%`, `api-was-dc1-02 CPU 89%`, `db-mysql-dc1-primary MEM 79%`, `db-mysql-dc1-backup DISK 69%`, `db-mysql-dc1-replica MEM 58%`

## Conversational AI Standard Five-Question QA

| # | Prompt | Result | Evidence |
|---|---|---|---|
| 1 | `현재 서버 전체 상태를 요약해줘` | PASS | Answer summarized 18 total, 16 normal, 1 warning, 1 danger, 0 offline; identified `api-was-dc1-01` and `api-was-dc1-02`; metadata showed Cloud Run AI and monitoring evidence. |
| 2 | `web-server-01 상태를 자세히 알려줘` | FAIL | Answer repeated the whole-fleet summary instead of a `web-server-01` detail. Rerun reproduced the failure and again used `monitoring-server-health` whole-fleet summary. |
| 3 | `지난 24시간 중 가장 부하가 높았던 시간대는 언제야?` | PASS | Answer identified peak `2026-05-14 03:50`, load1 max `16.58`, top average `9.08`, and top servers. |
| 4 | `지금 당장 조치가 필요한 서버가 있어?` | FAIL | Initial five-question sequence identified `api-was-dc1-01` as immediate-action and `api-was-dc1-02` as caution, but later contradicted itself by saying immediate action was not required. |
| 5 | `방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘` | PASS | Answer found no servers over `network > 70%` and provided top network references. |

## Focused Rerun

- New conversation rerun for Q2 reproduced the failure: `web-server-01 상태를 자세히 알려줘` returned a whole-fleet status summary.
- Follow-up Q4 rerun was affected by the prior `web-server-01` context and answered that `web-server-01` was normal. This is kept as context evidence, not as a closure of the original sequence contradiction.

## Decision

Release deployment is healthy, but AI conversational QA is no-go until:

1. server-specific detail prompts resolve to a matching server detail path instead of whole-fleet summary.
2. action-needed answers keep a single, non-contradictory conclusion.
