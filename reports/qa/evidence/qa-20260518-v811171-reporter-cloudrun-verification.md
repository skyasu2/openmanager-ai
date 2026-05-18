# v8.11.171 Reporter / Cloud Run Verification

- Target: Vercel production `https://openmanager-ai.vercel.app`
- Frontend version: `8.11.171`
- Frontend deployment: `dpl_6vJBFjs5zyp5P3TtaVWoP7hskWFi`
- Release pipeline: GitLab `2532578122`
- Cloud Run revision: `ai-engine-00483-42j`
- Cloud Run build SHA label: `eace7809`

## Checks

- GitLab release pipeline completed successfully for `v8.11.171`.
- Vercel `/api/version` returned `8.11.171` with commit `eace78090f6b717441a1d7a30eea5ad01d49341c`.
- Cloud Run service `ai-engine` was Ready and routed 100% traffic to `ai-engine-00483-42j`.
- Direct Cloud Run `/api/ai/incident-report` returned HTTP 200 with `success:true`, source `Reporter Agent + Tool Data (Hybrid)`, and report title `Redis 서버 메모리 경고 및 슬로우 쿼리 감지`.
- Authenticated Vercel `/api/ai/incident-report` returned HTTP 200 with `success:true`, `x-ai-source: cloud-run`, no frontend fallback headers, and a report artifact.
- Dashboard AI status indicator refreshed to `AI 엔진 상태: Ready` with `129ms`.
- Vercel usage check completed: effective `$10.7667`, billed `$0.0000`.

## Notes

The authenticated Vercel Reporter request still observed a provider parse drift inside Cloud Run, but Cloud Run absorbed it with the tool-based Reporter fallback and returned a successful report. This is expected after the v8.11.171 hardening and is distinct from the previous frontend fallback failure.
