# AI Slot Provenance Targeted E2E Evidence

- Date: 2026-04-24 19:53 KST
- Target: Vercel production, `https://openmanager-ai.vercel.app`
- Scope: targeted AI parity validation, not a broad UI/UX sweep
- Preconditions: `npm run check:usage:vercel` passed with `effective=15.7313 USD`, `billed=0.0000 USD`, `chargeCount=14007`

## Command

```bash
PLAYWRIGHT_SKIP_SERVER=1 PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app PLAYWRIGHT_GUEST_PIN=4231 PLAYWRIGHT_HEADLESS=true PLAYWRIGHT_HTML_REPORT=0 PLAYWRIGHT_WORKERS=1 npx playwright test tests/e2e/dashboard-ai-chat.spec.ts --config playwright.config.ts
```

## Result

```text
Running 2 tests using 1 worker
✓ AI 채팅 E2E 테스트 › 스타터 프롬프트 클릭 → 메시지 전송 → AI 응답 수신 (32.1s)
✓ AI 채팅 E2E 테스트 › 직접 메시지 입력 → 전송 → AI 응답 수신 (29.4s)
2 passed (1.4m)
```

## Data Provenance Path

- `parseDashboardStatusSnapshot()` now preserves dashboard metadata such as `Synthetic OTel snapshot` and `16:00 KST` as `dataSource` and `dataSlot`.
- `formatDashboardStatusSnapshot()` includes `source=` and `slot=` in the parity assertion evidence string.
- Both starter prompt and direct prompt E2E flows compare the AI response counts with the dashboard snapshot captured before prompt submission.
- Unit coverage confirms the production-style text `Synthetic OTel snapshot · 16:00 KST` is parsed into structured slot/source metadata.

## Exclusions

- This run did not repeat the broad frontend UI/UX modal sweep already covered by `QA-20260424-0346` and `QA-20260424-0347`.
- Product runtime behavior was not changed; this validates the QA evidence and parity guard path against production.
