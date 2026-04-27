# Vercel AI Assistant Playwright MCP Real Chat QA

- Date: 2026-04-27 KST
- Target: https://openmanager-ai.vercel.app
- Version: 8.11.36
- Vercel deployment id: dpl_9Ni1cic8moLhSj3YXfhkLrDDkNkp
- Vercel deployment URL: https://openmanager-irdlojag9-skyasus-projects.vercel.app
- Release commit: 0fe7179de3877bd11dcfb21d6ac58d24b1bfc045

## Commands

Production API checks:

```bash
curl -sS https://openmanager-ai.vercel.app/api/version
curl -sS https://openmanager-ai.vercel.app/api/health
```

Playwright MCP production QA:

```text
Browser automation: next-devtools Playwright MCP
Route: /login -> guest PIN login -> /dashboard
AI path: dashboard AI sidebar -> starter prompt -> direct prompt
```

Playwright CLI regression guard:

```bash
source scripts/mcp/run-with-project-env.sh
export PLAYWRIGHT_SKIP_SERVER=1
export PLAYWRIGHT_BASE_URL=https://openmanager-ai.vercel.app
export PLAYWRIGHT_GUEST_PIN=<redacted>
export PLAYWRIGHT_HEADLESS=true
export PLAYWRIGHT_HTML_REPORT=0
export PLAYWRIGHT_WORKERS=1
export PLAYWRIGHT_TIMEOUT=180000
npx playwright test tests/e2e/dashboard-ai-chat.spec.ts --config playwright.config.ts --project=chromium --reporter=line
```

Vercel usage check:

```bash
npm run check:usage:vercel
```

## MCP Result

- `/api/version`: production, Next.js 16.1.6, version 8.11.36
- `/api/health`: healthy; database, cache, and AI paths connected
- Guest PIN login reached authenticated dashboard in 2002ms
- Dashboard snapshot: total 18, online 17, warning 1, critical 0, offline 0
- Dashboard navigation performance: DOMContentLoaded 166ms, load 413ms, initial document response 118ms
- AI sidebar opened in 252ms
- Starter prompt flow:
  - Input: `현재 모든 서버의 상태를 요약해줘`
  - First meaningful AI response: 3042ms
  - `/api/ai/supervisor/stream/v2`: 2932ms, 7966 transfer bytes, 7666 encoded body bytes
  - Response matched dashboard counts: total 18, normal/online 17, warning 1, critical 0, offline 0
- Direct message flow:
  - Input: `현재 모든 서버의 상태를 요약해줘`
  - First meaningful AI response: 2522ms
  - `/api/ai/supervisor/stream/v2`: 2377ms, 7966 transfer bytes, 7666 encoded body bytes
  - Response matched dashboard counts: total 18, normal/online 17, warning 1, critical 0, offline 0
- Tool menu opened and exposed RAG search, Web search, response mode, deep analysis, and file attachment controls
- Browser console: 0 errors, 0 warnings
- Screenshot: `reports/qa/evidence/qa-20260427-vercel-ai-assistant-mcp-chat.png`
- Playwright CLI guard: 2/2 tests passed in 1.7 minutes
  - `AI 대시보드 채팅 연동 > 스타터 프롬프트 클릭 → 메시지 전송 → AI 응답 수신`
  - `AI 대시보드 채팅 연동 > 직접 메시지 입력 → 전송 → AI 응답 수신`
- Vercel usage: checked by CLI; effective 17.0653 USD, billed 0.0000 USD, chargeCount 15225

## Notes

- Guest PIN value was sourced from local environment and intentionally not recorded.
- Playwright MCP browser automation was used for the final manual QA pass. The CLI E2E was kept as a deterministic regression guard for the same AI assistant chat path.
