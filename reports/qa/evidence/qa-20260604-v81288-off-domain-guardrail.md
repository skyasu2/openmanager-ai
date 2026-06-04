# QA Evidence - v8.12.88 Off-Domain Guardrail Targeted Production Check

Date: 2026-06-04 KST

## Target

- Production URL: https://openmanager-ai.vercel.app
- Release tag: `v8.12.88`
- Commit: `3b91b069d547cf226c58bce153c94bcafdf714ef`
- GitLab pipeline: https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2564039473
- Vercel deployment: `dpl_4ouyrzWwdYJ3FcedNZcrp2pesDN3`
- Vercel deployment URL: https://openmanager-rl93ky6vm-skyasus-projects.vercel.app
- Cloud Run service URL: https://ai-engine-jdhrhws7ia-an.a.run.app

## Runtime State

- `GET https://openmanager-ai.vercel.app/api/version`
  - version: `8.12.88`
  - releaseTag: `v8.12.88`
  - commitSha: `3b91b069d547cf226c58bce153c94bcafdf714ef`
  - pipelineUrl: `https://gitlab.com/skyasu2/openmanager-ai/-/pipelines/2564039473`
- `GET https://ai-engine-jdhrhws7ia-an.a.run.app/health`
  - status: `ok`
  - version: `8.12.88`
  - routesReady: `true`
  - config: `groq=true`, `mistral=true`, `zai=true`, `cerebras=true`, `gemini=true`, `tavily=true`, `cloudRunApi=true`

## Off-Domain Guardrail Checks

Cloud Run direct supervisor route:

```text
POST /api/ai/supervisor
Headers: X-API-Key present, Content-Type application/json
```

### Live/current fact block

- Query: `오늘 서울 날씨 알려줘`
- Result: pass
- Response includes: `실시간 외부 조회 도구가 연결되어 있지 않아`
- Metadata:
  - provider: `deterministic`
  - modelId: `off-domain-guard`
  - usage.totalTokens: `0`
  - offDomainAction: `block`
  - offDomainCategory: `live_fact`

### General coding warn

- Query: `파이썬 피보나치 코드 짜줘`
- Result: pass
- Behavior: LLM answered best-effort, then appended off-domain warning suffix.
- Response includes: `서버 모니터링 외 질문으로 답변 정확도가 낮을 수 있습니다.`
- Metadata:
  - provider: `groq`
  - modelId: `meta-llama/llama-4-scout-17b-16e-instruct`
  - toolsCalled: `finalAnswer`
  - durationMs: `1025`

### Operational-context exception

- Query: `nginx 로그 파싱 스크립트 만들어줘`
- Result: pass
- Behavior: no off-domain warning; request routed to operational command guidance.
- Response includes: `/var/log/nginx/access.log`
- Metadata:
  - provider: `mistral`
  - finalAgent: `Advisor Agent`
  - handoff: `Direct Router -> Advisor Agent`

## Usage Guard

Command:

```bash
npm run check:usage:vercel
```

Result:

- Billing context: `skyasus-projects`
- Period: `2026-06-01T07:00:00.000Z..2026-06-04T14:07:59.658Z`
- Effective: `1.9358 USD`
- Billed: `0.0000 USD`
- Charge count: `1827`
- Status: PASS via `vercel usage --format json --non-interactive`

## Notes

- This was a targeted release-facing guardrail check for the v8.12.88 AI Engine change, not a broad browser matrix.
- Standard five-question conversational AI QA was not rerun because the changed behavior is off-domain boundary handling, and the tested representative prompts cover block, warn, and operational-context exception branches.
- Vision real-image QA was not in scope because Vision routing/provider behavior did not change.
- Non-blocking observability gap: warn-path responses append the user-visible warning, but the non-stream metadata does not currently expose `offDomainAction=warn`.
