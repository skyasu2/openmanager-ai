# v8.11.189 KRL AI Closure Evidence

- Date: 2026-05-20 21:48 KST
- Target: https://openmanager-ai.vercel.app/dashboard
- Release: v8.11.189
- Release commit: 41c9bb7ffb903768f0e5df3de4bad8526808c1d3
- Tag pipeline: 2540461831 success
- Production /api/version: 8.11.189

## Prompt 1

Prompt:

`Vercel BFF와 Cloud Run AI Engine 책임 경계를 알려줘. KRL 근거가 있으면 함께 알려줘.`

Result:

- Answer used internal knowledge search / KRL evidence.
- Visible response included Vercel BFF and Cloud Run AI Engine responsibility boundary.
- Metadata showed `지식 근거 검색 (5건)` and `도구: 내부 지식 검색 · 모드: 오토`.
- No visible raw tool-call markers, `Nothing to process.`, or reasoning JSON.

## Prompt 2

Prompt:

`OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.`

Result:

- Answer used internal knowledge search / KRL evidence instead of `monitoring-server-health` current status summary.
- Visible response included OTel SSOT evidence and `pre-generated OTel data slot`.
- Visible response included `OTel 상태 판단 기준`.
- Visible response included 18-server inventory basis and P0/P1/P2/P3/P4/P99 status rules:
  - P0 offline
  - P1/P2 critical
  - P3/P4 warning
  - P99 online
- No visible raw tool-call markers, `Nothing to process.`, or reasoning JSON.

## Programmatic Checks

Prompt 2 DOM check returned:

- `hasOTelSSOT: true`
- `hasStatusCriteria: true`
- `has18Inventory: true`
- `hasKnowledge: true`
- `hasMonitoringOnly: false`
- `hasToolBegin: false`
- `hasToolEnd: false`
- `hasNothing: false`
- `hasReasoningJson: false`

## Artifacts

- `reports/qa/evidence/qa-20260520-v811189-krl-ai-pass.png`
- `reports/qa/evidence/qa-20260520-v811189-krl-ai-status-criteria-pass.png`
