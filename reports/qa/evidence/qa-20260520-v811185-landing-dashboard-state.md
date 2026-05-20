# QA Evidence - v8.11.185 Landing + Dashboard State

Date: 2026-05-20 KST
Target: https://openmanager-ai.vercel.app
Version: 8.11.185
Commit: 5dc589362a921687b1f51bdd0c8f30ea3a6bb564
Pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2540065960

## Deployment

- GitLab tag pipeline `2540065960`: success
- Frontend `deploy`: success after retrying transient Vercel API upload failure
- Frontend `post_deploy_smoke`: success
- AI Engine `deploy_ai_engine`: success
- AI Engine `post_deploy_ai_engine_smoke`: success
- Post-deploy smoke:
  - `/`: pass
  - `/login`: pass
  - `/api/version`: pass, version `8.11.185`, commit `5dc589362a921687b1f51bdd0c8f30ea3a6bb564`

## Landing AI Text

Checked the hero `AI` span on production.

- Class: `landing-title-ai`
- `filter`: `none`
- `transform`: `none`
- `opacity`: `1`
- `text-rendering`: `geometricprecision`
- `-webkit-font-smoothing`: `antialiased`
- `text-shadow`: reduced dark shadow plus low-opacity cyan glow
- Screenshot: `reports/qa/evidence/qa-20260520-v811185-landing-ai.png`

Result: pass. The `AI` text is still intentionally stylized, but no CSS blur/filter is applied and the glow is restrained.

## Dashboard Server Status

Checked production `/dashboard` after guest session route from landing.

Visible dashboard values:

- Total: `18`
- Online: `17`
- Warning: `1`
- Risk: `0`
- Offline: `0`
- System resources: CPU `31%`, Memory `44%`, Disk `37%`
- Server list header: `상위 알림 서버 8개 표시 (전체 18대)`
- First warning card: `lb-haproxy-dc1-01`, CPU `62.0%`, MEM `36.0%`, Disk `24.0%`, label `경고`
- Screenshot: `reports/qa/evidence/qa-20260520-v811185-dashboard-status.png`

Cross-check against `/api/servers-unified?limit=18`:

- API count: `18`
- API status summary: `online=17`, `warning=1`
- API averages: CPU `31`, Memory `44`, Disk `37`
- Top resource warnings:
  - `db-mysql-dc1-backup` DISK `72`
  - `db-mysql-dc1-primary` DISK `66`
  - `storage-nfs-dc1-02` DISK `59.4`

Result: pass. Dashboard summary and system resource averages now match the full 18-server source instead of the default 10-item paginated API response.

## Usage

- Vercel usage check: pass
- Current period effective usage: `13.3467 USD`
- Billed usage: `0.0000 USD`
- Charge count: `11571`

## Remaining Scope

This was a targeted visual/state QA for the landing title and dashboard server-status surfaces. AI Assistant conversational QA was not rerun because the code change did not alter prompt routing, model behavior, stream contracts, or provider selection.
