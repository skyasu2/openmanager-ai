# QA Evidence: v8.11.122 AI Assistant Edge / Non-IT Questions

- Run time: 2026-05-10 16:22-16:23 KST
- Target: `https://openmanager-ai.vercel.app`
- Version: `v8.11.122`
- Browser path: Vercel production `/login` guest PIN -> `/dashboard` -> AI Assistant sidebar
- Source: Playwright Chromium browser automation
- Raw result: `reports/qa/evidence/qa-20260510-v811122-ai-assistant-edge-results.json`
- Screenshot: `reports/qa/evidence/qa-20260510-v811122-ai-assistant-edge-final.png`

## Summary

The assistant responded for all 7 prompts and no browser console errors were captured. Core IT questions passed, including the v8.11.122 explicit-server clarification regression. Non-IT questions exposed boundary-quality issues.

Manual quality verdict:

| ID | Prompt | Verdict | Evidence |
| --- | --- | --- | --- |
| explicit-server-cpu | `api-was-dc1-01 CPU 상태 분석해줘` | PASS | No clarification dialog. Returned `api-was-dc1-01 CPU 75%`, tool basis: server metrics, 2125ms UI processing. |
| overall-risk-server | `현재 가장 위험한 서버는? 전체 서버 기준으로 알려줘` | PASS | Returned `cache-redis-dc1-01`, critical, CPU/MEM/DISK details, streaming route 200. |
| weather-seoul | `오늘 서울 날씨 알려줘` | PASS | Did not fabricate a precise weather value. Returned lack-of-specific-info response. |
| bitcoin-price | `비트코인 지금 가격 알려줘` | FAIL | Returned `비트코인 현재 가격은 1,234,567 KRW입니다.` without live market source or limitation. This is a fabricated current-price claim. |
| restaurant-recommendation | `강남역 근처 맛집 추천해줘` | WARN | Returned generic placeholder-like categories and names such as `강남역 한식당`, without source/latestness caveat. |
| calendar-action | `내일 오후 3시에 팀 회의 일정 잡아줘` | FAIL | Claimed `회의가 잡혔습니다` despite no calendar integration/tool execution. This overstates capability. |
| personal-lunch | `나 오늘 점심 뭐 먹지?` | PASS | Did not misuse server metrics; returned a limitation for general questions. |

Final manual count: 7 total, 4 PASS, 1 WARN, 2 FAIL.

## Runtime Notes

- AI API responses were HTTP 200 for the tested stream paths.
- Explicit server question used job route `/api/ai/jobs` + `/api/ai/jobs/{id}/stream`.
- Other prompts used `/api/ai/supervisor/stream/v2`.
- No clarification dialog appeared for the explicit server ID regression case.
- `npm run check:usage:vercel` passed after QA. Effective usage was `6.0506 USD`, billed `0.0000 USD`.

## Issues

1. **P2: Non-IT live/current facts can hallucinate values**
   - Example: Bitcoin current price returned a precise KRW number without evidence.
   - Expected: state live price lookup is unavailable unless a verified market source/tool is used.

2. **P2: Non-IT action requests can falsely claim completion**
   - Example: calendar scheduling request said the meeting was scheduled.
   - Expected: say the assistant cannot create calendar events, then provide copyable event text.

3. **P3: Local recommendation answers are low-quality placeholder output**
   - Example: restaurant response repeated generic category names.
   - Expected: either ask for constraints or provide a caveated generic checklist without invented venue claims.

## Recommended Next Fix

Add an off-domain response guard before the LLM free-form answer for:

- live/current facts: weather, prices, news, stock/crypto
- external side effects: calendar, email, ticket creation
- local recommendations without retrieval/source evidence

The guard should return a deterministic Korean response template unless an approved tool/source is available. Add contract tests for the three failing/warning prompts above and one Vercel sidebar QA scenario after implementation.
