# QA Evidence - v8.11.19 Active Alert Targeted Pass

- Recorded at: 2026-04-17 15:11:27 KST
- Target release commit: d9e9f45377c439ddc3f7031ad23c8b991f3cd4ec
- Target deployment ID: dpl_optoHir793ZW8PGSyP6Abghmedg1
- Target deployment URL: https://openmanager-3nl6zit3b-skyasus-projects.vercel.app
- Production URL: https://openmanager-ai.vercel.app
- Production version at verification: `8.11.19`

## Targeted QA Result

- `QA-20260417-0302`
- scope: `targeted`
- target: `vercel-production`
- checks: `4/4` pass

Verified items:

- production `v8.11.19` deployment live
- Active Alerts modal button label no longer includes `:9100`
- AI sidebar prefill text no longer includes `:9100`
- `detectAnomalies` direct path succeeds against the target server without falling back to all-server scan

## Regression Outcome

Previous failure mode:

- `detectAnomalies` returned `cache-redis-dc1-01:9100 서버를 찾을 수 없습니다`
- the query then relied on an all-server fallback path

Verified fixed behavior:

- target server name is normalized without the port suffix
- `detectAnomalies` runs directly on the intended server
- response uses real time-series evidence (`평균 64.9% → 82% 급증`) with `신뢰도 95%`

## Production Verification

Command:

```bash
curl -s https://openmanager-ai.vercel.app/api/version
```

Result:

```json
{"version":"8.11.19","buildVersion":"8.11.19","nextjs":"16.1.6","environment":"production","timestamp":"2026-04-17T06:11:23.778Z"}
```

## Vercel Usage Check

Command:

```bash
npm run check:usage:vercel
```

Result summary:

- billing period: `2026-04-01T07:00:00.000Z..2026-04-17T06:11:27.847Z`
- effective usage: `9.7924 USD`
- billed: `0.0000 USD`
- charge count: `9135`
- interpretation: no unexpected billed usage spike observed
