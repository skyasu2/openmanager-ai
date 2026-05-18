# QA Evidence: v8.11.173 Today Reporter Change Check

- Date: 2026-05-18 21:22 KST
- Target: Vercel production `https://openmanager-ai.vercel.app`
- Release: `v8.11.173`
- Commit: `cdbec15ab4f6d567049c8149ad94470813176c7f`
- Vercel deployment: `dpl_EWpPNaJ7EXfkPKngFjwZTpo5mAqy`
- Deployment URL: `https://openmanager-cxyz6razc-skyasus-projects.vercel.app`
- GitLab pipeline: `2533982020`

## Scope

This run rechecked the Reporter changes made today on the live Vercel production deployment with Playwright MCP. It focused on the user-visible Reporter incident path, detail expansion, generated postmortem timeline, and production API status.

## Playwright MCP Flow

1. Navigated to `/`.
2. Confirmed the deployed app version badge `v8.11.173`.
3. Opened `/dashboard` from the landing CTA.
4. Confirmed dashboard OpenTelemetry snapshot `21:10 KST (slot 127/143)`.
5. Opened the AI assistant sidebar and confirmed `AI 엔진 상태: Ready`.
6. Switched to `자동장애 보고서`.
7. Generated an incident report with the prompt `현재 임계치 초과 서버와 조치 우선순위 정리`.
8. Opened report detail with `상세보기`.
9. Captured full-page screenshot: `reports/qa/evidence/qa-20260518-v811173-today-reporter-mcp.png`.

## Observed UI State

- Dashboard totals: `18` total, `17` online, `0` warning, `1` risk, `0` offline.
- Top resource warnings:
  - `lb-haproxy-dc1-01 CPU 85%`
  - `db-mysql-dc1-backup DISK 70%`
  - `api-was-dc1-01 CPU 64%`
  - `api-was-dc1-02 CPU 62%`
  - `db-mysql-dc1-primary MEM 59%`
- Reporter generated one active warning report:
  - Title: `lb-haproxy-dc1-01 서버의 CPU 과부하`
  - Cause: `서버의 CPU 과부하로 인한 성능 저하`
  - Impact: `주의 0대 · 위험 1대`
  - Next action: `서버 리소스 업그레이드`
  - Affected server: `lb-haproxy-dc1-01`
- Detail view showed:
  - Detected anomaly: `lb-haproxy-dc1-01 - Cpu`, `85%`
  - Recommended actions: `서버 리소스 업그레이드 (high)`, `로드 밸런싱 조정 (medium)`
  - Pattern: `서버 자원 과부하 패턴`
  - Postmortem timeline:
    - `2026-05-18T12:10:00.000Z - lb-haproxy-dc1-01 서버 CPU 85% 초과`
    - `2026-05-18T12:10:00.000Z - lb-haproxy-dc1-01 서버 네트워크 86.3% 초과`

## Network Checks

Playwright MCP network log for `/api/` routes:

- `HEAD /api/system` -> `200`
- `GET /api/system` -> `200`
- `POST /api/ai/wake-up` -> `200`
- `GET /api/monitoring/report` -> `200`
- `GET /api/health?service=ai&soft=true` -> `200`
- `POST /api/ai/incident-report` -> `200`

## Usage Check

- `npm run check:usage:vercel` completed successfully.
- Current billing period: `2026-05-01T07:00:00.000Z..2026-05-18T12:21:57.677Z`
- Effective: `$11.4422`
- Billed: `$0.0000`
- Charge count: `10353`

## Scope Notes

- This production run exercised the live incident path, including detailed postmortem rendering.
- The live production snapshot did not include a disk metric above the production critical threshold, so the disk-threshold timeline regression remains covered by the committed local tests and the previous release QA evidence.
- The standard five-question conversational AI suite was not repeated for this targeted recheck; the changed Reporter UI/API surface was covered directly.
