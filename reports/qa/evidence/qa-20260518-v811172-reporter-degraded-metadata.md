# v8.11.172 Reporter Degraded Metadata Production Verification

- Checked at: 2026-05-18 15:24 KST
- Frontend: Vercel production `https://openmanager-ai.vercel.app`
- Backend: Cloud Run `ai-engine`
- Release tag: `v8.11.172`
- Release pipeline: `2532907618`
- Commit: `2aec191db87e94fa7060200a78e68447a460d0f9`

## Results

- GitLab tag pipeline `2532907618` completed successfully.
- Vercel `/api/version` returned `8.11.172`, release tag `v8.11.172`, and commit `2aec191db87e94fa7060200a78e68447a460d0f9`.
- Cloud Run `ai-engine` latest ready revision is `ai-engine-00484-q2s` with 100% traffic and `BUILD_SHA=2aec191d`.
- Direct Cloud Run `/api/ai/incident-report` returned `success:true`, source `Reporter Agent + Tool Data (Hybrid)`, title `API 서버 CPU 과부하 경고`, and duration `_durationMs=2086`.
- The production Reporter call used the normal Reporter path, so `degraded`, `fallbackSource`, and `fallbackReasonCode` were absent as expected.
- The degraded-success metadata path is covered by local/unit regression tests:
  - `cloud-run/ai-engine/src/routes/analytics.test.ts`
  - `src/app/api/ai/incident-report/route.test.ts`
  - `src/lib/ai/chat-artifacts/incident-report-artifact.test.ts`
  - `src/components/ai/ArtifactCards.test.tsx`

## Notes

- The initial release script smoke timed out while the tag deploy pipeline was waiting behind the release commit's `main` validate pipeline. The tag pipeline later completed successfully.
- No frontend fallback header was involved in the direct Cloud Run Reporter smoke.
