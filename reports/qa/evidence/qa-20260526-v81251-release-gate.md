# QA Evidence: v8.12.51 Release Gate

- Target: Vercel production, `https://openmanager-ai.vercel.app`
- Version endpoint: `8.12.51`, commit `ad7735e728ad64d8f8a6fb3a99eee51ea4917b3b`, tag `v8.12.51`
- GitLab release pipeline: `2553301909`, success
- Cloud Run service URL: `https://ai-engine-jdhrhws7ia-an.a.run.app`
- Cloud Run revision: `ai-engine-00559-62w`
- Cloud Run health: `status=ok`, `service=ai-engine`, `version=8.12.51`, routes ready
- Cloud Run limits: `cpu=1`, `memory=512Mi`
- Vercel usage: effective `17.2740 USD`, billed `0.0000 USD`

## Route Checks

- `/`: title `OpenManager AI - Operational Decision Support Assistant`, H1 `OpenManager AI`, version `v8.12.51` visible.
- `/login`: title `Login | OpenManager AI`, guest PIN and provider login options visible, version `v8.12.51` visible.
- `/dashboard`: title `Dashboard | OpenManager AI`, OTel snapshot `21:40 KST`, 18 servers, online 17, warning 0, critical 1, offline 0.
- Dashboard resources: CPU 40%, Memory 46%, Disk 37%.
- Top alerts: `lb-haproxy-dc1-01 CPU 85%`, `api-was-dc1-01 CPU 77%`, `api-was-dc1-02 CPU 73%`, `lb-haproxy-dc1-03 CPU 71%`, `db-mysql-dc1-backup DISK 70%`.

## Conversational AI Standard Five

1. `현재 서버 전체 상태를 요약해줘`
   - PASS: returned 18 total servers, averages CPU 40%, Memory 46%, Disk 37%, and top affected servers.
   - Evidence path: `monitoring-server-health`, Cloud Run AI / streaming response.
   - Note: the AI health severity taxonomy is not a direct parity check against the dashboard host-status tile.

2. `web-server-01 상태를 자세히 알려줘`
   - PASS: resolved alias `web-server-01 -> web-nginx-dc1-01`.
   - Returned CPU 32%, Memory 47%, Disk 31%, Network 1%, load1 1.09, load5 0.98, response time 462ms.
   - Evidence path: `monitoring-server-health`, `/api/ai/supervisor/stream/v2` duration 833ms.

3. `지난 24시간 중 가장 부하가 높았던 시간대는 언제야?`
   - PASS: returned peak time `2026-05-26 03:50`, load1 max 16.58, top server `db-mysql-dc1-primary`.
   - Evidence path: `monitoring-peak-metric`.
   - Network path: `/api/ai/jobs` duration 1144ms, `/api/ai/jobs/:id/stream` duration 838ms.

4. `지금 당장 조치가 필요한 서버가 있어?`
   - PASS: returned immediate action server `lb-haproxy-dc1-01` at CPU 85% critical, plus warning servers `api-was-dc1-01` and `api-was-dc1-02`.
   - Evidence path: `monitoring-server-health`, `/api/ai/supervisor/stream/v2` duration 515ms.

5. `방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘`
   - PASS: preserved previous target set and filtered to `lb-haproxy-dc1-01` with Network 89.9% critical.
   - Evidence path: `monitoring-metric-current`.
   - Network path: `/api/ai/jobs` duration 750ms, `/api/ai/jobs/:id/stream` duration 2545ms.

## Artifacts

- Screenshot: `reports/qa/evidence/qa-20260526-v81251-ai-standard-five.png`
