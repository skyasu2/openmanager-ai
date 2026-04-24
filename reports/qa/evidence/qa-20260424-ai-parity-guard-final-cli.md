# Production AI Parity Guard Final CLI QA - 2026-04-24

Target: https://openmanager-ai.vercel.app
Environment: Vercel production frontend + Cloud Run AI backend
Command: `PLAYWRIGHT_SKIP_SERVER=1 PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_HEADLESS=true PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-ai-chat.spec.ts --config playwright.config.ts`

## Result

- `tests/e2e/dashboard-ai-chat.spec.ts`: 2 passed in 1.3m
- Starter prompt flow passed dashboard status parity assertion.
- Direct current-state query flow passed dashboard status parity assertion.
- Response detection now accepts dynamic `전체 <count>대` totals instead of the legacy hard-coded `전체 15대` marker.
- The local test helper rejects numeric prefix false positives such as matching `위험 1` against `위험 10대`.
- The local test helper rejects embedded label false positives such as matching `정상` inside `비정상`.
- New conversation extraction only removes previous history when the previous log is a prefix of the current log.

## Scope

- Covered: dashboard status snapshot parsing, AI sidebar starter prompt, direct AI current-state query, restored history isolation, exact-count/label-boundary matcher behavior.
- Skipped: Reporter/Analyst advanced flows, mobile viewport, OAuth provider completion, direct Cloud Run admin endpoints.
