# QA-20260519-0533 v8.11.178 AI Content Fidelity Evidence

- Target: `https://openmanager-ai.vercel.app`
- Deployment: `dpl_FjCHCyinMqvvzeNR2THJtcUCzRZ1`
- Release: `v8.11.178`
- Production commit: `5801a008e37f60d2159b5bac1399a598614142db`
- Recorded at: `2026-05-19 11:49:58 KST`

## Findings

- NLQ response path passed: requests were served by Cloud Run direct stream path (`x-ai-source: cloud-run`, `x-backend: cloud-run-stream-v2`), with no Vercel fallback observed.
- Fresh page data parity passed: AI values `82% / 73% / 39%` matched dashboard values `82.0% / 73.0% / 39.0%`.
- Long-session data parity warning: `aiQueryAsOfDataSlot` can remain pinned to the SSR slot while the dashboard advances, producing stale-session mismatch such as AI `94%` vs dashboard `82%`.
- Anomaly signal strength warning: snapshot anomaly/trend UI used a static `confidence: 0.9`, so CPU `82%` and CPU `96%` both rendered as `90%` signal strength.

## Disposition

- `aiQueryAsOfDataSlot` long-session freeze is a WONT-FIX candidate unless live per-session slot resync becomes a product requirement.
- Full real-time dashboard/AI slot synchronization is a WONT-FIX candidate for the current portfolio/free-tier scope.
- Static anomaly confidence is an implementation quality issue and should be fixed with metric severity and threshold-distance based signal strength.

## Usage

- `npm run check:usage:vercel` passed at `2026-05-19T03:38:31.578Z`.
- Current billing period effective usage remained `$11.4422`, billed usage `$0.0000`.
