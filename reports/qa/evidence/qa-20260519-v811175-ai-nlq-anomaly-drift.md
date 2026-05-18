# QA-20260519 Vercel Playwright MCP Notes

Target: Vercel production `https://openmanager-ai.vercel.app`

Deployment:
- Vercel deployment: `dpl_C8eLVUEdzSPMY83AwFUezu7ybd8V`
- Production version: `v8.11.175`
- Production commit: `7da68ac4a1772efbe83ee7760f77affe4396cf46`
- Local HEAD during QA: `73281f363f02` with unstaged changes

Scope:
- Deployment identity and `/api/version`
- `/dashboard` render
- AI Assistant sidebar
- Standard conversational AI five-question suite
- AI Assistant `이상감지/추세` tab
- Network and console sanity check
- Vercel usage CLI check

Results:
- Dashboard rendered 18-server OTel snapshot at 04:00 KST, slot 24/143.
- AI engine health indicator was `Ready`.
- Standard questions 1-4 passed with grounded server counts, server alias resolution, load1 peak, and immediate-action/no-critical distinction.
- Standard question 5 failed: `방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘` returned the generic full-system summary instead of filtering network-related servers from the prior context.
- `이상감지/추세` tab rendered and detected two disk warning servers, but the production UI still displays `신뢰도 90%` labels.
- Browser console warnings/errors: 0.
- Network API calls observed: `/api/ai/wake-up`, `/api/health?service=ai&soft=true`, `/api/ai/supervisor/stream/v2`, `/api/ai/nlq/extract-entities`, `/api/ai/jobs`, `/api/ai/intelligent-monitoring`.

Operator note:
- This QA run does not prove today's local changes on Vercel because production is still on `7da68ac4a1`, while the local workspace is `73281f363f02` plus uncommitted changes.
