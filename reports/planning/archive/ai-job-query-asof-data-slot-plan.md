# AI Job Query As-Of Data Slot Plan

Status: Completed
Owner: project
Created: 2026-04-29

## Problem

Async AI jobs can execute after the dashboard data slot has advanced. If server metric tools resolve "current" from worker execution time, the answer can drift from the data the user saw when the question was submitted.

## Contract

- `POST /api/ai/jobs` computes a server-owned `queryAsOf` snapshot at job creation time.
- `queryAsOf.dataSlot` contains `slotIndex`, `minuteOfDay`, and `timeLabel` for the same KST 10-minute OTel slot used by the dashboard.
- Vercel stores `queryAsOf` in job metadata and forwards it to the Cloud Run worker payload.
- Cloud Run validates `queryAsOf`, passes it to `executeSupervisorStream`, and runs metric tools inside a query-as-of execution context.
- Server metric tools use the query-as-of slot for "current" and range-relative lookups; cache keys include the slot where slot-sensitive.

## Tests

- Root job route test verifies Redis metadata and worker payload include `queryAsOf`.
- Cloud Run job route test verifies `queryAsOf` reaches supervisor and stored metadata.
- Server metrics test verifies query-as-of context selects the requested slot and cache key.

## Verification

- `npx vitest run src/app/api/ai/jobs/route.trigger.test.ts`
- `cd cloud-run/ai-engine && npx vitest run src/routes/jobs.test.ts src/tools-ai-sdk/server-metrics.test.ts`
- `cd cloud-run/ai-engine && npm run type-check`
- `npm run type-check`
