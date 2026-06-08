# QA Evidence - v8.12.117 System Boot Browser Smoke

Recorded: 2026-06-08 15:17 KST

## Scope

Targeted production browser smoke for the restored `/system-boot` loading page.

## Evidence

- Target: `https://openmanager-ai.vercel.app`
- Production version visible during the login/landing flow: `v8.12.117`
- Auth state: guest session created with `auth_session_id` and `guest_auth_proof` cookies.
- Browser session injected fresh `openmanager:system-boot:intent` payload and navigated to `/system-boot`.
- After 1.8 seconds, the page stayed on `https://openmanager-ai.vercel.app/system-boot`.
- Visible boot stage matched `AI 엔드포인트 웜업`.
- The page did not skip directly to `/dashboard`.
- Browser console error count was `0`.
- Vercel usage recheck passed after the smoke: effective `3.8906 USD`, billed `0.0000 USD`.

## Playwright Result

```json
{
  "ok": true,
  "urlAfter1800": "https://openmanager-ai.vercel.app/system-boot",
  "hasBootStage": true,
  "skippedToDashboard": false,
  "visibleStageSnippet": "AI 엔드포인트 웜업",
  "consoleErrors": []
}
```

## Result

The production boot loading page renders again when a fresh system-start boot intent is present, even while the system is already active.
