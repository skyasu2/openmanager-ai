# AI Sidebar Crash Repro - 2026-04-08

## Purpose

- This archive stores post-mortem repro evidence for the pre-fix AI sidebar crash.
- It is not a counted QA run artifact and must not be treated as release-gate evidence.

## Context

- Related failing run: [QA-20260407-0249](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260407-0249.json)
- Related fix verification run: [QA-20260408-0252](/mnt/d/dev/openmanager-ai/reports/qa/runs/2026/qa-run-QA-20260408-0252.json)
- Fixed by commit `7e86978c0`

## Archived Files

- [qa-20260408-alert-prefill-console.txt](/mnt/d/dev/openmanager-ai/reports/qa/repro/2026/qa-20260408-alert-prefill-console.txt)
  - Browser console captured the pre-fix `Cannot read properties of undefined (reading 'bg')` crash.
- [qa-20260408-alert-prefill-network.txt](/mnt/d/dev/openmanager-ai/reports/qa/repro/2026/qa-20260408-alert-prefill-network.txt)
  - Network trace captured the corresponding pre-fix `POST /api/ai/supervisor/stream/v2 => 200` path.

## Retention Rule

- Keep repro archives only when they materially support post-mortem or regression analysis.
- Do not place these files back under `reports/qa/evidence/` unless they are linked from a run JSON `artifacts` field.
