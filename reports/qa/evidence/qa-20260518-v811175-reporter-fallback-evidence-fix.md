# v8.11.175 Reporter Fallback Evidence Fix QA

- Date: 2026-05-18 23:46 KST
- Target: https://openmanager-ai.vercel.app
- Vercel deployment: `dpl_C8eLVUEdzSPMY83AwFUezu7ybd8V`
- Deployment URL: https://openmanager-gfgclo7qa-skyasus-projects.vercel.app
- Release: `v8.11.175`
- Release commit: `7da68ac4a1772efbe83ee7760f77affe4396cf46`
- Fix commit: `7fbcd87118ad1e97915df2e3afdd3f0f70d5cb42`
- GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2534475056
- Source: Playwright MCP on Vercel production

## Finding Before Fix

On `v8.11.174`, the dashboard showed a warning state, while the generated Reporter card said `서버 상태 정상`.

- Dashboard slot: `23:00 KST (slot 138/143)`
- Dashboard state: `17 online`, `1 warning`, `0 risk`, `0 offline`
- `POST /api/ai/incident-report`: `200`
- Request queryAsOf: `slotIndex=138`, `timeLabel=23:00 KST`
- Reporter response evidence included warning/critical log evidence, but the fallback report summary stayed normal:
  - title: `서버 상태 정상`
  - affected servers: none
  - recommendations: none
  - fallbackSource: `tool-based`
  - fallbackReasonCode: `provider_schema_drift`
- Screenshot: `reports/qa/evidence/qa-20260518-v811174-reporter-fallback-mismatch.png`

## Fix Applied

Reporter tool-based fallback now merges monitoring grounding evidence into the fallback report:

- warning/critical monitoring evidence affects report severity, title, affected servers, timeline, and system summary
- log evidence creates read-only diagnostic recommendations
- server-scoped reports filter grounding evidence to the requested server
- metric anomaly fallback behavior remains intact

## Local Verification

- `cd cloud-run/ai-engine && npm test -- src/routes/analytics-report-utils.test.ts`: `27/27` passed
- `cd cloud-run/ai-engine && npm test -- src/routes/analytics-report-utils.test.ts src/routes/analytics.test.ts`: `43/43` passed
- `cd cloud-run/ai-engine && npm run type-check`: passed
- `cd cloud-run/ai-engine && npm run test`: `1333/1333` passed
- `npm run test:contract`: `24/24` passed
- `git diff --check`: passed
- Main validate pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2534462479 success
- Release pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2534475056 success

## Production Recheck After Fix

`/api/version`:

```json
{
  "version": "8.11.175",
  "commitSha": "7da68ac4a1772efbe83ee7760f77affe4396cf46",
  "releaseTag": "v8.11.175",
  "pipelineUrl": "https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2534475056"
}
```

Playwright MCP flow:

1. Opened `/dashboard`.
2. Confirmed dashboard slot `23:40 KST (slot 142/143)`.
3. Confirmed state: `17 online`, `1 warning`, `0 risk`, `0 offline`.
4. Confirmed top resource warning: `storage-nfs-dc1-01 DISK 85%`.
5. Opened AI Assistant.
6. Confirmed `AI 엔진 상태: Ready`.
7. Opened `자동장애 보고서`.
8. Generated `장애 보고서 현재 임계치 초과 서버와 조치 우선순위 정리`.
9. Confirmed `POST /api/ai/incident-report => 200`.
10. Confirmed request queryAsOf: `slotIndex=142`, `timeLabel=23:40 KST`.
11. Expanded report detail.

Observed Reporter result:

- title: `디스크 사용량 경고: storage-nfs-dc1-01 서버`
- active reports: `1`
- severity bucket: `경고 (1)`, not normal/info
- impact summary: `주의 2대 · 위험 1대`
- affected server: `storage-nfs-dc1-01`
- detected anomaly: `storage-nfs-dc1-01 - Disk 85%`
- recommendations included read-only commands:
  - `du -sh /* 2>/dev/null | sort -hr | head -10`
  - `df -h && mount | grep -E "nfs|s3|fuse"`
  - `journalctl -xe --no-pager | grep -i "mysql\\|innodb" | tail -50`

Screenshot: `reports/qa/evidence/qa-20260518-v811175-reporter-fallback-evidence-fixed.png`

## Usage Check

`npm run check:usage:vercel`:

- context: `skyasus-projects`
- period: `2026-05-01T07:00:00.000Z..2026-05-18T14:45:55.928Z`
- effective: `$11.4422`
- billed: `$0.0000`
- result: checked, no unexpected billed usage observed during this QA.

## Skipped

- Full visual regression pack.
- Standard five-question conversational AI suite.
- Manual forced provider failure after deploy; the live production path naturally exercised Reporter degraded fallback because the endpoint returned `provider_schema_drift` during the initial failure.
