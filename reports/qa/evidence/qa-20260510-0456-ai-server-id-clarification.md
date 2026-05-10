# QA-20260510-0456 AI Server ID Clarification Evidence

- Commit: 567f496bd33913fd2b88842a4e1ac7f8026812e1
- Pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2513341064
- Target query: `api-was-dc1-01 CPU 상태 분석해줘`

## Fixed Behavior

- Actual OpenManager server IDs are now detected through `src/config/server-registry.ts`.
- `api-was-dc1-01` and `db-mysql-dc1-primary` skip the server-scope clarification UI.
- The query classifier treats registered server IDs as explicit scope signals and raises confidence above the clarification threshold.

## Validation

- `npx vitest run src/lib/ai/clarification-generator.test.ts src/lib/ai/query-classifier.test.ts`: 82/82 passed
- `npm run type-check`: passed
- `npm run lint`: passed, existing `qa-tracker.json` size info only
- `npm run test:quick`: passed
- `npm run test:contract`: 24/24 passed
- `git diff --check`: passed
- GitLab pipeline `2513341064`: success
